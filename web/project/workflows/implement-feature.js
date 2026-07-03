export const meta = {
  name: "implement-feature",
  description: "design → logic → connect-api 파이프라인을 단계별 checker 게이트와 함께 실행",
  whenToUse:
    "피그마 디자인 URL + 기능정의서 + API 명세가 모두 준비된 기능을 무인 파이프라인으로 구현할 때. 자료가 일부만 있으면 해당 단계까지만 실행됨.",
  phases: [
    { title: "Design", detail: "/design 절차로 UI 구현" },
    { title: "Gate:Design", detail: "checker 판정 + 스모크 검증" },
    { title: "Logic", detail: "/logic 절차로 동작 구현" },
    { title: "Gate:Logic", detail: "checker 판정 (tsc·vitest 포함)" },
    { title: "ConnectApi", detail: "/connect-api 절차로 API 연결" },
    { title: "Gate:Api", detail: "checker 판정 + 전체 플로우 확인" },
  ],
};

// args: {
//   domain: string            — feature 도메인명 (필수)
//   designUrls?: string[]     — Figma 디자인 URL들 (있으면 Design 단계 실행)
//   logicUrl?: string         — Figma 디스크립션 URL 또는 기능정의서 링크/내용
//   apiSpec?: string          — API 명세 (엔드포인트/메서드/타입)
//   page?: string             — 검증할 페이지 경로 (예: /members)
// }
if (!args || !args.domain) throw new Error("args.domain은 필수다 (feature 도메인명)");

const MAX_FIX_ROUNDS = 3; // review-and-fix.js의 MAX_ROUNDS와 통일

const MAKER_RESULT = {
  type: "object",
  properties: {
    done: { type: "boolean" },
    summary: { type: "string" },
    changedFiles: { type: "array", items: { type: "string" } },
    openQuestions: { type: "array", items: { type: "string" } },
  },
  required: ["done", "summary", "changedFiles", "openQuestions"],
};

const VERDICT = {
  type: "object",
  properties: {
    pass: { type: "boolean" },
    failures: { type: "array", items: { type: "string" } },
  },
  required: ["pass", "failures"],
};

// 런타임 스모크 결과 — checker는 브라우저를 못 띄우므로 이 결과로 런타임/Playwright 항목을 판정한다
const SMOKE_RESULT = {
  type: "object",
  properties: {
    ran: { type: "boolean" },
    pass: { type: "boolean" },
    render: { type: "boolean" },
    consoleErrors: { type: "array", items: { type: "string" } },
    networkFailures: { type: "array", items: { type: "string" } },
    note: { type: "string" },
  },
  required: ["ran", "pass"],
};

// fix 라운드 산출물 — 다음 라운드 checker/fix에 맥락으로 전달 (현재는 폐기되던 것)
const FIX_RESULT = {
  type: "object",
  properties: {
    summary: { type: "string" },
    disputed: { type: "array", items: { type: "string" } },
  },
  required: ["summary"],
};

const UNATTENDED_NOTE =
  "지금은 무인 파이프라인이므로 사용자에게 질문할 수 없다. 커맨드 문서에 '사용자에게 질문'하라고 된 상황(추측 금지 값, 확인 불가 항목)을 만나면 " +
  "그 항목을 구현하지 말고 openQuestions 배열에 담아 반환해라. 절대 추측으로 채우지 마라.";

