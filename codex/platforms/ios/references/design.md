> Codex 이식 기준: 이 문서의 플랫폼별 구현·DoD를 사용한다. 실행과 권한 규칙은 프로젝트 AGENTS.md 및 선택한 harness Skill을 따른다. verify.json은 `commands: [{name, command}]` 형식이다. 검증기는 자동 턴 종료 훅이 아니며 명시적으로 실행한다. 특정 버전·브랜치·프로젝트명은 실제 코드에서 재확인한다.

# $harness-design — UI 구현 (1단계: UI만)

입력: Figma 디자인 URL(들) + 대상 화면/도메인명. **이 단계에서는 UI만 만든다** — 동작 로직·API는 2·3단계의 일이다.

## Phase A: 디자인 분석

1. 전달받은 **모든** Figma URL을 피그마 MCP(`get_design_context`, `get_screenshot`)로 읽는다. 하나라도 생략 금지.
2. 값(색상·간격·폰트·radius·아이콘)은 **실측만** — 추측 금지. 확인 불가능한 값은 사용자에게 질문.
3. 화면 요소를 표로 전수 목록화: `요소 | 피그마 컴포넌트/값 | 구현 방법`

## Phase B: 컴포넌트 매핑

1. 피그마 컴포넌트 ↔ `ios-common` 기존 구현 매핑 (`import ios_common`, `Sources/ios-common$harness-component/{atoms,molecules,organism}` 탐색)
2. **ios-common에 있는 컴포넌트는 절대 재구현하지 않는다.** 없는 것만 프로젝트 컴포넌트로 신규 작성 (`XxxView.swift`)
3. 색상·간격·폰트는 ios-common `design/{color,area,text}` 토큰 사용 — hex/숫자 하드코딩 금지

## Phase C: UI 구현

- View를 구현하고, VM(`XxxVM: ObservableObject`)은 화면에 필요한 `@Published` 프로퍼티와 더미 초기값까지만 만든다
- 버튼 등 액션은 빈 클로저 + `// TODO: logic (2단계)` 주석
- API 호출·네비게이션 로직·비즈니스 규칙 **금지**
- `#Preview`(또는 PreviewProvider) 필수 — 더미 데이터로 렌더 확인

## Phase D: 자가 확인

- 빌드 성공: 프로젝트 AGENTS.md(또는 `.codex/harness/verify.json`)의 xcodebuild 명령 실행
- SwiftLint(설정 있으면) 위반 0

## Definition of Done

1. Phase A의 요소 표에 있는 모든 화면 요소가 구현됨 (표 ↔ 코드 대조 근거)
2. ios-common에 존재하는 컴포넌트를 재구현하지 않음 (`component/` 탐색 결과 근거 제시)
3. 색상·간격·폰트 하드코딩 없음 — `design/{color,area,text}` 토큰 사용 (신규 코드에 hex 리터럴 0건)
4. 빌드 성공 (xcodebuild 실행 결과)
5. 동작 로직·API 호출 코드 없음 (액션은 빈 클로저 + TODO)
6. `#Preview` 존재, 신규 코드에 `print()`·강제 언래핑(`!`/`try!`/`as!`) 0건
