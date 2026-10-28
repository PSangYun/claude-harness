# Data · Domain 계층 가이드

화면 아래의 데이터 흐름은 **domain 인터페이스 + data 구현** 두 계층으로 나눈다. ViewModel은 domain만 알고, Retrofit·DataStore·WebSocket 같은 구현 수단은 data 안에 가둔다.

이 문서는 `/harness-init`이 신규 AOS 프로젝트 루트에 `UDF_ARCHITECTURE_GUIDE.md`와 함께 씨딩하는 공용 가이드다. 화면 구조(Contract/Route/Screen/ViewModel)는 UDF 가이드가, ViewModel 아래쪽은 이 문서가 담당한다. 프로젝트 고유의 공통 응답 포맷·에러 코드는 각 프로젝트에서 이 파일에 보완한다.

```text
presentation ──→ domain ←── data
(ViewModel)      (인터페이스·모델)   (Retrofit·DataStore·WebSocket 구현)
```

- domain은 아무것도 참조하지 않는다. Android 프레임워크와 data 패키지를 import하지 않는다.
- presentation과 data는 domain만 참조한다. presentation이 data를, data가 presentation을 참조하지 않는다.
- 연결은 Hilt `@Binds`가 한다. ViewModel은 구현체 이름을 모른다.

일반적인 클린 아키텍처와 달리 **UseCase와 DataSource는 기본 계층이 아니다.** 6절 조건을 만족할 때만 만든다. 계층을 파일 수로 채우면 Repository 호출을 그대로 넘기는 껍데기 클래스만 늘어나고, 변경 하나에 고칠 파일이 세 배가 된다.

멀티모듈(`:domain`·`:data`)도 강제하지 않는다. 단일 `:app` 모듈에서 패키지로 나누되, 컴파일러가 의존 방향을 막아 주지 않으므로 7절 금지 패턴을 리뷰와 훅으로 지킨다.

---

## 1. 기본 구조

```text
domain/
├─ model/<group>/Xxx.kt              # 도메인 모델 (순수 Kotlin)
├─ model/ApiResult.kt                # 성공/실패 결과 타입
├─ repository/XxxRepository.kt       # 인터페이스
└─ usecase/<group>/VerbXxxUseCase.kt # 선택 — 6절 조건일 때만

data/
├─ api/XxxApi.kt                     # Retrofit 인터페이스
├─ local/datastore/XxxStore.kt       # DataStore (필요 시 local/db/ — Room)
├─ remote/websocket/                 # Retrofit 외 원격 수단 (필요 시)
├─ model/request/<group>/XxxRequest.kt
├─ model/response/<group>/XxxData.kt # 응답 DTO
├─ model/response/ApiResponse.kt     # 서버 공통 응답 포맷
├─ mapper/XxxMapper.kt               # DTO ↔ domain 변환
└─ repository/
   ├─ XxxRepositoryImpl.kt
   └─ extension/ApiCall.kt           # safeApiCall · toFailure · 재시도 헬퍼

core/di/
├─ NetworkModule.kt                  # OkHttp · Retrofit · Json · Api 제공
└─ RepositoryModule.kt               # @Binds 인터페이스 ↔ 구현
```

`<group>`은 도메인 묶음(예: `first`, `main/tournament`)이다. presentation의 `<group>`과 같은 이름을 쓰면 기능 단위로 파일을 찾기 쉽다.

---

## 2. 모델 규칙

모델은 계층마다 따로 둔다. 서버 스펙이 바뀌어도 domain과 화면이 흔들리지 않게 하기 위해서다.

| 구분 | 위치 | 이름 | 어노테이션 |
|---|---|---|---|
| 요청 DTO | `data/model/request/` | `XxxRequest` | `@Keep @Serializable` |
| 응답 DTO | `data/model/response/` | `XxxData` (페이지 래퍼는 `XxxResponse`) | `@Keep @Serializable` |
| 도메인 모델 | `domain/model/` | `Xxx` (접미사 없음) | 없음 |
| UI 모델 | `presentation/.../XxxUiModel.kt` | `XxxUiModel` | 필요 시 `@Immutable` (UDF 가이드 6절) |

