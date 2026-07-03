#!/usr/bin/env node
/**
 * stop-gate.js — Stop 훅 (결정적 checker 게이트)
 *
 * Claude가 턴을 끝내려 할 때 실행된다. 코드 변경이 있으면 프로젝트에 존재하는
 * 검증(type-check / eslint / 테스트)만 자동 감지해 실행하고, 실패 시 턴 종료를
 * 차단(block)하여 Claude가 스스로 수정하게 만든다.
 *
 * 설계 원칙:
 * - 범용: package.json/tsconfig/eslint 설정을 감지해 "있는 검증만" 실행. 비 Node 프로젝트는 무시
 * - fail-open: 훅 자체 오류·인프라 문제로는 절대 차단하지 않음 (exit 0)
 * - 단, fail-open으로 인한 스킵은 "조용히" 넘어가지 않고 systemMessage로 가시화한다
 * - 무한 루프 방지: stop_hook_active 가드 필수
 * - 비용 0 경로: 코드 변경 없는 Q&A 턴은 git diff 확인만 하고 즉시 통과
 * - 자기방어: 하네스 훅(.claude/hooks/*.js)이 바뀌면 최소 구문 검증(node --check)을 돌린다
 *   (워크플로우 .js는 DSL이라 node 단독 검증 불가 → Workflow 도구가 런타임에 검증)
 *
 * ⚠️ 이 파일은 프로젝트(.claude/hooks/)와 글로벌(~/.claude/hooks/) 양쪽에 동일 사본으로 둔다.
 *    한쪽을 고치면 반드시 다른 쪽도 동일하게 맞춰 드리프트를 막을 것.
 */

const { execSync } = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");

const STEP_TIMEOUT_MS = 60_000;
const BUDGET_MS = 240_000; // 등록 timeout(300s)보다 작게 — 초과 시 fail-open(가시화)
const MAX_REASON_LINES = 30;
const CODE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs)$/;
const START_MS = Date.now();

const readStdin = () => {
  try {
    return fs.readFileSync(0, "utf8");
  } catch {
    return "";
  }
};

const run = (cmd, cwd, timeout = STEP_TIMEOUT_MS) =>
  execSync(cmd, { cwd, timeout, stdio: ["ignore", "pipe", "pipe"], encoding: "utf8" });

const block = (label, output) => {
  const lines = String(output || "").split("\n").filter(Boolean).slice(0, MAX_REASON_LINES);
  process.stdout.write(
    JSON.stringify({
      decision: "block",
      reason: `[stop-gate] ${label} 실패 — 아래 에러를 수정한 후 다시 완료를 선언할 것:\n${lines.join("\n")}`,
    })
  );
  process.exit(0);
};

// fail-open 하되 "조용히" 넘어가지 않게 사유를 사용자에게 노출하고 통과
const visibleSkip = (why) => {
  process.stdout.write(
    JSON.stringify({
      systemMessage: `[stop-gate] ${why} — 일부 검증을 건너뜀(fail-open). 수동으로 npm run type-check / lint / test 확인 권장.`,
    })
  );
  process.exit(0);
};

const overBudget = () => Date.now() - START_MS > BUDGET_MS;

