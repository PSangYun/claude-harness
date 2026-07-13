---
description: 1단계 — Figma 디자인을 Compose UI로 구현 (aos-common 매핑, Screen→Content→Preview 구조, 동작 로직 없음). DoD 게이트 포함.
---

# /design — UI 구현 (1단계: UI만)

입력: Figma 디자인 URL(들) + 대상 화면/도메인명. **이 단계에서는 UI만 만든다** — 동작 로직·API는 2·3단계의 일이다.

## Phase A: 디자인 분석

0. **`C:\Users\AORUS\.claude\references\figma-aos-common-guide.md`를 Read로 먼저 읽는다** — 컴포넌트/폰트/색상/디자인 토큰 매핑 테이블과 피그마 파싱·검증 규칙이 전부 이 파일에 있다. 피그마 분석 서브에이전트를 띄우면 이 경로를 프롬프트에 포함시킨다.
1. 전달받은 **모든** Figma URL을 피그마 MCP(`get_design_context`, `get_screenshot`)로 읽는다. 하나라도 생략 금지.
2. 값(색상·간격·폰트·radius·아이콘)은 **실측만** — 추측 금지. 확인 불가능한 값은 사용자에게 질문.
3. 화면 요소를 표로 전수 목록화: `요소 | 피그마 컴포넌트/값 | 구현 방법`

## Phase B: 컴포넌트 매핑

1. 피그마 컴포넌트 ↔ `aos-common` 기존 구현 매핑 — **`AOS_COMMON_GUIDE.md`를 먼저 확인**하고(소스 탐색은 보조), `component/{atoms,molecules,organisms}` 대응 확인
2. **aos-common에 있는 컴포넌트는 절대 재구현하지 않는다.** 없는 것만 프로젝트 `core/component`(또는 프로젝트 컨벤션 위치)에 신규 작성
3. 색상·치수·폰트는 aos-common `ui/theme`(Color/Area/Font) 토큰 사용 — hex/dp 하드코딩 금지

## Phase C: UI 구현

- **Screen → Content → Preview 3단 구조** 준수:
  - `XxxScreen`: 라우트 진입점 (이 단계에서는 VM 연결 없이 더미 상태 전달)
  - `XxxContent`: **stateless** UI (모든 상태·콜백을 파라미터로 받음)
  - `XxxContentPreview`: `@Preview` — 더미 데이터로 렌더 확인
- 클릭 등 콜백은 빈 람다 + `// TODO: logic (2단계)` 주석
- API 호출·네비게이션 로직·비즈니스 규칙 **금지** (네비게이션은 콜백 파라미터로만 노출)
- XML 레이아웃 금지 (100% Compose)

## Phase D: 자가 확인

- 컴파일 성공: `./gradlew -q :<모듈>:compileDebugKotlin` (모듈명은 settings.gradle.kts — 예: `:app`)
- ktlint(도입돼 있으면) 위반 0: `./gradlew ktlintCheck`

## Definition of Done

1. Phase A의 요소 표에 있는 모든 화면 요소가 구현됨 (표 ↔ 코드 대조 근거)
2. aos-common에 존재하는 컴포넌트를 재구현하지 않음 (가이드/`component/` 확인 근거 제시)
3. 색상·치수·폰트 하드코딩 없음 — `ui/theme` 토큰 사용 (신규 코드에 hex/`.dp` 리터럴은 토큰 부재 사유 명시분만)
4. Screen → Content(stateless) → Preview 3단 구조 준수 (Content가 상태를 소유하지 않음)
5. 컴파일 성공 (`compileDebugKotlin` 실행 결과)
6. 동작 로직·API 호출 코드 없음 (콜백은 빈 람다 + TODO), 신규 코드에 `Log.d`/`println` 0건

> **완료 선언 전 checker 서브에이전트의 PASS 판정 필수** (maker/checker 분리). FAIL이면 maker가 수정 후 재판정 — **최대 3회**, 이후에도 FAIL이면 사용자에게 보고하고 중단한다. 런타임 확인이 필요하면 smoke 에이전트 결과를 checker에 전달한다.

$ARGUMENTS
