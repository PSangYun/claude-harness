> Codex 이식 기준: 이 문서의 플랫폼별 구현·DoD를 사용한다. 실행과 권한 규칙은 프로젝트 AGENTS.md 및 선택한 harness Skill을 따른다. verify.json은 `commands: [{name, command}]` 형식이다. 검증기는 자동 턴 종료 훅이 아니며 명시적으로 실행한다. 특정 버전·브랜치·프로젝트명은 실제 코드에서 재확인한다.

# $harness-feature — 기능 스캐폴딩 (AOS)

신규 기능의 폴더 구조와 파일 뼈대만 만든다. **비즈니스 로직·UI 디테일은 넣지 않는다** — 그건 이후 `$harness-design`(UI)·`$harness-logic`(동작)·`$harness-connect-api`(API)의 일이다.

## Phase A: 사전 질문 (답을 받기 전에 아무것도 생성하지 않는다)

1. **도메인명** (예: `reservation`) — 패키지·클래스 네이밍에 사용
2. **진입 경로** — 어느 기능 NavGraph(`navigation/XxxNavGraph`)/탭에서 진입하는 화면인가? 라우트 이름은? 새 흐름이면 NavGraph를 신설할지, 기존 흐름에 목적지만 추가할지
3. **레이어 범위** — 화면만인가, API 연동 예정인가? (domain/data 스텁 생성 여부 결정)
4. **참고할 기존 유사 화면** — 없으면 프로젝트 루트 `UDF_ARCHITECTURE_GUIDE.md` 3절 표준 템플릿(Contract/Route/Screen/ViewModel)을 기준으로 삼는다. 가이드가 없는 기존 프로젝트는 그 프로젝트 AGENTS.md의 화면 구조 컨벤션을 따른다

## Phase B: 기존 패턴 실측

- 유사 화면 폴더를 Read로 확인 — 파일 구성(Contract/Route/Screen/ViewModel 4분할인지)·네이밍·UiState/Intent 패턴을 실측 (추측 금지)
- `navigation/AppNavHost.kt`(그래프 조립)와 기능별 `XxxNavGraph.kt`(목적지 등록·`onNavigate` 처리)의 등록 방식 확인

## Phase C: 스캐폴딩 생성 (사전 질문에서 지정된 것만)

**presentation/<그룹>/<도메인>/** (항상 — UDF 4분할, 가이드 3절 템플릿 기준):
- `<Xxx>Contract.kt` — `<Xxx>UiState` data class(`@Immutable`) + `<Xxx>Intent` sealed interface(멤버는 `// TODO`) + `<Xxx>Navigation` sealed interface(`Back` 등 최소)
- `<Xxx>Route.kt` — `hiltViewModel()` + `collectAsStateWithLifecycle` + 이동 요청은 `onNavigate: (<Xxx>Navigation) -> Unit` 하나만 (`NavController` 파라미터 금지)
- `<Xxx>Screen.kt` — `state`·`onIntent`만 받는 순수 렌더링 뼈대(내부 private `<Xxx>Content` 위임 가능) + `<Xxx>ScreenPreview` (`@Preview`, 더미 상태)
- `<Xxx>ViewModel.kt` — `@HiltViewModel` + `StateFlow<UiState>` + `onIntent(intent)` 빈 dispatcher(`// TODO: logic`)

**domain/** (API 연동 예정일 때만 — 프로젝트 루트 `DATA_LAYER_GUIDE.md` 1절 구조 기준, 없으면 기존 패턴):
- `model/<그룹>/<Xxx>.kt` — 빈 data class + `// TODO`
- `repository/<Xxx>Repository.kt` — 인터페이스 (시그니처는 TODO 주석으로)
- UseCase는 만들지 않는다 (필요 여부는 `$harness-logic`에서 가이드 6절 기준으로 판단)

**data/** (API 연동 예정일 때만):
- `repository/<Xxx>RepositoryImpl.kt` — 스텁 구현 + `// TODO: connect-api (3단계)`
- 기존 DI 모듈에 바인딩 등록 (기존 패턴 그대로)
- DTO·Api·매퍼는 만들지 않는다 (`$harness-connect-api`의 일)

**navigation/** (요청 시):
- 기능별 `<Xxx>NavGraph.kt`에 `composable` 목적지 등록(Route 호출 + `onNavigate` → `navController` 처리) — 새 흐름이면 NavGraph 신설 후 `AppNavHost`에서 조립, 기존 흐름이면 해당 NavGraph에 목적지만 추가. `AppNavHost` 본문에 `composable` 직접 작성 금지

모든 파일 본문은 컴파일되는 최소 뼈대 + `// TODO:` 주석만.

## Phase D: 자가 확인

- `./gradlew -q :<모듈>:compileDebugKotlin` 성공 (모듈명은 settings.gradle.kts 실측 — 예: `:app`. Windows PowerShell/cmd면 `.\gradlew.bat`, Git Bash면 `./gradlew`)

## Definition of Done

1. Phase A 사전 질문에 대한 사용자 답변이 존재하고, **지정된 범위만** 생성됨 (임의 추가 0건)
2. 생성 파일이 참고 화면의 구조·네이밍 패턴과 일치 (실측 근거)
3. UDF 구조 준수 — Contract/Route/Screen/ViewModel 4분할, Screen은 `state`·`onIntent`만 받음, Route 이동 요청은 단일 `onNavigate`, ViewModel 공개 입력은 `onIntent()` 하나
4. 레이어 방향 준수 — ViewModel은 domain 인터페이스만 참조, Screen에 화면 상태 소유 없음, Route에 `NavController`·Repository 없음, Intent/ViewModel에 Android UI 타입 없음
5. (요청 시) 기능별 NavGraph에 목적지 등록됨 (`AppNavHost` 본문 직접 등록 아님)
6. 컴파일 성공 + 비즈니스 로직·네트워크 코드 0건 (TODO 스텁만)