DTO
- 필드명·nullable 여부는 API 명세 그대로 쓴다. 명세가 nullable이면 임의로 non-null로 바꾸지 않는다.
- 이름이 서버와 달라야 하면 `@SerialName`을 쓴다.
- DTO는 data 밖으로 나가지 않는다. WebSocket payload도 DTO다.

도메인 모델
- `@Serializable`·`@Keep`·Android 타입(`Uri`, `Bitmap`, `@StringRes` 등)을 넣지 않는다.
- null은 "값이 없다"는 도메인 의미가 있을 때만 쓴다. 서버가 빠뜨릴 수 있다는 이유만으로 nullable을 전파하지 않는다. 기본값·폴백은 mapper에서 결정한다.
- 서버 enum 문자열은 mapper에서 도메인 enum/sealed로 바꾼다. 모르는 값은 `Unknown` 같은 항목으로 받아 크래시를 막는다.

Mapper
- `data/mapper/XxxMapper.kt`에 `internal fun XxxData.toDomain(): Xxx` 확장 함수로 둔다.
- 요청 방향(도메인 값 → `XxxRequest`)도 같은 파일에 둔다.
- RepositoryImpl 안에 private 매퍼를 두지 않는다. Impl이 길어지고 매퍼만 따로 테스트할 수 없다.
- Domain → UI 변환은 이 문서 범위가 아니다. UDF 가이드 6절 `XxxMapper.kt`(presentation)가 담당한다.

---

## 3. 결과와 에러

Repository의 공개 함수는 예외를 던지지 않고 `ApiResult`를 돌려준다. ViewModel이 `try/catch` 없이 `when`으로 성공·실패를 모두 처리하게 하기 위해서다.

```kotlin
// domain/model/ApiResult.kt
const val NETWORK_ERROR = "NETWORK_ERROR"
const val PARSE_ERROR = "PARSE_ERROR"

sealed interface ApiResult<out T> {
    data class Success<T>(val data: T) : ApiResult<T>

    /** [httpStatus]는 서버가 응답한 HTTP 상태 코드 — 응답을 못 받았으면 null. */
    data class Failure(val code: String, val message: String, val httpStatus: Int? = null) : ApiResult<Nothing> {
        /** 응답을 못 받았거나 게이트웨이가 끊은 실패 — 서버가 처리했는지 알 수 없다 (5절) */
        val isResultUnknown: Boolean
            get() = code == NETWORK_ERROR || httpStatus in 502..504
    }
}
```

`isResultUnknown`은 재시도 헬퍼(5절)와 ViewModel이 함께 쓰므로 domain에 둔다. 상태 변경 요청이 이 실패로 끝나면 ViewModel은 "실패"가 아니라 "처리 결과 확인 필요"로 보여준다.

모든 API 호출은 공통 헬퍼 하나를 거친다. Repository 메서드마다 `runCatching { }.fold(...)`로 응답 분기를 다시 쓰면 같은 블록이 수십 번 복제되고, 한 곳만 다르게 고쳐지는 순간 에러 처리가 갈라진다.

```kotlin
// data/repository/extension/ApiCall.kt
// 예외 → ApiResult 변환 공통부. 취소는 실패가 아니므로 반드시 다시 던진다.
internal suspend fun <R> safeCall(block: suspend () -> ApiResult<R>): ApiResult<R> = try {
    block()
} catch (e: CancellationException) {
    throw e
} catch (e: IOException) {
    ApiResult.Failure(NETWORK_ERROR, "네트워크 연결을 확인해 주세요.")
} catch (e: SerializationException) {
    ApiResult.Failure(PARSE_ERROR, "응답을 처리하지 못했습니다.")
}

// 공통 응답 포맷(ApiResponse<T>) 호출 — 성공 시 data를 transform으로 도메인 변환
internal suspend fun <T, R> safeApiCall(
    json: Json,
    call: suspend () -> Response<ApiResponse<T>>,
    transform: (T) -> R
): ApiResult<R> = safeCall {
    val response = call()
    val body = response.body()
    val data = body?.data
    if (response.isSuccessful && body?.success == true && data != null) {
        ApiResult.Success(transform(data))
    } else {
        response.toFailure(json)
    }
}

// data 없이 성공 여부만 오는 호출
internal suspend fun safeApiCallNoData(json: Json, call: suspend () -> Response<ApiResponse<Unit>>): ApiResult<Unit> = safeCall {
    val response = call()
    if (response.isSuccessful && response.body()?.success == true) ApiResult.Success(Unit) else response.toFailure(json)
}
```

