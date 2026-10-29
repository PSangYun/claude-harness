> Codex 이식 기준: 이 문서의 플랫폼별 구현·DoD를 사용한다. 실행과 권한 규칙은 프로젝트 AGENTS.md 및 선택한 harness Skill을 따른다. verify.json은 `commands: [{name, command}]` 형식이다. 검증기는 자동 턴 종료 훅이 아니며 명시적으로 실행한다. 특정 버전·브랜치·프로젝트명은 실제 코드에서 재확인한다.

# $harness-publish — 라이브러리 배포 (aos-common)

프로젝트 AGENTS.md의 Publish 절차를 게이트와 함께 수행한다. **사용자가 명시적으로 요청했을 때만 실행** — 루프/자동화가 임의로 publish하지 않는다.

## Phase A: 배포 전 검증

1. `git status` 클린 확인 (미커밋 변경이 있으면 중단하고 보고)
2. `./gradlew -q :AosCommon:compileReleaseKotlin` 성공
3. `AOS_COMMON_GUIDE.md`의 버전 표기 ↔ 이번 배포 버전 일치 확인 (가이드가 낡았으면 먼저 갱신)

## Phase B: 버전 갱신

1. `AosCommon/build.gradle.kts`의 배포 버전(`com.itappandsy:aos-common:x.y.z`)을 semver 규칙으로 올린다:
   - 공개 API 파괴적 변경: major (사전에 사용자 합의 필수)
   - 컴포넌트/파라미터 추가: minor
   - 버그 수정: patch
2. `AOS_COMMON_GUIDE.md` 상단 버전 표기 갱신

## Phase C: 배포

1. GPR 자격증명 확인 (`local.properties`의 gpr.user/gpr.key 또는 env) — 없으면 중단하고 환경 문제로 보고
2. `./gradlew :AosCommon:publishReleasePublicationToGitHubPackagesRepository`
3. 커밋: `feat: x.y.z publish` (AGENTS.md 커밋 컨벤션) — **push는 사용자 확인 후**

## Phase D: 소비 앱 안내

- 배포 후 사용자에게 보고: 새 버전, 변경 요약, **소비 앱(ParkGolfAOS 등)이 해야 할 일** (build.gradle.kts 버전 갱신 + 앱의 AOS_COMMON_GUIDE.md 사본 교체 — 버전 드리프트 방지)

## Definition of Done

1. compileReleaseKotlin 성공 (실행 결과)
2. 버전이 semver 규칙에 맞게 증가 (변경 성격 ↔ 증가 단위 근거)
3. `AOS_COMMON_GUIDE.md` 버전 표기 = build.gradle.kts 배포 버전
4. publish 태스크 성공 (실행 결과 — 401이면 환경 문제로 구분)
5. `feat: x.y.z publish` 커밋 생성됨 (push 여부는 사용자 결정)
