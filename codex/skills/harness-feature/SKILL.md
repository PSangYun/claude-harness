---
name: harness-feature
description: Scaffold a feature, module, CLI entry point, or app screen using the current project's conventions without adding unrequested behavior.
---

`.codex/harness/manifest.json`과 `.codex/harness/references/feature.md`를 읽는다. 실제 유사 기능의 파일 구조·이름·진입점·의존 경계를 기준으로 검사 가능한 최소 뼈대를 만든다.
기능명·진입점·UI/API/공개 모듈 범위를 기존 요청과 코드에서 확인하고 결정할 수 없는 필수 정보만 묻는다. 컴파일되지 않는 자리표시자는 만들지 않는다.
화면·DI·Navigation은 프로젝트에 있을 때만 연결한다. CLI·서버·순수 모듈에 화면 파일을 추가하지 않는다. 뼈대 요청이면 세부 동작을 TODO로 남긴다.
변경 후 verify를 실행하고 참조 문서의 DoD를 항목별로 확인한다. checker 사용 여부와 미검증 항목을 밝힌다.
