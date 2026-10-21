#!/usr/bin/env node
/**
 * stop-gate.js — Stop 훅 (AOS: Gradle compileDebugKotlin + lint + 짝 테스트 결정적 게이트)
 *
 * Claude가 턴을 끝내려 할 때 실행된다. Kotlin 코드 변경이 있으면 프로젝트에 존재하는 검증
 * (compileDebugKotlin / ktlint·detekt 선언 시 / 변경 파일의 짝 단위 테스트)만 자동 감지해 실행하고,
 * 실패 시 턴 종료를 차단(block)하여 Claude가 스스로 수정하게 만든다.
 *
 * 설계 원칙:
 * - 범용: settings.gradle(.kts)의 모듈을 파싱해 변경된 모듈만 컴파일. wrapper 없는 프로젝트는 가시화 스킵
 * - 크로스플랫폼: Windows(git-bash 개발 환경)에서는 gradlew.bat, macOS/Linux에서는 ./gradlew
 * - fail-open: 훅 자체 오류·인프라 문제(GPR 자격증명 부재, SDK 경로 미설정 등)로는 절대 차단하지 않음 (exit 0)
 * - 단, fail-open으로 인한 스킵은 "조용히" 넘어가지 않고 systemMessage로 가시화한다
 * - 동시 세션 안전 (Claude 여러 개 + Android Studio가 같은 저장소를 쓰는 상황이 기본 전제):
 *   · 검사 루트 = 훅 입력 cwd가 속한 git 작업트리 루트 (worktree면 그 worktree).
 *     CLAUDE_PROJECT_DIR은 worktree 안에서도 메인 체크아웃을 가리키므로 루트 판정에 쓰지 않는다
 *   · 저장소 단위 락(임시 디렉토리)으로 stop-gate끼리의 동시 Gradle 실행을 직렬화하고, 짧게 기다려도
 *     못 잡으면 가시화 스킵 — 다른 세션의 빌드를 죽이거나 캐시를 지우지 않는다
 *   · 다른 빌드와의 산출물 경합·증분 캐시 깨짐 시그니처(Unable to delete, FileAlreadyExistsException 등)는
 *     코드 오류가 아니므로 차단하지 않고 가시화 스킵 (단 Kotlin 컴파일 에러 `e:` 가 함께 있으면 코드 문제로 차단)
 * - 무한 루프 방지: 차단 후 재진입(stop_hook_active) 시에도 수정본을 재검증하되,
 *   같은 턴 체인에서 3회 초과 차단이면 fail-open (Claude Code 자체 상한 8회보다 먼저 멈춤)
 * - 비용 0 경로: 코드 변경 없는 Q&A 턴은 git diff 확인만 하고 즉시 통과
 * - 자기방어: 하네스 훅(.claude/hooks/*.js)이 바뀌면 최소 구문 검증(node --check)을 돌린다
 * - 테스트 범위: 기본은 변경 파일의 짝 테스트(<이름>Test 등)만 `--tests`로 실행하고 스크린샷 테스트는 제외 —
 *   모듈 전체 실행은 느려서 예산(240s)을 넘기기 쉽다
 * - 단일 Gradle 호출: compile·lint·짝 테스트 태스크를 한 번의 `gradlew --continue` 호출에 넘겨 설정 단계를 1회만 치른다.
 *   실패 태스크는 출력의 "Execution failed for task ':m:task'"로 식별해 차단 사유에 표시 (커스텀 명령만 따로 실행)
 * - PASS 스탬프: 변경 파일 서명(경로+mtime+size)+HEAD가 같으면 12시간 동안 재검증 생략 —
 *   수정 없이 질문만 오가는 턴에서 Gradle을 다시 돌리지 않는다 (내용이 바뀌면 서명이 달라져 즉시 무효)
 * - 명령 오버라이드: `.claude/stop-gate.json` { "lint", "build", "test", "testScope", "excludeTests" }
 *   (설명 달린 예시: .claude/templates/stop-gate.json)
 *
 * 정본은 프로젝트 `.claude/hooks/stop-gate.js` 하나다 (하네스 저장소: aos/project/hooks/stop-gate.js).
 * 글로벌 ~/.claude/hooks 에는 두지 않는다 — 프로젝트 settings.json이 유일한 등록 지점이며,
 * 훅 명령은 `node "${CLAUDE_PROJECT_DIR}/.claude/hooks/stop-gate.js"` 로 세션 루트 기준 절대 경로를 쓴다
 * (훅 셸은 macOS/Linux sh, Windows는 Git Bash — Git Bash가 없으면 PowerShell로 떨어져 변수 확장이 안 되므로 Git Bash 필수).
 */