// 단계 실행 + checker 게이트 공통 루틴
// priorContext: 직전 단계들의 산출물 요약 — cross-review(maker 수평 소통)용. 단계 간 인터페이스 충돌 방지.
const runStage = async (stageName, gateName, makerPrompt, dodSource, priorContext) => {
  phase(stageName);
  const fullMakerPrompt =
    makerPrompt +
    (priorContext
      ? `\n\n[직전 단계 산출물 — 인터페이스 일관성을 맞춰라]\n${priorContext}\n` +
        `위 컴포넌트 props/타입·훅/스토어 시그니처와 충돌하지 않게 구현해라. 충돌이 불가피하면 임의로 바꾸지 말고 openQuestions로 보고해라.`
      : "");
  const result = await agent(fullMakerPrompt, {
    label: `maker:${stageName.toLowerCase()}`,
    phase: stageName,
    schema: MAKER_RESULT,
  });
  if (!result) return { ok: false, reason: `${stageName} maker 에이전트 실패`, openQuestions: [] };
  if (result.openQuestions && result.openQuestions.length > 0) {
    return {
      ok: false,
      reason: `${stageName} 단계에서 사용자 답변 필요`,
      openQuestions: result.openQuestions,
      summary: result.summary,
    };
  }

  phase(gateName);

  // 런타임 스모크 — checker가 못 하는 렌더/콘솔/4xx 검증을 smoke 에이전트가 대신 수행해 결과를 checker에 넘긴다
  let smoke = null;
  if (args.page) {
    smoke = await agent(
      `.claude/commands/verify-smoke.md 절차로 ${args.page} 페이지를 스모크 검증해라. ` +
        `dev 서버가 안 떠 있으면 임의로 띄우지 말고 ran:false로 반환해라. 렌더/콘솔에러/네트워크실패를 ran·pass·render·consoleErrors·networkFailures로 반환.`,
      { label: `smoke:${stageName.toLowerCase()}`, phase: gateName, schema: SMOKE_RESULT, agentType: "smoke" }
    );
    if (smoke) log(`${gateName} smoke: ${smoke.ran ? (smoke.pass ? "PASS" : "FAIL") : "미실행(dev 서버 없음)"}`);
  }
  const smokeNote = smoke
    ? `\n\n[런타임 스모크 결과] 너는 브라우저를 직접 못 띄우니, DoD의 런타임/Playwright 항목은 아래 스모크 결과를 근거로 판정해라(ran:false면 '확인 불가→FAIL'): ${JSON.stringify(smoke)}`
    : `\n\n[스모크 미수행] page 인자가 없어 런타임 검증을 못 했다. DoD의 런타임 전용 항목은 '확인 불가→FAIL'로 처리해라.`;

  let verdict = null;
  let lastFix = null;
  for (let round = 1; round <= MAX_FIX_ROUNDS + 1; round++) {
    const fixNote = lastFix
      ? `\n\n[직전 라운드 수정 요약] ${lastFix.summary}` +
        (lastFix.disputed && lastFix.disputed.length
          ? `\n[수정자가 '지적이 잘못됐다'고 본 항목] ${JSON.stringify(lastFix.disputed)}`
          : "")
      : "";
    verdict = await agent(
      `${dodSource}의 "Definition of Done" 섹션을 Read로 읽고 그 항목들을 판정해라. ` +
        `변경 파일 목록은 maker 신고를 믿지 말고 \`git status --porcelain\`(추적+미추적, node_modules 제외)로 직접 산출해서 그 파일들을 읽고 판정해라. ` +
        `검증 명령(npm run type-check, npx eslint, npx vitest run 등)은 직접 실행해서 확인해라.${smokeNote}${fixNote}\n\npass와 failures를 반환해라.`,
      { label: `gate:${stageName.toLowerCase()}:r${round}`, phase: gateName, schema: VERDICT, agentType: "checker" }
    );
    if (verdict && verdict.pass) break;
    if (round > MAX_FIX_ROUNDS) break;
    // verdict null(checker 무응답)이어도 무한 FAIL로 죽지 않게 명시 처리
    const failuresText =
      verdict && Array.isArray(verdict.failures) && verdict.failures.length
        ? verdict.failures
        : ["checker가 판정 항목을 반환하지 못함 — 변경 전체를 다시 점검해 DoD 위반·명백한 결함을 찾아 수정하라."];
    log(`${gateName} FAIL (라운드 ${round}) — 수정 시도`);
    lastFix = await agent(
      `checker가 FAIL 판정한 항목을 수정해라 (maker 역할). ${UNATTENDED_NOTE}\n\n[FAIL 항목 전문]\n${JSON.stringify(failuresText, null, 2)}\n\n` +
        `수정 후 type-check/eslint로 자가 확인까지 하고, 한 항목이라도 '지적이 잘못됐다'고 판단하면 그 사유를 disputed에 담아라. 무엇을 어떻게 고쳤는지 summary에 적어라.`,
      { label: `fix:${stageName.toLowerCase()}:r${round}`, phase: gateName, schema: FIX_RESULT }
    );
  }
  if (!verdict || !verdict.pass) {
    return {
      ok: false,
      reason: `${gateName} ${MAX_FIX_ROUNDS}회 수정 후에도 ${verdict ? "FAIL" : "checker 판정 실패(무응답)"}`,
      failures: verdict && Array.isArray(verdict.failures) ? verdict.failures : [],
      summary: result.summary,
    };
  }
  log(`${gateName} PASS`);
  return { ok: true, summary: result.summary, changedFiles: result.changedFiles };
};

