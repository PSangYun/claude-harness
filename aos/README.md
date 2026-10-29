# AOS 하네스

실사용 머신의 전역 설정(`~/.claude`)을 역반영한 발전판 (2026-10-28 동기화 — 실사용 프로젝트 기준, UDF 아키텍처 + data/domain 가이드 적용). 특정 회사·라이브러리 이름에 의존하지 않는 범용판이다. 공통 설명은 루트 README 참조 — 여기는 **aos가 web/ios와 다른 점**만 기록한다.

## 폴더 구조

```
aos/
├── global/            # 팀원 각자의 ~/.claude/ 에 배치 — ./install.sh aos
│   ├── CLAUDE.md      #   핵심판(~70줄): 언어·확인 질문·동시 작업·루프 규약·코드 리뷰·Android 규칙 위치 안내
│   │                  #   (매 세션 통째로 로드되므로 짧게 유지 — 세부 규칙은 아래 rules/·references/로 분리)
│   ├── rules/android.md                      # Android 세부 규칙 — paths: **/*.kt, **/*.kts 일 때만 자동 로드
│   ├── references/figma-guide.md             # 공용 디자인 시스템 우선 사용 + 피그마 파싱·검증 규칙 (피그마 작업 전 읽기)
│   ├── templates/UDF_ARCHITECTURE_GUIDE.md   # 신규 AOS 프로젝트 루트에 씨딩하는 UDF 가이드 (/harness-init Phase 2)
│   ├── templates/DATA_LAYER_GUIDE.md         # 같은 조건으로 씨딩하는 data/domain 가이드 (Repository·DTO·safeApiCall·재시도·UseCase 기준)
│   ├── settings.json  #   SessionStart(inject-model-rules) 훅 + env + subagentPromptCacheTtl — Stop 훅 없음 (아래 정책)
│   ├── prompts/       #   모델별 운영 규칙 프롬프트 8종 (OPUS·SONNET 각 4종) — 기본은 *_COMPACT_PROMPT 주입
│   ├── hooks/         #   inject-model-rules.js 만 (stop-gate.js 글로벌 사본 없음)
│   ├── commands/      #   harness-init 만 (maintain·review-loop는 project/commands 가 정본)
│   └── agents/        #   checker · code-reviewer · smoke · test-writer (haiku/sonnet + maxTurns 상한)
└── project/           # 앱 저장소의 .claude/ 에 배치 (git 커밋 → 팀 배포 채널)
    ├── settings.json  #   Stop 훅 등록 — 유일한 등록 지점 (아래 정책 참조)
    ├── hooks/stop-gate.js      # v2 — 정본
    ├── commands/      #   feature · design · logic · connect-api (DoD 포함) + maintain · review-loop
    ├── workflows/     #   implement-feature · review-and-fix
    ├── agents/        #   global/agents 사본 — 프로젝트 .claude/agents/ 로 그대로 복사 (원본과 동일 유지)
    └── templates/     #   .editorconfig + lint-setup.md (ktlint) · stop-gate.json(설정 예시) · .worktreeinclude · ci.yml
                       #   · gitattributes-block.txt · gitignore-block.txt (실사용 프로젝트에서 승격)
```

## 글로벌 CLAUDE.md 3분할 (세션 고정 비용 절감)

- `CLAUDE.md`(핵심판, 매 세션 로드) / `rules/android.md`(`.kt`·`.kts` 작업 시만 로드) / `references/figma-guide.md`(피그마 작업 전에 읽기). 이전 단일판(33KB/584줄)은 매 세션 통째로 올라갔다.
- 코딩 스타일·응답 방식 규칙은 `prompts/*_COMPACT_PROMPT.md`를 SessionStart 훅이 주입한다 (`CLAUDE_HARNESS_STYLE_PROMPT=full`이면 전체판, `CLAUDE_HARNESS_INJECT_MODEL_RULES=0`이면 끔). CLAUDE.md에 중복 기재하지 않는다.
- `settings.json`의 `subagentPromptCacheTtl: "1h"`로 서브에이전트 프롬프트 캐시를 길게 유지한다. 커맨드(.md) frontmatter에는 `model:`을 두지 않는다 — 모델 선택은 agents frontmatter와 워크플로우 `agent()` 옵션에서만.

## 공용 디자인 시스템 (있으면 우선, 없으면 직접 구현)

