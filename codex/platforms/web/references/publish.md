> Codex 이식 기준: 이 문서의 플랫폼별 구현·DoD를 사용한다. 실행과 권한 규칙은 프로젝트 AGENTS.md 및 선택한 harness Skill을 따른다. verify.json은 `commands: [{name, command}]` 형식이다. 검증기는 자동 턴 종료 훅이 아니며 명시적으로 실행한다. 특정 버전·브랜치·프로젝트명은 실제 코드에서 재확인한다.

# $harness-publish — 라이브러리 배포 (react-common)

배포는 `.github/workflows$harness-publish.yml`이 담당한다 (release published 또는 workflow_dispatch → `npm ci` → `npm run build` → GitHub Packages `npm publish`). 이 커맨드는 그 전후 절차를 게이트와 함께 수행한다. **사용자가 명시적으로 요청했을 때만 실행** — 루프/자동화가 임의로 publish하지 않는다.

## Phase A: 배포 전 검증

1. `git status` 클린 확인 (미커밋 변경이 있으면 중단하고 보고)
2. 로컬 검증: `npm run type-check` 0 / `npm run lint` 0 / `npm run build` 성공
3. 직전 배포 이후 변경 요약 작성 (`git log <직전버전태그>..HEAD --oneline`) — 파괴적 변경 포함 여부 판정

## Phase B: 버전 갱신

- `package.json` version을 semver 규칙으로 올린다:
  - Props/export 파괴적 변경: major (사전에 사용자 합의 필수 — 소비 앱들이 `^` 범위로 의존)
  - 컴포넌트/Props 추가: minor
  - 버그 수정: patch
- 버전 커밋 생성 — **push는 사용자 확인 후**

## Phase C: 배포 트리거

1. 사용자 확인 후 push + GitHub Release 생성 (또는 publish.yml workflow_dispatch에 버전 입력)
2. Actions 실행 결과 확인 — 실패 시 로그 첨부해 보고

## Phase D: 소비 앱 안내

- 배포 후 사용자에게 보고: 새 버전, 변경 요약, 소비 앱(parkgolf-association-admin 등 `@itandsy/react-common` 사용처)의 업데이트 필요 여부 (`^` 범위면 lockfile 갱신만으로 반영)

## Definition of Done

1. type-check 0 / lint 0 / build 성공 (실행 결과)
2. 버전이 semver 규칙에 맞게 증가 (변경 성격 ↔ 증가 단위 근거, 파괴적 변경이면 사용자 승인 존재)
3. push/Release는 사용자 확인 후에만 수행됨
4. publish 워크플로우 성공 확인 (Actions 결과)