const report = { domain: args.domain, stages: {} };
// cross-review용 누적 컨텍스트 — 각 단계 통과 시 다음 단계 maker에게 전달
let priorContext = "";
const appendPrior = (label, r) => {
  priorContext += `\n- ${label}: ${r.summary} (파일: ${JSON.stringify(r.changedFiles || [])})`;
};

// ── 1단계: Design ──
if (args.designUrls && args.designUrls.length > 0) {
  const r = await runStage(
    "Design",
    "Gate:Design",
    `.claude/commands/design.md를 Read로 읽고 그 절차(Phase A~D)를 그대로 따라 UI를 구현해라. 대상 Figma URL: ${JSON.stringify(args.designUrls)}. ` +
      `도메인: ${args.domain}. 검증 루프(Phase E)와 자동 리뷰(Phase F)는 게이트가 대신하므로 생략. ${UNATTENDED_NOTE}`,
    ".claude/commands/design.md",
    priorContext
  );
  report.stages.design = r;
  if (!r.ok) return { status: "BLOCKED", at: "Design", ...report, ...r };
  appendPrior("Design", r);
} else {
  log("designUrls 없음 — Design 단계 스킵");
}

// ── 2단계: Logic ──
if (args.logicUrl) {
  const r = await runStage(
    "Logic",
    "Gate:Logic",
    `.claude/commands/logic.md를 Read로 읽고 그 절차를 그대로 따라 동작 로직을 구현해라. 디스크립션/기능정의: ${args.logicUrl}. ` +
      `도메인: ${args.domain}. API는 절대 연결하지 말고 TODO로 남겨라. ${UNATTENDED_NOTE}`,
    ".claude/commands/logic.md",
    priorContext
  );
  report.stages.logic = r;
  if (!r.ok) return { status: "BLOCKED", at: "Logic", ...report, ...r };
  appendPrior("Logic", r);
} else {
  log("logicUrl 없음 — Logic 단계 스킵");
}

// ── 3단계: Connect API ──
if (args.apiSpec) {
  const r = await runStage(
    "ConnectApi",
    "Gate:Api",
    `.claude/commands/connect-api.md를 Read로 읽고 그 절차를 그대로 따라 API를 연결해라. API 명세: ${args.apiSpec}. ` +
      `도메인: ${args.domain}. ${UNATTENDED_NOTE}`,
    ".claude/commands/connect-api.md",
    priorContext
  );
  report.stages.connectApi = r;
  if (!r.ok) return { status: "BLOCKED", at: "ConnectApi", ...report, ...r };
  appendPrior("ConnectApi", r);
} else {
  log("apiSpec 없음 — ConnectApi 단계 스킵");
}

return {
  status: "PASS",
  ...report,
  next: args.page
    ? `풀 검증은 사용자가 /verify ${args.page} 실행 (8뷰포트 픽셀 비교는 사람 확인이 섞이는 게 안전)`
    : "풀 검증은 /verify [페이지 경로] 실행",
};