- 특정 라이브러리를 전제하지 않는다. 피그마 구현 전에 `build.gradle(.kts)`에서 공용 컴포넌트 라이브러리(디자인 시스템) 의존 여부를 확인하고, 연동돼 있으면 그 컴포넌트·테마 토큰을 우선 쓰고 없으면 직접 구현한다 — 규칙은 `references/figma-guide.md`.
- 라이브러리 가이드 사본을 프로젝트에 두고 버전을 고정해 쓰는 경우에만 `/harness-init`·`/maintain`이 의존 버전 ↔ 가이드 사본 버전 드리프트를 검사한다.
- 의존성을 사설 Maven 저장소(예: GitHub Packages)에서 받으면 자격증명은 `local.properties` 등에 두고, CI는 `project/templates/ci.yml`의 주석 처리된 env 예시를 프로젝트 변수명에 맞춰 해제한다. 자격증명 누락으로 인한 401/미해석은 stop-gate·checker·smoke가 코드 문제가 아닌 환경 문제로 분리한다.

## 글로벌 Stop 훅 미등록 정책 (web/ios와 다름)

- `global/settings.json`에는 **Stop 훅이 없다** — SessionStart(inject-model-rules)만 등록한다. Stop 훅은 프로젝트 `.claude/settings.json`에만 등록한다.
- 이유: Claude Code는 글로벌+프로젝트 양쪽 훅을 모두 실행하므로, 이중 등록 시 게이트가 턴마다 2회 돈다. PASS는 스탬프 캐시로 완화되지만 FAIL 턴은 Gradle 검증이 2회 다 돈다.
- 트레이드오프: 하네스 미적용 저장소(프로젝트 settings.json 없음)는 게이트가 안 돈다 — `/harness-init` 온보딩이 전제.
- `install.sh`는 settings.json의 훅을 이벤트별로 병합(스크립트 파일명 기준 중복 방지)하고, `$HOME` 플레이스홀더를 설치 시점의 실제 홈 경로로 치환한다. env·`subagentPromptCacheTtl` 등 그 외 키는 사용자에게 없는 것만 추가한다.

## 정본과 씨딩 사본

- 글로벌 `~/.claude/commands/`에는 `harness-init`만 둔다 — maintain·review-loop를 글로벌과 프로젝트 양쪽에 두면 스킬 목록에 이중 노출되기 때문.
- **정본은 `aos/project/{commands,workflows,hooks,templates}`** 다. `install.sh aos`가 commands·workflows·hooks를 `~/.claude/templates/{commands,workflows,hooks}/`로, settings.json을 `~/.claude/templates/settings.json`으로, templates의 파일(.worktreeinclude·ci.yml·stop-gate.json·gitattributes/gitignore 블록·lint-setup.md·.editorconfig)을 `~/.claude/templates/`로 복사하고, `/harness-init` Phase 3가 거기서 각 프로젝트로 씨딩한다. `global/templates/`에는 아키텍처 가이드 2종(UDF·data 계층)만 둔다 (같은 파일을 두 곳에 두던 구조는 드리프트의 원인이라 제거).
- 역반영 규칙: 프로젝트 사본이 정본과 다르면 개선분을 **이 저장소의 project/에 먼저 반영한 뒤** 각 프로젝트로 재씨딩 — `/maintain` 루브릭의 자산 동기화 항목이 드리프트를 감지한다 (줄바꿈 정규화 비교 `diff --strip-trailing-cr` 필수).

## UDF 아키텍처

- 화면 구조는 `Contract(UiState/Intent/Navigation)` / `Route(onNavigate 단일)` / `Screen(state·onIntent만)` / `ViewModel(onIntent 단일 dispatcher)` 4파일. 가이드 원본은 `global/templates/UDF_ARCHITECTURE_GUIDE.md`.
- `/harness-init`이 **신규 시작 프로젝트에만** 프로젝트 루트로 씨딩한다 (기존/clone 프로젝트는 기존 아키텍처 유지). `/feature`·`/design`·`/logic` DoD, code-reviewer 🟡 항목, review-and-fix convention 리뷰가 가이드 7절 금지 패턴을 기준으로 판정한다. 가이드가 없는 프로젝트에서는 프로젝트 CLAUDE.md의 화면 구조 컨벤션이 기준.

## Data · Domain 계층

