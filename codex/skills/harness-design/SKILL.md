---
name: harness-design
description: Implement requested UI from design files, screenshots, or descriptions using the current project's components and style system.
---

`.codex/harness/references/design.md`와 `design-system.md`를 읽고 실제 프로젝트 가이드와 유사 화면을 확인한다. UI가 없는 작업에는 적용하지 않는다.
Figma 입력이 있을 때만 사용 가능한 Figma 도구와 관련 스킬을 적용한다. 스크린샷·설명 기반 요청에 Figma를 필수로 요구하지 않는다. 확인 못한 값은 출처와 가정을 구분한다.
요소·변형을 목록화하고 기존 컴포넌트·스타일·토큰을 재사용한다. UI 전용 단계라면 업무/API는 TODO로 남기고, 기존 Preview/Story 도구가 있을 때 활용한다.
참조 문서의 DoD를 검증하고 `node .codex/harness/verify.cjs`를 실행한다. 빌드와 실제 렌더링 검증을 구분한다.
