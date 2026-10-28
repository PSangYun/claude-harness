# 팀 Claude Code 하네스 (Web / iOS / AOS)

검증된 루프 엔지니어링 하네스(maker/checker 분리 + stop-gate 결정적 게이트 + 유지보수 루프)를 세 플랫폼(web·ios·aos)에 맞춰 정리한 배포 패키지. 각 플랫폼 팀의 **실존하는 검증 명령**(타입체크/컴파일/린트/테스트)에 맞춰져 있다.

## 폴더 구조

```
harness/
├── web/  ios/  aos/
│   ├── global/           # 팀원 각자의 ~/.claude/ 에 배치 (개인 머신)
│   │   ├── CLAUDE.md     #   글로벌 규칙 + 플랫폼 규칙 (aos는 핵심판 ~70줄 — 세부 규칙은 rules/·references/로 분리)
│   │   ├── settings.json #   훅 등록 (web/ios는 Stop: stop-gate, aos는 SessionStart 훅만 — aos/README 참조)
│   │   ├── hooks/stop-gate.js   (aos는 글로벌 사본 없음 — project/hooks/stop-gate.js 가 정본)
│   │   ├── commands/     #   harness-init · maintain · review-loop (aos는 harness-init만 — 나머지는 project/commands)
│   │   └── agents/       #   checker · code-reviewer · smoke · test-writer
│   ├── project/          # 각 저장소의 .claude/ 에 배치 (git 추적 → 팀 배포 채널)
│   │   ├── settings.json
│   │   ├── hooks/stop-gate.js      (web/ios는 글로벌과 동일 사본 — 드리프트 금지 / aos는 이것이 정본)
│   │   ├── workflows/              review-and-fix.js + implement-feature.js
│   │   ├── commands/               design·logic·connect-api (DoD 포함 — 앱 저장소 전용)
│   │   └── templates/              린트 도입 템플릿 (aos는 + stop-gate.json · .worktreeinclude · ci.yml · gitattributes/gitignore 블록)
│   └── library/          # (선택) 공통 컴포넌트 라이브러리 저장소 전용 커맨드
│                         #   — 그런 라이브러리를 운영하는 저장소에서만 사용
└── README.md (이 문서)
```

> 플랫폼별로 제공되는 자산이 조금씩 다르다 (예: aos 프리셋은 모델별 운영 프롬프트를 포함하고 `library/`를 두지 않는다 — aos 고유 사항은 `aos/README.md` 참조).

## 앱 저장소 vs 라이브러리 저장소 — 배포 구성이 다르다

| 자산 | 앱 저장소 | 라이브러리(공통 컴포넌트) 저장소 |
|---|---|---|
| 코어 (settings·hooks·agents·review-and-fix·maintain) | ✅ | ✅ 동일 적용 (stop-gate가 모듈/스킴 자동 감지) |
| `project/commands` (design·logic·connect-api) | ✅ | ❌ 화면·VM·API 전제라 부적합 |
| `project/workflows/implement-feature.js` | ✅ | ❌ (동일 이유) |
| `library/commands` (component·publish) | ❌ | ✅ (제공되는 플랫폼에서) |
| 린트 템플릿 | ✅ | ✅ |

라이브러리 커맨드는 컴포넌트 구현·공개 API 호환성·배포 절차를 DoD 게이트로 강제한다. 저장소마다 규범이 다르므로 **해당 저장소의 CLAUDE.md를 정본**으로 삼는다.

## 공통 요구사항

- **Node.js** — 모든 훅이 node 기반 (Windows 포함 크로스플랫폼). `node -v`로 확인.
- 훅 등록 후 동작 확인: `echo '{}' | node ~/.claude/hooks/stop-gate.js` → 아무 출력 없이 종료하면 정상 (aos는 글로벌 사본이 없으므로 프로젝트에서 `node .claude/hooks/stop-gate.js`).

## 설치 절차

### 팀원 각자 1회 — 글로벌 자산 (`~/.claude`)

```bash
git clone <이 저장소 URL>
cd claude-harness
./install.sh <web|ios|aos>     # Windows는 Git Bash에서 실행
```

스크립트가 하는 일: hooks/commands/agents(+플랫폼에 있으면 prompts·rules·references·templates) 복사(기존 파일은 백업), CLAUDE.md 병합(하네스 규약이 없을 때만 추가), settings.json에 훅 병합(web/ios는 Stop, aos는 SessionStart + env·subagentPromptCacheTtl — 기존 설정 보존), 훅 동작 확인까지. aos는 `aos/project/{commands,workflows,templates}`도 `~/.claude/templates/`로 복사해 `/harness-init`의 씨딩 원본으로 쓴다. 수동으로 하려면 `<플랫폼>/global/`을 `~/.claude/`에 같은 규칙으로 복사하면 된다.

