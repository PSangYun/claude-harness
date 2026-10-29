---
name: harness-logic
description: Implement described UI behavior, state transitions, validation, and navigation while leaving network calls as repository stubs in this harness.
---

`.codex/harness/references/logic.md`를 읽는다. 없으면 프로젝트의 실제 상태·내비게이션 규약을 기준으로 동작 목록과 DoD를 정한다.
기능 정의를 동작·상태 전이·검증·오류·이동으로 목록화한다. API는 인터페이스와 컴파일 가능한 TODO 스텁으로 유지한다.
AOS에서는 존재하는 UDF·Data 가이드를 읽고 Result 보존·lifecycle 소비·중복 요청 방지를 구현한다. UseCase는 가이드의 추가 조건을 충족할 때만 만든다.
검증 후 동작 목록 ↔ 구현 근거를 대조하고 `node .codex/harness/verify.cjs`를 실행한다. 런타임 확인이 없으면 명시한다.