- 원본은 `global/templates/DATA_LAYER_GUIDE.md`. UDF 가이드와 같은 조건(신규 시작 프로젝트만)으로 프로젝트 루트에 씨딩한다. 절 번호는 UDF 가이드와 맞춰 7절 금지 패턴·8절 체크리스트다.
- 구조: `domain/{model,repository}` 인터페이스 + `data/{api,local,model,repository}` 구현, `ApiResult`, Hilt `@Binds`, 단일 모듈. UseCase·DataSource는 기본 계층이 아니고 6절 조건일 때만 만든다.
- 실제 프로젝트에서 반복된 문제를 금지 패턴으로 넣었다: domain·presentation의 `data.*` import(DTO 누출), Repository마다 반복된 `runCatching` 응답 분기(`CancellationException` 삼킴 — `safeApiCall` 단일 헬퍼로 대체), RepositoryImpl 안의 private 매퍼(`data/mapper/`로 분리).
- 재시도 정책(조회는 재시도, 상태 변경 POST는 반영 여부 확인 후 1회 재전송)을 5절로 정리했다. 상태 변경 재전송은 서버가 `expectedRevision` 같은 값으로 중복을 막아 줄 때만 안전하므로, 가이드는 이 전제를 명시해, 멱등성 키나 revision 같은 서버 중복 방지 장치가 있을 때만 재전송하고 반영 확인 결과를 `Applied`/`NotApplied`/`Unknown`으로 나눈다. 게이트웨이 실패는 `code` 문자열이 아니라 `httpStatus`로 판별한다.
- `/feature`·`/logic`·`/connect-api` DoD, code-reviewer, review-and-fix convention 리뷰가 이 가이드 7절을 기준으로 판정한다.

## stop-gate v2 (v1 대비)

- **검사 루트 = `git rev-parse --show-toplevel`** (worktree에서도 정확한 루트) · gradlew 없으면 가시화 스킵.
- **저장소 단위 락**으로 여러 Claude 세션의 Gradle 실행을 직렬화 (최대 20초 대기, 초과 시 fail-open 안내). 세션 간 산출물 삭제 경합(`Unable to delete`·`NoSuchFileException`·`Timeout waiting to lock` 등)은 Kotlin 에러가 함께 없으면 skip — 오차단 방지.
- **환경 실패 분리**: 사설 저장소 401/미해석·SDK location·네트워크 타임아웃은 가시화 스킵(코드 문제와 구분). `.worktreeinclude`로 worktree에 `local.properties`를 복사하면 자격증명 누락 skip 자체가 사라진다.
- **짝 단위 테스트**: 변경 파일의 `<이름>Test`/`<이름>Tests`/`<이름>KtTest`와 변경된 테스트 파일만 실행 (`testScope: paired` 기본, `module`/`none`/`custom`). 스크린샷 테스트(Screenshot/Roborazzi/Paparazzi)는 기본 제외, `excludeTests`로 조정. `No tests found`는 skip.
- **단일 Gradle 호출**: compile·ktlint/detekt·짝 테스트를 `gradlew -q --console=plain --continue` 1회로 실행해 설정 단계를 한 번만 치른다. 실패 태스크는 출력의 `Execution failed for task ':m:task'`로 식별해 차단 사유 제목에 표시하고, ktlint/detekt 위반 라인(`Foo.kt:줄:열:`)도 사유에 포함한다. `--continue`라 compile 실패 시 lint 결과까지 한 번의 차단에 모인다(fix 라운드 1회 절감). `.claude/stop-gate.json`의 build/lint/test 커스텀 명령만 따로 실행.
- **PASS 스탬프 12시간**: 변경 파일 서명(경로+mtime+size)+HEAD가 같으면 12시간 동안 재검증 생략 — 수정 없이 질문만 오가는 턴에서 Gradle을 다시 돌리지 않는다. 내용이 바뀌거나 pull/commit으로 HEAD가 바뀌면 즉시 무효. `No tests found`(짝 테스트 필터 불일치) skip도 compile·lint 통과분을 스탬프로 기억한다.
- 모듈 자동 감지 강화(Kotlin DSL 다중/여러 줄 `include`, Groovy, `includeBuild` 제외, 실패 시 build.gradle 디렉토리 폴백) · 린트 감지에 `build.gradle`(Groovy) 포함 · 차단 reason의 CR 제거 · 같은 세션 3회 차단 후 fail-open (Claude Code 상한 8회보다 먼저 멈춤).
- 설정 예시는 `project/templates/stop-gate.json` (`.claude/stop-gate.json`에 build/lint/test/testScope/excludeTests).

