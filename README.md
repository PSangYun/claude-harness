# 팀별 Claude Code 하네스 (Web / iOS / AOS)

웹팀에서 검증된 루프 엔지니어링 하네스(maker/checker 분리 + stop-gate 결정적 게이트 + 유지보수 루프)를
세 플랫폼 팀에 맞게 변환한 배포 패키지. 실제 저장소 조사(2026-07-03, ios-common·ParkGolfIOS·aos-common·ParkGolfAOS·react-common·parkgolf-association-admin·react-boilerplate·bokjiportal)를 기반으로 각 팀의 **실존하는 검증 명령**에 맞춰져 있다.

## 폴더 구조

```
harness/
├── web/  ios/  aos/
│   ├── global/           # 팀원 각자의 ~/.claude/ 에 배치 (개인 머신)
│   │   ├── CLAUDE.md     #   글로벌 규칙 + 공통 라이브러리 매핑 (aos는 핵심판 ~70줄 — 세부 규칙은 rules/·references/로 분리)
│   │   ├── settings.json #   Stop 훅(stop-gate) 등록 (aos는 SessionStart 훅만 — aos/README 참조)
│   │   ├── hooks/stop-gate.js   (aos는 글로벌 사본 없음 — project/hooks/stop-gate.js 가 정본)
│   │   ├── commands/     #   harness-init · maintain · review-loop (aos는 harness-init만 — 나머지는 project/commands)
│   │   └── agents/       #   checker · code-reviewer · smoke · test-writer
│   ├── project/          # 각 저장소의 .claude/ 에 배치 (git 추적 → 팀 배포 채널)
│   │   ├── settings.json
│   │   ├── hooks/stop-gate.js      (글로벌과 동일 사본 — 드리프트 금지)
│   │   ├── workflows/              review-and-fix.js + implement-feature.js (3플랫폼 전부)
│   │   ├── commands/               design·logic·connect-api (DoD 포함 — **앱 저장소 전용**.
│   │   │                            web은 bokjiportal의 DoD 포함판이 정본이라 여기 미포함)
│   │   └── templates/              린트 도입 템플릿 (ios: .swiftlint.yml / aos: .editorconfig + lint-setup.md
│   │                                + stop-gate.json · .worktreeinclude · ci.yml · gitattributes/gitignore 블록)
│   └── library/          # 공통 라이브러리 저장소 전용 커맨드 (앱 커맨드 대신 배치)
│       └── commands/               component.md(DS 컴포넌트 구현) + publish.md(배포 절차) — DoD 포함
└── README.md (이 문서)

## 앱 저장소 vs 라이브러리 저장소 — 배포 구성이 다르다

| 자산 | 앱 (ParkGolfIOS·ParkGolfAOS·admin 등) | 라이브러리 (ios-common·aos-common·react-common) |
|---|---|---|
| 코어 (settings·hooks·agents·review-and-fix·maintain) | ✅ | ✅ 동일 적용 (stop-gate가 SwiftPM 스킴/`:AosCommon` 모듈 자동 감지) |
| `project/commands` (design·logic·connect-api) | ✅ | ❌ 화면·VM·API 전제라 부적합 |
| `project/workflows/implement-feature.js` | ✅ | ❌ (동일 이유) |
| `library/commands` (component·publish) | ❌ | ✅ DS 컴포넌트 구현 + 배포 절차가 핵심 루프 |
| 린트 템플릿 | ✅ | ✅ |

라이브러리 커맨드는 각 저장소의 기존 규범을 DoD로 옮긴 것: aos-common(VariantsPreview 카르테시안 곱·토큰·가이드 동기화·publish 절차), ios-common(브랜치 1.0.0 추적 = push가 곧 배포 → 공개 API 변경·push에 사용자 승인 게이트), react-common(code_convention.md·storybook_convention.md 준수 + Storybook 스토리 필수 + semver).
```

## 공통 요구사항

- **Node.js** — 모든 훅이 node 기반 (크로스플랫폼: ParkGolfAOS의 Windows 개발 환경 포함). `node -v`로 확인.
- 훅 등록 후 동작 확인: `echo '{}' | node ~/.claude/hooks/stop-gate.js` → 아무 출력 없이 종료하면 정상 (aos는 글로벌 사본이 없으므로 프로젝트에서 `node .claude/hooks/stop-gate.js`).

## 설치 절차

### 팀원 각자 1회 — 글로벌 자산 (`~/.claude`)

```bash
git clone https://github.com/itandsy/claude-harness.git
cd claude-harness
./install.sh <web|ios|aos>     # Windows는 Git Bash에서 실행
```

스크립트가 하는 일: hooks/commands/agents 복사(기존 파일은 백업, 플랫폼에 있으면 prompts·rules·references·templates도), CLAUDE.md 병합(하네스 규약 없을 때만 추가), settings.json에 훅 병합(web/ios는 Stop, aos는 SessionStart + env·subagentPromptCacheTtl — 기존 설정 보존), 훅 동작 확인까지. aos는 `aos/project/{commands,workflows,templates}`도 `~/.claude/templates/`로 복사해 `/harness-init`의 씨딩 원본으로 쓴다. 수동으로 하려면 `<플랫폼>/global/`을 `~/.claude/`에 같은 규칙으로 복사하면 된다.

### 저장소당 1회 — 프로젝트 자산 (`.claude/`, git 커밋)

