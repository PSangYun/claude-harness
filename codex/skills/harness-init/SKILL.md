---
name: harness-init
description: Initialize or audit a project's Codex harness, AGENTS.md, architecture guides, and verification commands after installing this harness.
---

프로젝트 루트의 `.codex/harness/manifest.json`과 `AGENTS.md`를 읽는다. manifest가 없으면 이 하네스 저장소의 `codex/README.md` 설치 방법을 안내한다. 임의 플랫폼을 설치하지 않는다.

1. 실제 모듈·의존성·명령·소스 구조와 기존 지침을 대조한다. 기존 아키텍처를 강제로 이식하지 않는다.
2. `AGENTS.md`에 프로젝트 개요·실제 검증 명령·핵심 규칙·반복 실수 섹션을 보완한다. 다른 사용자 홈 경로나 프로젝트명은 복사하지 않는다.
3. `.codex/harness/verify.json`의 commands를 실제 프로젝트의 필수 검사 집합으로 설정한다. Python/CLI 등에는 컴파일을 강제하지 않는다. 값은 저장소 루트에서 실행되는 명령이다. 비밀 값·배포 명령은 넣지 않는다. 미도입 검사는 사유와 함께 별도 기록한다.
4. `generic`이면 해당 언어의 도구와 검사 명령을 확인한다. 특정 framework·패키지·디자인 시스템은 요구하지 않는다. Android UDF·Data 템플릿은 사용자가 신규 Compose 앱에 채택한 경우에만 루트에 씨딩하고, 기존 파일을 덮어쓰지 않는다.
5. `node .codex/harness/verify.cjs`로 실행 가능 여부를 확인한다. SKIP은 미검증으로 보고한다. 모바일 실행은 smoke 기준을 별도 적용한다.
6. 공유할 `AGENTS.md`, `.agents/skills/`, `.codex/harness/`, 가이드를 알려준다. 자동 git add·commit·push는 하지 않는다. 개인 `.codex/config.toml`이나 기존 `.claude/` 권한은 수정하지 않는다.

설치된 하네스에는 Claude Stop 훅·SessionStart 훅·Workflow DSL이 등록되지 않는다. 검증 명령은 명시적으로 실행하고, CI 강제가 필요하면 사용자의 CI 작업 범위에서 별도로 연결한다.
