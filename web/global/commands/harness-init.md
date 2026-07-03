---
description: 프로젝트를 루프 하네스에 편입 — CLAUDE.md 생성/검증, 보일러플레이트 자산 동기화, 권한 오염 검사, 메모리 시딩 (프로젝트당 1회)
---

# /harness-init — 프로젝트 하네스 온보딩

신규·기존 프로젝트를 루프 엔지니어링 하네스에 편입한다. **분석 → 보고 → 사용자 확인 → 적용** 순서로 진행하고, 파괴적 변경은 반드시 확인을 받는다.

## Phase 1: 프로젝트 분석

1. 스택 파악: package.json(이름·스크립트·의존성), tsconfig, eslint 설정, 테스트 프레임워크 유무
2. 실제 구조 파악: `ls src/` (또는 해당 언어의 소스 루트), git 브랜치(`git branch -a`)
3. 기존 `.claude/` 자산 확인: commands, hooks, settings, workflows

## Phase 2: CLAUDE.md 생성 또는 검증

- **CLAUDE.md가 없으면**: `/Users/joyounghyun/Desktop/Project/react-boilerplate/CLAUDE.template.md`를 기반으로 생성 (보일러플레이트가 없으면 프로젝트 개요/명령어/아키텍처/핵심 규칙/프로젝트 루브릭/반복되는 실수 섹션 구조로 직접 작성). 플레이스홀더는 Phase 1에서 파악한 **실제 값**으로만 채운다 — 추측 금지
- **CLAUDE.md가 있으면**: 실제 프로젝트와 대조해 불일치를 전부 보고:
  - 폴더 구조 설명 ↔ 실제 `src/` 구조
  - Git 브랜치 설명 ↔ 실제 브랜치
  - 명령어 ↔ 실제 package.json scripts
  - 절대 경로(특히 타 OS·타 프로젝트 경로 — `C:\`, 다른 사용자 홈 등) ↔ 이 머신에서 유효한 경로
  - 언급된 파일(상수, 설정 등)이 실제 존재하는지
- `## 프로젝트 루브릭`과 `## 반복되는 실수` 섹션이 없으면 추가 (승격 규약 주석 포함)

## Phase 3: 보일러플레이트 자산 동기화 (해당 스택인 경우)

react-boilerplate 기반 Next.js 프로젝트라면 누락 자산을 확인하고 동기화를 제안:
- `.claude/commands/`: design·logic·connect-api(DoD 포함 버전), verify·verify-smoke·review·review-loop·simplify
- `.claude/agents/`: checker·smoke·reviewer(code-reviewer)·test-writer (커맨드/워크플로우가 이들을 호출하므로 프로젝트에 함께 있어야 환경 독립적으로 동작)
- `.claude/hooks/quality-check.js`(Pre+PostToolUse 등록) + `.claude/hooks/stop-gate.js`(Stop, 글로벌과 동일 사본)
- `.claude/workflows/`: implement-feature.js, review-and-fix.js
- `vitest.config.ts` + package.json `"test": "vitest run"` + vitest devDependency (테스트 부재 시 — 순수 로직 한정 정책 설명)

## Phase 4: 권한 오염 검사

`.claude/settings.local.json`이 있으면:
- 타 OS 경로(`C:\`, `PowerShell`, `taskkill` 등), 타 프로젝트 경로, 일회성 항목, 과도한 `additionalDirectories` 검출
- 발견 시: `cp`로 백업(`settings.local.json.bak-YYYYMMDD`) 후 정리안을 보여주고 **사용자 확인 후** 적용
- 공통 검증 명령(lint/type-check/test 등)은 글로벌 `~/.claude/settings.json`이 이미 커버하므로 local에서 중복 제거

## Phase 5: 메모리 시딩

프로젝트 메모리 디렉토리에 MEMORY.md가 없으면 생성하고, **CLAUDE.md에 없는 환경 quirk만** 시딩 (예: package name과 디렉토리명 불일치, 특이한 토큰명, 검증 체계 구성). 10줄 이내 — 길게 쓰지 말 것.

## Phase 6: 공유 자산 git 추적 (팀 배포가 실제로 작동하게)

하네스는 **git이 배포 채널**이다. `.claude/` 본체가 추적되지 않으면 팀원이 clone/pull해도 하네스가 따라오지 않는다. 따라서:

1. `git ls-files .claude | wc -l`로 현재 추적 여부 확인 (0이면 미추적 상태)
2. `git status .claude/`로 무엇이 untracked인지 확인하고, **개인 설정·비밀이 없는지 점검**(`settings.local.json*`은 .gitignore로 제외됨 — 토큰/키가 들어 있지 않은지 한 번 더 확인)
3. 공유 자산을 추적 시작: `git add .claude/agents .claude/commands .claude/hooks .claude/workflows .claude/settings.json .claude/loop.md`
4. 커밋은 **사용자에게 확인 후** 진행 (임의 커밋 금지). 커밋 메시지 예: `chore: AI 하네스 자산 git 추적`

## Phase 7: 동작 확인 + 보고

1. stop-gate 동작 확인: 변경 없는 상태에서 `echo '{}' | node ~/.claude/hooks/stop-gate.js` 가 조용히 통과하는지
2. 사용자에게 최종 보고: 생성/수정한 파일, 발견한 불일치와 처리 결과, 사용 가능한 루프 도구 안내 (`/maintain`, `/loop`, `/review-loop`, DoD 게이트)

$ARGUMENTS