실패 응답 변환은 `toFailure` 한 곳에서 한다. 아래 `ApiResponse`는 예시 포맷이다. 공통 응답 포맷이 다른 프로젝트는 `ApiResponse`와 `toFailure`만 그 포맷에 맞게 바꾸고 헬퍼 시그니처는 유지한다.

```kotlin
// data/model/response/ApiResponse.kt
@Keep @Serializable
data class ApiResponse<T>(val success: Boolean, val data: T? = null, val error: ApiError? = null)

@Keep @Serializable
data class ApiError(val code: String, val message: String)

// data/repository/extension/ApiCall.kt (이어서)
// code/message는 body의 error → errorBody JSON의 error → 폴백 순으로 뽑는다.
// httpStatus는 어느 분기든 채운다 — 재시도 판별(isResultUnknown)이 서버 error code에 가려지지 않게 하기 위해서다.
internal fun Response<out ApiResponse<*>>.toFailure(json: Json): ApiResult.Failure {
    val error = body()?.error ?: errorBody()?.string()?.let { raw ->
        // 게이트웨이 HTML 등 JSON이 아닌 본문은 무시하고 폴백으로 간다
        try {
            json.decodeFromString<ApiResponse<JsonElement>>(raw).error
        } catch (e: IllegalArgumentException) {
            null
        }
    }
    return ApiResult.Failure(
        // 2xx인데 error도 data도 없으면 서버 포맷 위반으로 본다
        code = error?.code ?: if (isSuccessful) PARSE_ERROR else "HTTP_${code()}",
        message = error?.message ?: "요청을 처리하지 못했습니다.",
        httpStatus = code()
    )
}
```

`SerializationException`은 `IllegalArgumentException`의 하위 타입이라 위 `catch` 하나로 형식 오류와 타입 불일치를 함께 받는다.

- **`runCatching`을 Repository에 쓰지 않는다.** `runCatching`은 `CancellationException`도 잡는다. 화면을 나가 `viewModelScope`가 취소되면 그 취소가 `NETWORK_ERROR` 실패로 둔갑하고, 코루틴은 취소된 줄 모르고 다음 줄을 실행한다.
- `IOException`·`SerializationException` 외의 예외는 잡지 않는다. 그 외 예외는 프로그래밍 오류이므로 실패 값으로 숨기지 않고 드러나게 둔다.
- `Failure.message`는 서버 메시지이거나 폴백 문구다. 화면에 그대로 보일지, code별로 다른 문구·동작으로 바꿀지는 ViewModel이 정한다. data 계층은 문자열 리소스를 참조하지 않는다.
- 특정 code에 의미가 있으면(예: 409 충돌 → 최신 상태 재조회) `Failure`에 판별 프로퍼티를 추가해 ViewModel이 문자열 비교를 하지 않게 한다.

---

## 4. Repository

