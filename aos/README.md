# AOS 하네스

실사용 머신의 전역 설정(`~/.claude`)을 역반영한 발전판 (2026-07-08 동기화). 공통 설명은 루트 README 참조 — 여기는 **aos가 web/ios와 다른 점**만 기록한다.

## 폴더 구조

```
aos/
├── global/            # 팀원 각자의 ~/.claude/ 에 배치 — ./install.sh aos
│   ├── CLAUDE.md      #   글로벌 규칙 + Android 전용 규칙(@Keep·Compose Stability 등)
│   │                  #   + 범용 Figma 파싱/구현 워크플로우
│   ├── settings.json  #   SessionStart(inject-model-rules) 훅만 등록 — compact prompt 기본, Stop 훅 없음
│   ├── prompts/       #   모델별 운영 규칙 프롬프트 8종 (OPUS·SONNET 각 4종)
│   ├── hooks/         #   stop-gate.js + inject-model-rules.js (SessionStart 시 모델에 맞는 compact prompts 판 주입)
│   ├── commands/      #   harness-init만 활성 (maintain·review-loop는 templates/로 이동)
│   ├── templates/     #   프로젝트 씨딩 원본 — commands/{maintain,review-loop}
│   │                  #   + workflows/{implement-feature,review-and-fix}
│   └── agents/        #   checker · code-reviewer · smoke · test-writer
└── project/           # 앱 저장소의 .claude/ 에 배치 (git 커밋 → 팀 배포 채널)
    ├── settings.json  #   Stop 훅 등록 — 유일한 등록 지점 (아래 정책 참조)
    ├── hooks/stop-gate.js      (글로벌과 동일 사본 — 드리프트 금지)
    ├── commands/      #   design · logic · connect-api · feature (DoD 포함)
    ├── workflows/     #   implement-feature · review-and-fix
    └── templates/     #   린트 도입 (.editorconfig + lint-setup.md)
```


## 토큰 절약 기본값

- `global/settings.json`은 `CLAUDE_CODE_DISABLE_1M_CONTEXT=1`을 기본 env로 둬 1M 컨텍스트 세션이 장시간 비대해지는 것을 피한다. 기존 개인 전역 설정을 직접 정리할 때는 `global/settings.token-saving.example.json`을 참고한다.
- `inject-model-rules.js`는 기본적으로 `*_COMPACT_PROMPT.md`만 주입한다. 전체 `*_SYSTEM_PROMPT.md`가 필요한 장기/고난도 작업에서만 `CLAUDE_HARNESS_STYLE_PROMPT=full`로 올린다.
- 추가 규칙 주입이 불필요한 세션은 `CLAUDE_HARNESS_INJECT_MODEL_RULES=0`으로 SessionStart 추가 컨텍스트를 끌 수 있다.

## 글로벌 Stop 훅 미등록 정책 (web/ios와 다름)

- `global/settings.json`에는 **Stop 훅이 없다** — SessionStart(inject-model-rules)만 등록한다. Stop 훅은 프로젝트 `.claude/settings.json`에만 등록한다.
- 이유: Claude Code는 글로벌+프로젝트 양쪽 훅을 모두 실행하므로, 이중 등록 시 게이트가 턴마다 2회 돈다. PASS는 스탬프 캐시(2분)로 완화되지만 FAIL 턴은 Gradle 검증이 2회 다 돈다.
- 트레이드오프: 하네스 미적용 저장소(프로젝트 settings.json 없음)는 게이트가 안 돈다 — `/harness-init` 온보딩이 전제.
- `install.sh`는 settings.json의 훅을 이벤트별로 병합(스크립트 파일명 기준 중복 방지)하고, `$HOME` 플레이스홀더를 설치 시점의 실제 홈 경로로 치환한다 (Windows 훅 실행 셸의 변수 확장에 의존하지 않기 위함 — web/ios의 Stop 훅 병합도 동일하게 동작).

## templates/ 씨딩 계층

- 글로벌 `~/.claude/commands/`에는 `harness-init`만 둔다 — maintain·review-loop를 글로벌과 프로젝트 양쪽에 두면 스킬 목록에 이중 노출되기 때문.
- 활성 커맨드는 프로젝트 `.claude/commands/`에만 두고, 씨딩 원본은 `~/.claude/templates/{commands,workflows}/` (`/harness-init` Phase 3가 이 경로에서 씨딩).
- 역반영 규칙: 프로젝트 사본이 템플릿과 다르면 개선분을 **템플릿에 먼저 반영한 뒤** 각 프로젝트로 재씨딩 — `/maintain` 루브릭의 자산 동기화 항목이 드리프트를 감지한다 (줄바꿈 정규화 비교 `diff --strip-trailing-cr` 필수).

## stop-gate 개선점 (v1 대비)

- 차단 후 재진입(`stop_hook_active`) 시에도 수정본을 재검증하고, 같은 턴 체인에서 3회 초과 차단이면 fail-open (Claude Code 자체 상한 8회보다 먼저 멈춤).
- 리소스 XML(`src/**/res/**/*.xml`) 개명·삭제도 게이트 대상 — R 참조 깨짐 감지.

## 워크플로우 개선점 (v1 대비)

- **implement-feature**: 스모크를 판정 라운드마다 재실행해 fix 반영 후의 최신 결과로 판정 (stale 증거로 인한 반복 FAIL/거짓 PASS 방지). fix 라운드에서 발생한 `openQuestions`도 유실 없이 사용자에게 전파.
- **review-and-fix**: 변경 전부터 있던 문제는 `preexisting`으로 분리해 무인 수정에서 제외하고 보고만 한다. 변경 hunk 기준 리뷰, `--diff-filter=d`로 삭제 파일 제외, fix 무응답 시 1회 재시도, disputed(지적이 잘못됐다는 반론)는 전 라운드 누적으로 checker에 전달. 리뷰 시작 실패는 FAIL이 아닌 `BLOCKED`로 구분(재시도 가능).