**itandsy 6개 저장소는 이미 배포 PR이 올라가 있다** (react-common #536 · ios-common #1 · aos-common #9 · ParkGolfIOS #2 · ParkGolfAOS #26 · parkgolf-association-admin #491) — 머지하면 끝. 새 저장소는:

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
| 테스트 | vitest/jest `--changed` | 오버라이드 지정 시만 (테스트 타겟 부재) | 실질 테스트 존재 시만 (Example* 템플릿 무시) |
| 명령 오버라이드 | — | `.claude/stop-gate.json` `{lint,build,test}` | `.claude/stop-gate.json` `{lint,build,test}` |
| 환경 실패 처리 | fail-open | Xcode 없음 → 통과 / 콜드 빌드 초과 → 가시화 스킵 | GPR 401/미해석 → 가시화 스킵 (코드 문제와 구분) |

공통 안전장치: 코드 변경 없으면 비용 0 통과, `stop_hook_active` 무한 루프 가드, 240s 예산 초과 시 fail-open(가시화), PASS 스탬프 캐시(같은 변경 상태면 재검증 생략 — web/ios는 2분으로 글로벌+프로젝트 중복 등록 대비, aos는 변경 파일 서명+HEAD 기준 12시간), `.claude/hooks/*.js` 변경 시 `node --check` 자기방어. aos는 compile·lint·짝 테스트를 Gradle 1회 호출(`--continue`)로 묶어 설정 단계를 한 번만 치른다.

## 조사에서 발견된 조치 필요 사항 (하네스와 별개로 사람 판단 필요)

### 🔴 보안 (즉시)

1. **aos-common**: `.claude/settings.local.json`에 **Figma API 토큰(`figd_...`)이 평문 커밋**되어 있음 → 토큰 폐기(rotate) + 파일 git 제거 + .gitignore 등록
2. **ParkGolfIOS**: **APNs 인증키 `AuthKey_G657N9S53C.p8`이 리포에 커밋**되고 리소스 번들에도 포함 → 키 폐기 + git 이력 정리 검토

### 🟡 드리프트/정리

3. **ParkGolfAOS**: aos-common `1.6.1` 고정인데 라이브러리 최신은 `1.7.2`, 앱에 복사된 `AOS_COMMON_GUIDE.md`도 1.6.0 기준 → 버전·가이드 동기화 (`/maintain` 루브릭 7번이 이후 자동 감지)
4. **ParkGolfIOS**: ios-common을 **"1.0.0" 이름의 브랜치**로 추적 (semver 태그 아님) — 라이브러리 푸시가 앱에 즉시 전파됨. 태그 잠금 전환 검토 권장
5. **ParkGolfIOS**: 루트에 실수 커밋 잔여물 (`https:/`, `Users/`, `tmp/`, `private/` 디렉토리) + Pods/ 통째 커밋
6. **ParkGolfAOS**: 루트에 개발 잔여물 (figma svg/png, `api-1.json` 874KB, `Websocket_Events` 등)
7. **react-common**: 하네스 미적용 + `.claude/settings.json`에 일회성 sed 권한 오염 → `/harness-init` 대상 1순위
8. **parkgolf-association-admin**: `.claude/commands`가 DoD 미포함 구버전 — DoD 포함 정본은 **bokjiportal**의 design/logic/connect-api/verify-smoke. 웹팀 저장소 간 커맨드 동기화 필요. CLAUDE.md의 Windows 절대경로도 이 머신 기준으로 정리 대상

## 3단계 파이프라인 (design → logic → connect-api)

세 플랫폼 모두 DoD 게이트가 달린 무인 파이프라인을 지원한다:

- **커맨드**: `/design`(UI만, 공통 라이브러리 매핑) → `/logic`(동작, API는 TODO 스텁) → `/connect-api`(API 연결). 각 커맨드에 `## Definition of Done` 섹션이 있어 checker가 판정 근거로 사용. iOS/AOS 버전은 `project/commands/`에 포함 (iOS: Screen→Content→Preview, AOS: UDF Contract/Route/Screen/ViewModel — 플랫폼 컨벤션 반영). **web은 bokjiportal의 DoD 포함 커맨드가 정본** — 웹 저장소에는 bokjiportal 것을 복사할 것.
- **워크플로우**: `implement-feature.js` — 자료(designUrls/logicUrl/apiSpec)가 준비된 단계까지 maker→smoke→checker 게이트(FAIL 시 수정 루프 최대 3회)로 자동 진행. 모바일 스모크는 빌드+(기기 연결 시) 실행 확인 (aos는 Design·ConnectApi 게이트에서만 수행하고, `adb devices`에 기기가 없으면 빌드도 생략해 `ran:false` — 컴파일은 checker가 1회만 검증. `runSmoke: true`면 전 단계).

## 린트 도입 (project/templates/ — 도입 즉시 stop-gate가 자동 감지)

- **iOS**: `templates/.swiftlint.yml`을 저장소 루트에 복사 + `brew install swiftlint`. 강제 언래핑 계열은 error, 나머지는 warning 위주로 점진 적용 가능하게 구성.
- **AOS**: `templates/lint-setup.md` 절차대로 ktlint Gradle 플러그인 선언 + `templates/.editorconfig` 복사 (컴포저블 PascalCase 허용 설정 포함). 도입 직후 `./gradlew ktlintFormat` 1회로 기존 코드 정리 권장.

## 후속 제안 (남은 것)

- **테스트 기반 마련**: iOS는 테스트 타겟 자체가 없음(test-writer가 타겟 추가를 안내), AOS는 템플릿뿐. 순수 로직(모델 변환·VM 상태 전이)부터 시작 권장.
- **웹 저장소 커맨드 동기화**: parkgolf-association-admin 등의 구버전 커맨드를 bokjiportal의 DoD 포함판으로 교체 + `verify-smoke.md`·agents 배포.