```kotlin
// domain/repository/XxxRepository.kt
interface XxxRepository {
    /** 메모리 캐시 — null이면 아직 한 번도 로드하지 않음 */
    val items: StateFlow<List<Xxx>?>

    suspend fun getItems(keyword: String? = null): ApiResult<List<Xxx>>
    suspend fun update(id: String, name: String): ApiResult<Unit>
}

// data/repository/XxxRepositoryImpl.kt
@Singleton
class XxxRepositoryImpl @Inject constructor(
    private val api: XxxApi,
    private val json: Json
) : XxxRepository {
    private val _items = MutableStateFlow<List<Xxx>?>(null)
    override val items: StateFlow<List<Xxx>?> = _items.asStateFlow()

    override suspend fun getItems(keyword: String?): ApiResult<List<Xxx>> =
        safeApiCall(json, { api.getItems(keyword) }) { data -> data.map { it.toDomain() } }
            .also { result -> if (keyword == null && result is ApiResult.Success) _items.value = result.data }

    override suspend fun update(id: String, name: String): ApiResult<Unit> =
        safeApiCallNoData(json) { api.update(id, UpdateXxxRequest(name = name)) }
}
```

- 인터페이스는 `domain/repository/`, 구현은 `data/repository/`에 두고 `RepositoryModule`에서 `@Binds @Singleton`으로 묶는다.
- 시그니처에는 도메인 모델·기본 타입만 쓴다. `XxxRequest`·`XxxData`·`Response<T>`가 인터페이스에 나타나면 안 된다.
- 공개 함수는 main-safe다. Retrofit·Room·DataStore의 suspend API는 이미 main-safe이므로 `withContext(Dispatchers.IO)`로 감싸지 않는다. 대량 매핑처럼 CPU를 오래 쓰는 작업만 주입받은 `Dispatchers.Default`로 옮긴다.
- 화면 간에 공유되는 캐시는 Repository가 `StateFlow`로 소유한다. 여러 ViewModel이 같은 데이터를 각자 들고 있지 않는다. 캐시를 갱신하는 조건(예: 검색어 없는 첫 페이지만)은 KDoc에 적는다.
- 실시간 이벤트(WebSocket 등)는 Repository가 `Flow<도메인 이벤트>`로 노출한다. payload DTO를 그대로 흘려보내지 않고 mapper에서 도메인 이벤트로 바꾼다.

---

## 5. 재시도 정책

응답을 받지 못한 실패(`NETWORK_ERROR`, HTTP 502·503·504 게이트웨이 응답)는 "실패"가 아니라 **"서버가 처리했는지 모름"** 이다. 판별은 3절 `Failure.isResultUnknown`이 `httpStatus`로 한다. 서버가 503에 `SERVICE_UNAVAILABLE` 같은 자체 error code를 실어 보내도 빠지지 않게 하기 위해서다. 요청 성격에 따라 다르게 다룬다.

```kotlin
// data/repository/extension/ApiCall.kt (이어서)
private val READ_RETRY_DELAYS_MILLIS = longArrayOf(1_000L, 2_000L)
private const val RECONCILE_DELAY_MILLIS = 1_500L

// 조회처럼 다시 보내도 결과가 같은 요청 — 간격을 늘려 최대 두 번 더 보낸다
internal suspend fun <T> retryOnNetworkError(block: suspend () -> ApiResult<T>): ApiResult<T> {
    var result = block()
    for (delayMillis in READ_RETRY_DELAYS_MILLIS) {
        if (result !is ApiResult.Failure || !result.isResultUnknown) return result
        delay(delayMillis)
        result = block()
    }
    return result
}

// 결과를 모르는 요청이 서버에 반영됐는지 확인한 결과
internal sealed interface ApplyCheck<out T> {
    data class Applied<T>(val data: T) : ApplyCheck<T>

    /** 서버 기록상 반영되지 않았음이 확정됨 — 다시 보내도 두 번 반영되지 않는다 */
    data object NotApplied : ApplyCheck<Nothing>

    /** 조회 실패, 처리 중, 아직 조회에 안 보임 등 판단할 수 없음 */
    data object Unknown : ApplyCheck<Nothing>
}

// 두 번 반영되면 안 되는 요청 — 반영 안 됨이 확정될 때만 한 번 다시 보낸다.
// 전제: send가 서버의 중복 방지 장치(멱등성 키, expectedRevision 등)를 싣고 있어야 한다.
internal suspend fun <T> sendReconciled(
    send: suspend () -> ApiResult<T>,
    checkApplied: suspend () -> ApplyCheck<T>
): ApiResult<T> {
    val first = send()
    if (first !is ApiResult.Failure || !first.isResultUnknown) return first
    delay(RECONCILE_DELAY_MILLIS)
    return when (val check = checkApplied()) {
        is ApplyCheck.Applied -> ApiResult.Success(check.data)
        ApplyCheck.NotApplied -> send()
        ApplyCheck.Unknown -> first
    }
}
```

