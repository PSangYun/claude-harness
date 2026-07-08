---
description: 프로젝트를 루프 하네스에 편입 — CLAUDE.md 생성/검증, 하네스 자산 동기화, 권한 오염 검사, 메모리 시딩 (프로젝트당 1회)
---

# /harness-init — 프로젝트 하네스 온보딩 (AOS)

신규·기존 안드로이드 프로젝트를 루프 엔지니어링 하네스에 편입한다. **분석 → 보고 → 사용자 확인 → 적용** 순서로 진행하고, 파괴적 변경은 반드시 확인을 받는다.

## Phase 1: 프로젝트 분석

1. 빌드 시스템 파악: `settings.gradle.kts`의 모듈 목록, `gradle/libs.versions.toml`(AGP/Kotlin/Compose 버전), gradle wrapper 유무
2. 검증 수단 파악: ktlint/detekt/spotless 선언 유무, 실질 테스트 유무(Example* 템플릿 제외), `.github/workflows/` 유무
3. 빌드 전제조건 파악: `local.properties` 요구사항 (GPR 자격증명, 서명 키, 소셜 로그인 키) — **없으면 어떤 태스크까지 가능한지** 확인
4. 실제 구조 파악: 주요 패키지 트리(2~3단계), 아키텍처(MVVM/Hilt/레이어링), git 브랜치(`git branch -a`)
5. 기존 `.claude/` 자산 확인: commands, agents, hooks, settings, workflows
6. 공통 라이브러리 소비 확인: `aos-common` 의존 버전 ↔ 라이브러리 최신 버전 ↔ `AOS_COMMON_GUIDE.md` 사본 버전 3자 비교 — 드리프트 발견 시 보고

## Phase 2: CLAUDE.md 생성 또는 검증

- **CLAUDE.md가 없으면**: 아래 섹션 구조로 직접 작성. 플레이스홀더는 Phase 1에서 파악한 **실제 값**으로만 채운다 — 추측 금지
  - 프로젝트 개요 (모듈, SDK 버전, 주요 의존성)
  - 빌드·검증 명령 (정확한 Gradle 태스크 — 모듈명 실측값)
  - 아키텍처 (패키지 구조, 레이어 규칙, Screen/Content/Preview 컨벤션)
  - 핵심 규칙 (aos-common 재사용, 테마 토큰, 공개 API 변경 절차)
  - `## 프로젝트 루브릭`
  - `## 반복되는 실수` (승격 규약 주석 포함)
