# Codex 하네스 — Web / iOS / AOS

Claude 하네스의 프로젝트 규칙·플랫폼별 DoD·리뷰/스모크 기준을 Codex용으로 이식한 배포 패키지다. 프로젝트에 설치하며 사용자 홈이나 Codex 권한·모델 설정을 바꾸지 않는다. 원본 Claude 패키지는 저장소의 `web/`, `ios/`, `aos/`에 보존돼 있다.

## 설치

Node.js 18 이상과 Git이 필요하다. 하네스 저장소 루트에서 실행한다. 대상 프로젝트는 기존 디렉토리여야 한다.

```powershell
# 실제 변경 없이 설치 계획 확인
node codex/install.cjs aos --project "C:\Projects\MyApp" --dry-run

# 기존 Android 앱: 기존 아키텍처 유지
node codex/install.cjs aos --project "C:\Projects\MyApp"

# 화면 구현 전의 신규 Android 앱에만 UDF·Data 가이드 씨딩
node codex/install.cjs aos --project "C:\Projects\NewApp" --new-project

# 공통 라이브러리: component/publish Skills 설치
node codex/install.cjs aos --project "C:\Projects\aos-common" --kind library
```

macOS/Linux에서도 같은 Node 명령을 사용한다. Web은 첫 인자를 `web`, iOS는 `ios`로 바꾼다. Web·iOS에는 `--new-project`를 지정하지 않는다.

설치 결과:

```text
<프로젝트>/
├── AGENTS.md                         # 공통·플랫폼 규칙의 관리 구간
├── .agents/skills/harness-*/SKILL.md  # Codex가 발견하는 작업 절차
└── .codex/harness/
    ├── manifest.json                 # 플랫폼·앱/라이브러리·관리 파일 해시
    ├── references/                   # 구현·리뷰·스모크·아키텍처 기준
    ├── verify.json                   # 프로젝트 실제 검증 명령 (사용자 관리)
    └── verify.cjs                    # 명시적으로 실행하는 검증기
```

`AGENTS.md`는 기존 내용을 보존하고 `codex-harness:start/end` 구간만 갱신한다. `verify.json`과 이미 존재하는 루트 아키텍처 가이드는 보존한다. 관리 파일의 사용자 수정이나 심볼릭 링크와 충돌하면 쓰기 전에 중단한다. 바뀐 기존 파일은 `.bak-<UUID>`로 백업하고 해당 하네스 백업 패턴을 기존 `.gitignore`에 추가한다. 같은 명령으로 재설치할 수 있다. 플랫폼·app/library 변경 설치는 혼합 자산을 막기 위해 거절한다.

설치 후 대상 프로젝트에서 새 Codex 채팅을 시작하고 `$harness-init`으로 실제 빌드·린트·테스트 명령을 확인한다. 로컬에서 Skills가 바로 표시되지 않으면 재시작한다. `AGENTS.override.md`가 있으면 같은 디렉토리의 `AGENTS.md`가 선택되지 않으므로 해당 override도 확인한다.

## 사용

| 작업 | Skill |
|---|---|
| 온보딩/설정 점검 | `$harness-init` |
| 앱 기능 뼈대 | `$harness-feature` |
| UI → 동작 → API | `$harness-design` → `$harness-logic` → `$harness-connect-api` |
| 준비된 단계까지 연속 구현 | `$harness-implement-feature` |
| 변경분 리뷰·수정·재검증 | `$harness-review-loop` |
| 1회 유지보수 | `$harness-maintain` |
| 공통 라이브러리 컴포넌트/배포 | `$harness-component` / `$harness-publish` |

Web 앱의 원본 design/logic/connect-api 커맨드는 이 저장소에 포함되지 않아 Codex판에 단계별 기준을 작성했다. 실제 프로젝트 명세와 컨벤션을 우선한다. 모든 플랫폼의 기존 라이브러리 DoD와 AOS 최신 UDF·Data 가이드는 references에 포함돼 있다.

checker는 Codex 서브에이전트를 사용할 수 있고 위임이 허용된 환경에서 독립 판정 역할로 실행한다. 이 패키지가 임의로 모델명이나 TOML 에이전트 설정을 등록하지는 않는다. 지원하지 않는 환경은 자가 검증으로 보고하며 독립 PASS로 표현하지 않는다. 수정·재판정은 최대 3회다.

## 검증

대상 프로젝트의 저장소 루트에서 실행한다.

```powershell
node .codex/harness/verify.cjs
```

검증은 **Codex 턴 종료 훅에 자동 등록되지 않는다.** AGENTS/Skills가 완료 전 실행하도록 지시한다. 머지 차단이 필요하면 동일 검증 명령을 프로젝트 CI에 별도로 연결한다. 기존 Claude settings/hooks/Workflow DSL·모델별 프롬프트는 Codex 설정으로 복사하지 않는다.

`verify.json`의 명시 명령이 자동 감지보다 우선한다. 예:

```json
{
  "platform": "aos",
  "timeoutMs": 210000,
  "commands": [
    { "name": "compile", "command": ".\\gradlew.bat :app:compileDebugKotlin" },
    { "name": "lint", "command": ".\\gradlew.bat :app:ktlintCheck" },
    { "name": "test", "command": ".\\gradlew.bat :app:testDebugUnitTest" }
  ]
}
```

명령은 저장소 루트의 셸에서 실행된다. 신뢰하는 프로젝트의 검증 명령만 넣는다. OS·모듈명·태스크는 실측값으로 바꾸고 존재하지 않는 린트·테스트는 넣지 않는다. 배포·자격증명·의존성 설치는 검증 명령에 넣지 않는다.

- Web 자동 감지: lockfile 기반 npm/pnpm/yarn의 타입 검사·lint script, 로컬 Vitest/Jest. 의존성 설치나 npx 다운로드는 하지 않는다.
- AOS 자동 감지: 표준 Gradle 모듈의 compileDebugKotlin, 직접 선언된 ktlint/detekt. 복잡한 settings·사용자 플러그인·테스트는 명시 명령이 필요하다.
- iOS: lint 설정은 감지하지만 workspace/project/scheme/destination은 실제 명령을 지정해야 한다. Xcode 없는 환경은 미검증이다.
- 변경 범위는 staged·unstaged·untracked를 포함한다. 명시 명령은 변경 유무와 무관하게 실행한다. 결과 캐시는 사용하지 않는다.
- 이 검증기끼리는 저장소 단위 락을 사용한다. IDE/별도 셸 빌드까지 제어하지는 않는다. 락 잔재는 owner.json의 세션 종료 여부를 사람이 확인한 뒤 정리한다.
- 명령당 최대 240초, 전체 명령 실행 예산 240초다. 전체 타임아웃·환경 문제·락 경합은 SKIP으로 보고한다.

종료 코드: `0` 설정된 검사 통과, `1` 검사 실패, `2` 검증 불가/빌드 명령 미확인/앱 변경 없음. 결과의 `skipped`는 0일 때도 확인한다. 컴파일 통과는 기기 실행·Figma 렌더링·프로젝트 DoD 전체 통과를 뜻하지 않는다.

## 이 패키지 검증

```powershell
node --test codex/tests/harness.test.cjs
node --check codex/install.cjs
node --check codex/scripts/verify.cjs
```

Codex판 자산의 정본은 `codex/`다. Claude판의 관련 규칙을 갱신하면 Codex references에도 반영하고 위 검사를 실행한다. 플랫폼별 source와 설치 사본을 함께 수정하지 말고 정본 수정 후 재설치한다.

설정 방식 근거: [AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md), [Skills와 발견 경로](https://learn.chatgpt.com/docs/build-skills).
