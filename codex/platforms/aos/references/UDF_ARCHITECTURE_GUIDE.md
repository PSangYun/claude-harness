# Compose MVVM + UDF 아키텍처 가이드

화면은 **AAC ViewModel 기반 MVVM + 단방향 데이터 흐름(UDF)** 을 사용한다.

이 문서는 `$harness-init`이 신규 AOS 프로젝트 루트에 씨딩하는 공용 가이드다. 프로젝트 고유의 흐름·목적지 이름(예: 최초 진입 NavGraph의 실제 목적지 목록)은 각 프로젝트에서 이 파일에 보완한다.

```text
State  : ViewModel → Route → Screen
Intent : Screen → Route → ViewModel

Intent → 처리 → 새 UiState → 렌더링 → Intent
```

- ViewModel만 화면 상태를 변경한다.
- Screen은 상태를 렌더링하고 Intent만 전달한다.
- Route는 ViewModel, 플랫폼 UI, Navigation을 연결한다.
- 기능별 NavGraph가 실제 `NavController` 동작을 담당한다.

UDF에서 “단방향”은 View와 ViewModel 사이에 화살표가 하나뿐이라는 뜻이 아니다. 사용자 입력인 Intent는 위로만 올라가고, 렌더링 상태인 UiState는 아래로만 내려간다는 뜻이다. 양쪽이 같은 mutable 상태를 함께 변경하지 않으므로 상태의 소유권과 변경 경로가 명확해진다.

이 구조는 화면 표시, 업무 로직, Android 플랫폼 처리, Navigation을 서로 다른 경계에 둔다. 화면이 커져도 변경 위치를 예측할 수 있고 Screen과 ViewModel을 독립적으로 테스트할 수 있다.

---

## 1. 기본 구조

```text
presentation/<group>/<feature>/
├─ XxxContract.kt     # UiState, Intent, Result, Navigation
├─ XxxRoute.kt        # 상태 수집, Intent 분배, 플랫폼 UI
├─ XxxScreen.kt       # 순수 렌더링, Preview
└─ XxxViewModel.kt    # Intent 처리, 상태 변경

navigation/
├─ AppNavHost.kt      # 단일 NavHost 소유, graph 등록
└─ XxxNavGraph.kt     # 목적지와 back stack 정책
```

Stateless Composable에는 Contract, Route, ViewModel을 억지로 만들지 않는다.

파일은 개수를 맞추기 위해 나누는 것이 아니다. 상태 계약, 화면 렌더링, 업무 처리, Navigation 연결이 서로 다른 이유로 변경되기 때문에 각각 독립적으로 수정할 수 있도록 분리한다.

---

## 2. Contract 규칙

```kotlin
data class XxxUiState(
    val isLoading: Boolean = false,
    val result: XxxResult? = null
)

sealed interface XxxIntent {
    data object BackClicked : XxxIntent
    data object SubmitClicked : XxxIntent
    data class ResultHandled(val result: XxxResult) : XxxIntent
}

sealed interface XxxResult {
    data object Completed : XxxResult
}

sealed interface XxxNavigation {
    data object Back : XxxNavigation
    data object Next : XxxNavigation
}
```

네 타입은 역할과 수명이 다르다. Intent는 입력, UiState는 현재 화면의 스냅샷, Result는 반드시 처리돼야 하는 결과다. Navigation은 사용자 입력이나 Result를 Route가 화면 이동 요청으로 해석한 값이다.

- `UiState`: 화면 렌더링 상태. 불변이며 ViewModel만 변경한다.
- `Intent`: 사용자 입력 또는 플랫폼 callback 결과. `Context`, `Activity`, `NavController`를 포함하지 않는다.
- `Result`: 유실되면 안 되는 처리 결과. 업무 결과가 아니어도 반드시 확인하거나 후속 처리해야 한다면 사용할 수 있다. `NavigateHome`보다 `Completed`, `ExistingMember`처럼 의미를 표현한다.
- `Navigation`: Route가 NavGraph에 전달하는 이동 요청. ViewModel은 알지 않는다.
- 중요한 비동기 결과는 UiState에 저장하고 `ResultHandled`로 소비한다. `ResultHandled`는 처리한 result를 싣고, ViewModel은 현재 result가 그 값과 같을 때만 지운다 (3절).
- 관련 상태는 하나의 UiState로 묶되, 독립적이거나 갱신 빈도가 크게 다르면 별도 `StateFlow`를 허용한다.