- **CLAUDE.md가 있으면** (aos-common·ParkGolfAOS는 이미 있음): 실제 프로젝트와 대조해 불일치를 전부 보고:
  - 패키지 구조 설명 ↔ 실제 구조
  - Git 브랜치 설명 ↔ 실제 브랜치
  - 명령어 ↔ 실제 Gradle 태스크/모듈명
  - 절대 경로(타 OS 경로 — `C:\` 등) ↔ 이 머신에서 유효한 경로
  - 언급된 파일(가이드, 설정 등)이 실제 존재하는지
- `## 프로젝트 루브릭`과 `## 반복되는 실수` 섹션이 없으면 추가 (승격 규약 주석 포함)

## Phase 3: 하네스 자산 동기화

누락 자산을 확인하고 동기화를 제안:
- `.claude/agents/`: checker·smoke·code-reviewer·test-writer (글로벌 `~/.claude/agents/` 사본 — 커맨드/워크플로우가 이들을 호출하므로 프로젝트에 함께 있어야 환경 독립적으로 동작)
- `.claude/hooks/stop-gate.js` (Stop, 글로벌과 동일 사본) + `.claude/settings.json`에 훅 등록 — **글로벌 settings.json에는 Stop 훅을 등록하지 않는다** (프로젝트와 이중 등록되어 게이트가 턴마다 2회 돌게 됨)
- `.claude/commands/`: maintain·review-loop (+ 프로젝트 유형별 구현 커맨드) — 씨딩 소스는 `~/.claude/templates/commands/`. 글로벌 `~/.claude/commands/`에 같은 이름을 두면 스킬 목록에 이중 노출되므로 **활성 커맨드는 프로젝트에만** 둔다
- `.claude/workflows/`: review-and-fix.js·implement-feature.js — 씨딩 소스는 `~/.claude/templates/workflows/`
- `.gitattributes`에 `.claude/**/*.md`·`*.js`·`*.json` `text eol=lf` 추가 (Windows 체크아웃 시 글로벌 원본과의 CRLF diff 노이즈 방지)
- **역반영 규칙**: 프로젝트 사본이 글로벌 원본/템플릿과 다르면(반드시 줄바꿈 정규화 비교 — `diff --strip-trailing-cr`) diff를 보고하고, 사용자 확인 후 개선분을 **템플릿에 먼저 반영한 뒤** 각 프로젝트로 재씨딩한다 — 단방향 씨딩만 있으면 드리프트가 구조적으로 재발한다
- 자동 감지가 안 맞는 프로젝트면 `.claude/stop-gate.json`에 build/lint/test 명령 명시
- **ktlint 또는 detekt 미도입이면 도입을 제안** — 현재 AOS 저장소들은 린트가 없어 결정적 게이트가 컴파일뿐이므로, 린트 도입이 하네스 검증력을 크게 올린다 (도입하면 stop-gate가 자동으로 감지해 실행)

## Phase 4: 권한 오염 검사

`.claude/settings.local.json`이 있으면:
- 일회성 명령 누적(과거 세션의 curl/gradlew 변형 등), 타 프로젝트 경로, 과도한 `additionalDirectories`, **평문 토큰/시크릿**(Figma 토큰 등) 검출
- 발견 시: `cp`로 백업(`settings.local.json.bak-YYYYMMDD`) 후 정리안을 보여주고 **사용자 확인 후** 적용
- **`settings.local.json`이 git에 커밋되어 있으면 즉시 보고** — .gitignore 추가 제안 + 토큰이 들어 있으면 토큰 폐기(rotate)까지 안내 (개인 설정 + 시크릿 유출 채널)

## Phase 5: 메모리 시딩

프로젝트 메모리 디렉토리에 MEMORY.md가 없으면 생성하고, **CLAUDE.md에 없는 환경 quirk만** 시딩 (예: rootProject명과 저장소명 불일치, GPR 자격증명 필요, Windows/macOS 혼합 팀 여부). 10줄 이내 — 길게 쓰지 말 것.

## Phase 6: 공유 자산 git 추적 (팀 배포가 실제로 작동하게)

하네스는 **git이 배포 채널**이다. `.claude/` 본체가 추적되지 않으면 팀원이 clone/pull해도 하네스가 따라오지 않는다:

1. `git ls-files .claude | wc -l`로 현재 추적 여부 확인 (0이면 미추적 상태)
2. `git status .claude/`로 무엇이 untracked인지 확인하고, **개인 설정·비밀이 없는지 점검**(`settings.local.json*`은 .gitignore로 제외 — 토큰/키가 들어 있지 않은지 한 번 더 확인)
3. 공유 자산을 추적 시작: `git add .claude/agents .claude/hooks .claude/workflows .claude/settings.json` (+ 있으면 `.claude/stop-gate.json`, `.claude/commands`)
4. 커밋은 **사용자에게 확인 후** 진행 (임의 커밋 금지). 커밋 메시지 예: `chore: AI 하네스 자산 git 추적`

## Phase 7: 동작 확인 + 보고

1. stop-gate 동작 확인: 변경 없는 상태에서 `echo '{}' | node .claude/hooks/stop-gate.js` 가 조용히 통과하는지
2. 사용자에게 최종 보고: 생성/수정한 파일, 발견한 불일치와 처리 결과, 사용 가능한 루프 도구 안내 (`/maintain`, `/loop`, `/review-loop`, DoD 게이트)

$ARGUMENTS
