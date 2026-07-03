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

# 1. 훅·커맨드·에이전트 복사 (기존 동명 파일은 백업 후 교체)
for d in hooks commands agents; do
  for f in "$SRC/$d"/*; do
    base="$(basename "$f")"
    [ -f "$DST/$d/$base" ] && ! cmp -s "$f" "$DST/$d/$base" && cp "$DST/$d/$base" "$DST/$d/$base.bak-$STAMP"
    cp "$f" "$DST/$d/$base"
  done
done
echo "✅ hooks / commands / agents 설치"

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

# 3. settings.json — Stop(stop-gate) 훅 병합 (기존 설정 보존)
node - "$SRC/settings.json" "$DST/settings.json" <<'EOF'
const fs = require("fs");
const [srcPath, dstPath] = process.argv.slice(2);
const src = JSON.parse(fs.readFileSync(srcPath, "utf8"));
let dst = {};
try { dst = JSON.parse(fs.readFileSync(dstPath, "utf8")); } catch {}
dst.hooks = dst.hooks || {};
dst.hooks.Stop = dst.hooks.Stop || [];
const has = JSON.stringify(dst.hooks.Stop).includes("stop-gate.js");
if (!has) {
  dst.hooks.Stop.push(...src.hooks.Stop);
  fs.writeFileSync(dstPath, JSON.stringify(dst, null, 2) + "\n");
  console.log("✅ settings.json에 Stop(stop-gate) 훅 등록");
} else {
  console.log("☑️  settings.json에 stop-gate 훅이 이미 등록됨 — 건너뜀");
}
EOF

# 4. 동작 확인
if echo '{}' | node "$DST/hooks/stop-gate.js" >/dev/null 2>&1; then
  echo "✅ stop-gate 동작 확인 (변경 없음 → 조용히 통과)"
else
  echo "⚠️  stop-gate 확인 실패 — echo '{}' | node ~/.claude/hooks/stop-gate.js 를 직접 실행해 보세요"
fi

echo ""
echo "설치 완료 ($P). 프로젝트 저장소를 clone/pull하면 .claude/ 프로젝트 자산은 자동으로 따라옵니다."
