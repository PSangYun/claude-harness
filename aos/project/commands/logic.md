---
description: 2단계 — 디스크립션 기반 동작 로직 구현 (Contract Intent + ViewModel onIntent dispatcher + StateFlow, API는 TODO 스텁). DoD 게이트 포함.
---

# /logic — 동작 구현 (2단계: 기능, API 연결 금지)

입력: Figma 디스크립션 URL 또는 기능정의서 + 대상 도메인명. 1단계(/design)에서 만든 UI에 동작을 붙인다. **API 연결은 3단계의 일** — 이 단계에서는 스텁까지만.

## Phase A: 디스크립션 분석

1. 디스크립션/기능정의서의 동작 항목을 **전수 목록화**: `[동작]`, `[필수 입력]`, `[검증 규칙]`, `[수정 시 다른 점]`, `[에러 케이스]`
2. 각 항목에 대해 `동작 | 트리거(Intent) | 상태 변화(UiState) | 구현 위치(ViewModel private 함수 / Route 네비게이션 변환)` 표 작성
3. 애매한 항목은 추측하지 말고 사용자에게 질문

## Phase B: 상태·시그니처 정의 (레이어 준수)

- `XxxContract`의 `XxxIntent` sealed interface(동작 목록 전수)·`XxxUiState`(1단계 더미를 실제 상태로, 유실되면 안 되는 결과용 `result` 필드 포함 여부)·`XxxNavigation` 확정 — ViewModel 공개 입력은 `onIntent(intent)` 하나, 실제 처리는 private 함수로 위임(`when` 안에 로직 작성 금지)
- domain 레이어에 필요한 모델/repository **인터페이스** 정의 (구현은 data 레이어 — 이 단계에서는 스텁)
- API가 필요한 지점은 repository 스텁 **빈 구현 + `// TODO: connect-api (3단계)`** — Retrofit 코드 작성 금지

## Phase C: 동작 구현

- 입력 검증, 상태 전이, 조건부 노출/비활성화 — 비즈니스 로직은 **ViewModel private 함수에**, Screen은 `state`·`onIntent`만 (UI 생명주기 전용 로컬 상태만 허용)
- 화면 전환은 Route의 단일 `onNavigate(XxxNavigation)` → 기능별 NavGraph가 수행. ViewModel에서 Navigation 실행 금지. 로그인 성공처럼 **유실되면 안 되는 결과**는 `UiState.result` + `ResultHandled` Intent로 처리 (Channel/SharedFlow Effect는 toast·스크롤 등 유실돼도 되는 UI 동작만)
- 에러/빈 상태 처리 (기존 패턴·aos-common toast 등 공통 사용)
- Route에서 `collectAsStateWithLifecycle`로 uiState 수집 (Screen은 ViewModel을 모른다). Activity Result·권한 같은 플랫폼 UI도 Route에서 처리해 Intent로 변환

## Phase D: 자가 확인

- 컴파일 성공: `./gradlew -q :<모듈>:compileDebugKotlin` + ktlint(있으면) 위반 0
- 순수 로직(상태 전이·검증 규칙)은 단위 테스트 작성 후 `./gradlew -q :<모듈>:testDebugUnitTest` 통과 (test-writer 규칙 준수)

## Definition of Done

1. Phase A 동작 목록이 전수 구현됨 (목록 ↔ 구현 대조표 근거)
2. API 지점은 전부 repository 스텁 + TODO — 신규 Retrofit/네트워크 코드 0건
3. 비즈니스 로직이 ViewModel에 있고 Screen은 `state`·`onIntent`만, Route에 `NavController`·Repository 없음, Intent/ViewModel에 Android UI 타입 없음, 레이어 방향 준수 (presentation→domain, domain에 Android 의존 없음)
4. 입력 검증·에러 상태 처리 구현됨 (디스크립션의 에러 케이스 전수), 화면 이동을 유발하는 결과는 `UiState.result` + `ResultHandled`로 처리
5. 컴파일 성공 + (작성한) 단위 테스트 통과 (실행 결과 근거)
6. 신규 코드에 `!!`·`Log.d`/`println`·UI 경로 `runBlocking` 0건

> **완료 선언 전 checker 서브에이전트의 PASS 판정 필수** (maker/checker 분리 — 글로벌 규약).

$ARGUMENTS
