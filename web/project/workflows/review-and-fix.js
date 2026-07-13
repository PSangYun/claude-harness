export const meta = {
  name: "review-and-fix",
  description: "변경분을 병렬 리뷰하고, maker가 수정한 뒤 checker가 재판정하는 루프 (최대 3회)",
  whenToUse: "브랜치/작업 디렉토리의 변경분을 리뷰하고 지적사항을 자동으로 수정·재검증할 때",
  phases: [
    { title: "Review", detail: "변경범위 산출 → 코드 리뷰 + 컨벤션 스캔 병렬" },
    { title: "Fix", detail: "maker가 지적사항 수정" },
    { title: "Verify", detail: "checker가 PASS/FAIL 판정" },
  ],
};

// args: { base?: string } — diff 비교 기준 (기본 HEAD = 워킹트리 변경분)
const base = (args && args.base) || "HEAD";
const MAX_ROUNDS = 3; // implement-feature.js의 MAX_FIX_ROUNDS와 통일

const FINDINGS = {
  type: "object",
  properties: {
    findings: {
      type: "array",
      items: {
        type: "object",
        properties: {
          file: { type: "string" },
          line: { type: "number" },
          severity: { type: "string", enum: ["critical", "major", "minor"] },
          description: { type: "string" },
        },
        required: ["file", "severity", "description"],
      },
    },
  },
  required: ["findings"],
};

const VERDICT = {
  type: "object",
  properties: {
    pass: { type: "boolean" },
    failures: { type: "array", items: { type: "string" } },
  },
  required: ["pass", "failures"],
};

const SCOPE = {
  type: "object",
  properties: { files: { type: "array", items: { type: "string" } } },
  required: ["files"],
};

const FIX_RESULT = {
  type: "object",
  properties: {
    summary: { type: "string" },
    disputed: { type: "array", items: { type: "string" } },
  },
  required: ["summary"],
};

// judge 합성 결과 — 두 리뷰어 지적을 충돌 조정·우선순위화·오탐 제거한 최종본
const JUDGE = {
  type: "object",
  properties: {
    curated: {
      type: "array",
      items: {
        type: "object",
        properties: {
          file: { type: "string" },
          line: { type: "number" },
          severity: { type: "string", enum: ["critical", "major", "minor"] },
          description: { type: "string" },
          reason: { type: "string" },
        },
        required: ["file", "severity", "description"],
      },
    },
    dropped: {
      type: "array",
      items: {
        type: "object",
        properties: { description: { type: "string" }, reason: { type: "string" } },
        required: ["description", "reason"],
      },
    },
  },
  required: ["curated"],
};

// ── 1) 변경 범위를 결정적으로 산출해 두 리뷰어에 동일 목록 주입 (untracked 신규 파일 누락 방지) ──
// scope는 순수 git 집계라 haiku로 충분 (토큰 절약). 단일 실패점이므로 1회 재시도하고,
// 실패와 "진짜 0건"을 구분한다(실패를 CLEAN으로 오인해 리뷰를 통째로 스킵하지 않도록).
phase("Review");
const scopePrompt =
  `변경 범위만 산출해라(리뷰하지 마라). \`git diff --name-only ${base}\`와 \`git ls-files --others --exclude-standard\`의 합집합에서 ` +
  `node_modules·.git·.next·dist·build 등 빌드/의존성 산출물을 제외한 실제 소스 파일 목록을 files로 반환해라.`;
let scope = await agent(scopePrompt, { label: "scope", phase: "Review", schema: SCOPE, model: "haiku" });
if (!scope || !Array.isArray(scope.files)) {
  log("scope 산출 실패 — 1회 재시도");
  scope = await agent(scopePrompt, { label: "scope:retry", phase: "Review", schema: SCOPE, model: "haiku" });
}
const files = scope && Array.isArray(scope.files) ? scope.files : null;
if (files === null) {
  return {
    status: "BLOCKED",
    reason: "변경 범위 산출 실패(scope 에이전트 무응답) — 리뷰를 신뢰성 있게 못 돌림. 다시 시도 필요",
    findings: [],
    remaining: [],
  };
}
log(`리뷰 대상 ${files.length}개 파일`);
if (files.length === 0) {
  return { status: "CLEAN", findings: [], remaining: [], note: "변경 파일 없음" };
}
const fileList = JSON.stringify(files);

