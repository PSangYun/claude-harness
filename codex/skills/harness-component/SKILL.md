---
name: harness-component
description: Build or update a reusable library module, function, class, or UI component with public exports, compatibility checks, documentation, and relevant tests.
---

`.codex/harness/references/component.md`를 읽는다. 실제 라이브러리의 공개 API·컨벤션·소비자·모듈 위치를 우선 확인한다.
모듈·함수·클래스·UI 컴포넌트의 요청된 계약과 export·문서·관련 테스트를 확인한다. UI이면 디자인 변형과 기존 Preview/Story 도구를 활용한다. 새 도구나 디자인 시스템을 강제하지 않는다. 공개 API 파괴적 변경은 사용자 요청 범위를 확인한다.
참조 문서의 DoD와 verify로 검증한다. 배포는 별도 publish 요청이 있을 때만 수행한다.