const { execSync } = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");

const STEP_TIMEOUT_MS = 60_000;
const GRADLE_TIMEOUT_MS = 210_000; // 데몬 콜드 스타트 감안 별도 상한
const BUDGET_MS = 240_000; // 등록 timeout(300s)보다 작게 — 초과 시 fail-open(가시화)
const LOCK_WAIT_MS = 20_000; // 다른 stop-gate가 같은 저장소를 빌드 중이면 이만큼만 기다린 뒤 가시화 스킵
const LOCK_STALE_MS = 10 * 60_000; // 이보다 오래된 락은 비정상 종료 잔재로 보고 회수
const STAMP_TTL_MS = 12 * 60 * 60_000; // PASS 스탬프 유효 기간 — 변경 서명+HEAD 가 같으면 이 동안 재검증 생략
const MAX_REASON_LINES = 30;
const MAX_BUFFER = 10 * 1024 * 1024;
const CODE_EXT = /\.(kt|kts|java)$/;
const PROJ_FILE = /(build\.gradle(\.kts)?|settings\.gradle(\.kts)?|libs\.versions\.toml|gradle\.properties|AndroidManifest\.xml)$/;
const RES_FILE = /(^|\/)src\/[^/]+\/res\/.+\.xml$/; // 리소스 XML — 개명·삭제 시 R 참조 깨짐도 게이트 대상
const DEFAULT_TEST_EXCLUDE = /(Screenshot|Roborazzi|Paparazzi)Test/; // 스크린샷 테스트는 느리고 환경 의존적 — 기본 제외
const START_MS = Date.now();

const sha1 = (s) => crypto.createHash("sha1").update(s).digest("hex");
// 동기 대기 (락 폴링용) — Node 메인 스레드에서 Atomics.wait 허용
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

const readStdin = () => {
  try {
    return fs.readFileSync(0, "utf8");
  } catch {
    return "";
  }
};

// 훅 출력은 동기 write — process.exit 직전의 비동기 stdout 쓰기 유실 방지 (Windows 파이프는 비동기)
const emit = (obj) => {
  const s = JSON.stringify(obj);
  try {
    fs.writeSync(1, s);
  } catch {
    process.stdout.write(s);
  }
};

const run = (cmd, cwd, timeout = STEP_TIMEOUT_MS) =>
  execSync(cmd, { cwd, timeout, stdio: ["ignore", "pipe", "pipe"], encoding: "utf8", maxBuffer: MAX_BUFFER });

// Gradle 출력에서 에러 라인만 추출 (없으면 마지막 N줄)
//   e: (Kotlin) · error: (Java/AGP) · FAILURE/What went wrong/Execution failed/"> " (Gradle 요약) · <파일>.kt:줄:열 (ktlint/detekt 위반 — w: 경고는 제외)
const isErrorLine = (l) =>
  /^e:|error:|FAILURE:|What went wrong|Execution failed for task|Compilation error|^> /i.test(l) ||
  (/\.kts?:\d+:\d+/.test(l) && !/^w: /.test(l));
const extractErrors = (output) => {
  // Windows gradlew.bat 출력은 CRLF — \r 이 reason에 남지 않게 줄 단위로 제거
  const all = String(output || "").split(/\r?\n/).filter(Boolean);
  const errs = all.filter((l) => isErrorLine(l.trim()));
  return (errs.length ? errs : all.slice(-MAX_REASON_LINES)).slice(0, MAX_REASON_LINES);
};

