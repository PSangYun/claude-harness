> Codex 이식 기준: 이 문서의 플랫폼별 구현·DoD를 사용한다. 실행과 권한 규칙은 프로젝트 AGENTS.md 및 선택한 harness Skill을 따른다. verify.json은 `commands: [{name, command}]` 형식이다. 검증기는 자동 턴 종료 훅이 아니며 명시적으로 실행한다. 특정 버전·브랜치·프로젝트명은 실제 코드에서 재확인한다.

# $harness-connect-api — API 연결 (3단계)

입력: API 명세(엔드포인트/메서드/요청·응답 타입) + 대상 도메인명. 2단계($harness-logic)가 남긴 repository 스텁을 실제 API로 연결한다.

## Phase A: 연결 지점 전수 검색 + 명세 매칭

1. `grep -rn "TODO: connect-api\|TODO: api" --include="*.kt"` 로 연결 지점 전수 목록화
2. 각 지점 ↔ API 명세 엔드포인트 매칭 표: `TODO 위치 | 엔드포인트 | 메서드 | 요청/응답 타입`
3. 명세에 없는 지점·지점이 없는 명세는 사용자에게 보고 (추측 연결 금지)

## Phase B: data 레이어 구현 (기존 패턴 준수)

기준 문서: 프로젝트 루트 `DATA_LAYER_GUIDE.md`(있으면 2~5절 규칙·7절 금지 패턴). 가이드가 없는 기존 프로젝트는 기존 data 코드의 패턴을 그대로 따른다.

- `data/api/`의 기존 Retrofit 인터페이스 스타일을 먼저 읽고 동일하게 작성 (인증 헤더·suspend 시그니처·에러 래핑 방식)
- 요청/응답 모델은 `data/model/{request,response}/`에 `@Keep @Serializable`로 — 명세의 필드명/nullable 여부 그대로 (임의 생략 금지). DTO → domain 매핑은 `data/mapper/`의 `toDomain()` 확장 함수로 (가이드 없는 프로젝트는 기존 매퍼 위치)
- repository 구현(`data/repository/`)이 domain 인터페이스를 구현, Hilt DI 모듈에 바인딩 등록. 인터페이스 시그니처에 DTO·`Response<T>`가 나타나지 않게 한다
- API 호출은 공통 헬퍼(`safeApiCall` 등 — 없으면 가이드 3절대로 `data/repository/extension/`에 먼저 만든다)를 거친다. 메서드마다 `runCatching`으로 감싸 응답 분기를 직접 쓰지 않는다 (`CancellationException` 삼킴)
- 상태를 바꾸는 요청은 서버 중복 방지 장치(멱등성 키·`expectedRevision` 등)가 있을 때만 `sendReconciled`로 확인 후 재전송한다. 없으면 자동 재전송하지 않고 `isResultUnknown` 실패를 ViewModel에 넘겨 "처리 결과 확인 필요"로 보여준다. 장치 유무가 명세에 없으면 사용자에게 확인한다 (가이드 5절 — 조회는 `retryOnNetworkError`)
- 베이스 URL·키는 `BuildConfig`/`local.properties` 주입 방식 사용 — **하드코딩 금지**

## Phase C: VM 연결 + 상태 처리

- 2단계 스텁을 실제 repository 호출로 교체 — `viewModelScope` 코루틴, 로딩 상태 + 에러 상태를 uiState에 반영 (성공 후 화면 이동 같은 중요한 결과는 `UiState.result` + `ResultHandled` Intent — Channel/SharedFlow로만 전달 금지)
- 사용자 노출 에러는 기존 패턴(toast/스낵바/에러 뷰)으로 표시
- 중복 요청 방지·화면 이탈 시 취소(viewModelScope가 담당하는지 확인)

## Phase D: 자가 확인

- 컴파일 성공: `./gradlew -q :<모듈>:compileDebugKotlin` + ktlint(있으면) 위반 0
- dev 서버 접근이 가능하면 curl로 엔드포인트 1회 실측 (응답 형태 ↔ `@Serializable` 모델 대조)
- 401/Could not resolve 류 실패는 GPR 자격증명 문제(환경) — 코드 수정으로 대응하지 말고 보고

## Definition of Done

1. Phase A의 TODO 연결 지점이 전수 해소됨 (`grep` 재실행 결과 0건 또는 잔여 사유 명시)
2. 응답 모델이 명세와 일치하고 domain 매핑 존재 (필드 대조 근거 — 실측했으면 실측 응답 기준)
3. repository 구현이 DI에 등록되어 주입됨 (Hilt 모듈 근거)
4. 로딩·에러 상태 처리 존재 (각 호출 지점별, uiState 반영)
5. 컴파일 성공 (`compileDebugKotlin` 실행 결과)
6. URL·키·토큰 하드코딩 0건 (BuildConfig/local.properties 주입)
7. 레이어 방향 준수 — 신규·변경 파일 중 domain·presentation에 `data.*` import 0건, domain에 `android.*` import 0건 (`grep` 결과 근거)
8. 신규 API 호출이 전부 공통 헬퍼를 거치고 Repository에 `runCatching` 0건 (`DATA_LAYER_GUIDE.md`가 없는 프로젝트는 기존 에러 래핑 방식과 일치하는지로 판정)
