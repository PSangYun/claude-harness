export const meta = {
  name: "implement-feature",
  description: "design → logic → connect-api 파이프라인을 단계별 checker 게이트와 함께 실행 (AOS)",
  whenToUse:
    "피그마 디자인 URL + 기능정의서 + API 명세가 모두 준비된 기능을 무인 파이프라인으로 구현할 때. 자료가 일부만 있으면 해당 단계까지만 실행됨.",
  phases: [
    { title: "Design", detail: "/design 절차로 Compose UI 구현" },
    { title: "Gate:Design", detail: "checker 판정 + 스모크(빌드/실행) 검증" },
    { title: "Logic", detail: "/logic 절차로 동작 구현" },
    { title: "Gate:Logic", detail: "checker 판정 (compileDebugKotlin 포함)" },
    { title: "ConnectApi", detail: "/connect-api 절차로 API 연결" },
    { title: "Gate:Api", detail: "checker 판정 + 전체 플로우 확인" },
  ],
};

// args: {
//   domain: string            — 기능 도메인명 (필수)
//   designUrls?: string[]     — Figma 디자인 URL들 (있으면 Design 단계 실행)
//   logicUrl?: string         — Figma 디스크립션 URL 또는 기능정의서 링크/내용
//   apiSpec?: string          — API 명세 (엔드포인트/메서드/타입)
//   runSmoke?: boolean        — true면 Logic 단계에도 런타임 스모크 수행 (기본: Design·ConnectApi 게이트만)
// }
if (!args || !args.domain) throw new Error("args.domain은 필수다 (기능 도메인명)");

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

// 런타임 스모크 결과 — checker는 에뮬레이터를 못 띄우므로 이 결과로 런타임/실행 항목을 판정한다
const SMOKE_RESULT = {
  type: "object",
  properties: {
    ran: { type: "boolean" },
    pass: { type: "boolean" },
    build: { type: "boolean" },
    launch: { type: "string" },
    errors: { type: "array", items: { type: "string" } },
    note: { type: "string" },
  },
  required: ["ran", "pass"],
};

