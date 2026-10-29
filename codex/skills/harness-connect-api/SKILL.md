---
name: harness-connect-api
description: Connect existing API stubs to documented endpoints, DTO mapping, repository implementations, and loading or error state in this harness.
---

`.codex/harness/references/connect-api.md`를 읽는다. 없으면 프로젝트의 기존 API·에러·캐시·인증 패턴을 확인한다.
명세와 TODO 연결 지점을 전수 대조하고 요청·응답 필드와 nullable을 보존한다. 키·URL은 기존 주입 경로를 사용한다.
AOS에서는 DATA_LAYER_GUIDE.md가 있으면 준수한다. DTO를 domain/presentation에 노출하지 않고 공통 호출 헬퍼에서 취소를 보존한다. 상태 변경의 불명확한 결과를 일반 실패로 처리해 무조건 재전송하지 않는다.
명세에 없는 필수 계약은 추측하지 않는다. 실제 서비스의 데이터 변경 요청은 사용자가 승인한 테스트 범위에서만 실행한다.
로딩·오류·성공 상태 및 DI를 연결하고 참조 DoD와 verify를 확인한다. 실제 서버·기기에서 확인하지 않은 항목은 미검증으로 남긴다.
