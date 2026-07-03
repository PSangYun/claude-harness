# 글로벌 규칙

항상 한국어로 답변

# 루프 운영 규약 (모든 프로젝트 공통)

## maker/checker 분리

- `/design`·`/logic`·`/connect-api` 등 구현 커맨드에 `Definition of Done` 섹션이 있으면, **완료 선언 전에 checker 서브에이전트의 PASS 판정이 필수**다. 구현한 쪽이 스스로 통과를 선언하지 않는다.
- checker는 판정만 한다 (수정 제안 금지). FAIL이면 maker가 수정 후 재판정, 최대 3회. 3회 후에도 FAIL이면 사용자에게 보고하고 멈춘다.
- 턴 종료 시 stop-gate 훅(`.claude/hooks/stop-gate.js`)이 변경 코드의 Kotlin 컴파일(compileDebugKotlin)/린트(설정 존재 시)를 자동 검증한다. 차단되면 에러를 수정한 후에만 완료를 선언할 수 있다.

## 무인 자동 수정 금지

- 루프(`/loop`, `/maintain`)는 **기계적 수정만** 한다 (포맷터, 명백한 금지 패턴 제거). 동작 변경·리팩토링·삭제는 보고만 하고 사람 판단에 맡긴다.
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

# aos-common — 피그마 디자인 시스템 ↔ 코드 매핑

- 저장소: `github.com/itandsy/aos-common` — GitHub Packages 배포 `com.itappandsy:aos-common` (모듈 `:AosCommon`, namespace `com.itappandsy.aoscommon`)
- 피그마 파일: `D-펫포션_디자인 시스템` (fileKey: `b40fvavILA2SJpQkH9lZO9`)

> 피그마 MCP로 디자인을 가져올 때, aos-common의 기존 컴포넌트를 먼저 확인하여 사용할 것.
> **새 컴포넌트를 만들지 말고**, 기존 컴포넌트를 import하여 사용할 것.
> **API 확인은 소스 탐색보다 `AOS_COMMON_GUIDE.md`를 먼저 볼 것** (사용처 저장소에 사본이 있음 — 단, 사본 버전이 라이브러리 최신과 다를 수 있으니 버전 표기를 확인).

## 컴포넌트 탐색 규칙

aos-common은 피그마 디자인 시스템과 동일한 아토믹 구조를 따른다 (`com.itappandsy.aoscommon.common` 하위):

```
component/
├── atoms/      — avatar, badge, button, category/{chip, segment, tabs},
│                 check, checkbox, decorate, divider, icon, indicator,
│                 label, radio, scrollbar, switch, thumbnail, toast,
│                 toggle, tooltip
├── molecules/  — actions, keyboard, login, navigation, textBox
└── organisms/  — bottomsheet, dialog, list
ui/theme/       — Area.kt(간격), Color.kt(색상 토큰), Font.kt, Opacity.kt
```

- 피그마 컴포넌트 `Button/...` → `component/atoms/button/` 안의 기존 구현을 먼저 확인
- 색상 hex·치수 하드코딩 금지 — `ui/theme`의 토큰 사용 (초기화는 `initPrimaryColor` 등 가이드 참조)

## 배포·소비 방식 주의 (공개 API 변경 시)

- **공개 API(컴포저블 파라미터) 변경은 반드시 사용자 확인 후 진행** — 소비 앱이 버전 고정으로 쓰므로 파괴적 변경은 업그레이드를 막는다.
- 라이브러리 수정 후 배포 절차: 버전 갱신 → `AOS_COMMON_GUIDE.md` 갱신 → `./gradlew :AosCommon:publishReleasePublicationToGitHubPackagesRepository` → `feat: x.y.z publish` 커밋 (aos-common CLAUDE.md의 Publish 절차 준수)
- 소비 앱(예: ParkGolfAOS)은 `implementation("com.itappandsy:aos-common:x.y.z")` 버전 고정 — 라이브러리 publish 후 **앱의 버전과 가이드 사본을 함께 갱신**해야 드리프트가 안 생긴다.
- 빌드에는 GitHub Packages 자격증명 필요: `local.properties`의 `gpr.user`/`gpr.key` (또는 env `GPR_USER`/`GPR_KEY`) — 없으면 sync 자체가 실패한다.