// fix 라운드 산출물 — 다음 라운드 checker/fix에 맥락으로 전달
const FIX_RESULT = {
  type: "object",
  properties: {
    summary: { type: "string" },
    disputed: { type: "array", items: { type: "string" } },
    openQuestions: { type: "array", items: { type: "string" } },
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
        `위 Contract(UiState/Intent/Navigation)·Screen 파라미터·함수 시그니처와 충돌하지 않게 구현해라. 충돌이 불가피하면 임의로 바꾸지 말고 openQuestions로 보고해라.`
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

  let verdict = null;
  let lastFix = null;
  // 런타임 스모크는 UI/연동 단계(Design·ConnectApi)에만 수행한다. Logic 단계는 compile/checker 검증으로 충분하므로
  // 라운드마다 smoke 에이전트를 호출하는 요청 수를 줄인다. args.runSmoke === true 면 모든 단계에서 수행한다.
  const shouldRunSmoke = args.runSmoke === true || stageName === "Design" || stageName === "ConnectApi";
  for (let round = 1; round <= MAX_FIX_ROUNDS + 1; round++) {
    // 런타임 스모크 — checker가 못 하는 실행 검증을 smoke 에이전트가 대신 수행해 결과를 checker에 넘긴다.
    // smoke는 adb devices로 기기를 먼저 확인하고, 없으면 assembleDebug도 생략한 채 ran:false 로 즉시 돌아온다
    // (컴파일은 checker가 검증 — 기기 없는 환경에서 라운드마다 APK 전체 빌드를 하지 않는다).
    // 매 라운드 재실행해 fix 반영 후의 최신 결과로 판정한다 (stale 증거로 반복 FAIL/거짓 PASS 방지)
    const smoke = !shouldRunSmoke ? null : await agent(
      `스모크 검증을 수행해라. 먼저 adb devices로 연결된 기기/에뮬레이터를 확인하고, 없으면 빌드도 하지 말고 ` +
        `ran:false·pass:false·build:false·launch:"skipped"·note:"연결된 기기 없음"으로 즉시 반환해라 (컴파일은 checker가 검증한다, 임의 부팅 금지). ` +
        `기기가 있으면 ./gradlew -q assembleDebug 빌드(.claude/stop-gate.json에 build 명령 있으면 그것 우선, Windows PowerShell/cmd면 \`.\\gradlew.bat\`) 후 설치+실행까지 확인해라. ` +
        `401/Could not resolve는 환경 문제로 ran:false 처리. ran·pass·build·launch·errors·note로 반환해라.`,
      { label: `smoke:${stageName.toLowerCase()}:r${round}`, phase: gateName, schema: SMOKE_RESULT, agentType: "smoke" }
    );
    if (smoke) log(`${gateName} smoke r${round}: ${smoke.ran ? (smoke.pass ? "PASS" : "FAIL") : `미실행(${smoke.note || "사유 없음"})`}`);
    const smokeNote = smoke
      ? `\n\n[런타임 스모크 결과 — 이번 라운드 실측] 너는 에뮬레이터를 직접 못 띄우니, DoD의 런타임/실행 항목은 아래 스모크 결과를 근거로 판정해라(ran:false면 '확인 불가→FAIL'): ${JSON.stringify(smoke)}`
      : shouldRunSmoke
        ? `\n\n[스모크 미수행] 런타임 검증을 못 했다. DoD의 런타임 전용 항목은 '확인 불가→FAIL'로 처리해라.`
        : `\n\n[스모크 생략 단계] 이 단계는 런타임 스모크를 돌리지 않는다. 컴파일·테스트 명령 결과로 판정하고, DoD에 실행/렌더 전용 항목이 있으면 '확인 불가→FAIL'로 처리해라.`;

    const fixNote = lastFix
      ? `\n\n[직전 라운드 수정 요약] ${lastFix.summary}` +
        (lastFix.disputed && lastFix.disputed.length
          ? `\n[수정자가 '지적이 잘못됐다'고 본 항목] ${JSON.stringify(lastFix.disputed)}`
          : "")
      : "";
    verdict = await agent(
      `${dodSource}의 "Definition of Done" 섹션을 Read로 읽고 그 항목들을 판정해라. ` +
        `변경 파일 목록은 maker 신고를 믿지 말고 \`git status --porcelain\`(추적+미추적, build 디렉토리 제외)로 직접 산출해서 그 파일들을 읽고 판정해라. ` +
        `검증 명령(./gradlew -q :<모듈>:compileDebugKotlin, ktlintCheck 등 — 모듈명은 settings.gradle.kts 참조, Windows PowerShell/cmd면 \`.\\gradlew.bat\`)은 직접 실행해서 확인해라. ` +
        `단, 아래 스모크 결과에 build:true가 있으면 컴파일 항목은 그 결과(assembleDebug 성공 = compileDebugKotlin 포함)를 근거로 판정하고 compileDebugKotlin을 다시 실행하지 마라 (같은 변경에 빌드 2회 금지). ` +
        `401/Could not resolve는 환경 문제로 구분해라.${smokeNote}${fixNote}\n\npass와 failures를 반환해라.`,
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
        `수정 후 ./gradlew -q :<모듈>:compileDebugKotlin(과 ktlintCheck, 도입돼 있으면; Windows PowerShell/cmd면 \`.\\gradlew.bat\`)으로 자가 확인까지 하고, 한 항목이라도 '지적이 잘못됐다'고 판단하면 그 사유를 disputed에 담아라. 무엇을 어떻게 고쳤는지 summary에 적어라.`,
      { label: `fix:${stageName.toLowerCase()}:r${round}`, phase: gateName, schema: FIX_RESULT }
    );
    // fix 라운드에서 발생한 질문도 유실 없이 사용자에게 도달해야 한다 (추측 금지 안전장치)
    if (lastFix && Array.isArray(lastFix.openQuestions) && lastFix.openQuestions.length > 0) {
      return {
        ok: false,
        reason: `${gateName} 수정 라운드에서 사용자 답변 필요`,
        openQuestions: lastFix.openQuestions,
        summary: lastFix.summary || result.summary,
      };
    }
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
      `도메인: ${args.domain}. checker 판정은 게이트가 대신하므로 완료 선언만 하지 마라. ${UNATTENDED_NOTE}`,
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
  next: "최종 확인은 에뮬레이터/실기기에서 화면·플로우를 사람이 직접 확인 (픽셀 단위 Figma 대조는 사람 판단이 섞이는 게 안전)",
};