// 차단 횟수 추적(세션+저장소 단위 임시 파일) — 재진입 재검증의 무한 루프 방지용
let blocksPath = null;
const readBlocks = () => {
  try {
    return parseInt(fs.readFileSync(blocksPath, "utf8"), 10) || 0;
  } catch {
    return 0;
  }
};
const bumpBlocks = () => {
  try {
    if (blocksPath) fs.writeFileSync(blocksPath, String(readBlocks() + 1));
  } catch {
    /* 무시 */
  }
};
const clearBlocks = () => {
  try {
    if (blocksPath) fs.unlinkSync(blocksPath);
  } catch {
    /* 무시 */
  }
};

// ── 저장소 단위 빌드 락 ──
// 같은 저장소(worktree 포함)에서 여러 세션의 stop-gate가 동시에 Gradle을 돌리면 build/ 산출물 경합이 나므로
// 한 번에 하나만 빌드한다. 락은 stop-gate끼리만 조율한다 — Android Studio·터미널 빌드는 경합 시그니처 분류로 대응
let lockPath = null;
let lockHeld = false;
const releaseLock = () => {
  if (!lockHeld) return;
  lockHeld = false;
  try {
    fs.unlinkSync(lockPath);
  } catch {
    /* 무시 */
  }
};
process.on("exit", releaseLock);
const isPidAlive = (pid) => {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return Boolean(e && e.code === "EPERM"); // 권한 없음 = 살아 있는 다른 사용자 프로세스
  }
};
const tryAcquireLock = () => {
  try {
    const fd = fs.openSync(lockPath, "wx");
    fs.writeSync(fd, `${process.pid}\n${Date.now()}`);
    fs.closeSync(fd);
    lockHeld = true;
    return true;
  } catch (e) {
    if (!e || e.code !== "EEXIST") return true; // 락 파일을 만들 수 없는 환경 → 락 없이 진행 (fail-open)
  }
  try {
    const [pidStr, tsStr] = fs.readFileSync(lockPath, "utf8").split("\n");
    const stale = !isPidAlive(parseInt(pidStr, 10)) || Date.now() - (parseInt(tsStr, 10) || 0) > LOCK_STALE_MS;
    if (stale) fs.unlinkSync(lockPath); // 잔재 회수 → 다음 시도에서 획득
  } catch {
    /* 읽기/삭제 실패 → 다음 폴링에서 재시도 */
  }
  return false;
};
const acquireLock = (repoKey, maxWaitMs) => {
  lockPath = path.join(os.tmpdir(), `stop-gate-lock-${sha1(repoKey)}`);
  const deadline = Date.now() + maxWaitMs;
  for (;;) {
    if (tryAcquireLock()) return true;
    if (Date.now() >= deadline) return false;
    sleep(2_000);
  }
};

const block = (label, output) => {
  bumpBlocks();
  emit({
    decision: "block",
    reason: `[stop-gate] ${label} 실패 — 아래 에러를 수정한 후 다시 완료를 선언할 것:\n${extractErrors(output).join("\n")}`,
  });
  process.exit(0);
};

// fail-open 하되 "조용히" 넘어가지 않게 사유를 사용자에게 노출하고 통과
const visibleSkip = (why) => {
  clearBlocks();
  emit({
    systemMessage: `[stop-gate] ${why} — 일부 검증을 건너뜀(fail-open). 수동으로 ./gradlew compileDebugKotlin 확인 권장.`,
  });
  process.exit(0);
};

const overBudget = () => Date.now() - START_MS > BUDGET_MS;
const remainingBudget = () => Math.max(10_000, BUDGET_MS - (Date.now() - START_MS));

// 환경 문제(자격증명·의존성 해석·SDK 경로·네트워크)는 코드 문제가 아니므로 차단하지 않고 가시화만
const isEnvFailure = (output) =>
  /401 Unauthorized|Could not resolve|Could not GET 'https:\/\/maven\.pkg\.github\.com|gpr\.(user|key)|GPR_(USER|KEY)|Could not determine the dependencies|SDK location not found|UnknownHostException|Read timed out|Connection (refused|reset)/i.test(
    String(output || "")
  );
