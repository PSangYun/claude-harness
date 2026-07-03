---
description: 유지보수 루프 — 프로젝트의 결정적 검증(lint/type-check/format/test)을 돌리고 기계적 수정만 수행한다. /loop와 함께 사용 가능.
---

# /maintain — 유지보수 루프 (모든 프로젝트 공용)

이 커맨드는 루프 엔지니어링의 유지보수 루브릭이다. **기계적으로 검증 가능한 것만 고치고, 동작 변경은 절대 하지 않는다.**

## 루브릭 (전부 충족 시 CLEAN)

package.json의 scripts를 읽고 **존재하는 것만** 실행한다:

1. `npm run lint` (또는 `npx eslint .`) — 에러 0 (warning은 보고만)
2. `npm run type-check`/`typecheck` (또는 `npx tsc --noEmit`) — 에러 0
3. `npm run format:check` (있으면) — 통과
4. `npm test` (vitest/jest 있으면) — 통과
5. TODO/FIXME 트리아지: `grep -rn "TODO\|FIXME" src/` — 목록화만 (수정은 사람 판단)
6. **프로젝트 루브릭**: 프로젝트 CLAUDE.md에 `## 프로젝트 루브릭` 섹션이 있으면 그 항목들도 검사에 포함

## 절차 (반드시 이 순서)

**Phase 1 — 진단**: 루브릭 전 항목 실행, 결과를 표로 정리 (항목 | 상태 | 에러 수)

**Phase 2 — 기계적 수정만**:
- `npx eslint --fix`, `npx prettier --write` 등 도구가 자동으로 고치는 것
- 명백한 단순 위반 (예: 금지된 클래스 제거, console.log → console.info)
- **금지**: 동작 변경 리팩토링, API/비즈니스 로직 수정, 파일 구조 변경. 기계적이지 않은 문제는 수정하지 말고 보고 목록에 남길 것

**Phase 3 — 재검증**: 루브릭 재실행. 수정으로 인해 새 에러가 생겼으면 해당 수정을 되돌린다.

**Phase 4 — 보고**:
- 전부 통과면 한 줄: `CLEAN — lint 0 / type 0 / test 통과`
- 남은 문제는 "사람 판단 필요" 목록으로 정리 (파일:라인 + 한 줄 설명)
- **재발 패턴 발견 시**: 같은 종류의 위반이 반복되면 프로젝트 CLAUDE.md의 `## 반복되는 실수` 섹션에 날짜와 함께 1줄 추가. 이미 2회 이상 기록된 패턴이면 `.claude/hooks/quality-check.js`에 정규식 검사로 승격할 것을 사용자에게 제안

## 사용법

- 수동 1회: `/maintain`
- 세션 중 백그라운드 루프: `/loop /maintain` (동적 간격) 또는 `/loop 30m /maintain`