## 에이전트·워크플로우 (토큰 절약)

- agents: checker·smoke는 `haiku`, code-reviewer·test-writer는 `sonnet`. 전부 `maxTurns` 상한(50/30/40/60). smoke는 `omitClaudeMd: true`(CLAUDE.md 미로드 — 빌드/실행 판정만). checker는 maker가 넘긴 자가 대조표(항목↔파일:라인)의 지점부터 확인해 전수 재탐색을 줄인다.
- **라운드당 빌드 1회**: smoke는 `adb devices`를 먼저 보고 기기가 없으면 assembleDebug도 생략하고 `ran:false`로 즉시 반환한다(APK 전체 빌드는 기기 실행이 있을 때만 의미). checker는 스모크 결과에 `build:true`가 있으면 compileDebugKotlin을 다시 돌리지 않는다 — 기기 있으면 smoke의 assembleDebug, 없으면 checker의 compileDebugKotlin 하나만 돈다.
- **implement-feature**: 런타임 스모크는 Design·ConnectApi 게이트에서만 (Logic은 compile/checker로 충분, `args.runSmoke: true`면 전 단계). 스모크를 판정 라운드마다 재실행해 fix 반영 후의 최신 결과로 판정. fix 라운드의 `openQuestions`도 유실 없이 전파.
- **review-and-fix**: scope·convention 리뷰어는 `haiku`, 버그 리뷰어는 메인 모델 상속. 변경 전부터 있던 문제는 `preexisting`으로 분리해 무인 수정에서 제외하고 보고만. 변경 hunk 기준 리뷰, `--diff-filter=d`로 삭제 파일 제외, fix 무응답 시 1회 재시도, disputed는 전 라운드 누적으로 checker에 전달, 리뷰 시작 실패는 `BLOCKED`로 구분.

## 턴당 검증 비용 (무엇이 언제 도는가)

구형 하네스의 "검증이 많아 오래 걸림"을 줄인 결과를 비용 관점으로 정리한 표. 빌드는 **같은 변경에 1회**가 원칙이고, 그 이상은 전부 생략 조건이 있다.

| 시점 | 실행되는 것 | 생략·완화 조건 |
|---|---|---|
| 턴 종료 (프로젝트 Stop 훅 → stop-gate) | Gradle **1회**: 변경 모듈 `compileDebugKotlin` + `ktlintCheck`/`detekt`(빌드 스크립트 선언 시) + 짝 단위 테스트. `.claude/hooks/*.js` 변경 시 `node --check` | 코드 변경 없음 → 비용 0 · 같은 변경 서명+HEAD로 12시간 내 PASS → 생략 · gradlew 없음/환경 실패/산출물 경합 → 가시화 스킵 · 같은 세션 3회 차단 또는 240s 예산 초과 → fail-open |
| implement-feature 게이트 라운드 (maker → smoke → checker, fix 최대 3회) | maker의 DoD 자가 확인 compile 1회 + checker compile 1회(직후라 증분 UP-TO-DATE, 수 초). smoke는 Design·ConnectApi 게이트에서 **기기 연결 시에만** `assembleDebug`+설치·실행 | 기기 없으면 smoke 빌드 0회(`ran:false`) · smoke `build:true`면 checker compile 생략 · Logic 단계는 smoke 없음 |
| review-and-fix 라운드 (리뷰 병렬 → fix → checker) | 리뷰 에이전트는 Gradle 없음(변경 hunk 읽기만, scope·convention은 haiku). fix 라운드에만 maker 자가 확인 compile + checker compile | 변경 전부터 있던 문제(`preexisting`)는 보고만, fix 대상 아님 |
| 워크플로우가 끝난 메인 턴 종료 | stop-gate 1회 (에이전트 판정과 별개인 결정적 게이트 — 의도적으로 유지) | 이후 수정 없는 턴은 스탬프로 생략 |

## 동시 세션 운용

- 병렬 작업은 git worktree로만, 동시 인스턴스 2개 이하, 다른 세션 빌드 중 `--stop`·`build/` 삭제 금지 — 글로벌 CLAUDE.md "동시 작업" 섹션과 checker 규칙에 명시. stop-gate 락 대기 초과 안내가 보이면 `./gradlew compileDebugKotlin`을 수동 확인.
