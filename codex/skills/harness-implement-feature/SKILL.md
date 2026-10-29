---
name: harness-implement-feature
description: Carry a feature through the available design, behavior, and API stages with per-stage DoD verification using the installed Codex harness.
---

입력의 도메인·디자인·동작 명세·API 명세와 기존 구현 상태를 확인한다. 이미 완료된 단계를 다시 만들지 않고, 자료가 준비된 단계까지 진행한다.
해당 단계별 design.md → logic.md → connect-api.md를 필요할 때 읽고 수행한다. web에 참조 문서가 없으면 기존 코드와 사용자 명세에서 동일 단계의 DoD를 정한다.
각 단계에서 변경 파일·계약/시그니처·검증 근거·미해결 질문을 기록해 다음 단계에 넘긴다. 필수 입력 누락은 해당 의존 작업을 멈추고 질문한다. 독립적인 작업은 계속한다.
검증은 verify와 단계별 DoD로 한다. smoke.md의 런타임 결과와 컴파일 결과를 구분한다. 실패는 최대 3회 수정·재판정하며, checker가 없으면 자가 검증임을 명시한다.
라이브러리에는 앱 파이프라인을 적용하지 않고 component 절차를 사용한다. 배포·외부 게시·커밋은 이 파이프라인에 포함되지 않는다.