예를 들어 ViewModel이 로그인 성공을 `NavigateHome`으로 표현하면 UI 목적지를 알게 된다. 대신 `LoginResult.ExistingMember`를 상태로 만들고 Route가 `LoginNavigation.Home`으로 변환하면 업무 결과와 화면 이동 책임을 분리할 수 있다.

---

## 3. 표준 화면 템플릿

### Route

Route는 순수 Screen과 Android 실행 환경 사이의 어댑터다. Screen에 ViewModel이나 SDK를 노출하지 않으면서 Activity Result처럼 Composable 생명주기가 필요한 기능을 연결한다.

```kotlin
@Composable
fun XxxRoute(
    onNavigate: (XxxNavigation) -> Unit,
    viewModel: XxxViewModel = hiltViewModel()
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val lifecycleOwner = LocalLifecycleOwner.current // androidx.lifecycle.compose.LocalLifecycleOwner
    // effect가 onNavigate 변경으로 재시작되지 않으므로 최신 콜백을 읽게 한다
    val currentOnNavigate by rememberUpdatedState(onNavigate)

    // Result 소비 — STARTED 이상에서만 수집해 화면 전환 중이나 백그라운드에서 이동하지 않는다
    LaunchedEffect(viewModel, lifecycleOwner) {
        lifecycleOwner.repeatOnLifecycle(Lifecycle.State.STARTED) {
            viewModel.uiState
                .map { it.result }
                .distinctUntilChanged()
                .filterNotNull()
                .collect { result ->
                    when (result) {
                        XxxResult.Completed -> currentOnNavigate(XxxNavigation.Next)
                    }
                    viewModel.onIntent(XxxIntent.ResultHandled(result))
                }
        }
    }

    XxxScreen(
        state = state,
        onIntent = { intent ->
            when (intent) {
                XxxIntent.BackClicked -> onNavigate(XxxNavigation.Back)
                else -> viewModel.onIntent(intent)
            }
        }
    )
}
```

Route 책임:

- lifecycle-aware 상태 수집
- Screen에 `state`, `onIntent` 전달
- 사용자 입력 또는 Result를 `XxxNavigation`으로 변환
- Activity Result, 권한, 외부 SDK 등 플랫폼 UI 실행
- 플랫폼 callback을 Intent로 변환

Route에서 Repository를 호출하거나 업무 규칙을 구현하지 않는다.

모든 Intent를 ViewModel에 보낼 필요는 없다. 뒤로가기처럼 UI만으로 결정되는 동작은 Route가 Navigation으로 바로 변환하고, API 호출이나 데이터 검증이 필요한 Intent만 ViewModel로 전달한다.

Result는 `repeatOnLifecycle(STARTED)` 안에서 `uiState`를 수집해 소비한다. Navigation으로 변환한 뒤 같은 블록에서 `ResultHandled(result)`를 보낸다. 화면이 STARTED 아래에 있는 동안 도착한 결과는 상태에 남아 있다가 다시 STARTED가 되면 처리되고, 구성 변경 중에 도착한 결과도 Route가 다시 만들어진 뒤 처리된다.

`LaunchedEffect(state.result)`로 직접 소비하지 않는다. `collectAsStateWithLifecycle()`은 수집만 멈출 뿐 첫 Composition에서 `StateFlow`의 현재 값을 초기값으로 돌려주고, `LaunchedEffect`는 생명주기와 무관하게 Composition 진입 즉시 실행된다. 미처리 result가 남은 화면으로 돌아오면 back stack entry가 STARTED가 되기 전에 이동이 실행될 수 있다.

`distinctUntilChanged`는 다른 UiState 필드만 바뀌어 같은 result가 다시 흘러오는 것을 막는다. `filterNotNull`보다 앞에 둬야 result가 null로 지워진 뒤 같은 값이 다시 생겼을 때도 처리된다. Result는 Navigation으로 바꿀 대상만 다루고, 화면에 계속 보여야 하는 오류 문구 같은 값은 일반 UiState 필드로 둔다.

### Screen

Screen을 순수 렌더러로 유지하면 동일한 UiState에서 항상 같은 UI를 만들 수 있다. ViewModel 없이 Preview를 실행할 수 있고 화면 테스트에서도 Repository나 Navigation 환경을 준비할 필요가 없다.

```kotlin
@Composable
fun XxxScreen(state: XxxUiState, onIntent: (XxxIntent) -> Unit) {
    XxxContent(state = state, onIntent = onIntent)
}
```

