---
name: harness-component
description: Build or update a shared design-system library component, its variants, preview or stories, exports, and public API documentation using this harness.
---

manifest에서 library 여부를 확인하고 `.codex/harness/references/component.md`를 읽는다. 실제 라이브러리의 공개 API·컨벤션·토큰·컴포넌트 위치를 우선 확인한다.
디자인의 변형을 전수 대조하고 Preview/Story·공개 export·문서를 함께 갱신한다. 기존 컴포넌트를 중복 구현하지 않는다. 공개 API 파괴적 변경은 사용자 요청 범위를 확인한다.
참조 문서의 DoD와 verify로 검증한다. 배포는 별도 publish 요청이 있을 때만 수행한다.
