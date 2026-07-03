---
description: 2단계 — 디스크립션 기반 동작 로직 구현 (ViewModel + StateFlow, API는 TODO 스텁). DoD 게이트 포함.
---

# /logic — 동작 구현 (2단계: 기능, API 연결 금지)

입력: Figma 디스크립션 URL 또는 기능정의서 + 대상 도메인명. 1단계(/design)에서 만든 UI에 동작을 붙인다. **API 연결은 3단계의 일** — 이 단계에서는 스텁까지만.

## Phase A: 디스크립션 분석

1. 디스크립션/기능정의서의 동작 항목을 **전수 목록화**: `[동작]`, `[필수 입력]`, `[검증 규칙]`, `[수정 시 다른 점]`, `[에러 케이스]`
2. 각 항목에 대해 `동작 | 트리거 | 상태 변화 | 구현 위치(VM/Screen)` 표 작성
3. 애매한 항목은 추측하지 말고 사용자에게 질문

## Phase B: 상태·시그니처 정의 (레이어 준수)

- `@HiltViewModel` ViewModel에 `uiState`(StateFlow) + 액션 함수 시그니처 확정 — 1단계 더미 상태를 실제 상태 모델(data class)로 교체
- domain 레이어에 필요한 모델/repository **인터페이스** 정의 (구현은 data 레이어 — 이 단계에서는 스텁)
- API가 필요한 지점은 repository 스텁 **빈 구현 + `// TODO: connect-api (3단계)`** — Retrofit 코드 작성 금지

## Phase C: 동작 구현

- 입력 검증, 상태 전이, 조건부 노출/비활성화 — 비즈니스 로직은 **VM에**, Content는 stateless 유지
- 화면 전환은 `AppNavHost` 경유 (Screen의 네비게이션 콜백 연결)
- 에러/빈 상태 처리 (기존 패턴·aos-common toast 등 공통 사용)
- Screen에서 `collectAsStateWithLifecycle`로 uiState 수집

## Phase D: 자가 확인

- 컴파일 성공: `./gradlew -q :<모듈>:compileDebugKotlin` + ktlint(있으면) 위반 0
- 순수 로직(상태 전이·검증 규칙)은 단위 테스트 작성 후 `./gradlew -q :<모듈>:testDebugUnitTest` 통과 (test-writer 규칙 준수)

## Definition of Done

1. Phase A 동작 목록이 전수 구현됨 (목록 ↔ 구현 대조표 근거)
2. API 지점은 전부 repository 스텁 + TODO — 신규 Retrofit/네트워크 코드 0건
3. 비즈니스 로직이 VM에 있고 Content는 stateless 유지, 레이어 방향 준수 (presentation→domain, domain에 Android 의존 없음)
4. 입력 검증·에러 상태 처리 구현됨 (디스크립션의 에러 케이스 전수)
5. 컴파일 성공 + (작성한) 단위 테스트 통과 (실행 결과 근거)
6. 신규 코드에 `!!`·`Log.d`/`println`·UI 경로 `runBlocking` 0건

> **완료 선언 전 checker 서브에이전트의 PASS 판정 필수** (maker/checker 분리 — 글로벌 규약).

$ARGUMENTS
