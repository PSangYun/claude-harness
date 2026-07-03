---
description: 3단계 — TODO 스텁에 실제 API 연결 (Retrofit 인터페이스 + 모델 + Repository 구현 + DI). DoD 게이트 포함.
---

# /connect-api — API 연결 (3단계)

입력: API 명세(엔드포인트/메서드/요청·응답 타입) + 대상 도메인명. 2단계(/logic)가 남긴 repository 스텁을 실제 API로 연결한다.

## Phase A: 연결 지점 전수 검색 + 명세 매칭

1. `grep -rn "TODO: connect-api\|TODO: api" --include="*.kt"` 로 연결 지점 전수 목록화
2. 각 지점 ↔ API 명세 엔드포인트 매칭 표: `TODO 위치 | 엔드포인트 | 메서드 | 요청/응답 타입`
3. 명세에 없는 지점·지점이 없는 명세는 사용자에게 보고 (추측 연결 금지)

## Phase B: data 레이어 구현 (기존 패턴 준수)

- `data/api/`의 기존 Retrofit 인터페이스 스타일을 먼저 읽고 동일하게 작성 (인증 헤더·suspend 시그니처·에러 래핑 방식)
- 요청/응답 모델은 `data/model/`에 `@Serializable`로 — 명세의 필드명/nullable 여부 그대로 (임의 생략 금지), domain 모델과 매핑 함수 작성
- repository 구현(`data/repository/`)이 domain 인터페이스를 구현, Hilt DI 모듈에 바인딩 등록
- 베이스 URL·키는 `BuildConfig`/`local.properties` 주입 방식 사용 — **하드코딩 금지**

## Phase C: VM 연결 + 상태 처리

- 2단계 스텁을 실제 repository 호출로 교체 — `viewModelScope` 코루틴, 로딩 상태 + 에러 상태를 uiState에 반영
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

> **완료 선언 전 checker 서브에이전트의 PASS 판정 필수** (maker/checker 분리 — 글로벌 규약). 런타임 확인은 smoke 에이전트(빌드+실행) 결과를 checker에 전달한다.

$ARGUMENTS
