---
description: 프로젝트를 루프 하네스에 편입 — CLAUDE.md 생성/검증, 하네스 자산 동기화, 권한 오염 검사, 메모리 시딩 (프로젝트당 1회)
---

# /harness-init — 프로젝트 하네스 온보딩 (AOS)

신규·기존 안드로이드 프로젝트를 루프 엔지니어링 하네스에 편입한다. **분석 → 보고 → 사용자 확인 → 적용** 순서로 진행하고, 파괴적 변경은 반드시 확인을 받는다.

## Phase 1: 프로젝트 분석

1. 빌드 시스템 파악: `settings.gradle.kts`의 모듈 목록, `gradle/libs.versions.toml`(AGP/Kotlin/Compose 버전), gradle wrapper 유무
2. 검증 수단 파악: ktlint/detekt/spotless 선언 유무, 실질 테스트 유무(Example* 템플릿 제외), `.github/workflows/` 유무
3. 빌드 전제조건 파악: `local.properties` 요구사항 (사설 저장소 자격증명(예: GitHub Packages), 서명 키, 소셜 로그인 키 등) — **없으면 어떤 태스크까지 가능한지** 확인
4. 실제 구조 파악: 주요 패키지 트리(2~3단계), 아키텍처(MVVM/Hilt/레이어링, 루트 `UDF_ARCHITECTURE_GUIDE.md`·`DATA_LAYER_GUIDE.md` 유무와 화면 파일 구성이 Contract/Route/Screen/ViewModel인지, `domain/repository`·`data/repository` 분리와 UseCase 유무), git 브랜치(`git branch -a`), `.worktreeinclude`·`.gitattributes`·`.github/workflows/` 유무
5. 기존 `.claude/` 자산 확인: commands, agents, hooks, settings, workflows
6. 공통 라이브러리 소비 확인 (공용 디자인 시스템 등을 버전 고정으로 쓰고 가이드 사본을 두는 경우만): 의존 버전 ↔ 라이브러리 최신 버전 ↔ 가이드 사본 버전 3자 비교 — 드리프트 발견 시 보고

## Phase 2: CLAUDE.md 생성 또는 검증

- **신규 시작 프로젝트(화면 코드가 아직 없음)면** `~/.claude/templates/UDF_ARCHITECTURE_GUIDE.md`와 `~/.claude/templates/DATA_LAYER_GUIDE.md`를 프로젝트 루트에 같은 이름으로 씨딩하고, CLAUDE.md 아키텍처 섹션에 "화면 구현 시 `UDF_ARCHITECTURE_GUIDE.md` 준수 (Contract/Route/Screen/ViewModel), Repository·DTO·API 연결 시 `DATA_LAYER_GUIDE.md` 준수 (domain 인터페이스 + data 구현, safeApiCall)"를 적는다. **기존/clone 프로젝트에는 씨딩하지 않는다** — 기존 아키텍처를 따르고, 가이드와 다른 점은 보고만 한다
- **CLAUDE.md가 없으면**: 아래 섹션 구조로 직접 작성. 플레이스홀더는 Phase 1에서 파악한 **실제 값**으로만 채운다 — 추측 금지
  - 프로젝트 개요 (모듈, SDK 버전, 주요 의존성)
  - 빌드·검증 명령 (정확한 Gradle 태스크 — 모듈명 실측값)
  - 아키텍처 (패키지 구조, 레이어 규칙, 화면 구조 컨벤션 — UDF 프로젝트면 Contract/Route/Screen/ViewModel, 아니면 실측한 구조 그대로)
  - 핵심 규칙 (공용 UI 라이브러리 재사용(있으면), 테마 토큰, 공개 API 변경 절차)
  - `## 프로젝트 루브릭`
  - `## 반복되는 실수` (승격 규약 주석 포함)