// 동시 빌드 경합(다른 세션·Android Studio가 같은 build/ 를 동시에 씀) 또는 증분 캐시 깨짐 시그니처.
// Kotlin 컴파일 에러(e: …)가 함께 있으면 코드 문제로 보고 경합으로 분류하지 않는다
const CONTENTION_RE =
  /Unable to delete (directory|file)|NoSuchFileException|FileAlreadyExistsException|FileNotFoundException: .*[\\/]build[\\/]|failed to make parent directories|has files open|Failed to clean up output files|Timeout waiting to lock|Could not acquire lock|AccessDeniedException|being used by another process|daemon disappeared unexpectedly/i;
const hasKotlinErrors = (output) => /^e: /m.test(String(output || ""));
const isContentionFailure = (output) => !hasKotlinErrors(output) && CONTENTION_RE.test(String(output || ""));

const main = () => {
  let input = {};
  try {
    input = JSON.parse(readStdin() || "{}");
  } catch {
    /* stdin 파싱 실패 시 빈 입력으로 진행 */
  }

  // 0. 검사 루트 = 훅 입력 cwd가 속한 git 작업트리 루트 (worktree면 그 worktree). git 없음/repo 아님 → 게이트 대상 아님
  const inputCwd = input.cwd || process.cwd();
  let cwd = inputCwd;
  try {
    cwd = run("git rev-parse --show-toplevel", inputCwd, 5_000).trim() || inputCwd;
  } catch {
    process.exit(0);
  }

  // 1. 무한 루프 방지: 차단 후 재진입(stop_hook_active)이어도 수정본을 재검증한다.
  //    단 같은 턴 체인에서 3회 초과 차단이면 fail-open으로 전환해 루프를 끊는다.
  blocksPath = path.join(os.tmpdir(), `stop-gate-blocks-${sha1(`${input.session_id || ""}\n${cwd}`)}.count`);
  if (input.stop_hook_active === true && readBlocks() >= 3) {
    visibleSkip("같은 턴 체인에서 3회 차단 초과 — 재검증 중단");
  }

  // 2. 코드 변경 감지 (변경 없으면 비용 0으로 통과)
  const isGateFile = (f) => {
    if (!f) return false;
    if (!CODE_EXT.test(f) && !PROJ_FILE.test(f) && !RES_FILE.test(f) && !/\.(js|cjs|mjs)$/.test(f)) return false;
    if (f.includes("build/") || f.includes(".gradle/")) return false;
    // 숨김 디렉토리는 제외하되 .claude(하네스 자체)는 자기방어 위해 포함
    if (f.split("/").some((seg) => seg.startsWith(".") && seg !== ".claude")) return false;
    // .claude 밖의 js는 AOS 프로젝트 게이트 대상 아님
    if (/\.(js|cjs|mjs)$/.test(f) && !f.startsWith(".claude/")) return false;
    return true;
  };
  const toFiles = (out) =>
    String(out || "")
      .split("\n")
      .map((f) => f.trim())
      .filter(isGateFile);

  let head = "";
  try {
    head = run("git rev-parse HEAD", cwd, 5_000).trim();
  } catch {
    /* 커밋 없는 fresh repo → diff는 생략하고 untracked만으로 감지 */
  }
  let changed = [];
  try {
    const diff = head ? run("git diff --name-only HEAD", cwd, 10_000) : "";
    const untracked = run("git ls-files --others --exclude-standard", cwd, 10_000);
    changed = toFiles(`${diff}\n${untracked}`);
  } catch (e) {
    // repo 안에서의 git 실패(타임아웃·index.lock 등)는 무음이 아니라 가시화하고 통과
    visibleSkip(`git 변경 감지 실패(${String((e && e.code) || "unknown")})`);
  }

  // 2.1. 턴 안에서 커밋까지 끝난 변경 감지: 워킹트리가 깨끗해도 HEAD가 마지막 검증
  //      시점과 다르고 최근(15분 내) 커밋이면 커밋분을 검증 대상에 포함
  const headPath = path.join(os.tmpdir(), `stop-gate-head-${sha1(cwd)}.txt`);
  const recordHead = () => {
    try {
      if (head) fs.writeFileSync(headPath, head);
    } catch {
      /* 기록 실패는 무시 */
    }
  };
  if (changed.length === 0 && head) {
    let lastHead = "";
    try {
      lastHead = fs.readFileSync(headPath, "utf8").trim();
    } catch {
      /* 기록 없음 → 아래에서 현재 HEAD 기록 후 통과 */
    }
    if (/^[0-9a-f]{7,40}$/i.test(lastHead) && lastHead !== head) {
      try {
        const commitMs = parseInt(run("git log -1 --format=%ct", cwd, 5_000).trim(), 10) * 1000;
        if (Date.now() - commitMs <= 15 * 60_000) {
          changed = toFiles(run(`git diff --name-only ${lastHead} HEAD`, cwd, 10_000));
        }
      } catch {
        /* 이전 HEAD 유실(rebase·gc 등) → 검증 불가, 현재 HEAD 기록 후 통과 */
      }
    }
  }
  if (changed.length === 0) {
    recordHead();
    clearBlocks();
    process.exit(0);
  }

  const harnessJs = changed.filter((f) => f.startsWith(".claude/") && /\.(js|cjs|mjs)$/.test(f));
  const appFiles = changed.filter((f) => !f.startsWith(".claude/"));

  // 2.5. 중복 실행 방지 — 같은 변경 상태의 PASS를 STAMP_TTL_MS(12시간) 동안 기억.
  //      키 = 변경 파일 서명(경로+mtime+size) + HEAD. 내용이 바뀌면 서명이, pull/commit 이 있으면 HEAD 가 달라져 즉시
  //      무효화되므로 TTL 은 긴 안전망일 뿐이다. 수정 없이 질문만 오가는 턴에서 Gradle 을 다시 돌리지 않기 위한 장치
  //      (이전 2분은 사실상 매 턴 재실행이었다). 실패는 스탬프를 남기지 않는다
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
  const stampPath = path.join(os.tmpdir(), `stop-gate-${sha1(`${cwd}\n${head}\n${sig}`)}.pass`);
  try {
    if (Date.now() - fs.statSync(stampPath).mtimeMs < STAMP_TTL_MS) {
      clearBlocks();
      process.exit(0);
    }
  } catch {
    /* 스탬프 없음 → 검증 진행 */
  }
  const stamp = () => {
    try {
      fs.writeFileSync(stampPath, "");
    } catch {
      /* 스탬프 실패는 무시 */
    }
    recordHead();
    clearBlocks();
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

  // 4. Gradle wrapper 감지 — 없으면 조용히 넘기지 않고 가시화 스킵 (검증 공백을 사용자가 알아야 한다)
  const isWin = process.platform === "win32";
  // NoDefaultCurrentDirectoryInExePath=1 환경에서 cmd.exe가 현재 디렉터리의 bat을 못 찾으므로 .\ 명시
  const gradlew = isWin ? ".\\gradlew.bat" : "./gradlew";
  if (!fs.existsSync(path.join(cwd, isWin ? "gradlew.bat" : "gradlew"))) {
    visibleSkip(`저장소 루트(${cwd})에 Gradle wrapper(${isWin ? "gradlew.bat" : "gradlew"})가 없음 — Kotlin 변경을 검증하지 못함`);
  }
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
      // include(":a", ":b") / 여러 줄 include( … ) / Groovy include ':a', ':b' 모두 지원. includeBuild(...)는 제외
      const quoted = (s) => [...s.matchAll(/["']:?([\w.:-]+)["']/g)].map((q) => q[1]);
      modules = [
        ...new Set([
          ...[...src.matchAll(/\binclude\s*\(([^)]*)\)/g)].flatMap((m) => quoted(m[1])),
          ...[...src.matchAll(/\binclude[ \t]+(["'][^\n]*)/g)].flatMap((m) => quoted(m[1])),
        ]),
      ];
    } catch {
      /* 파싱 실패 → 아래 디렉토리 스캔 폴백 */
    }
  }
  if (modules.length === 0) {
    // 폴백: build.gradle(.kts)를 가진 1단계 디렉토리를 모듈로 간주
    try {
      modules = fs
        .readdirSync(cwd, { withFileTypes: true })
        .filter(
          (d) =>
            d.isDirectory() &&
            !d.name.startsWith(".") &&
            ["build.gradle.kts", "build.gradle"].some((b) => fs.existsSync(path.join(cwd, d.name, b)))
        )
        .map((d) => d.name);
    } catch {
      /* 전체 빌드로 폴백 */
    }
  }
  const modDir = (m) => m.replace(/:/g, "/");
  const moduleOf = (f) => modules.find((m) => f === m || f.startsWith(`${modDir(m)}/`));
  const changedModules = [...new Set(appFiles.map(moduleOf).filter(Boolean))];
  const taskFor = (task) =>
    changedModules.length > 0 ? changedModules.map((m) => `:${m}:${task}`).join(" ") : task;

  // 4-0. 저장소 단위 빌드 락 — 같은 저장소(worktree 포함)의 다른 세션 stop-gate와 Gradle 동시 실행 방지
  let repoKey = cwd;
  try {
    repoKey = path.resolve(cwd, run("git rev-parse --git-common-dir", cwd, 5_000).trim());
  } catch {
    /* 실패 시 작업트리 경로로 대체 */
  }
  if (isWin) repoKey = repoKey.replace(/\\/g, "/").toLowerCase();
  if (!acquireLock(repoKey, Math.min(LOCK_WAIT_MS, remainingBudget() / 4))) {
    visibleSkip("다른 세션이 같은 저장소를 빌드 중(stop-gate 락 대기 초과) — 그 빌드가 끝난 뒤 다음 턴 종료 시 재검증됨");
  }

  // 실패 태스크명은 Gradle 출력에서 직접 읽는다 (-q 에서도 "Execution failed for task ':app:xxx'." 는 출력됨)
  const failedTasksOf = (out) => [
    ...new Set(
      [...String(out || "").matchAll(/Execution failed for task '([^']+)'|^> Task (\S+) FAILED/gm)].map((m) => m[1] || m[2])
    ),
  ];
  const isTestTask = (t) => /(^|:)test[A-Za-z]*$/i.test(t); // :app:testDebugUnitTest 등 (ktlintTestSourceSetCheck 는 아님)

  // Gradle 실패 분류: 시간 초과·환경·경합은 가시화 스킵, 그 외(코드 오류)만 차단
  //   label 은 실패 태스크를 출력에서 못 찾을 때(시간 초과 등)의 대체 이름
  const failGradle = (label, e) => {
    const out = `${(e && e.stdout) || ""}\n${(e && e.stderr) || ""}`;
    const failed = failedTasksOf(out);
    const what = failed.length ? failed.join(", ") : label;
    if (e && (e.killed || /ETIMEDOUT/.test(String(e.code)))) {
      if (hasKotlinErrors(out)) block(what, out); // 죽기 전에 컴파일 에러가 이미 찍혔으면 코드 문제
      visibleSkip(`${what}가 예산 내에 끝나지 않음 (콜드 데몬 또는 다른 빌드와 경합 추정) — 다음 턴 종료 시 재검증됨`);
    }
    if (isEnvFailure(out)) visibleSkip(`${what} 중 의존성 해석/자격증명/SDK 경로 문제 — 코드 문제 아님`);
    if (isContentionFailure(out)) {
      visibleSkip(
        `${what} 중 빌드 산출물 경합 또는 증분 캐시 깨짐 추정(다른 세션·Android Studio 빌드와 겹침) — 코드 문제 아님. 다른 빌드가 끝난 뒤 재실행하면 보통 통과`
      );
    }
    // --tests 필터 불일치는 테스트 태스크만 실패했을 때만 생략한다 — --continue 로 lint 실패가 함께 찍혔으면 차단해야 한다.
    // compile·lint 는 통과한 상태이므로 PASS 스탬프를 남겨 같은 변경 상태에서 매 턴 재실행하지 않는다
    if (/No tests found for given includes/i.test(out) && !hasKotlinErrors(out) && failed.every(isTestTask)) {
      stamp();
      visibleSkip(`${what}: --tests 필터에 맞는 테스트 클래스를 찾지 못함(테스트 클래스명 ≠ 파일명 추정) — 테스트 검증 생략`);
    }
    block(what, out);
  };
  // 단일 Gradle 호출: 태스크를 전부 한 번에 넘겨 설정 단계를 1회만 치른다. --continue 로 compile 실패 시에도 lint 를 이어
  // 돌려 두 종류의 실패를 한 번의 차단에 모아 전달 (테스트는 compile 에 의존하므로 compile 실패 시 자동 생략)
  const runGradle = (label, taskArgs) => {
    try {
      run(`${gradlew} ${gradleFlags} --continue ${taskArgs}`, cwd, Math.min(GRADLE_TIMEOUT_MS, remainingBudget()));
    } catch (e) {
      failGradle(label, e);
    }
  };
  const runCustom = (label, cmd) => {
    try {
      run(cmd, cwd, Math.min(GRADLE_TIMEOUT_MS, remainingBudget()));
    } catch (e) {
      failGradle(label, e);
    }
  };

  // 4-1 ~ 4-3. 검증 태스크 조립 — Gradle 태스크(compile · lint · 테스트)는 batch 에 모아 4-4 에서 한 번에 실행한다.
  //   .claude/stop-gate.json 의 build/lint/test 커스텀 명령은 Gradle 태스크가 아닐 수 있으므로 각각 따로 실행
  const batch = []; // 단일 Gradle 호출에 넘길 태스크 인자
  const batchLabels = []; // 실패 태스크를 출력에서 못 찾을 때 쓰는 사람용 이름

  // 4-1. 컴파일: compileDebugKotlin — 결정적 타입 게이트
  if (!config.build) {
    batch.push(taskFor("compileDebugKotlin"));
    batchLabels.push("compileDebugKotlin");
  }

  // 4-2. 린트: ktlint/detekt가 빌드 스크립트에 선언된 경우에만 (도입 시 자동 활성화)
  if (!config.lint) {
    try {
      const buildFiles = [
        "build.gradle.kts",
        "build.gradle",
        ...changedModules.map((m) => `${modDir(m)}/build.gradle.kts`),
        ...changedModules.map((m) => `${modDir(m)}/build.gradle`),
      ].filter((f) => fs.existsSync(path.join(cwd, f)));
      const buildSrc = buildFiles.map((f) => fs.readFileSync(path.join(cwd, f), "utf8")).join("\n");
      if (/ktlint/i.test(buildSrc)) {
        batch.push(taskFor("ktlintCheck"));
        batchLabels.push("ktlintCheck");
      }
      if (/detekt/i.test(buildSrc)) {
        batch.push(taskFor("detekt"));
        batchLabels.push("detekt");
      }
    } catch {
      /* 린트 감지 실패는 무시 (컴파일은 batch 에 이미 들어 있음) */
    }
  }

  // 4-3. 테스트 — 범위는 .claude/stop-gate.json의 testScope
  //   paired(기본): 변경 .kt의 짝 테스트(<이름>Test/<이름>Tests/<이름>KtTest) + 변경된 테스트 파일만 --tests로 실행, 스크린샷 테스트 제외
  //   module      : 변경 모듈의 testDebugUnitTest 전체 (실질 테스트 파일이 있을 때만 — v1 동작)
  //   none        : 생략.  config.test 가 있으면 그 명령을 그대로 실행
  const stripExt = (p) => path.basename(p).replace(/\.(kt|java)$/, "");
  const testExclude = (() => {
    const v = config.excludeTests;
    if (Array.isArray(v) && v.length === 0) return /$^/; // 빈 배열 = 아무것도 제외하지 않음
    if (!v) return DEFAULT_TEST_EXCLUDE;
    try {
      return new RegExp(Array.isArray(v) ? v.join("|") : String(v));
    } catch {
      return DEFAULT_TEST_EXCLUDE;
    }
  })();
  // 모듈의 src/test 하위 테스트 소스 전수 (Example* 템플릿 제외)
  const listTestFiles = (m) => {
    const out = [];
    const walk = (dir) => {
      try {
        for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
          const p = path.join(dir, ent.name);
          if (ent.isDirectory()) walk(p);
          else if (/\.(kt|java)$/.test(ent.name) && !/^Example/.test(ent.name)) out.push(p);
        }
      } catch {
        /* 디렉토리 없음 */
      }
    };
    walk(path.join(cwd, modDir(m), "src", "test"));
    return out;
  };
  // package 선언 + 파일명(=클래스명 관례)으로 FQCN 산출
  const fqcnOf = (file) => {
    const name = stripExt(file);
    try {
      const m = fs.readFileSync(file, "utf8").match(/^\s*package\s+([\w.]+)/m);
      return m ? `${m[1]}.${name}` : name;
    } catch {
      return name;
    }
  };
  const pairedTestArgs = () => {
    const wanted = new Map(); // 모듈 → 찾을 테스트 클래스 단순명 집합
    for (const f of appFiles) {
      if (!/\.(kt|java)$/.test(f)) continue;
      const m = moduleOf(f);
      if (!m) continue;
      const base = stripExt(f);
      const names = wanted.get(m) || new Set();
      if (/\/src\/test\//.test(f)) names.add(base); // 변경된 테스트 파일 자체
      else [`${base}Test`, `${base}Tests`, `${base}KtTest`].forEach((n) => names.add(n));
      wanted.set(m, names);
    }
    const parts = [];
    for (const [m, names] of wanted) {
      const classes = [...new Set(listTestFiles(m).filter((p) => names.has(stripExt(p))).map(fqcnOf))].filter(
        (c) => !testExclude.test(c)
      );
      if (classes.length) parts.push(`:${m}:testDebugUnitTest ${classes.map((c) => `--tests "${c}"`).join(" ")}`);
    }
    return parts.join(" ");
  };
  const hasRealTests = () => (changedModules.length > 0 ? changedModules : modules).some((m) => listTestFiles(m).length > 0);

  const testScope = config.test ? "custom" : ["paired", "module", "none"].includes(config.testScope) ? config.testScope : "paired";
  let testArgs = "";
  if (testScope === "paired") testArgs = pairedTestArgs();
  else if (testScope === "module" && hasRealTests()) testArgs = taskFor("testDebugUnitTest");
  if (testArgs) {
    batch.push(testArgs);
    batchLabels.push(testScope === "paired" ? "testDebugUnitTest(짝 테스트)" : "testDebugUnitTest");
  }

  // 4-4. 실행: 커스텀 빌드 → Gradle 단일 호출(compile·lint·테스트) → 커스텀 lint → 커스텀 test
  if (config.build) {
    if (overBudget()) visibleSkip("검증 예산(240s) 초과 (빌드 전)");
    runCustom("빌드(설정 명령)", config.build);
  }
  if (batch.length > 0) {
    const label = batchLabels.join("·");
    if (overBudget()) visibleSkip(`검증 예산(240s) 초과 (${label} 전)`);
    runGradle(label, batch.join(" "));
  }
  if (config.lint) {
    if (overBudget()) visibleSkip("검증 예산(240s) 초과 (lint 전)");
    runCustom("lint(설정 명령)", config.lint);
  }
  if (testScope === "custom") {
    if (overBudget()) visibleSkip("검증 예산(240s) 초과 (test 전)");
    runCustom("test(설정 명령)", config.test);
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
