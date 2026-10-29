---
name: harness-feature
description: Scaffold a feature's files and navigation in a project using this Codex harness, without implementing detailed UI or business logic.
---

`.codex/harness/manifest.json`에서 app 종류를 확인한다. library이면 component 절차를 사용한다.
`.codex/harness/references/feature.md`가 있으면 읽는다. 없으면 실제 유사 기능의 파일 구조·이름·진입점·DI 패턴을 기준으로 컴파일 가능한 최소 뼈대를 만든다.
도메인명·진입 경로·화면/API 범위는 기존 요청과 코드에서 먼저 확인하고 결정할 수 없는 필수 정보만 묻는다. 빈 data class처럼 컴파일되지 않는 자리표시자는 만들지 않는다.
세부 UI·업무 규칙·네트워크 연결은 이후 design/logic/connect-api 단계로 남긴다.
변경 후 verify를 실행하고 참조 문서의 DoD를 항목별로 확인한다. checker 사용 여부와 미검증 항목을 밝힌다.