- **CLAUDE.md가 있으면**: 실제 프로젝트와 대조해 불일치를 전부 보고:
  - 패키지 구조 설명 ↔ 실제 구조
  - Git 브랜치 설명 ↔ 실제 브랜치
  - 명령어 ↔ 실제 Gradle 태스크/모듈명
  - 절대 경로(타 OS 경로 — `C:\` 등) ↔ 이 머신에서 유효한 경로
  - 언급된 파일(가이드, 설정 등)이 실제 존재하는지
- `## 프로젝트 루브릭`과 `## 반복되는 실수` 섹션이 없으면 추가 (승격 규약 주석 포함)

## Phase 3: 하네스 자산 동기화

누락 자산을 확인하고 동기화를 제안:
- `.claude/agents/`: checker·smoke·code-reviewer·test-writer (글로벌 `~/.claude/agents/` 사본 — 커맨드/워크플로우가 이들을 호출하므로 프로젝트에 함께 있어야 환경 독립적으로 동작)
- `.claude/hooks/stop-gate.js` — 정본은 하네스 저장소의 `aos/project/hooks/stop-gate.js`, 씨딩 소스는 `~/.claude/templates/hooks/stop-gate.js` (글로벌 `~/.claude/hooks/`에는 활성 사본이 없다. 그곳에 남은 stop-gate.js는 이전 설치의 잔재라 비교 기준으로 쓰지 않는다)
- `.claude/settings.json` — 씨딩 소스는 `~/.claude/templates/settings.json`. 없으면 복사, 있으면 **Stop 훅 항목과 빠진 permissions만 병합**하고 프로젝트가 이미 정한 값은 보존한다 (훅 명령은 템플릿의 `command` 문자열을 그대로 복사한다 — `CLAUDE_PROJECT_DIR` 환경변수 기준 경로라서 절대 경로로 바꾸지 않는다). **글로벌 settings.json에는 Stop 훅을 등록하지 않는다** (프로젝트와 이중 등록되어 게이트가 턴마다 2회 돌게 됨)
- 템플릿 원본이 없으면(`~/.claude/templates/hooks/` 부재) 하네스 저장소에서 `./install.sh aos`를 다시 실행하라고 안내하고 이 두 항목은 건너뛴다
- `.claude/commands/`: maintain·review-loop (+ 프로젝트 유형별 구현 커맨드) — 씨딩 소스는 `~/.claude/templates/commands/`. 글로벌 `~/.claude/commands/`에 같은 이름을 두면 스킬 목록에 이중 노출되므로 **활성 커맨드는 프로젝트에만** 둔다
- `.claude/workflows/`: review-and-fix.js·implement-feature.js — 씨딩 소스는 `~/.claude/templates/workflows/`
- `.gitattributes`에 `~/.claude/templates/gitattributes-block.txt`의 줄(`.claude/**/*.md`·`*.js`·`*.json` `text eol=lf`)을 없는 것만 추가 (Windows 체크아웃 시 글로벌 원본과의 CRLF diff 노이즈 방지)
- `.gitignore`에 `~/.claude/templates/gitignore-block.txt`의 줄을 없는 것만 추가 (`settings.local.json*`·`.claude/worktrees/`·`.kotlin/`·피그마 덤프·서명 키)
- `.worktreeinclude`가 없으면 `~/.claude/templates/.worktreeinclude`를 프로젝트 루트에 복사 (worktree 생성 시 `local.properties`를 함께 복사해 SDK 경로·자격증명 누락으로 stop-gate가 skip되는 것을 방지)
- `.github/workflows/`가 없으면 `~/.claude/templates/ci.yml` 씨딩을 **제안만** 한다 (CI는 배포 설정 변경이므로 사용자 확인 후 적용 — 모듈명·린트 태스크·(사설 저장소를 쓰면) Secrets 등록은 템플릿 상단 주석대로 조정)
- **역반영 규칙**: 프로젝트 사본이 글로벌 원본/템플릿과 다르면(반드시 줄바꿈 정규화 비교 — `diff --strip-trailing-cr`) diff를 보고하고, 사용자 확인 후 개선분을 **템플릿에 먼저 반영한 뒤** 각 프로젝트로 재씨딩한다 — 단방향 씨딩만 있으면 드리프트가 구조적으로 재발한다
- 자동 감지가 안 맞는 프로젝트면 `.claude/stop-gate.json`에 build/lint/test 명령 명시 (키 설명·예시: `~/.claude/templates/stop-gate.json` — testScope/excludeTests 포함)
- **ktlint 또는 detekt 미도입이면 도입을 제안** — 현재 AOS 저장소들은 린트가 없어 결정적 게이트가 컴파일뿐이므로, 린트 도입이 하네스 검증력을 크게 올린다 (도입하면 stop-gate가 자동으로 감지해 실행 — 절차는 `~/.claude/templates/lint-setup.md`, `.editorconfig`도 같은 위치)

## Phase 4: 권한 오염 검사

`.claude/settings.local.json`이 있으면:
- 일회성 명령 누적(과거 세션의 curl/gradlew 변형 등), 타 프로젝트 경로, 과도한 `additionalDirectories`, **평문 토큰/시크릿**(Figma 토큰 등) 검출
- 발견 시: `cp`로 백업(`settings.local.json.bak-YYYYMMDD`) 후 정리안을 보여주고 **사용자 확인 후** 적용
- **`settings.local.json`이 git에 커밋되어 있으면 즉시 보고** — .gitignore 추가 제안 + 토큰이 들어 있으면 토큰 폐기(rotate)까지 안내 (개인 설정 + 시크릿 유출 채널)

## Phase 5: 메모리 시딩

프로젝트 메모리 디렉토리에 MEMORY.md가 없으면 생성하고, **CLAUDE.md에 없는 환경 quirk만** 시딩 (예: rootProject명과 저장소명 불일치, 사설 저장소 자격증명 필요, Windows/macOS 혼합 팀 여부). 10줄 이내 — 길게 쓰지 말 것.

## Phase 6: 공유 자산 git 추적 (팀 배포가 실제로 작동하게)

하네스는 **git이 배포 채널**이다. `.claude/` 본체가 추적되지 않으면 팀원이 clone/pull해도 하네스가 따라오지 않는다:

1. `git ls-files .claude | wc -l`로 현재 추적 여부 확인 (0이면 미추적 상태)
2. `git status .claude/`로 무엇이 untracked인지 확인하고, **개인 설정·비밀이 없는지 점검**(`settings.local.json*`은 .gitignore로 제외 — 토큰/키가 들어 있지 않은지 한 번 더 확인. `.claude/worktrees/`·`scheduled_tasks.lock`도 제외 대상)
3. 공유 자산을 추적 시작: `git add .claude/agents .claude/hooks .claude/workflows .claude/commands .claude/settings.json` (+ 있으면 `.claude/stop-gate.json`, `.gitattributes`, `.worktreeinclude`, `UDF_ARCHITECTURE_GUIDE.md`, `DATA_LAYER_GUIDE.md`, `.github/workflows/ci.yml`) — `settings.local.json`이 스테이징에 섞이지 않았는지 `git status`로 재확인
4. 커밋은 **사용자에게 확인 후** 진행 (임의 커밋 금지). 커밋 메시지 예: `chore: AI 하네스 자산 git 추적`

## Phase 7: 동작 확인 + 보고

1. stop-gate 동작 확인: 변경 없는 상태에서 `echo '{}' | node .claude/hooks/stop-gate.js` 가 조용히 통과하는지
2. 사용자에게 최종 보고: 생성/수정한 파일, 발견한 불일치와 처리 결과, 사용 가능한 루프 도구 안내 (`/maintain`, `/loop`, `/review-loop`, DoD 게이트)
3. 적용 시점 안내: 이미 열려 있는 다른 Claude 세션에는 글로벌 CLAUDE.md·`~/.claude/rules/` 변경이 `/clear` 또는 재시작 전까지 적용되지 않는다. 프로젝트 `.claude/settings.json`의 훅 등록은 파일 저장 즉시 반영된다.

$ARGUMENTS
