// SessionStart 훅: 실행 중인 모델에 맞는 운영 규칙 판을 컨텍스트로 주입
// - 기본값은 토큰 절약을 위해 COMPACT_PROMPT를 주입한다.
// - CLAUDE_HARNESS_STYLE_PROMPT=full 일 때만 SYSTEM_PROMPT 전체판을 주입한다.
// - CLAUDE_HARNESS_INJECT_MODEL_RULES=0 이면 추가 주입을 건너뛴다.
const fs = require('fs');
const path = require('path');

let input = '';
process.stdin.on('data', d => (input += d));
process.stdin.on('end', () => {
  if (process.env.CLAUDE_HARNESS_INJECT_MODEL_RULES === '0') process.exit(0);

  let model = '';
  try {
    model = (JSON.parse(input).model || '').toLowerCase();
  } catch (e) {}

  const family = model.includes('sonnet') ? 'SONNET_STYLE' : 'OPUS_4_8_STYLE';
  const variant = process.env.CLAUDE_HARNESS_STYLE_PROMPT === 'full' ? 'SYSTEM' : 'COMPACT';
  const file = `${family}_${variant}_PROMPT.md`;

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
