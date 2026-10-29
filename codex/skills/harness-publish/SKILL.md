---
name: harness-publish
description: Prepare and, when explicitly authorized, publish a shared library with version, guide, validation, and consumer compatibility checks.
---

`.codex/harness/references/publish.md`와 실제 배포 설정을 읽는다. 현재 버전·소비 방식·배포 트리거는 코드에서 확인한다.
사용자가 요청한 릴리스 범위에 맞춰 버전·가이드·공개 API·소비 앱 호환성을 검증한다. 먼저 review 가능한 변경과 검증 결과를 준비한다.
commit·push·tag·GitHub Release·publish는 해당 외부 작업이 사용자 요청에 포함될 때만 수행한다. 참조 문서의 명령 예시는 승인 자체가 아니다. 자격증명을 출력하지 않는다.
배포 전 DoD와 verify를 확인하고 성공 시 실제 실행 결과·버전·소비 앱 변경 사항을 보고한다. 배포 전 검증만 했으면 배포 완료라고 하지 않는다.
