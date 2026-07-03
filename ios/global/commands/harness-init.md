---
description: 프로젝트를 루프 하네스에 편입 — CLAUDE.md 생성/검증, 하네스 자산 동기화, 권한 오염 검사, 메모리 시딩 (프로젝트당 1회)
---

# /harness-init — 프로젝트 하네스 온보딩 (iOS)

신규·기존 iOS 프로젝트를 루프 엔지니어링 하네스에 편입한다. **분석 → 보고 → 사용자 확인 → 적용** 순서로 진행하고, 파괴적 변경은 반드시 확인을 받는다.

## Phase 1: 프로젝트 분석

1. 빌드 시스템 파악: Package.swift(SwiftPM)인지 .xcworkspace/.xcodeproj인지, Podfile 유무, 공유 스킴 목록(`ls *.xcodeproj/xcshareddata/xcschemes/`)
2. 검증 수단 파악: `.swiftlint.yml`·`.swiftformat` 유무, 테스트 타겟 유무, `.github/workflows/` 유무
3. 실제 구조 파악: 소스 루트 디렉토리 트리(2단계), 아키텍처 패턴(View + VM 등), git 브랜치(`git branch -a`)
4. 기존 `.claude/` 자산 확인: commands, agents, hooks, settings, workflows
5. 공통 라이브러리 소비 확인: project.pbxproj 또는 Package.resolved에서 `ios-common` 검색 — **브랜치 추적인지 버전 태그인지** 반드시 확인 (브랜치 추적이면 CLAUDE.md에 전파 주의 명시)

## Phase 2: CLAUDE.md 생성 또는 검증

- **CLAUDE.md가 없으면**: 아래 섹션 구조로 직접 작성. 플레이스홀더는 Phase 1에서 파악한 **실제 값**으로만 채운다 — 추측 금지
  - 프로젝트 개요 (타겟, 최소 iOS 버전, 의존성 관리 방식)
  - 빌드·검증 명령 (xcodebuild 정확한 명령 — 스킴/워크스페이스 실측값)
  - 아키텍처 (디렉토리 구조, View/VM 패턴, 상태 관리)
  - 핵심 규칙 (ios-common 재사용, 디자인 토큰, 공개 API 변경 절차)
  - `## 프로젝트 루브릭`
  - `## 반복되는 실수` (승격 규약 주석 포함)
- **CLAUDE.md가 있으면**: 실제 프로젝트와 대조해 불일치를 전부 보고:
  - 디렉토리 구조 설명 ↔ 실제 구조
  - Git 브랜치 설명 ↔ 실제 브랜치
  - 빌드 명령 ↔ 실제 스킴/워크스페이스 이름
  - 절대 경로(타 OS·타 사용자 홈 등) ↔ 이 머신에서 유효한 경로
  - 언급된 파일이 실제 존재하는지

## Phase 3: 하네스 자산 동기화

누락 자산을 확인하고 동기화를 제안:
- `.claude/agents/`: checker·smoke·code-reviewer·test-writer (글로벌 `~/.claude/agents/` 사본 — 커맨드/워크플로우가 이들을 호출하므로 프로젝트에 함께 있어야 환경 독립적으로 동작)
- `.claude/hooks/stop-gate.js` (Stop, 글로벌과 동일 사본) + `.claude/settings.json`에 훅 등록
- `.claude/workflows/review-and-fix.js`
- 자동 감지가 안 맞는 프로젝트(스킴 다중 등)면 `.claude/stop-gate.json`에 build/lint 명령 명시
- **SwiftLint 미도입이면 도입을 제안** (`.swiftlint.yml` 기본 설정) — 현재 iOS 저장소들은 린트·테스트가 없어 결정적 게이트가 빌드뿐이므로, 린트 도입이 하네스 검증력을 크게 올린다

## Phase 4: 권한 오염 검사

`.claude/settings.local.json`이 있으면:
- 일회성 명령 누적(과거 세션의 curl/sed 등), 타 프로젝트 경로, 과도한 `additionalDirectories`, **평문 토큰/시크릿** 검출
- 발견 시: `cp`로 백업(`settings.local.json.bak-YYYYMMDD`) 후 정리안을 보여주고 **사용자 확인 후** 적용
- `settings.local.json`이 git에 커밋되어 있으면 .gitignore 추가를 제안 (개인 설정 + 시크릿 유출 채널)

## Phase 5: 메모리 시딩

프로젝트 메모리 디렉토리에 MEMORY.md가 없으면 생성하고, **CLAUDE.md에 없는 환경 quirk만** 시딩 (예: 스킴명과 저장소명 불일치, 시뮬레이터 요구 버전, pod install 필요 시점). 10줄 이내 — 길게 쓰지 말 것.

## Phase 6: 공유 자산 git 추적 (팀 배포가 실제로 작동하게)

하네스는 **git이 배포 채널**이다. `.claude/` 본체가 추적되지 않으면 팀원이 clone/pull해도 하네스가 따라오지 않는다:

1. `git ls-files .claude | wc -l`로 현재 추적 여부 확인 (0이면 미추적 상태)
2. `git status .claude/`로 무엇이 untracked인지 확인하고, **개인 설정·비밀이 없는지 점검**(`settings.local.json*`은 .gitignore로 제외 — 토큰/키가 들어 있지 않은지 한 번 더 확인)
3. 공유 자산을 추적 시작: `git add .claude/agents .claude/hooks .claude/workflows .claude/settings.json` (+ 있으면 `.claude/stop-gate.json`, `.claude/commands`)
4. 커밋은 **사용자에게 확인 후** 진행 (임의 커밋 금지). 커밋 메시지 예: `chore: AI 하네스 자산 git 추적`

## Phase 7: 동작 확인 + 보고

1. stop-gate 동작 확인: 변경 없는 상태에서 `echo '{}' | node ~/.claude/hooks/stop-gate.js` 가 조용히 통과하는지
2. 사용자에게 최종 보고: 생성/수정한 파일, 발견한 불일치와 처리 결과, 사용 가능한 루프 도구 안내 (`/maintain`, `/loop`, `/review-loop`, DoD 게이트)

$ARGUMENTS