### 저장소당 1회 — 프로젝트 자산 (`.claude/`, git 커밋)

```bash
cp -r <플랫폼>/project/* <저장소>/.claude/          # 앱이면 project/, 라이브러리면 library/ 커맨드 사용
cp -r <플랫폼>/global/agents <저장소>/.claude/      # clone만 받은 환경에서도 checker/smoke가 동작하도록 사본 포함
echo ".claude/settings.local.json*" >> <저장소>/.gitignore
git add .claude .gitignore   # settings.local.json이 스테이징 안 됐는지 확인 후 커밋
```

이후 각 저장소에서 `/harness-init` 실행 → CLAUDE.md 생성/검증, 권한 오염 정리, 메모리 시딩 (파괴적 변경은 사용자 확인 후 적용).

## 플랫폼별 결정적 게이트 (stop-gate가 자동 실행)

| | Web | iOS | AOS |
|---|---|---|---|
| 타입/컴파일 | `npm run type-check` (tsc) | `xcodebuild build` (워크스페이스/SwiftPM 자동 감지) | `./gradlew :<모듈>:compileDebugKotlin` (모듈 자동 감지) |
| 린트 | `npx eslint <변경분>` | SwiftLint (`.swiftlint.yml` 존재 시) | ktlint/detekt (빌드 스크립트 선언 시 자동 활성) |
| 테스트 | vitest/jest `--changed` | 오버라이드 지정 시만 (테스트 타겟 부재 시) | 실질 테스트 존재 시만 (Example* 템플릿 무시) |
| 명령 오버라이드 | — | `.claude/stop-gate.json` `{lint,build,test}` | `.claude/stop-gate.json` `{lint,build,test}` |
| 환경 실패 처리 | fail-open | Xcode 없음 → 통과 / 콜드 빌드 초과 → 가시화 스킵 | 사설 저장소 인증 실패/미해석 → 가시화 스킵 (코드 문제와 구분) |

공통 안전장치: 코드 변경 없으면 비용 0 통과, `stop_hook_active` 무한 루프 가드, 240s 예산 초과 시 fail-open(가시화), PASS 스탬프 캐시(같은 변경 상태면 재검증 생략 — web/ios는 2분으로 글로벌+프로젝트 중복 등록 대비, aos는 변경 파일 서명+HEAD 기준 12시간), `.claude/hooks/*.js` 변경 시 `node --check` 자기방어. aos는 compile·lint·짝 테스트를 Gradle 1회 호출(`--continue`)로 묶어 설정 단계를 한 번만 치른다.

## 3단계 파이프라인 (design → logic → connect-api)

세 플랫폼 모두 DoD 게이트가 달린 무인 파이프라인을 지원한다:

- **커맨드**: `/design`(UI만, 프로젝트 공용 컴포넌트/토큰 재사용) → `/logic`(동작, API는 TODO 스텁) → `/connect-api`(API 연결). 각 커맨드에 `## Definition of Done` 섹션이 있어 checker가 판정 근거로 사용. iOS/AOS 버전은 `project/commands/`에 포함 (iOS: Screen→Content→Preview, AOS: UDF Contract/Route/Screen/ViewModel — 플랫폼 컨벤션 반영).
- **워크플로우**: `implement-feature.js` — 자료(designUrls/logicUrl/apiSpec)가 준비된 단계까지 maker→smoke→checker 게이트(FAIL 시 수정 루프 최대 3회)로 자동 진행. 모바일 스모크는 빌드+(기기 연결 시) 실행 확인 (aos는 Design·ConnectApi 게이트에서만 수행하고, `adb devices`에 기기가 없으면 빌드도 생략해 `ran:false` — 컴파일은 checker가 1회만 검증. `runSmoke: true`면 전 단계).

## 린트 도입 (project/templates/ — 도입 즉시 stop-gate가 자동 감지)

- **iOS**: `templates/.swiftlint.yml`을 저장소 루트에 복사 + `brew install swiftlint`. 강제 언래핑 계열은 error, 나머지는 warning 위주로 점진 적용 가능하게 구성.
- **AOS**: `templates/lint-setup.md` 절차대로 ktlint Gradle 플러그인 선언 + `templates/.editorconfig` 복사 (컴포저블 PascalCase 허용 설정 포함). 도입 직후 `./gradlew ktlintFormat` 1회로 기존 코드 정리 권장.
