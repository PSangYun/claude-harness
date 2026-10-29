> Codex 이식 기준: 이 문서의 플랫폼별 구현·DoD를 사용한다. 실행과 권한 규칙은 프로젝트 AGENTS.md 및 선택한 harness Skill을 따른다. verify.json은 `commands: [{name, command}]` 형식이다. 검증기는 자동 턴 종료 훅이 아니며 명시적으로 실행한다. 특정 버전·브랜치·프로젝트명은 실제 코드에서 재확인한다.

# $harness-publish — 라이브러리 배포 (ios-common)

⚠️ ios-common은 ParkGolfIOS가 SPM으로 **브랜치 `1.0.0`을 추적**한다 (semver 태그 잠금 아님). 즉 **`1.0.0` 브랜치에 push하는 순간이 배포**이고, 소비 앱은 다음 패키지 resolve 때 그대로 따라온다. **사용자가 명시적으로 요청했을 때만 실행** — 루프/자동화가 임의로 push하지 않는다.

## Phase A: 배포 전 검증

1. `git status` 클린 확인, 현재 브랜치 확인 (`1.0.0`인지 별도 작업 브랜치인지)
2. 라이브러리 빌드: `xcodebuild -scheme ios-common -destination 'generic/platform=iOS Simulator' -quiet build` 성공
3. 이번 변경에 **공개 API 시그니처 변경이 포함되어 있으면**: 변경 목록을 표로 정리해 사용자에게 보여주고 진행 여부 확인 (소비 앱이 즉시 깨질 수 있는 유일한 지점)

## Phase B: 소비 앱 영향 확인 (공개 API 변경 시 필수, 그 외 권장)

- ParkGolfIOS 체크아웃이 로컬에 있으면: ios-common 로컬 참조로 교체 후 앱 빌드 1회 (`xcodebuild -workspace ParkGolfIOS.xcworkspace -scheme ParkGolfIOS ... build`)
- 로컬에 없으면: 영향 범위(변경된 public 심볼을 앱이 사용하는지)를 GitHub 코드 검색으로 확인하고 결과를 근거로 첨부

## Phase C: 배포 (push)

1. 커밋 메시지에 변경 요약 포함
2. **사용자 확인 후** `1.0.0` 브랜치에 push
3. push 후 사용자에게 보고: 소비 앱에서 패키지 re-resolve 시 반영됨 (`-resolvePackageDependencies`)

## Definition of Done

1. 라이브러리 빌드 성공 (실행 결과)
2. 공개 API 변경 여부가 명시적으로 판정됨 (변경 있으면 사용자 승인 근거 존재)
3. 공개 API 변경 시 소비 앱 영향 확인 수행됨 (빌드 결과 또는 사용처 검색 근거)
4. push는 사용자 확인 후에만 수행됨

## 참고 (개선 제안 — 발견 시 사용자에게 안내)

브랜치 추적은 의도치 않은 전파 사고의 원인이 된다. 여유가 될 때 **semver 태그 배포**(예: `1.1.0` 태그 + 앱에서 `from: "1.1.0"` 잠금)로 전환하면 이 커맨드의 Phase B가 불필요해지고 롤백도 쉬워진다.
