# Codex 하네스 저장소

이 저장소는 Web·iOS·AOS용 AI 개발 하네스의 배포 원본이다. 실제 앱 프로젝트가 아니므로 Gradle/Xcode/npm 앱 빌드를 여기서 실행하지 않는다.

- Codex판 정본은 `codex/`다. 설치·사용법은 `codex/README.md`를 읽는다. 기존 Claude판은 `web/`, `ios/`, `aos/`와 `install.sh`에 보존한다.
- 공통 지침은 `codex/common/AGENTS.md`, 플랫폼 지침과 구현 기준은 `codex/platforms/`, 작업 Skills는 `codex/skills/`에서 수정한다.
- Claude판 업데이트를 옮길 때 규칙/DoD는 보존하되 Claude 전용 settings·훅 이벤트·모델명·Workflow DSL을 실행 가능한 Codex 기능처럼 복사하지 않는다.
- 설치기는 사용자 `AGENTS.md`·verify.json·기존 가이드를 보존하고 관리 파일 충돌을 감지해야 한다. 사용자 홈·실제 앱에 임의로 설치하지 말고 임시 프로젝트에서 검증한다.
- 검증: `node --test codex/tests/harness.test.cjs`, `node --check codex/install.cjs`, `node --check codex/scripts/verify.cjs`, `git diff --check`.
- 테스트는 임시 Git 저장소를 만든다. 샌드박스가 .git 쓰기를 막으면 그 환경 실패를 코드 실패와 구분한다. 실제 저장소 권한을 완화하지 않는다.
- 검증 불가·타임아웃·환경 오류는 PASS가 아니다. 앱·라이브러리와 Web·iOS·AOS의 설치/재설치 동작을 유지한다.
- 한국어로 보고하고 변경·검증·미검증 범위를 구분한다. 커밋·푸시는 사용자가 요청한 경우에만 한다.
