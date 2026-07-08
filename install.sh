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
DST="$HOME/.claude"
STAMP="$(date +%Y%m%d)"

command -v node >/dev/null || { echo "❌ Node.js가 필요합니다 (훅이 node 기반) — 설치 후 다시 실행하세요."; exit 1; }

mkdir -p "$DST/hooks" "$DST/commands" "$DST/agents"

# 1. 훅·커맨드·에이전트 + (플랫폼에 있으면) prompts·templates 복사 (기존 동명 파일은 백업 후 교체)
for d in hooks commands agents prompts templates/commands templates/workflows; do
  [ -d "$SRC/$d" ] || continue
  mkdir -p "$DST/$d"
  for f in "$SRC/$d"/*; do
    [ -f "$f" ] || continue
    base="$(basename "$f")"
    [ -f "$DST/$d/$base" ] && ! cmp -s "$f" "$DST/$d/$base" && cp "$DST/$d/$base" "$DST/$d/$base.bak-$STAMP"
    cp "$f" "$DST/$d/$base"
  done
done
echo "✅ hooks / commands / agents (+ 플랫폼에 있으면 prompts·templates) 설치"

# 2. CLAUDE.md — 없으면 복사, 있는데 하네스 규약이 없으면 백업 후 이어붙임
if [ ! -f "$DST/CLAUDE.md" ]; then
  cp "$SRC/CLAUDE.md" "$DST/CLAUDE.md"
  echo "✅ CLAUDE.md 생성"
elif ! grep -q "루프 운영 규약" "$DST/CLAUDE.md"; then
  cp "$DST/CLAUDE.md" "$DST/CLAUDE.md.bak-$STAMP"
  { echo ""; cat "$SRC/CLAUDE.md"; } >> "$DST/CLAUDE.md"
  echo "✅ 기존 CLAUDE.md 뒤에 하네스 규약 추가 (백업: CLAUDE.md.bak-$STAMP)"
else
  echo "☑️  CLAUDE.md에 하네스 규약이 이미 있음 — 건너뜀"
fi

# 3. settings.json — 훅 병합 (기존 설정 보존, 이벤트별 스크립트 파일명 기준 중복 방지)
#    aos는 Stop 훅을 글로벌에 두지 않는다 — 프로젝트 .claude/settings.json에만 등록해
#    글로벌+프로젝트 이중 실행을 막는 정책. 글로벌에는 SessionStart(inject-model-rules)만 병합
if [ -f "$SRC/settings.json" ]; then
node - "$SRC/settings.json" "$DST/settings.json" <<'EOF'
const fs = require("fs");
const os = require("os");
const [srcPath, dstPath] = process.argv.slice(2);
const src = JSON.parse(fs.readFileSync(srcPath, "utf8"));
let dst = {};
try { dst = JSON.parse(fs.readFileSync(dstPath, "utf8")); } catch {}
dst.hooks = dst.hooks || {};
// $HOME 플레이스홀더는 설치 시점의 실제 홈 경로로 치환 — 훅 실행 셸의 변수 확장에 의존하지 않는다 (Windows 대비)
const home = os.homedir().replace(/\\/g, "/");
const added = [];
for (const [event, entries] of Object.entries(src.hooks || {})) {
  dst.hooks[event] = dst.hooks[event] || [];
  const have = JSON.stringify(dst.hooks[event]);
  for (const entry of entries) {
    const resolved = JSON.parse(JSON.stringify(entry).replace(/\$HOME/g, () => home));
    const marker = (JSON.stringify(resolved).match(/[\w.-]+\.js/) || [""])[0];
    if (marker && have.includes(marker)) continue;
    dst.hooks[event].push(resolved);
    added.push(event + "(" + (marker || "?") + ")");
  }
}
if (added.length) {
  fs.writeFileSync(dstPath, JSON.stringify(dst, null, 2) + "\n");
  console.log("✅ settings.json 훅 등록: " + added.join(", "));
} else {
  console.log("☑️  settings.json에 훅이 이미 등록됨 — 건너뜀");
}
EOF
else
  echo "☑️  글로벌 settings.json 없는 플랫폼 ($P) — 훅 병합 건너뜀"
fi

# 4. 동작 확인
if echo '{}' | node "$DST/hooks/stop-gate.js" >/dev/null 2>&1; then
  echo "✅ stop-gate 동작 확인 (변경 없음 → 조용히 통과)"
else
  echo "⚠️  stop-gate 확인 실패 — echo '{}' | node ~/.claude/hooks/stop-gate.js 를 직접 실행해 보세요"
fi

echo ""
echo "설치 완료 ($P). 프로젝트 저장소를 clone/pull하면 .claude/ 프로젝트 자산은 자동으로 따라옵니다."
