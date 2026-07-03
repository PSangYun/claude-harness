---
description: 신규 기능 스캐폴딩 — View/VM 폴더·파일 뼈대 생성 (사전 질문 필수, 로직 없음). DoD 게이트 포함.
---

# /feature — 기능 스캐폴딩 (iOS)

신규 기능의 폴더 구조와 파일 뼈대만 만든다. **비즈니스 로직·UI 디테일은 넣지 않는다** — 그건 이후 `/design`(UI)·`/logic`(동작)·`/connect-api`(API)의 일이다.

## Phase A: 사전 질문 (답을 받기 전에 아무것도 생성하지 않는다)

1. **도메인명** (예: `reservation`) — 폴더·타입 네이밍에 사용
2. **진입 경로** — 어느 화면/탭에서 진입하는가? 네비게이션 연결도 이번에 하는가?
3. **레이어 범위** — 화면만인가, API 연동 예정인가? (model/api 스텁 생성 여부 결정)
4. **참고할 기존 유사 화면** — 없으면 `view/main/home` 패턴을 기준으로 삼는다

## Phase B: 기존 패턴 실측

- 유사 화면 폴더를 Read로 확인 — 파일 구성(`XxxView` + `XxxVM`)·네이밍·상태 패턴을 실측 (추측 금지)
- `core/navigation`의 화면 등록/전환 방식 확인

## Phase C: 스캐폴딩 생성 (사전 질문에서 지정된 것만)

**view/<그룹>/<도메인>/** (항상):
- `<Xxx>View.swift` — SwiftUI 뷰 뼈대 + `#Preview`(더미 상태). 액션은 빈 클로저 + `// TODO: logic (2단계)`
- `<Xxx>VM.swift` — `class <Xxx>VM: ObservableObject` + 화면 상태 `@Published` 프로퍼티(더미 초기값) + 빈 액션 함수(`// TODO: logic`)

**API 연동 예정일 때만**:
- `model/<Xxx>.swift` — 빈 `Codable` 구조체 + `// TODO`
- `api/` — 기존 요청 함수 패턴의 스텁 (`// TODO: connect-api (3단계)`, 네트워크 코드 금지)

**네비게이션** (요청 시):
- 기존 `core/navigation` 패턴 그대로 화면 등록/전환 연결

모든 파일 본문은 컴파일되는 최소 뼈대 + `// TODO:` 주석만.

## Phase D: 자가 확인

- 빌드 성공: `xcodebuild -workspace ParkGolfIOS.xcworkspace -scheme ParkGolfIOS -configuration Debug -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO -quiet build` (프로젝트 CLAUDE.md/`.claude/stop-gate.json`의 명령 우선)
- SwiftLint(설정 있으면) 위반 0

## Definition of Done

1. Phase A 사전 질문에 대한 사용자 답변이 존재하고, **지정된 범위만** 생성됨 (임의 추가 0건)
2. 생성 파일이 참고 화면의 구조·네이밍 패턴과 일치 (실측 근거)
3. View/VM 분리 준수 (View에 상태 소유·로직 없음) + `#Preview` 존재
4. (요청 시) 네비게이션 등록됨 (기존 패턴)
5. 빌드 성공 + 비즈니스 로직·네트워크 코드 0건 (TODO 스텁만)
6. 신규 코드에 강제 언래핑·`print()` 0건

> **완료 선언 전 checker 서브에이전트의 PASS 판정 필수** (maker/checker 분리 — 글로벌 규약).

$ARGUMENTS