| 요청 | 처리 |
|---|---|
| 조회(GET), 같은 값을 덮어쓰는 PUT | `retryOnNetworkError` — 최초 1회 + 재시도 2회 (1초, 2초) |
| 상태를 바꾸는 요청 + 서버 중복 방지 장치 있음 | `sendReconciled` — 대기 후 `checkApplied`로 확인. `Applied`면 그 결과, `NotApplied`면 1회 재전송, `Unknown`이면 원래 실패 |
| 상태를 바꾸는 요청 + 중복 방지 장치 없음 (결제·주문 등) | 자동 재전송하지 않는다. `isResultUnknown` 실패를 그대로 돌려주고, ViewModel이 "처리 결과 확인 필요" 상태와 재확인 동작을 보여준다 |
| 서버가 명시적으로 거절한 실패 (4xx, `error` 포함 응답) | 재시도하지 않는다 |

POST는 HTTP 의미상 멱등이 아니다(RFC 9110 9.2.2). 첫 요청이 서버에서 아직 처리 중이거나 처리 결과가 조회에 늦게 반영되면, 조회에 안 보인다는 이유로 다시 보낸 요청이 두 번째로 반영된다. 그래서 `NotApplied`는 "조회 결과에 없음"이 아니라 **서버가 중복을 막아 주는 기준으로 확인한 결과**여야 한다.

- 멱등성 키: 요청마다 키(UUID)를 만들어 첫 요청과 재전송에 같은 값을 싣는다(`Idempotency-Key` 헤더 등). 서버가 같은 키를 한 번만 반영하고, 그 키로 처리 상태를 조회할 수 있으면 `NotApplied`를 확정할 수 있다.
- revision: 요청에 `expectedRevision`을 싣고 서버가 revision이 다르면 거절한다. 첫 요청이 늦게 반영된 뒤 도착한 재전송은 revision 충돌로 거절되므로 중복 반영이 생기지 않는다. 확인 결과 revision이 아직 그대로면 `NotApplied`다.
- 둘 다 없으면 `sendReconciled`를 쓰지 않는다. `checkApplied`가 조회 목록만 보고 `NotApplied`를 돌려주는 구현도 금지다.
- 재시도는 Repository 안에서만 한다. ViewModel이 같은 요청을 반복 호출해 재시도를 흉내 내지 않는다.
- 자동 재전송 횟수에 상한을 둔다. 그 뒤는 사용자가 다시 시도하게 하고, ViewModel은 재시도 버튼을 노출한다.
- 이 헬퍼는 필드처럼 연결이 자주 끊기는 환경에서 필요하다. 상태 변경 요청이 없는 앱은 `retryOnNetworkError`만 둬도 된다.

---

## 6. 선택 계층 — UseCase와 DataSource

기본은 ViewModel → Repository 직접 호출이다. 아래 조건일 때만 계층을 추가한다.

### UseCase

추가 기준 (하나 이상):

1. 같은 Repository 조합 로직이 ViewModel 2곳 이상에서 반복된다.
2. 여러 Repository를 엮는 업무 규칙이 있고, ViewModel과 따로 단위 테스트할 가치가 있다.
3. ViewModel이 비대해진 원인이 화면 상태가 아니라 업무 규칙이다.

```kotlin
// domain/usecase/<group>/SubmitScoreUseCase.kt
class SubmitScoreUseCase @Inject constructor(
    private val matchRepository: MatchRepository,
    private val roundRepository: RoundRepository
) {
    suspend operator fun invoke(matchId: String, score: Int): ApiResult<HoleScoreSubmission> { /* 조합 규칙 */ }
}
```