`Screen`은 외부에 공개되는 얇은 화면 진입점이고 `Content`는 실제 private UI 구현이다. 지금은 단순 위임만 하더라도 프로젝트 전체 시그니처를 일정하게 유지하고 내부 UI 변경을 감춘다. Screen에 역할을 만들기 위해 로직을 억지로 추가하지 않는다.

- ViewModel, Repository, `NavController`를 참조하지 않는다.
- 상태를 직접 변경하지 않고 Intent만 전달한다.
- ViewModel 없이 실행되는 Preview를 제공한다.
- 포커스, 스크롤, 애니메이션처럼 UI 생명주기에만 필요한 값은 로컬 상태로 둘 수 있다.
- UI 우선순위: 공용 디자인 시스템(있으면) → 기존 패턴 → Figma 값 → 최소 변경.
- 공용 디자인 시스템을 쓰면 사용 전에 그 가이드 문서를 확인한다.

Screen이 로컬 상태를 가질 수 없는 것은 아니다. UI 생명주기에만 필요한 상태는 가장 가까운 UI에 두고, 화면 복귀 후에도 유지되거나 업무 결과에 영향을 주는 상태만 ViewModel로 올린다.

버튼을 누르는 즉시 최상단으로 이동하는 것처럼 ViewModel 판단이 필요 없는 동작은 Content가 소유한 `LazyListState` 또는 `ScrollState`로 바로 처리한다. 같은 클릭이 데이터 갱신도 요청한다면 로컬 스크롤과 `onIntent(RefreshClicked)`를 각각 실행한다. API 성공처럼 ViewModel 처리 결과가 스크롤을 요청할 때만 Effect를 사용한다.

### ViewModel

ViewModel은 화면의 business state holder다. Intent를 받아 Repository 또는 Domain 계층에 업무 처리를 위임하고, 결과를 Screen이 렌더링할 수 있는 UiState로 변환한다. ViewModel 아래쪽(Repository·UseCase·DTO·에러 처리) 규칙은 프로젝트 루트 `DATA_LAYER_GUIDE.md`를 따른다.

```kotlin
@HiltViewModel
class XxxViewModel @Inject constructor(
    private val repository: XxxRepository
) : ViewModel() {
    private val _uiState = MutableStateFlow(XxxUiState())
    val uiState: StateFlow<XxxUiState> = _uiState.asStateFlow()

    fun onIntent(intent: XxxIntent) {
        when (intent) {
            XxxIntent.SubmitClicked -> submit()
            is XxxIntent.ResultHandled -> clearResult(intent.result)
            XxxIntent.BackClicked -> Unit // Route가 Navigation으로 바로 변환한다
        }
    }

    // 처리 중이거나 아직 소비되지 않은 결과가 있으면 무시 — 연타로 같은 요청이 두 번 나가는 것을 막는다
    private fun submit() {
        if (_uiState.value.isLoading || _uiState.value.result != null) return
        _uiState.update { it.copy(isLoading = true) }
        viewModelScope.launch {
            when (repository.submit()) {
                is ApiResult.Success -> _uiState.update { it.copy(isLoading = false, result = XxxResult.Completed) }
                is ApiResult.Failure -> _uiState.update { it.copy(isLoading = false) } // 오류 표시는 화면 규칙대로
            }
        }
    }

    // Route가 처리한 결과와 같을 때만 지운다 — 처리하는 사이 새로 들어온 결과까지 지우지 않기 위해서다
    private fun clearResult(handled: XxxResult) {
        _uiState.update { if (it.result == handled) it.copy(result = null) else it }
    }
}
```

`ResultHandled`가 처리한 값을 싣는 이유는 경합 때문이다. Route가 결과 A를 처리하고 `ResultHandled`를 보내기 전에 ViewModel이 결과 B를 넣으면, 값 없는 `ResultHandled`는 B까지 지운다. 값을 비교해 지우면 B는 남아 다음 `LaunchedEffect`에서 처리된다. 같은 값의 결과가 연속으로 생길 수 있는 화면(예: 같은 `Completed`가 짧은 간격으로 두 번)은 Result에 요청 ID 같은 식별값을 넣어 구분한다.

- 공개 입력은 `onIntent(intent)` 하나로 통일한다.
- `onIntent()`는 private 함수로 분배하는 얇은 dispatcher다.
- API 호출과 복잡한 계산을 `when` 안에 직접 작성하지 않는다.
- 실제 로직은 기존 MVVM처럼 기능별 private 함수로 나눈다.
- ViewModel에 Android UI 타입이나 Navigation 구현을 전달하지 않는다.
- 비동기 상태 전환, 중복 방지 등 의도가 불명확한 함수에는 이유를 설명하는 1~2줄 주석을 작성한다.

