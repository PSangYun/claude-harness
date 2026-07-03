#!/usr/bin/env node
/**
 * stop-gate.js — Stop 훅 (AOS: Gradle compileDebugKotlin + lint 결정적 게이트)
 *
 * Claude가 턴을 끝내려 할 때 실행된다. Kotlin 코드 변경이 있으면 프로젝트에 존재하는
 * 검증(compileDebugKotlin / ktlint·detekt 설정 시)만 자동 감지해 실행하고, 실패 시
 * 턴 종료를 차단(block)하여 Claude가 스스로 수정하게 만든다.
 *
 * 설계 원칙 (웹팀 stop-gate.js와 동일 골격):
 * - 범용: settings.gradle(.kts)의 모듈을 파싱해 변경된 모듈만 컴파일. 비 Gradle 프로젝트는 무시
 * - 크로스플랫폼: Windows(git-bash 개발 환경)에서는 gradlew.bat, macOS/Linux에서는 ./gradlew
 * - fail-open: 훅 자체 오류·인프라 문제(GPR 자격증명 부재 등)로는 절대 차단하지 않음 (exit 0)
 * - 단, fail-open으로 인한 스킵은 "조용히" 넘어가지 않고 systemMessage로 가시화한다
 * - 무한 루프 방지: stop_hook_active 가드 필수
 * - 비용 0 경로: 코드 변경 없는 Q&A 턴은 git diff 확인만 하고 즉시 통과
 * - 자기방어: 하네스 훅(.claude/hooks/*.js)이 바뀌면 최소 구문 검증(node --check)을 돌린다
 * - 명령 오버라이드: 자동 감지가 안 맞는 프로젝트는 `.claude/stop-gate.json`에
 *   { "lint": "...", "build": "...", "test": "..." } 로 명령을 직접 지정할 수 있다
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
const GRADLE_TIMEOUT_MS = 210_000; // 데몬 콜드 스타트 감안 별도 상한
const BUDGET_MS = 240_000; // 등록 timeout(300s)보다 작게 — 초과 시 fail-open(가시화)
const MAX_REASON_LINES = 30;
const MAX_BUFFER = 10 * 1024 * 1024;
const CODE_EXT = /\.(kt|kts|java)$/;
const PROJ_FILE = /(build\.gradle(\.kts)?|settings\.gradle(\.kts)?|libs\.versions\.toml|gradle\.properties|AndroidManifest\.xml)$/;
const START_MS = Date.now();

const readStdin = () => {
  try {
    return fs.readFileSync(0, "utf8");
  } catch {
    return "";
  }
};

const run = (cmd, cwd, timeout = STEP_TIMEOUT_MS) =>
  execSync(cmd, { cwd, timeout, stdio: ["ignore", "pipe", "pipe"], encoding: "utf8", maxBuffer: MAX_BUFFER });

// Gradle 출력에서 에러 라인만 추출 (없으면 마지막 N줄)
const extractErrors = (output) => {
  const all = String(output || "").split("\n").filter(Boolean);
  const errs = all.filter((l) => /^e:|error:|FAILURE:|What went wrong|Compilation error/i.test(l.trim()));
  return (errs.length ? errs : all.slice(-MAX_REASON_LINES)).slice(0, MAX_REASON_LINES);
};

const block = (label, output) => {
  process.stdout.write(
    JSON.stringify({
      decision: "block",
      reason: `[stop-gate] ${label} 실패 — 아래 에러를 수정한 후 다시 완료를 선언할 것:\n${extractErrors(output).join("\n")}`,
    })
  );
  process.exit(0);
};

// fail-open 하되 "조용히" 넘어가지 않게 사유를 사용자에게 노출하고 통과
const visibleSkip = (why) => {
  process.stdout.write(
    JSON.stringify({
      systemMessage: `[stop-gate] ${why} — 일부 검증을 건너뜀(fail-open). 수동으로 ./gradlew compileDebugKotlin 확인 권장.`,
    })
  );
  process.exit(0);
};

const overBudget = () => Date.now() - START_MS > BUDGET_MS;
const remainingBudget = () => Math.max(10_000, BUDGET_MS - (Date.now() - START_MS));

// 환경 문제(자격증명·의존성 해석)는 코드 문제가 아니므로 차단하지 않고 가시화만
const isEnvFailure = (output) =>
  /401 Unauthorized|Could not resolve|Could not GET 'https:\/\/maven\.pkg\.github\.com|gpr\.(user|key)|GPR_(USER|KEY)|Could not determine the dependencies/i.test(
    String(output || "")
  );

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
        if (!f) return false;
        if (!CODE_EXT.test(f) && !PROJ_FILE.test(f) && !/\.(js|cjs|mjs)$/.test(f)) return false;
        if (f.includes("build/") || f.includes(".gradle/")) return false;
        // 숨김 디렉토리는 제외하되 .claude(하네스 자체)는 자기방어 위해 포함
        if (f.split("/").some((seg) => seg.startsWith(".") && seg !== ".claude")) return false;
        // .claude 밖의 js는 AOS 프로젝트 게이트 대상 아님
        if (/\.(js|cjs|mjs)$/.test(f) && !f.startsWith(".claude/")) return false;
        return true;
      });
  } catch {
    process.exit(0); // git 없음/repo 아님 → 게이트 대상 아님
  }
  if (changed.length === 0) process.exit(0);

  const harnessJs = changed.filter((f) => f.startsWith(".claude/") && /\.(js|cjs|mjs)$/.test(f));
  const appFiles = changed.filter((f) => !f.startsWith(".claude/"));

  // 2.5. 중복 실행 방지 — 같은 변경 상태의 PASS를 2분간 기억 (파일 mtime/size 포함 키)
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
  const stamp = () => {
    try {
      fs.writeFileSync(stampPath, "");
    } catch {
      /* 스탬프 실패는 무시 */
    }
  };

  // 3. 하네스 자체(.claude/hooks/*.js) 변경 시 구문 검증 (워크플로우 DSL은 제외)
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
    stamp();
    process.exit(0);
  }

  // 4. Gradle 프로젝트 감지 (wrapper 없으면 게이트 대상 아님)
  const isWin = process.platform === "win32";
  const gradlew = isWin ? "gradlew.bat" : "./gradlew";
  if (!fs.existsSync(path.join(cwd, isWin ? "gradlew.bat" : "gradlew"))) process.exit(0);
  const gradleFlags = "-q --console=plain";

  // 명령 오버라이드 로드 (.claude/stop-gate.json)
  let config = {};
  try {
    config = JSON.parse(fs.readFileSync(path.join(cwd, ".claude", "stop-gate.json"), "utf8"));
  } catch {
    /* 설정 없음 → 자동 감지 */
  }

  // 변경된 모듈 산출: settings.gradle(.kts)의 include 목록 ↔ 변경 파일 첫 경로 세그먼트 매칭
  const settingsFile = ["settings.gradle.kts", "settings.gradle"].find((f) => fs.existsSync(path.join(cwd, f)));
  let modules = [];
  if (settingsFile) {
    try {
      const src = fs.readFileSync(path.join(cwd, settingsFile), "utf8");
      modules = [...src.matchAll(/include\s*\(?\s*["':]+([\w.:-]+)["']/g)].map((m) => m[1].replace(/^:/, ""));
    } catch {
      /* 파싱 실패 → 전체 빌드로 폴백 */
    }
  }
  const changedModules = [
    ...new Set(
      appFiles
        .map((f) => modules.find((m) => f === m || f.startsWith(`${m.replace(/:/g, "/")}/`)))
        .filter(Boolean)
    ),
  ];
  const taskFor = (task) =>
    changedModules.length > 0 ? changedModules.map((m) => `:${m}:${task}`).join(" ") : task;

  const runGradle = (label, taskArgs) => {
    try {
      run(`${gradlew} ${gradleFlags} ${taskArgs}`, cwd, Math.min(GRADLE_TIMEOUT_MS, remainingBudget()));
    } catch (e) {
      const out = `${e.stdout || ""}\n${e.stderr || ""}`;
      if (e.killed || /ETIMEDOUT/.test(String(e.code))) {
        visibleSkip(`${label}가 예산 내에 끝나지 않음 (콜드 데몬 추정)`);
      }
      if (isEnvFailure(out)) {
        visibleSkip(`${label} 중 의존성 해석/자격증명 문제(GPR 등) — 코드 문제 아님`);
      }
      block(label, out);
    }
  };

  // 4-1. 컴파일: compileDebugKotlin — 현재 유일한 결정적 타입 게이트 (ktlint/detekt 부재 기준)
  if (overBudget()) visibleSkip("검증 예산(240s) 초과 (컴파일 전)");
  if (config.build) {
    try {
      run(config.build, cwd, Math.min(GRADLE_TIMEOUT_MS, remainingBudget()));
    } catch (e) {
      const out = `${e.stdout || ""}\n${e.stderr || ""}`;
      if (isEnvFailure(out)) visibleSkip("빌드(설정 명령) 중 의존성 해석/자격증명 문제 — 코드 문제 아님");
      block("빌드(설정 명령)", out);
    }
  } else {
    runGradle("compileDebugKotlin", taskFor("compileDebugKotlin"));
  }

  // 4-2. 린트: ktlint/detekt가 빌드 스크립트에 선언된 경우에만 (현재 프로젝트들엔 없음 — 도입 시 자동 활성화)
  if (!config.lint) {
    try {
      const buildFiles = [
        "build.gradle.kts",
        "build.gradle",
        ...changedModules.map((m) => `${m.replace(/:/g, "/")}/build.gradle.kts`),
      ].filter((f) => fs.existsSync(path.join(cwd, f)));
      const buildSrc = buildFiles.map((f) => fs.readFileSync(path.join(cwd, f), "utf8")).join("\n");
      if (/ktlint/i.test(buildSrc)) {
        if (overBudget()) visibleSkip("검증 예산(240s) 초과 (ktlint 전)");
        runGradle("ktlintCheck", taskFor("ktlintCheck"));
      }
      if (/detekt/i.test(buildSrc)) {
        if (overBudget()) visibleSkip("검증 예산(240s) 초과 (detekt 전)");
        runGradle("detekt", taskFor("detekt"));
      }
    } catch {
      /* 린트 감지 실패는 무시 (컴파일이 이미 통과) */
    }
  } else {
    if (overBudget()) visibleSkip("검증 예산(240s) 초과 (lint 전)");
    try {
      run(config.lint, cwd, Math.min(GRADLE_TIMEOUT_MS, remainingBudget()));
    } catch (e) {
      block("lint(설정 명령)", `${e.stdout || ""}\n${e.stderr || ""}`);
    }
  }

  // 4-3. 테스트: 실질 테스트 파일이 있을 때만 (Example* 템플릿만 있으면 스킵)
  const hasRealTests = (() => {
    const roots =
      changedModules.length > 0 ? changedModules.map((m) => m.replace(/:/g, "/")) : modules.map((m) => m.replace(/:/g, "/"));
    const walk = (dir) => {
      let found = false;
      try {
        for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
          if (found) return true;
          const p = path.join(dir, ent.name);
          if (ent.isDirectory()) found = walk(p);
          else if (/\.(kt|java)$/.test(ent.name) && !/^Example/.test(ent.name)) return true;
        }
      } catch {
        /* 디렉토리 없음 */
      }
      return found;
    };
    return roots.some((r) => walk(path.join(cwd, r, "src", "test")));
  })();
  if (config.test || hasRealTests) {
    if (overBudget()) visibleSkip("검증 예산(240s) 초과 (test 전)");
    if (config.test) {
      try {
        run(config.test, cwd, remainingBudget());
      } catch (e) {
        block("test(설정 명령)", `${e.stdout || ""}\n${e.stderr || ""}`);
      }
    } else {
      runGradle("testDebugUnitTest", taskFor("testDebugUnitTest"));
    }
  }

  // 전부 통과 → PASS 스탬프 기록
  stamp();
  process.exit(0);
};

try {
  main();
} catch {
  process.exit(0); // fail-open: 훅 자체 오류로는 절대 차단하지 않음
}
