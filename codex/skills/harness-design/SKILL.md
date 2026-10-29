---
name: harness-design
description: Implement only the UI stage from Figma or measured design input using this project's common component library and harness design criteria.
---

`.codex/harness/references/design.md`와 플랫폼의 design-system.md 또는 figma-aos-common-guide.md를 읽는다. 문서가 없으면 실제 프로젝트 가이드와 유사 화면을 확인한다.
요청된 Figma 입력은 사용 가능한 Figma 도구로 읽고 필요한 Figma 스킬을 적용한다. 연결이 없으면 확인하지 못한 값을 추측하지 말고 독립적으로 가능한 작업을 진행한다.
요소·변형을 목록화하고 기존 공통 컴포넌트와 토큰에 매핑한다. 이 단계에서는 UI와 더미 상태·Preview/Story만 구현하고 업무 로직과 API는 TODO로 남긴다.
참조 문서의 DoD를 검증하고 `node .codex/harness/verify.cjs`를 실행한다. 빌드와 실제 렌더링 검증을 구분한다.