`onIntent()`를 하나로 통일하는 이유는 Screen과 ViewModel 사이의 공개 계약을 일정하게 유지하기 위해서다. 실제 로직까지 한 함수에 몰아넣지 않으며 내부 구현은 기존 MVVM처럼 기능별 private 함수로 나눈다.

함수 주석은 코드 동작을 반복하기보다 “왜”에 집중한다. 예를 들어 Result 초기화에는 값을 null로 만든다는 설명보다 화면 이동의 재실행을 막기 위한 처리라고 기록한다.

---

## 4. Navigation

여러 callback 대신 Route에는 `onNavigate: (XxxNavigation) -> Unit` 하나를 전달한다.

Route마다 `onBack`, `onSuccess`, `onDetail`을 추가하면 Route 시그니처와 AppNavHost가 함께 커진다. 화면 전용 Navigation 타입으로 요청을 묶고 실제 route와 back stack 옵션을 기능별 NavGraph로 옮기면 AppNavHost는 전체 graph 조립 역할만 유지할 수 있다.

```text
즉시 이동
Screen → Intent → Route → Navigation → NavGraph → NavController

비동기 결과 이동
Intent → ViewModel → Repository → UiState.Result
→ Route → Navigation → NavGraph → NavController → ResultHandled
```

`AppNavHost`에 모든 `composable`을 작성하지 않고 인증, 홈, 마이페이지 같은 흐름(기능) 단위로 분리한다.

```kotlin
fun NavGraphBuilder.xxxDestination(navController: NavHostController) {
    composable(Routes.XXX) {
        XxxRoute(
            onNavigate = { destination ->
                when (destination) {
                    XxxNavigation.Back -> navController.popBackStack()
                    XxxNavigation.Next -> navController.navigate(Routes.NEXT)
                }
            }
        )
    }
}
```

- `AppNavHost`: 단일 NavHost와 NavController의 최상위 소유자.
- `XxxNavGraph`: 목적지 등록과 실제 back stack 정책 담당.
- `XxxRoute`: Navigation 요청만 생성하며 `NavController`를 알지 않는다.
- 반복되는 `popUpTo`, `launchSingleTop`은 `NavController` 확장 함수로 분리할 수 있다.

NavGraph를 분리해도 NavHost가 여러 개 생기는 것은 아니다. `AppNavHost`가 하나의 NavHost와 NavController를 소유하고 각 `XxxNavGraph`가 같은 builder에 목적지를 등록한다.

최초 진입 흐름(splash, 강제 업데이트, 권한, 로그인, 약관, 회원가입, 휴대폰 인증 등)은 하나의 `FirstNavGraph`로 묶는다. 로그인도 별도 `LoginNavGraph`를 만들지 않고 같은 최초 진입 흐름에 포함한다 — 화면 하나마다 NavGraph를 만들지 말고 사용자 여정 단위로 묶는 것이 기준이다.

### 로그인 흐름 예시

```text
로그인 버튼 클릭
→ LoginIntent.ProviderClicked
→ LoginRoute에서 SDK 실행 + ViewModel에 Intent 전달
→ SDK 토큰 callback
→ LoginIntent.ProviderTokenReceived
→ LoginViewModel에서 서버 로그인
→ LoginUiState.result = LoginResult.ExistingMember
→ LoginRoute에서 LoginNavigation.Home으로 변환
→ FirstNavGraph(최초 진입 흐름)에서 HOME 이동
→ LoginIntent.ResultHandled로 결과 초기화
```

Screen은 route 문자열을 모르고, ViewModel은 `NavController`를 모르며, NavGraph는 로그인 API를 모른다.

---

## 5. Effect

`XxxEffect`는 기본 파일이 아니다. 유실되어도 상태 정합성이 깨지지 않을 때만 사용한다.

Result와 Effect는 발생 횟수나 비즈니스 로직 여부로 나누지 않는다. 같은 동작이 한 번인지 여러 번인지보다 collector가 놓쳤을 때 문제가 생기는지가 기준이다.

ViewModel이 UI보다 오래 살아 있는 동안 collector가 사라지면 일회성 Effect가 유실될 수 있다. 사용자가 반드시 확인해야 하거나 다음 화면 상태를 결정하는 결과는 UiState로 보존한다.

사용 가능: 포커스, 스크롤, 햅틱, 장식성 애니메이션.

사용 금지: 로그인·결제·저장 완료, 경기 종료, 중요한 오류, Navigation의 기본 전달 수단.