- 이름은 `동사+명사+UseCase`, 공개 함수는 `operator fun invoke` 하나다.
- domain 안의 순수 Kotlin이다. Android와 data를 import하지 않는다.
- Repository 함수 하나를 그대로 호출하고 끝나는 UseCase는 만들지 않는다. 그런 경우 ViewModel이 Repository를 직접 쓴다.
- 한 화면에서 UseCase와 같은 Repository 직접 호출을 섞어도 된다. 모든 호출을 UseCase로 감싸는 일관성보다 껍데기 클래스가 없는 쪽이 낫다.

### DataSource

Repository가 원격과 로컬을 **조합**할 때만 나눈다. 예: 원격 응답을 Room에 저장하고 Room을 단일 진실 공급원으로 노출, 오프라인 우선 동기화.

```text
data/remote/XxxRemoteDataSource.kt   # Api + safeApiCall
data/local/XxxLocalDataSource.kt     # Room DAO · DataStore
```

단순 API 호출만 하는 Repository는 `XxxApi`를 직접 주입받는다. DataSource를 끼워 Api 호출을 한 번 더 감싸지 않는다.

---

## 7. 금지 패턴

- domain에서 `data.*` 또는 `android.*` import (도메인 모델·인터페이스·UseCase 전부)
- presentation에서 `data.*` import (DTO·Api·RepositoryImpl·WebSocket payload 포함)
- Repository 인터페이스 시그니처에 `XxxRequest`·`XxxData`·`Response<T>` 사용
- Repository 공개 함수에서 예외를 던지거나 `ApiResult` 없이 nullable로 실패 표현
- Repository에서 `runCatching`으로 API 호출을 감싸기 (`CancellationException` 삼킴)
- 메서드마다 응답 분기·실패 변환을 직접 작성 (`safeApiCall` 미사용)
- RepositoryImpl 안의 private 매퍼 (`data/mapper/`에 둔다)
- 상태를 바꾸는 요청을 서버 중복 방지 장치(멱등성 키·revision) 없이 자동 재전송, 조회에 안 보인다는 이유만으로 미반영(`NotApplied`) 판정
- 게이트웨이 실패를 `code` 문자열(`"HTTP_503"` 등)로 판별 (`httpStatus` 기준 `isResultUnknown` 사용)
- ViewModel에서 같은 요청을 반복 호출해 재시도
- Repository 함수 하나를 그대로 넘기는 UseCase, Api 호출을 그대로 감싸는 DataSource
- data 계층에서 문자열 리소스·Context 참조
- URL·API 키·토큰 하드코딩 (`BuildConfig`/`local.properties` 주입)

---

## 8. 체크리스트

- [ ] domain 파일에 `data.*`·`android.*` import가 없는가?
- [ ] presentation 파일에 `data.*` import가 없는가?
- [ ] DTO는 `@Keep @Serializable`이고 필드·nullable이 명세와 같은가?
- [ ] DTO → domain 매퍼가 `data/mapper/`에 있는가?
- [ ] Repository 인터페이스가 도메인 모델과 기본 타입만 쓰는가?
- [ ] 모든 API 호출이 `safeApiCall`/`safeApiCallNoData`를 거치고 `runCatching`이 없는가?
- [ ] RepositoryImpl이 `RepositoryModule`에 `@Binds`로 등록됐는가?
- [ ] `toFailure`가 모든 실패 분기에서 `httpStatus`를 채우는가?
- [ ] 상태 변경 요청의 자동 재전송이 서버 중복 방지 장치가 있을 때만, `NotApplied` 확정 뒤에만 일어나는가?
- [ ] UseCase·DataSource가 있다면 6절 추가 기준을 만족하는가?
- [ ] `./gradlew :app:compileDebugKotlin` 통과
- [ ] `./gradlew :app:ktlintCheck` 통과