const main = () => {
  let input = {};
  try {
    input = JSON.parse(readStdin() || "{}");
  } catch {
    /* stdin 파싱 실패 시 빈 입력으로 진행 */
  }

  // 1. 무한 루프 방지: 이미 stop-gate가 차단해서 재시도 중인 턴이면 통과
  if (input.stop_hook_active === true) process.exit(0);

  const cwd = input.cwd || process.cwd();

  // 2. git repo + 코드 변경 감지 (변경 없으면 비용 0으로 통과)
  let changed = [];
  try {
    run("git rev-parse --is-inside-work-tree", cwd, 5_000);
    const diff = run("git diff --name-only HEAD", cwd, 10_000);
    const untracked = run("git ls-files --others --exclude-standard", cwd, 10_000);
    changed = `${diff}\n${untracked}`
      .split("\n")
      .map((f) => f.trim())
      .filter((f) => {
        if (!f || !CODE_EXT.test(f)) return false;
        if (f.includes("node_modules/")) return false;
        // 숨김 디렉토리는 제외하되 .claude(하네스 자체)는 자기방어 위해 포함
        if (f.split("/").some((seg) => seg.startsWith(".") && seg !== ".claude")) return false;
        return true;
      });
  } catch {
    process.exit(0); // git 없음/repo 아님 → 게이트 대상 아님
  }
  if (changed.length === 0) process.exit(0);

  const harnessJs = changed.filter((f) => f.startsWith(".claude/") && /\.(js|cjs|mjs)$/.test(f));
  const appFiles = changed.filter((f) => !f.startsWith(".claude/"));

  // 2.5. 중복 실행 방지 — 글로벌+프로젝트 양쪽에 등록된 경우 같은 변경 상태의 PASS를 2분간 기억.
  //      키에 파일 mtime/size를 포함하므로 내용이 바뀌면 즉시 무효화됨. 실패는 스탬프를 남기지 않음.
  const sig = changed
    .map((f) => {
      try {
        const st = fs.statSync(path.join(cwd, f));
        return `${f}:${st.mtimeMs}:${st.size}`;
      } catch {
        return f;
      }
    })
    .join("\n");
  const stampPath = path.join(
    os.tmpdir(),
    `stop-gate-${crypto.createHash("sha1").update(`${cwd}\n${sig}`).digest("hex")}.pass`
  );
  try {
    if (Date.now() - fs.statSync(stampPath).mtimeMs < 120_000) process.exit(0);
  } catch {
    /* 스탬프 없음 → 검증 진행 */
  }

  // 3. 하네스 자체(.claude/hooks/*.js) 변경 시 구문 검증 — 깨진 훅이 게이트를 조용히 무력화하는 것 방지.
  //    워크플로우(.claude/workflows/*.js)는 export + top-level return/await를 쓰는 DSL이라 node 단독으로는
  //    구문 검증이 불가능(거짓 양성)하므로 제외한다 — 이들은 Workflow 도구가 실행 시점에 검증한다.
  for (const f of harnessJs) {
    if (f.startsWith(".claude/workflows/")) continue;
    try {
      run(`node --check "${f}"`, cwd, 10_000);
    } catch (e) {
      block(`harness 구문오류 (${f})`, `${e.stdout || ""}\n${e.stderr || ""}`);
    }
  }

  // 앱 코드 변경이 없으면(하네스만 바뀜) 여기서 통과
  if (appFiles.length === 0) {
    try {
      fs.writeFileSync(stampPath, "");
    } catch {
      /* 무시 */
    }
    process.exit(0);
  }

  // 4. Node 프로젝트가 아니거나 의존성 미설치면 통과 (npx 네트워크 다운로드 방지)
  const pkgPath = path.join(cwd, "package.json");
  if (!fs.existsSync(pkgPath) || !fs.existsSync(path.join(cwd, "node_modules"))) process.exit(0);

  let pkg = {};
  try {
    pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  } catch {
    process.exit(0);
  }
  const scripts = pkg.scripts || {};
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };

  // 4-1. type-check: 프로젝트 스크립트 우선, 없으면 tsconfig 감지 시 tsc 직접 실행
  if (overBudget()) visibleSkip("검증 예산(240s) 초과 (type-check 전)");
  const typeCheckScript = ["type-check", "typecheck"].find((s) => scripts[s]);
  try {
    if (typeCheckScript) run(`npm run -s ${typeCheckScript}`, cwd);
    else if (fs.existsSync(path.join(cwd, "tsconfig.json")) && deps.typescript)
      run("npx tsc --noEmit", cwd);
  } catch (e) {
    block("type-check", `${e.stdout || ""}\n${e.stderr || ""}`);
  }

  // 4-2. eslint: 설정 존재 시 변경된 앱 파일만 검사 (.claude는 eslint 대상 아님)
  if (overBudget()) visibleSkip("검증 예산(240s) 초과 (eslint 전)");
  const hasEslintConfig =
    pkg.eslintConfig ||
    ["eslint.config.js", "eslint.config.mjs", "eslint.config.cjs", "eslint.config.ts", ".eslintrc", ".eslintrc.js", ".eslintrc.json", ".eslintrc.cjs", ".eslintrc.yaml", ".eslintrc.yml"].some(
      (f) => fs.existsSync(path.join(cwd, f))
    );
  if (hasEslintConfig && deps.eslint) {
    const targets = appFiles
      .filter((f) => fs.existsSync(path.join(cwd, f)))
      .slice(0, 50)
      .map((f) => `"${f}"`)
      .join(" ");
    if (targets) {
      try {
        run(`npx eslint --no-error-on-unmatched-pattern ${targets}`, cwd);
      } catch (e) {
        block("eslint", `${e.stdout || ""}\n${e.stderr || ""}`);
      }
    }
  }

  // 4-3. 테스트: vitest/jest 감지 시 변경분만 실행
  if (overBudget()) visibleSkip("검증 예산(240s) 초과 (test 전)");
  try {
    if (deps.vitest) run("npx vitest run --changed --passWithNoTests", cwd);
    else if (deps.jest) run("npx jest --onlyChanged --passWithNoTests", cwd);
  } catch (e) {
    block("test", `${e.stdout || ""}\n${e.stderr || ""}`);
  }

  // 전부 통과 → PASS 스탬프 기록 (중복 등록된 훅의 재검증 생략용)
  try {
    fs.writeFileSync(stampPath, "");
  } catch {
    /* 스탬프 실패는 무시 — 검증은 이미 통과 */
  }
  process.exit(0);
};

try {
  main();
} catch {
  process.exit(0); // fail-open: 훅 자체 오류로는 절대 차단하지 않음
}
