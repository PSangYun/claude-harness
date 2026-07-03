#!/usr/bin/env node
/**
 * stop-gate.js — Stop 훅 (iOS: SwiftLint + xcodebuild 결정적 게이트)
 *
 * Claude가 턴을 끝내려 할 때 실행된다. Swift 코드 변경이 있으면 프로젝트에 존재하는
 * 검증(SwiftLint / xcodebuild 빌드)만 자동 감지해 실행하고, 실패 시 턴 종료를
 * 차단(block)하여 Claude가 스스로 수정하게 만든다.
 *
 * 설계 원칙 (웹팀 stop-gate.js와 동일 골격):
 * - 범용: 프로젝트 유형(xcworkspace / xcodeproj / Package.swift)을 감지해 "가능한 검증만" 실행
 * - fail-open: 훅 자체 오류·인프라 문제(xcodebuild 없음 등)로는 절대 차단하지 않음 (exit 0)
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
const BUILD_TIMEOUT_MS = 210_000; // xcodebuild는 오래 걸릴 수 있어 별도 상한
const BUDGET_MS = 240_000; // 등록 timeout(300s)보다 작게 — 초과 시 fail-open(가시화)
const MAX_REASON_LINES = 30;
const MAX_BUFFER = 10 * 1024 * 1024;
const CODE_EXT = /\.(swift|h|m|mm)$/;
const PROJ_FILE = /(project\.pbxproj|Podfile|Podfile\.lock|Package\.swift|Package\.resolved|\.xcconfig|\.entitlements)$/;
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

const has = (cmd) => {
  try {
    execSync(`command -v ${cmd}`, { stdio: "ignore", timeout: 5_000 });
    return true;
  } catch {
    return false;
  }
};

// xcodebuild 출력에서 에러 라인만 추출 (없으면 마지막 N줄)
const extractErrors = (output) => {
  const all = String(output || "").split("\n").filter(Boolean);
  const errs = all.filter((l) => /error:|BUILD FAILED|fatal error|Undefined symbol/i.test(l));
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
      systemMessage: `[stop-gate] ${why} — 일부 검증을 건너뜀(fail-open). 수동으로 xcodebuild 빌드/swiftlint 확인 권장.`,
    })
  );
  process.exit(0);
};

const overBudget = () => Date.now() - START_MS > BUDGET_MS;
const remainingBudget = () => Math.max(10_000, BUDGET_MS - (Date.now() - START_MS));

// 프로젝트 유형 감지 → xcodebuild 명령 구성
const detectBuildCommand = (cwd) => {
  const entries = fs.readdirSync(cwd);
  const workspace = entries.find((f) => f.endsWith(".xcworkspace"));
  const xcodeproj = entries.find((f) => f.endsWith(".xcodeproj"));

  // 공유 스킴 탐색: <proj>.xcodeproj/xcshareddata/xcschemes/*.xcscheme
  const findScheme = (projDir, preferred) => {
    const dir = path.join(cwd, projDir, "xcshareddata", "xcschemes");
    if (!fs.existsSync(dir)) return preferred;
    const schemes = fs.readdirSync(dir).filter((f) => f.endsWith(".xcscheme")).map((f) => f.replace(/\.xcscheme$/, ""));
    if (schemes.length === 0) return preferred;
    return schemes.includes(preferred) ? preferred : schemes[0];
  };

  if (workspace && xcodeproj) {
    const scheme = findScheme(xcodeproj, workspace.replace(/\.xcworkspace$/, ""));
    return `xcodebuild -workspace "${workspace}" -scheme "${scheme}" -configuration Debug -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO -quiet build`;
  }
  if (xcodeproj) {
    const scheme = findScheme(xcodeproj, xcodeproj.replace(/\.xcodeproj$/, ""));
    return `xcodebuild -project "${xcodeproj}" -scheme "${scheme}" -configuration Debug -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO -quiet build`;
  }
  if (entries.includes("Package.swift")) {
    // SwiftPM 패키지 — 스킴명 = 패키지명 (예: ios-common)
    try {
      const m = fs.readFileSync(path.join(cwd, "Package.swift"), "utf8").match(/name:\s*"([^"]+)"/);
      if (m) return `xcodebuild -scheme "${m[1]}" -destination 'generic/platform=iOS Simulator' -quiet build`;
    } catch {
      /* 파싱 실패 시 빌드 스킵 */
    }
  }
  return null;
};

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
        if (f.includes("Pods/") || f.includes("DerivedData/") || f.includes(".build/")) return false;
        // 숨김 디렉토리는 제외하되 .claude(하네스 자체)는 자기방어 위해 포함
        if (f.split("/").some((seg) => seg.startsWith(".") && seg !== ".claude")) return false;
        // .claude 밖의 js는 iOS 프로젝트 게이트 대상 아님
        if (/\.(js|cjs|mjs)$/.test(f) && !f.startsWith(".claude/")) return false;
        return true;
      });
  } catch {
    process.exit(0); // git 없음/repo 아님 → 게이트 대상 아님
  }
  if (changed.length === 0) process.exit(0);

  const harnessJs = changed.filter((f) => f.startsWith(".claude/") && /\.(js|cjs|mjs)$/.test(f));
  const appFiles = changed.filter((f) => !f.startsWith(".claude/"));
  const swiftFiles = appFiles.filter((f) => /\.swift$/.test(f));

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
  const stamp = () => {
    try {
      fs.writeFileSync(stampPath, "");
    } catch {
      /* 스탬프 실패는 무시 */
    }
  };

  // 3. 하네스 자체(.claude/hooks/*.js) 변경 시 구문 검증 — 깨진 훅이 게이트를 조용히 무력화하는 것 방지.
  //    워크플로우(.claude/workflows/*.js)는 Workflow DSL이라 node 단독 검증 불가 → 제외.
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

  // 4. 명령 오버라이드 로드 (.claude/stop-gate.json)
  let config = {};
  try {
    config = JSON.parse(fs.readFileSync(path.join(cwd, ".claude", "stop-gate.json"), "utf8"));
  } catch {
    /* 설정 없음 → 자동 감지 */
  }

  // 4-1. SwiftLint: .swiftlint.yml + 바이너리 존재 시 변경된 Swift 파일만 검사
  if (overBudget()) visibleSkip("검증 예산(240s) 초과 (lint 전)");
  if (config.lint) {
    try {
      run(config.lint, cwd);
    } catch (e) {
      block("lint(설정 명령)", `${e.stdout || ""}\n${e.stderr || ""}`);
    }
  } else if (fs.existsSync(path.join(cwd, ".swiftlint.yml")) && has("swiftlint") && swiftFiles.length > 0) {
    const targets = swiftFiles
      .filter((f) => fs.existsSync(path.join(cwd, f)))
      .slice(0, 50)
      .map((f) => `"${f}"`)
      .join(" ");
    if (targets) {
      try {
        run(`swiftlint lint --quiet --strict --force-exclude ${targets}`, cwd);
      } catch (e) {
        block("swiftlint", `${e.stdout || ""}\n${e.stderr || ""}`);
      }
    }
  }

  // 4-2. 빌드: xcodebuild — 유일한 결정적 타입/컴파일 게이트 (테스트·린트 부재 프로젝트 기준)
  if (overBudget()) visibleSkip("검증 예산(240s) 초과 (빌드 전)");
  if (!has("xcodebuild")) process.exit(0); // Xcode 없는 머신 → 게이트 대상 아님
  const buildCmd = config.build || detectBuildCommand(cwd);
  if (buildCmd) {
    try {
      run(buildCmd, cwd, Math.min(BUILD_TIMEOUT_MS, remainingBudget()));
    } catch (e) {
      if (e.killed || /ETIMEDOUT/.test(String(e.code))) {
        visibleSkip("빌드가 예산 내에 끝나지 않음 (콜드 빌드 추정)");
      }
      block("xcodebuild 빌드", `${e.stdout || ""}\n${e.stderr || ""}`);
    }
  }

  // 4-3. 테스트: 오버라이드로 지정된 경우에만 (기본 프로젝트들에 테스트 타겟 없음)
  if (config.test) {
    if (overBudget()) visibleSkip("검증 예산(240s) 초과 (test 전)");
    try {
      run(config.test, cwd, remainingBudget());
    } catch (e) {
      block("test(설정 명령)", `${e.stdout || ""}\n${e.stderr || ""}`);
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
