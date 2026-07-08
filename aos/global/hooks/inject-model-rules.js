// SessionStart 훅: 실행 중인 모델에 맞는 운영 규칙 판을 컨텍스트로 주입
// - sonnet 계열 → SONNET_STYLE_SYSTEM_PROMPT.md
// - 그 외(opus, fable, model 필드 누락 포함) → OPUS_4_8_STYLE_SYSTEM_PROMPT.md
//   (기존 전역 CLAUDE.md import와 동일한 동작 보존 — clear/resume 시 model 필드가 생략될 수 있음)
const fs = require('fs');
const path = require('path');

let input = '';
process.stdin.on('data', d => (input += d));
process.stdin.on('end', () => {
  let model = '';
  try {
    model = (JSON.parse(input).model || '').toLowerCase();
  } catch (e) {}

  const file = model.includes('sonnet')
    ? 'SONNET_STYLE_SYSTEM_PROMPT.md'
    : 'OPUS_4_8_STYLE_SYSTEM_PROMPT.md';

  let rules;
  try {
    rules = fs.readFileSync(path.join(__dirname, '..', 'prompts', file), 'utf8');
  } catch (e) {
    process.exit(0); // 규칙 파일이 없으면 조용히 통과 (세션 시작을 막지 않음)
  }

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: rules },
    })
  );
});
