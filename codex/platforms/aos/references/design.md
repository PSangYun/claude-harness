> Codex 이식 기준: 이 문서의 플랫폼별 구현·DoD를 사용한다. 실행과 권한 규칙은 프로젝트 AGENTS.md 및 선택한 harness Skill을 따른다. verify.json은 `commands: [{name, command}]` 형식이다. 검증기는 자동 턴 종료 훅이 아니며 명시적으로 실행한다. 특정 버전·브랜치·프로젝트명은 실제 코드에서 재확인한다.

# $harness-design — UI 구현 (1단계: UI만)

입력: Figma 디자인 URL(들) + 대상 화면/도메인명. **이 단계에서는 UI만 만든다** — 동작 로직·API는 2·3단계의 일이다.

## Phase A: 디자인 분석

1. 전달받은 **모든** Figma URL을 피그마 MCP(`get_design_context`, `get_screenshot`)로 읽는다. 하나라도 생략 금지.
2. 값(색상·간격·폰트·radius·아이콘)은 **실측만** — 추측 금지. 확인 불가능한 값은 사용자에게 질문.
3. 화면 요소를 표로 전수 목록화: `요소 | 피그마 컴포넌트/값 | 구현 방법`

## Phase B: 컴포넌트 매핑

1. `.codex/harness/references/figma-aos-common-guide.md`가 있으면 **코드 작성 전에 전체를 읽는다** (피그마 컴포넌트·폰트·색상·Area 토큰 ↔ aos-common 매핑표). 서브에이전트에 위임할 때도 이 경로를 프롬프트에 넘긴다
2. 피그마 컴포넌트 ↔ `aos-common` 기존 구현 매핑 — **`AOS_COMMON_GUIDE.md`를 먼저 확인**하고(소스 탐색은 보조), `component/{atoms,molecules,organisms}` 대응 확인
3. **aos-common에 있는 컴포넌트는 절대 재구현하지 않는다.** 없는 것만 프로젝트 `core$harness-component`(또는 프로젝트 컨벤션 위치)에 신규 작성
4. 색상·치수·폰트는 aos-common `ui/theme`(Color/Area/Font) 토큰 사용 — hex/dp 하드코딩 금지

## Phase C: UI 구현

- **UDF 구조(Contract/Route/Screen) 준수** — 프로젝트 루트 `UDF_ARCHITECTURE_GUIDE.md` 3절 템플릿 기준 (가이드 없는 기존 프로젝트는 AGENTS.md의 화면 구조 컨벤션):
  - `XxxContract`: `XxxUiState`(이 단계는 UI 표현에 필요한 필드만) + `XxxIntent` sealed interface(UI 이벤트 이름만 선언, 처리 없음) + `XxxNavigation`
  - `XxxRoute`: 이 단계에서는 VM 연결 없이 더미 상태 전달 — 이동 요청은 `onNavigate` 하나만 노출, `NavController` 파라미터 금지
  - `XxxScreen`: `state`·`onIntent`만 받는 **순수 렌더링** (내부 private `XxxContent` 위임 가능, 화면 상태 소유 금지)
  - `XxxScreenPreview`: `@Preview` — ViewModel 없이 더미 UiState로 렌더 확인
- 클릭 등 이벤트는 `onIntent(XxxIntent.Xxx)` 호출까지만 — 처리는 `// TODO: logic (2단계)` 주석
- API 호출·네비게이션 로직·비즈니스 규칙 **금지** (이동 요청은 `XxxNavigation`으로만 노출, 실제 이동은 NavGraph의 일)
- XML 레이아웃 금지 (100% Compose)

## Phase D: 자가 확인

- 컴파일 성공: `./gradlew -q :<모듈>:compileDebugKotlin` (모듈명은 settings.gradle.kts — 예: `:app`)
- ktlint(도입돼 있으면) 위반 0: `./gradlew ktlintCheck`

## Definition of Done

1. Phase A의 요소 표에 있는 모든 화면 요소가 구현됨 (표 ↔ 코드 대조 근거)
2. aos-common에 존재하는 컴포넌트를 재구현하지 않음 (AOS_COMMON_GUIDE·references 매핑표/`component/` 확인 근거 제시)
3. 색상·치수·폰트 하드코딩 없음 — `ui/theme` 토큰 사용 (신규 코드에 hex/`.dp` 리터럴은 토큰 부재 사유 명시분만)
4. Contract/Route/Screen 구조 준수 (Screen이 `state`·`onIntent`만 받고 화면 상태를 소유하지 않음, Route에 `NavController` 없음, Preview가 ViewModel 없이 렌더됨)
5. 컴파일 성공 (`compileDebugKotlin` 실행 결과)
6. 동작 로직·API 호출 코드 없음 (이벤트는 `onIntent` 호출까지만 + TODO), 신규 코드에 `Log.d`/`println` 0건
