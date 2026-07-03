---
description: 3단계 — TODO 스텁에 실제 API 연결 (api 레이어 + 모델 + 에러 처리). DoD 게이트 포함.
---

# /connect-api — API 연결 (3단계)

입력: API 명세(엔드포인트/메서드/요청·응답 타입) + 대상 도메인명. 2단계(/logic)가 남긴 TODO 스텁을 실제 API로 연결한다.

## Phase A: 연결 지점 전수 검색 + 명세 매칭

1. `grep -rn "TODO: connect-api\|TODO: api" --include="*.swift"` 로 연결 지점 전수 목록화
2. 각 지점 ↔ API 명세 엔드포인트 매칭 표: `TODO 위치 | 엔드포인트 | 메서드 | 요청/응답 타입`
3. 명세에 없는 지점·지점이 없는 명세는 사용자에게 보고 (추측 연결 금지)

## Phase B: API 레이어 구현

- 프로젝트 기존 패턴 준수: `api/` 디렉토리의 기존 요청 함수 스타일(네트워킹 라이브러리·인증 헤더·베이스 URL 주입 방식)을 먼저 읽고 동일하게 작성
- 응답 모델은 `model/`에 `Codable`로 — 명세의 필드명/옵셔널 여부 그대로 (임의 생략 금지)
- 베이스 URL·키는 기존 상수/설정 주입 방식 사용 — **하드코딩 금지**

## Phase C: VM 연결 + 상태 처리

- TODO 스텁을 실제 호출로 교체, 로딩 상태(`isLoading` 등) + 에러 상태 반영
- 사용자 노출 에러는 기존 패턴(AppMsgState/Toast)으로 표시
- 취소/중복 호출 방지 (필요 시 Task 관리)

## Phase D: 자가 확인

- 빌드 성공 (xcodebuild) + SwiftLint(있으면) 위반 0
- dev 서버 접근이 가능하면 curl로 엔드포인트 1회 실측 (응답 형태 ↔ 모델 대조)

## Definition of Done

1. Phase A의 TODO 연결 지점이 전수 해소됨 (`grep` 재실행 결과 0건 또는 잔여 사유 명시)
2. 응답 모델이 명세와 일치 (필드 대조 근거 — 실측했으면 실측 응답 기준)
3. 로딩·에러 상태 처리 존재 (각 호출 지점별)
4. 빌드 성공 (xcodebuild 실행 결과)
5. URL·키·토큰 하드코딩 0건 (기존 주입 방식 사용)

> **완료 선언 전 checker 서브에이전트의 PASS 판정 필수** (maker/checker 분리 — 글로벌 규약). 런타임 확인은 smoke 에이전트(빌드+실행) 결과를 checker에 전달한다.

$ARGUMENTS
