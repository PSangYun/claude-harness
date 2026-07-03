---
description: 신규 기능 스캐폴딩 — presentation/domain/data 3레이어 폴더·파일 뼈대 생성 (사전 질문 필수, 로직 없음). DoD 게이트 포함.
---

# /feature — 기능 스캐폴딩 (AOS)

신규 기능의 폴더 구조와 파일 뼈대만 만든다. **비즈니스 로직·UI 디테일은 넣지 않는다** — 그건 이후 `/design`(UI)·`/logic`(동작)·`/connect-api`(API)의 일이다.

## Phase A: 사전 질문 (답을 받기 전에 아무것도 생성하지 않는다)

1. **도메인명** (예: `reservation`) — 패키지·클래스 네이밍에 사용
2. **진입 경로** — AppNavHost의 어느 그래프/탭에서 진입하는 화면인가? 라우트 이름은?
3. **레이어 범위** — 화면만인가, API 연동 예정인가? (domain/data 스텁 생성 여부 결정)
4. **참고할 기존 유사 화면** — 없으면 `presentation/main/home` 패턴을 기준으로 삼는다

## Phase B: 기존 패턴 실측

- 유사 화면 폴더를 Read로 확인 — 파일 구성·네이밍·UiState 패턴을 실측 (추측 금지)
- `navigation/AppNavHost.kt`의 라우트 등록 방식 확인

## Phase C: 스캐폴딩 생성 (사전 질문에서 지정된 것만)

**presentation/<도메인>/** (항상):
- `<Xxx>Screen.kt` — 라우트 진입점 (`hiltViewModel()`, `collectAsStateWithLifecycle`, 네비게이션 콜백 파라미터)
- `<Xxx>Content.kt` — **stateless** UI 뼈대 + `<Xxx>ContentPreview` (`@Preview`, 더미 상태)
- `<Xxx>ViewModel.kt` — `@HiltViewModel` + `<Xxx>UiState` data class + `StateFlow<UiState>` + 빈 액션 함수(`// TODO: logic`)

**domain/** (API 연동 예정일 때만):
- `model/<Xxx>.kt` — 빈 data class + `// TODO`
- `repository/<Xxx>Repository.kt` — 인터페이스 (시그니처는 TODO 주석으로)

**data/** (API 연동 예정일 때만):
- `repository/<Xxx>RepositoryImpl.kt` — 스텁 구현 + `// TODO: connect-api (3단계)`
- 기존 DI 모듈에 바인딩 등록 (기존 패턴 그대로)

**navigation/** (요청 시):
- `AppNavHost`에 라우트 등록 — 기존 등록 방식과 동일하게

모든 파일 본문은 컴파일되는 최소 뼈대 + `// TODO:` 주석만.

## Phase D: 자가 확인

- `./gradlew -q :app:compileDebugKotlin` 성공 (Windows는 `gradlew.bat`)

## Definition of Done

1. Phase A 사전 질문에 대한 사용자 답변이 존재하고, **지정된 범위만** 생성됨 (임의 추가 0건)
2. 생성 파일이 참고 화면의 구조·네이밍 패턴과 일치 (실측 근거)
3. Screen → Content(stateless) → Preview 3단 구조 준수
4. 레이어 방향 준수 — ViewModel은 domain 인터페이스만 참조, Content에 상태 소유 없음
5. (요청 시) AppNavHost 라우트 등록됨
6. 컴파일 성공 + 비즈니스 로직·네트워크 코드 0건 (TODO 스텁만)

> **완료 선언 전 checker 서브에이전트의 PASS 판정 필수** (maker/checker 분리 — 글로벌 규약).

$ARGUMENTS
