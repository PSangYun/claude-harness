#!/bin/bash
# 팀별 Claude Code 하네스 — 글로벌 자산(~/.claude) 설치 스크립트
#
# 사용법:  ./install.sh <web|ios|aos>
# (Windows는 Git Bash에서 실행 — Node.js 필요)
set -e

P="$1"
if [ -z "$P" ] || [ ! -d "$(dirname "$0")/$P/global" ]; then
  echo "사용법: ./install.sh <web|ios|aos>"
  exit 1
fi
SRC="$(cd "$(dirname "$0")/$P/global" && pwd)"
PROJ=""
[ -d "$(dirname "$0")/$P/project" ] && PROJ="$(cd "$(dirname "$0")/$P/project" && pwd)"
DST="$HOME/.claude"
STAMP="$(date +%Y%m%d)"

command -v node >/dev/null || { echo "❌ Node.js가 필요합니다 (훅이 node 기반) — 설치 후 다시 실행하세요."; exit 1; }

mkdir -p "$DST/hooks" "$DST/commands" "$DST/agents"

# 디렉토리의 파일만 복사 (하위 디렉토리 재귀 없음, .editorconfig 같은 점 파일 포함). 동명 파일은 내용이 다를 때만 .bak-날짜 백업 후 교체
install_dir() { # $1=원본 디렉토리  $2=대상 디렉토리
  [ -d "$1" ] || return 0
  mkdir -p "$2"
  for f in "$1"/* "$1"/.[!.]*; do
    [ -f "$f" ] || continue
    base="$(basename "$f")"
    [ -f "$2/$base" ] && ! cmp -s "$f" "$2/$base" && cp "$2/$base" "$2/$base.bak-$STAMP"
    cp "$f" "$2/$base"
  done
}

# 1. 글로벌 자산 복사: hooks·commands·agents + (플랫폼에 있으면) prompts·rules·references·templates
for d in hooks commands agents prompts rules references templates templates/commands templates/workflows; do
  install_dir "$SRC/$d" "$DST/$d"
done
echo "✅ hooks / commands / agents (+ 플랫폼에 있으면 prompts·rules·references·templates) 설치"

# 1-1. aos: 프로젝트 자산(project/commands·workflows·templates)이 정본이고, ~/.claude/templates/ 는 그 씨딩 사본이다.
#      /harness-init Phase 3가 ~/.claude/templates/{commands,workflows}/ 와 ~/.claude/templates/ 의 파일
#      (.worktreeinclude·ci.yml·stop-gate.json·gitattributes/gitignore 블록·lint-setup.md·.editorconfig)에서 각 프로젝트로 씨딩한다.
#      (web/ios는 maintain·review-loop를 글로벌 commands/ 에 활성 상태로 두므로 해당 없음)
if [ "$P" = "aos" ] && [ -n "$PROJ" ]; then
  install_dir "$PROJ/commands" "$DST/templates/commands"
  install_dir "$PROJ/workflows" "$DST/templates/workflows"
  install_dir "$PROJ/templates" "$DST/templates"
  echo "✅ templates/ 씨딩 원본 갱신 — commands·workflows·프로젝트 템플릿 파일 (정본: $P/project/)"
fi

# 1-2. aos는 글로벌 Stop 훅을 두지 않는다 — 이전 설치가 남긴 사본이 있으면 안내만 (삭제는 사용자 판단)
if [ "$P" = "aos" ] && [ -f "$DST/hooks/stop-gate.js" ] && [ ! -f "$SRC/hooks/stop-gate.js" ]; then
  echo "ℹ️  ~/.claude/hooks/stop-gate.js 는 이전 설치의 잔재입니다 — aos 정본은 프로젝트 .claude/hooks/stop-gate.js 이므로 삭제해도 됩니다 (글로벌 settings.json에 Stop 훅이 없는지 확인)"
fi

# 2. CLAUDE.md — 없으면 복사, 있는데 하네스 규약이 없으면 백업 후 이어붙임, 있으면 건너뜀(내용이 다르면 교체 방법 안내)
if [ ! -f "$DST/CLAUDE.md" ]; then
  cp "$SRC/CLAUDE.md" "$DST/CLAUDE.md"
  echo "✅ CLAUDE.md 생성"
elif ! grep -q "루프 운영 규약" "$DST/CLAUDE.md"; then
  cp "$DST/CLAUDE.md" "$DST/CLAUDE.md.bak-$STAMP"
  { echo ""; cat "$SRC/CLAUDE.md"; } >> "$DST/CLAUDE.md"
  echo "✅ 기존 CLAUDE.md 뒤에 하네스 규약 추가 (백업: CLAUDE.md.bak-$STAMP)"
elif cmp -s "$SRC/CLAUDE.md" "$DST/CLAUDE.md"; then
  echo "☑️  CLAUDE.md가 하네스판과 동일 — 건너뜀"
else
  echo "☑️  CLAUDE.md에 하네스 규약이 이미 있음 — 건너뜀 (하네스 최신판으로 바꾸려면: cp ~/.claude/CLAUDE.md ~/.claude/CLAUDE.md.bak-$STAMP && cp \"$SRC/CLAUDE.md\" ~/.claude/CLAUDE.md)"
fi

# 3. settings.json — 병합 (기존 설정 보존)
#    · hooks: 이벤트별로 스크립트 파일명 기준 중복 방지 병합. $HOME 플레이스홀더는 설치 시점의 실제 홈 경로로 치환
#    · env 등 그 외 키: 기존 값은 절대 덮어쓰지 않고 없는 키만 추가
#    aos는 Stop 훅을 글로벌에 두지 않는다 — 프로젝트 .claude/settings.json에만 등록해 이중 실행을 막는 정책
if [ -f "$SRC/settings.json" ]; then
node - "$SRC/settings.json" "$DST/settings.json" <<'NODE'
const fs = require("fs");
const os = require("os");
const [srcPath, dstPath] = process.argv.slice(2);
const src = JSON.parse(fs.readFileSync(srcPath, "utf8"));
let dst = {};
try { dst = JSON.parse(fs.readFileSync(dstPath, "utf8")); } catch {}
const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
const home = os.homedir().replace(/\\/g, "/");
const added = [];
// 1) 훅: 이벤트별 스크립트 파일명 마커 기준 중복 방지 병합
dst.hooks = isObj(dst.hooks) ? dst.hooks : {};
for (const [event, entries] of Object.entries(src.hooks || {})) {
  dst.hooks[event] = Array.isArray(dst.hooks[event]) ? dst.hooks[event] : [];
  const have = JSON.stringify(dst.hooks[event]);
  for (const entry of entries) {
    const resolved = JSON.parse(JSON.stringify(entry).replace(/\$HOME/g, () => home));
    const marker = (JSON.stringify(resolved).match(/[\w.-]+\.js/) || [""])[0];
    if (marker && have.includes(marker)) continue;
    dst.hooks[event].push(resolved);
    added.push(event + "(" + (marker || "?") + ")");
  }
}
// 2) 그 외 키(env 등): 없는 키만 추가 — 사용자가 이미 정한 값은 보존
for (const [key, val] of Object.entries(src)) {
  if (key === "hooks") continue;
  if (isObj(val)) {
    if (key in dst && !isObj(dst[key])) continue;
    dst[key] = dst[key] || {};
    for (const [k, v] of Object.entries(val)) {
      if (k in dst[key]) continue;
      dst[key][k] = v;
      added.push(key + "." + k);
    }
  } else if (!(key in dst)) {
    dst[key] = val;
    added.push(key);
  }
}
if (added.length) {
  fs.writeFileSync(dstPath, JSON.stringify(dst, null, 2) + "\n");
  console.log("✅ settings.json 병합: " + added.join(", "));
} else {
  console.log("☑️  settings.json에 하네스 설정이 이미 있음 — 건너뜀");
}
NODE
else
  echo "☑️  글로벌 settings.json 없는 플랫폼 ($P) — 훅 병합 건너뜀"
fi

# 4. 동작 확인
if [ -f "$DST/hooks/stop-gate.js" ] && [ -f "$SRC/hooks/stop-gate.js" ]; then
  if echo '{}' | node "$DST/hooks/stop-gate.js" >/dev/null 2>&1; then
    echo "✅ stop-gate 동작 확인 (변경 없음 → 조용히 통과)"
  else
    echo "⚠️  stop-gate 확인 실패 — echo '{}' | node ~/.claude/hooks/stop-gate.js 를 직접 실행해 보세요"
  fi
else
  echo "☑️  글로벌 Stop 훅 없는 플랫폼 ($P) — 프로젝트 .claude/hooks/stop-gate.js 가 정본, /harness-init 이 등록·확인한다"
fi
if [ -f "$DST/hooks/inject-model-rules.js" ]; then
  if echo '{"model":"claude-fable-5-1"}' | CLAUDE_HARNESS_INJECT_MODEL_RULES=1 node "$DST/hooks/inject-model-rules.js" 2>/dev/null | grep -q additionalContext; then
    echo "✅ inject-model-rules 동작 확인 (SessionStart 시 모델별 규칙 주입)"
  else
    echo "⚠️  inject-model-rules 확인 실패 — ~/.claude/prompts/ 에 *_COMPACT_PROMPT.md 가 있는지 확인하세요"
  fi
fi

echo ""
echo "설치 완료 ($P). 각 저장소에서 /harness-init 을 실행해 .claude/ 프로젝트 자산을 씨딩·동기화하세요 (git 추적된 .claude/ 는 clone/pull로 따라옵니다)."
echo "이미 열려 있는 Claude 세션에는 글로벌 CLAUDE.md·rules 변경이 /clear 또는 재시작 전까지 적용되지 않습니다."