// ── 2) 두 리뷰어에 동일 파일 목록 주입, 무응답 관점은 1회 재시도 후 명시 ──
const reviewDefs = [
  {
    // 실제 버그·타입·레이어 위반 탐지 → 추론이 필요하므로 강한 모델(메인루프 상속)
    label: "review:code",
    prompt:
      `아래 "리뷰 대상 파일"만 코드 리뷰해라. 각 파일을 Read로 전부 읽어라. ` +
      `프로젝트 CLAUDE.md의 규칙을 기준으로 버그·타입 안전성·레이어 의존성 위반·잘못된 패턴만 지적하고 취향 문제는 제외해라. ` +
      `각 지적은 file/line/severity(critical|major|minor)/description으로 반환. 문제 없으면 빈 배열.\n\n리뷰 대상 파일: ${fileList}`,
  },
  {
    // 규칙 패턴 매칭 → 추론 거의 불필요하므로 haiku (토큰 절약)
    label: "review:convention",
    model: "haiku",
    prompt:
      `아래 "리뷰 대상 파일"에서 컨벤션 위반만 스캔해라. 각 파일을 Read로 읽어라. ` +
      `프로젝트 CLAUDE.md의 "핵심 규칙"·"반복되는 실수" 섹션과 .claude/hooks/quality-check.js의 검사 항목을 기준으로: ` +
      `금지 클래스(dark:), 하드코딩 spacing, Props 타입 미분리, 라이브러리 컴포넌트 재구현, 네이밍 위반, 불완전 반응형 등. ` +
      `각 위반은 file/line/severity/description으로 반환. 문제 없으면 빈 배열.\n\n리뷰 대상 파일: ${fileList}`,
  },
];

const runReviewer = async (def) => {
  const opts = { label: def.label, phase: "Review", schema: FINDINGS };
  if (def.model) opts.model = def.model;
  let r = await agent(def.prompt, opts);
  if (!r) {
    log(`${def.label} 무응답 — 1회 재시도`);
    r = await agent(def.prompt, { ...opts, label: `${def.label}:retry` });
  }
  return { label: def.label, findings: r && Array.isArray(r.findings) ? r.findings : null };
};
const reviewed = await parallel(reviewDefs.map((d) => () => runReviewer(d)));

// null 관점은 조용히 누락하지 않고 명시한다 (parallel은 thunk가 throw하면 null을 반환)
const missing = [];
reviewed.forEach((x, i) => {
  if (!x || x.findings === null) missing.push(x ? x.label : reviewDefs[i].label);
});
if (missing.length)
  log(`⚠️ 리뷰 관점 누락(재시도 후에도 무응답): ${missing.join(", ")} — 이 관점은 빠졌으니 사람이 직접 확인 필요`);

// ── 3) 두 리뷰어 중복 지적 dedup (file:line:description) ──
const seen = new Set();
const findings = [];
for (const f of reviewed.filter((x) => x && x.findings).flatMap((x) => x.findings)) {
  const key = `${f.file}:${f.line || 0}:${(f.description || "").trim().slice(0, 80)}`;
  if (seen.has(key)) continue;
  seen.add(key);
  findings.push(f);
}

if (findings.length === 0) {
  return { status: "CLEAN", findings: [], remaining: [], minor: [], missingPerspectives: missing };
}