중요한 결과는 UiState와 `Handled` Intent로 처리한다.

비즈니스 처리에서 Effect가 발생할 수도 있다. 예를 들어 저장 성공 자체는 UiState 또는 Result로 보존하고, 그로 인해 실행하는 성공 애니메이션이나 가벼운 Toast만 Effect로 전달한다. 즉 비즈니스 결과 자체를 Effect에 넣는 것이 아니라, 그 결과에서 파생된 유실 가능한 UI 동작을 Effect로 표현한다.

판단 순서:

1. 다시 렌더링하는 데 필요한 값이면 일반 UiState다.
2. 반드시 후속 처리돼야 하면 `UiState.result + ResultHandled`다.
3. 놓쳐도 괜찮은 UI 명령이면 Effect다.
4. ViewModel 판단 없이 현재 UI에서 끝나는 동작이면 Content의 로컬 UI 로직이다.

---

## 6. 상황별 추가 파일

기본 파일만으로 책임이 불명확할 때 기능 특성에 맞는 파일을 추가할 수 있다.

기본 네 파일은 출발점이지 상한선이 아니다. 외부 SDK나 복잡한 변환을 Route 또는 ViewModel에 억지로 넣기보다 이름과 책임이 분명한 기능 전용 파일로 분리한다.

```text
XxxAuthLauncher.kt       # Credential Manager, 소셜 SDK
XxxPaymentLauncher.kt    # 결제 SDK
XxxPermissionHandler.kt  # 권한 요청
XxxMapper.kt             # Domain → UI 변환
XxxUiModel.kt            # 복잡한 화면 모델
XxxCoordinator.kt        # 독립 흐름 조정
XxxEffect.kt             # 유실 가능한 UI 동작
```

추가 기준:

1. Activity, Context, Launcher가 필요한 플랫폼 API 또는 외부 SDK다.
2. 플랫폼 연동 코드 때문에 Route의 기본 책임을 읽기 어렵다.
3. UI 변환 또는 독립 흐름이 충분히 복잡하다.

템플릿의 파일 수를 맞추거나 미래 재사용을 추측해 만들지 않는다.

### LoginAuthLauncher 사례

```text
LoginScreen → ProviderClicked → LoginRoute
├─ ViewModel에 Intent 전달
└─ LoginAuthLauncher 실행
   → SDK callback → ProviderTokenReceived → ViewModel
```

`LoginAuthLauncher`는 소셜 로그인 플랫폼 연동 때문에 추가된 선택 파일이다.

Credential Manager와 소셜 SDK는 Activity 또는 Composable 생명주기를 요구한다. 이를 ViewModel에 넣지 않고 `LoginAuthLauncher`가 플랫폼 실행을 담당한 뒤 결과만 Intent로 되돌린다.

---

## 7. 금지 패턴

- Screen에서 ViewModel 내부 상태 직접 변경
- 하위 Content에 ViewModel 전달
- Route에서 Repository 호출
- Route에 `NavController` 전달
- ViewModel에서 Navigation 실행
- ViewModel 또는 Intent에 Android UI 타입 전달
- 모든 로직을 `onIntent()`의 `when` 안에 구현
- 중요한 결과를 `Channel` 또는 `SharedFlow`로만 전달
- Result를 `LaunchedEffect(state.result)`로 직접 소비 (`repeatOnLifecycle(STARTED)` 안에서 수집)
- AppNavHost 한 파일에 모든 목적지 구현
- 책임 없는 Contract, Effect, Coordinator 생성

---

## 8. 체크리스트

- [ ] UiState는 불변이고 ViewModel만 변경하는가?
- [ ] Screen은 `state`, `onIntent`만으로 렌더링 가능한가?
- [ ] Intent에 Android UI 타입이 없는가?
- [ ] `onIntent()`가 얇은 dispatcher인가?
- [ ] Route가 상태 수집과 플랫폼 UI를 담당하는가?
- [ ] Route의 이동 요청이 단일 `onNavigate`인가?
- [ ] 실제 Navigation이 기능별 NavGraph에 있는가?
- [ ] 중요한 결과가 UiState와 `Handled`로 처리되고, `ResultHandled`가 처리한 result를 비교해 지우는가?
- [ ] 처리 중이거나 소비 안 된 결과가 있을 때 같은 요청이 다시 나가지 않는가?
- [ ] 추가 파일이 실제 기능 특성상 필요한가?
- [ ] `./gradlew :app:compileDebugKotlin` 통과
- [ ] `./gradlew :app:ktlintCheck` 통과
