---
name: harness-maintain
description: Run a one-time maintenance audit and mechanical fixes for an installed Codex harness project, including validation and guide drift.
---

AGENTS.md·manifest·verify.json과 실제 검증 수단을 확인한다. `node .codex/harness/verify.cjs`를 실행한다. 필요하면 기존 lint/format 명령으로 기계적인 수정만 하고 재검증한다.
TODO/FIXME, 공통 라이브러리 의존 버전 ↔ 가이드 버전, 하네스 사본 ↔ 배포 원본의 차이는 목록으로 보고한다. 줄바꿈만 다른 것은 드리프트로 취급하지 않는다.
동작 변경·의존성 업그레이드·삭제·공개 API 리팩토링은 유지보수 명목으로 실행하지 않는다. 반복 일정은 별도 요청 없이는 만들지 않는다.
검사별 PASS/FAIL/SKIP과 남은 사람 판단 항목을 보고한다. 실제 검증 불가를 CLEAN으로 보고하지 않는다.
