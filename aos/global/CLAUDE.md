# 글로벌 규칙

<!-- 코딩 스타일·응답 방식·파일 작업·보안·커밋 금지 규칙은 SessionStart 훅(hooks/inject-model-rules.js)이 모델에 맞는 축약판을 주입한다: sonnet 계열 → prompts/SONNET_STYLE_COMPACT_PROMPT.md, 그 외 → prompts/OPUS_4_8_STYLE_COMPACT_PROMPT.md. 전체판이 필요할 때만 CLAUDE_HARNESS_STYLE_PROMPT=full로 올린다. 여기에 중복 추가하지 말 것 -->
<!-- 이 파일은 매 세션 통째로 컨텍스트에 올라간다 — 짧게 유지한다. Android 세부 규칙은 rules/android.md(.kt/.kts 작업 시 자동 로드), 피그마 파싱·검증 규칙은 references/figma-guide.md(해당 작업 전에 읽기)로 분리돼 있다 -->

## 언어

- 항상 한국어로 답변
- 코드 주석은 한국어로 작성

## 확인 질문 (묻는 횟수 최소화)

- `defaultMode: bypassPermissions`가 켜진 프로젝트에서는 **파일 수정·빌드·테스트·adb 설치/실행·진단용 임시 변경(원복 포함)을 묻지 말고 진행하고 결과만 보고**한다.
- 요구사항이 모호하면 질문 대신 **합리적 가정을 명시하고 진행 → 사후 보고**한다.
- 확인을 받는 건 되돌리기 어려운 것만: `push` / `push --force` / `reset --hard` / 파일 대량 삭제 / 외부 공개·배포. (커밋·푸시는 사용자가 요청할 때만 한다는 기존 규칙은 그대로.)
- `Definition of Done`이 있는 커맨드의 "사용자에게 보고하고 멈춘다" 조항은 **checker 3회 FAIL 같은 실제 막힘에만** 적용한다. 중간 진행 확인용으로 쓰지 않는다.
- 질문이 꼭 필요하면 **짧은 한국어 한 문장 + 구체적 선택지** 형태로 쓴다. 영어 원문·장문 설명·여러 질문 동시 나열 금지. 응답당 질문은 하나.

## Git

- 커밋 메시지는 Conventional Commits 형식 사용

## 동시 작업 (Claude 세션 여러 개)

- 같은 저장소의 병렬 작업은 **git worktree로만** 한다 (`EnterWorktree` 또는 `git worktree add`). 같은 폴더에서 두 세션이 동시에 빌드하면 Gradle 산출물을 서로 지워 stop-gate가 오차단된다.
- 다른 세션이 빌드 중이면 `./gradlew --stop`, `build/`·`.gradle/` 삭제, 스테일 캐시 정리를 하지 않는다. 그런 정리는 다른 세션이 없을 때만 한다.
- 동시 인스턴스는 2개 이하로 유지한다 (Gradle 데몬 메모리·의존성 저장소 호출 중복).
- stop-gate는 저장소 단위 락으로 빌드를 직렬화한다. 다른 세션의 락을 20초 넘게 기다리면 검증을 건너뛰고(fail-open) 수동 확인을 안내하므로, 그 안내가 보이면 `./gradlew compileDebugKotlin`을 직접 돌려 확인한다.

# 루프 운영 규약 (모든 프로젝트 공통)

## maker/checker 분리

- `/design`·`/logic`·`/connect-api` 등 구현 커맨드에 `Definition of Done` 섹션이 있으면, **완료 선언 전에 checker 서브에이전트의 PASS 판정이 필수**다. 구현한 쪽이 스스로 통과를 선언하지 않는다.
- checker는 판정만 한다 (수정 제안 금지). FAIL이면 maker가 수정 후 재판정, 최대 3회. 3회 후에도 FAIL이면 사용자에게 보고하고 멈춘다.
- 턴 종료 시 stop-gate 훅(`.claude/hooks/stop-gate.js`)이 변경 코드의 Kotlin 컴파일(compileDebugKotlin)/린트(설정 존재 시)/짝 단위 테스트를 자동 검증한다. 차단되면 에러를 수정한 후에만 완료를 선언할 수 있다.

## 무인 자동 수정 금지

- 루프(`/loop`, `/maintain`)는 **기계적 수정만** 한다 (포맷터, 명백한 금지 패턴 제거). 동작 변경·리팩토링·삭제는 보고만 하고 사람 판단에 맡긴다.
- 루프가 임의로 커밋/푸시하지 않는다.

## 학습 승격 파이프라인 (기록 → 규칙 → 자동화)

1. **세션 메모리**: 환경 quirk, 일회성 발견은 프로젝트 메모리에 기록
2. **프로젝트 CLAUDE.md**: 같은 실수가 재발하면 해당 프로젝트 CLAUDE.md의 `## 반복되는 실수` 섹션에 `### 제목 (YYYY-MM-DD)` 형식으로 추가
3. **훅 승격**: 같은 실수가 2회 이상 기록되면 그 프로젝트의 `.claude/hooks/quality-check.js`에 정규식 검사로 승격하여 편집 즉시 자동 차단 — 사용자에게 승격을 제안할 것

## 온보딩

- 새 프로젝트나 하네스 미적용 프로젝트를 만나면 `/harness-init` 실행을 제안한다.
- **신규 시작 AOS 프로젝트**는 `/harness-init` 시 `~/.claude/templates/UDF_ARCHITECTURE_GUIDE.md`·`DATA_LAYER_GUIDE.md`를 프로젝트 루트로 씨딩해 UDF 아키텍처(Contract/Route/Screen/ViewModel)와 data/domain 규칙(domain 인터페이스 + data 구현, UseCase 선택)을 적용한다. 기존/clone 프로젝트에는 적용하지 않는다 — 기존 아키텍처를 따른다.

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

# Android 규칙 — 위치 안내 (Android/Kotlin 프로젝트에서만, iOS 프로젝트에서는 무시)

- Android 세부 규칙(@Keep, Compose Stability, 패키지 구조, Safe Area, Modifier 순서, 리소스·아이콘)은 `~/.claude/rules/android.md`에 있다. `.kt`/`.kts` 파일을 다룰 때 자동으로 로드된다.
- **공용 디자인 시스템 우선**: 피그마 디자인 구현 요청을 받으면 구현 전에 `build.gradle(.kts)`에서 공용 컴포넌트 라이브러리(디자인 시스템) 의존 여부를 확인하고, 연동돼 있으면 사용자가 말하지 않아도 그 컴포넌트와 테마 토큰을 우선 사용한다. 없는 프로젝트에서만 직접 구현한다. API 확인은 소스 탐색보다 라이브러리 가이드 문서(프로젝트에 사본이 있으면 버전 표기 확인)를 먼저 본다.
- 피그마 디자인 구현·공용 컴포넌트 사용·디자인 토큰 매핑 작업은 **코드 작성 전에** `~/.claude/references/figma-guide.md` 전체를 읽는다. 피그마 분석 서브에이전트에도 이 경로를 프롬프트에 넣어 직접 읽게 한다.
- 피그마 API 토큰은 환경변수 `$FIGMA_TOKEN`을 쓴다. 없으면 사용자에게 설정(셸 환경변수 또는 `~/.claude/settings.json`의 `env`)을 안내하고, 토큰 값을 파일·로그·보고에 적지 않는다.
