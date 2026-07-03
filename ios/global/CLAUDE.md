# 글로벌 규칙

항상 한국어로 답변

# 루프 운영 규약 (모든 프로젝트 공통)

## maker/checker 분리

- `/design`·`/logic`·`/connect-api` 등 구현 커맨드에 `Definition of Done` 섹션이 있으면, **완료 선언 전에 checker 서브에이전트의 PASS 판정이 필수**다. 구현한 쪽이 스스로 통과를 선언하지 않는다.
- checker는 판정만 한다 (수정 제안 금지). FAIL이면 maker가 수정 후 재판정, 최대 3회. 3회 후에도 FAIL이면 사용자에게 보고하고 멈춘다.
- 턴 종료 시 stop-gate 훅(`~/.claude/hooks/stop-gate.js`)이 변경 코드의 SwiftLint(설정 존재 시)/xcodebuild 빌드를 자동 검증한다. 차단되면 에러를 수정한 후에만 완료를 선언할 수 있다.

## 무인 자동 수정 금지

- 루프(`/loop`, `/maintain`)는 **기계적 수정만** 한다 (`swiftlint --fix`, 포맷터, 명백한 금지 패턴 제거). 동작 변경·리팩토링·삭제는 보고만 하고 사람 판단에 맡긴다.
- 루프가 임의로 커밋/푸시하지 않는다.

## 학습 승격 파이프라인 (기록 → 규칙 → 자동화)

1. **세션 메모리**: 환경 quirk, 일회성 발견은 프로젝트 메모리에 기록
2. **프로젝트 CLAUDE.md**: 같은 실수가 재발하면 해당 프로젝트 CLAUDE.md의 `## 반복되는 실수` 섹션에 `### 제목 (YYYY-MM-DD)` 형식으로 추가
3. **훅 승격**: 같은 실수가 2회 이상 기록되면 그 프로젝트의 `.claude/hooks/quality-check.js`에 정규식 검사로 승격하여 편집 즉시 자동 차단 — 사용자에게 승격을 제안할 것

## 온보딩

- 새 프로젝트나 하네스 미적용 프로젝트를 만나면 `/harness-init` 실행을 제안한다.

# 코드 리뷰 작성 방식

PR/코드 리뷰 요청 시(예: "PR #N 리뷰해줘", `/review`) 아래 규칙을 따른다.

1. **인라인 코멘트가 기본.** 단순 텍스트 응답이나 PR 본문(이슈) 코멘트로 끝내지 않는다. `gh api -X POST repos/<owner>/<repo>/pulls/<n>/reviews`에 `commit_id`(head SHA) + `event: "COMMENT"` + `comments` 배열(`path`/`line`/`side: "RIGHT"`/`body`)을 한 번에 제출.
2. **라인 번호는 patch에서 직접 계산.** `gh api .../pulls/<n>/files`로 받은 `patch` 필드를 파싱해 hunk `@@ -A,B +C,D @@`의 새 라인 번호를 추적한다. `+`와 context 라인만 카운트, `-` 라인은 스킵.
3. **사람이 쓴 톤, 이모지 금지.** "~할 것 같습니다", "~어떠실까요", "확인 부탁드립니다" 같은 동료 개발자 톤. AI가 작성한 듯한 어색한 표현·이모지 절대 금지.
4. **단정이 아니라 제안.** "~해야 합니다"가 아니라 "~하는 게 좋아 보입니다", "~검토 부탁드립니다", "~방향 어떠실까요"처럼 제안형. 좋은 변경은 함께 칭찬한다.
5. **머지 커밋으로 들어온 파일은 인라인 불가.** dev 등에서 머지되어 들어온 파일은 GitHub API가 `Path could not be resolved`로 거부함. 이 경우 같은 PR에 별도 리뷰를 게시하되 본문에 `**파일경로:라인** — 내용` 형식으로 정리.
6. **에러 디버깅.** `Unprocessable Entity` + `Line/Path could not be resolved`가 떨어지면 코멘트 배열을 이등분/제외하며 실패 항목을 격리한다. 더미 코멘트("test", "dbg" 등)는 실제 PR에 절대 게시하지 않는다(분류기에서 차단되며 협업자에게 노이즈).
7. **리뷰 본문 제목.** 분할 제출하더라도 사용자에게 노출되므로 "리뷰 1/2" 같은 디버깅 흔적 대신 의미 있는 한 줄로.
8. **마지막 단계로 사용자에게 PR URL과 등록 결과(인라인 N건, 본문 정리 M건)를 요약해서 알린다.**

# ios-common — 피그마 디자인 시스템 ↔ 코드 매핑

- 저장소: `github.com/itandsy/ios-common` — SwiftPM 라이브러리, **import 시 모듈명 `ios_common`**, iOS 16+, 의존성 Kingfisher·MarkdownUI
- 피그마 파일: `D-펫포션_디자인 시스템` (fileKey: `b40fvavILA2SJpQkH9lZO9`)

> 피그마 MCP로 디자인을 가져올 때, ios-common의 기존 컴포넌트를 먼저 탐색하여 사용할 것.
> **새 컴포넌트를 만들지 말고**, 매핑된 기존 컴포넌트를 import하여 사용할 것.

## 컴포넌트 탐색 규칙

ios-common은 피그마 디자인 시스템과 동일한 아토믹 구조를 따른다:

```
Sources/ios-common/
├── component/
│   ├── atoms/      — avatar, badge, button, check, checkbox, chip, divider,
│   │                 gradient, indicator, label, logo, radio, skeleton,
│   │                 switch, tab, toast, toggleIcon
│   ├── molecules/
│   ├── organism/
│   └── common/
├── design/         — area(간격), color(색상 토큰), text(타이포그래피)
├── core/           — AppMsgState, SwipeState
└── utils/
```

- 피그마 컴포넌트 `Button/...` → `component/atoms/button/` 안의 기존 구현을 먼저 확인
- 색상·간격·폰트는 hex/숫자 하드코딩 금지 — `design/{color,area,text}`의 토큰 사용

## 소비 방식 주의 (공개 API 변경 시)

- ParkGolfIOS는 ios-common을 SPM으로 **브랜치 `1.0.0` 추적** 방식으로 소비한다 (semver 태그 잠금 아님).
- 즉 `1.0.0` 브랜치에 푸시하면 앱이 재-resolve 시 그대로 따라간다 — **공개 API 시그니처를 바꾸는 변경은 반드시 사용자 확인 후 진행**하고, 소비 앱(ParkGolfIOS) 빌드가 깨지지 않는지 확인할 것.