// ── judge 합성: 두 리뷰어 지적의 충돌 조정·중복 통합·오탐 제거·severity 재조정 (강한 모델) ──
const judged = await agent(
  `너는 심판(judge)이다. 아래는 두 리뷰어(버그 탐지 + 컨벤션 스캔)가 낸 지적 목록이다. ` +
    `① 명백한 오탐(false positive)은 dropped로 빼고 ② 같은/유사 지적은 하나로 합치고 ③ 실제 영향 기준으로 severity를 재조정해 ` +
    `최종 curated 목록을 만들어라. 판단이 애매하면 해당 file을 Read로 직접 확인해라. 취향/스타일 트집은 제외. ` +
    `각 curated 항목엔 reason(왜 유효한지)을, dropped엔 reason(왜 오탐인지)을 적어라.\n\n지적 목록(JSON):\n${JSON.stringify(findings, null, 2)}`,
  { label: "judge:synthesis", phase: "Review", schema: JUDGE }
);
// judge 실패 시 원본 findings로 안전 폴백 (조용히 버리지 않음)
const curated = judged && Array.isArray(judged.curated) ? judged.curated : findings;
const dropped = judged && Array.isArray(judged.dropped) ? judged.dropped : [];
const mustFix = curated.filter((f) => f.severity !== "minor");
const minor = curated.filter((f) => f.severity === "minor");
log(
  `judge 합성: 최종 ${curated.length}건 (수정 대상 ${mustFix.length}, minor ${minor.length}, 오탐 제외 ${dropped.length})${missing.length ? `, 누락 관점 ${missing.length}개` : ""}`
);

// minor는 자동 수정하지 않되 결과로 보고해 사람이 판단하게 한다 (조용히 버리지 않음)
if (mustFix.length === 0) {
  return { status: "CLEAN", findings: curated, dropped, remaining: [], minor, missingPerspectives: missing };
}

// ── 4) maker/checker 루프 — 수정은 워킹트리에 직접 적용 (worktree 격리 안 씀, 한 라운드 1개 fix) ──
let verdict = null;
let lastFix = null;
const disputedAll = [];
for (let round = 1; round <= MAX_ROUNDS; round++) {
  phase("Fix");
  lastFix = await agent(
    `다음 리뷰 지적사항을 수정해라 (maker 역할). 수정 후 type-check와 eslint로 자가 확인까지 해라. ` +
      `지적된 것만 고치고 그 외 코드는 건드리지 마라. 한 항목이라도 지적이 잘못됐다고 판단되면 그 사유를 disputed에 담고, 무엇을 어떻게 고쳤는지 summary에 적어라.` +
      (lastFix ? `\n\n[직전 라운드 수정 요약] ${lastFix.summary}` : "") +
      `\n\n[지적사항(JSON)]\n${JSON.stringify(mustFix, null, 2)}`,
    { label: `fix:round${round}`, phase: "Fix", schema: FIX_RESULT }
  );
  if (lastFix && Array.isArray(lastFix.disputed)) disputedAll.push(...lastFix.disputed);

  phase("Verify");
  verdict = await agent(
    `다음 DoD를 판정해라. 변경 범위는 maker 신고를 믿지 말고 \`git status --porcelain\`로 직접 확인해라:\n` +
      mustFix
        .map(
          (f, i) =>
            `${i + 1}. [${f.severity}] ${f.file}${f.line ? `:${f.line}` : ""} — ${f.description} 이 지적이 해소되었는가`
        )
        .join("\n") +
      `\n${mustFix.length + 1}. 수정으로 인한 type-check/eslint 신규 에러가 없는가 (직접 실행해서 확인)` +
      (lastFix && lastFix.disputed && lastFix.disputed.length
        ? `\n\n참고: 수정자가 '지적이 잘못됐다'고 본 항목 — 타당하면 그 항목은 PASS로 인정해라: ${JSON.stringify(lastFix.disputed)}`
        : "") +
      `\n\npass(전 항목 PASS 여부)와 failures(미해소 항목 설명 배열)를 반환해라.`,
    { label: `verify:round${round}`, phase: "Verify", schema: VERDICT, agentType: "checker" }
  );

  if (verdict && verdict.pass) {
    log(`라운드 ${round}: checker PASS`);
    break;
  }
  log(
    `라운드 ${round}: checker FAIL — ${verdict && Array.isArray(verdict.failures) ? verdict.failures.length : "?"}건 미해소${round < MAX_ROUNDS ? ", 재시도" : ""}`
  );
}

return {
  status: verdict && verdict.pass ? "PASS" : "FAIL",
  findings: curated,
  minor,
  dropped,
  missingPerspectives: missing,
  disputed: disputedAll,
  remaining: verdict && Array.isArray(verdict.failures) ? verdict.failures : ["checker 판정 실패(무응답)"],
  note: verdict && verdict.pass ? "전 지적사항 해소 확인" : `${MAX_ROUNDS}회 상한 도달 — 남은 항목은 사람 판단 필요`,
};
