---
name: harness-logic
description: Implement requested behavior, validation, state transitions, and error handling for apps, services, CLI tools, or modules using existing architecture.
---

`.codex/harness/references/logic.md`를 읽는다. 없으면 프로젝트의 실제 상태·내비게이션 규약을 기준으로 동작 목록과 DoD를 정한다.
기능 정의를 입력·결과·상태 전이·검증·오류·수명으로 목록화한다. 이동은 UI가 있을 때만 다룬다. 네트워크 연결을 별도 단계로 요청받았으면 API 스텁을 유지하고, 통합 구현 요청이면 필요한 연결까지 진행한다.
AOS에서 루트에 채택된 UDF·Data 가이드가 있으면 Result 보존·lifecycle 소비·중복 요청 방지를 따른다. 그 외에는 기존 아키텍처를 유지한다.
검증 후 동작 목록 ↔ 구현 근거를 대조하고 `node .codex/harness/verify.cjs`를 실행한다. 런타임 확인이 없으면 명시한다.
