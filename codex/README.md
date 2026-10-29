# 개인용 범용 Codex 하네스

기반은 chore/reuse다. 기존 Codex판의 설치·검증 코드를 재사용하고 지침·Skills·참조 문서를 범용화했다. 설치에 회사 공통 패키지·사설 레지스트리·특정 Figma 파일·브랜치·기술 스택을 요구하지 않는다.

## 설치와 업데이트

Node.js 18 이상과 Git이 필요하다. 하네스 저장소 루트에서 실행하며 대상은 기존 프로젝트 디렉토리다.

```powershell
# 기본: 자동 프로필, 불명확한 프로젝트는 generic
node codex/install.cjs --project "C:\Projects\MyProject" --dry-run
node codex/install.cjs --project "C:\Projects\MyProject"

# 언어·플랫폼에 상관없이 프로젝트의 규칙/검사 명령 사용
node codex/install.cjs generic --project "C:\Projects\MyCli" --kind tool
node codex/install.cjs generic --project "C:\Projects\MyLibrary" --kind library

# 앱 프로젝트 프로필 명시
node codex/install.cjs web --project "C:\Projects\MyWeb"
node codex/install.cjs ios --project "C:\Projects\MyIos"
node codex/install.cjs aos --project "C:\Projects\MyAndroid"

# 신규 Compose 앱에서 MVVM+UDF/Data 템플릿을 채택할 때만
node codex/install.cjs aos --project "C:\Projects\NewAndroid" --new-project
```

macOS/Linux도 같은 Node 명령에 해당 OS의 경로를 지정한다. 사용자 홈·Codex 모델·권한·앱 의존성·CI는 설치기가 변경하지 않는다.

자동 프로필: 직접 확인 가능한 Android 플러그인 → Xcode 프로젝트 → 알려진 Web UI 의존성 → generic 순이다. Node 서버·순수 Swift 패키지·Python·Rust·Go·빈 프로젝트 등은 generic으로 유지한다. 불명확하면 추측하지 않으며 명시 프로필이 우선한다. 재설치의 auto는 기존 설치 프로필을 유지한다.

AGENTS.md의 codex-harness:start/end 구간만 갱신하고 구간 밖 사용자 내용은 보존한다. verify.json과 기존 루트 아키텍처 가이드는 덮어쓰지 않는다. 관리 파일의 사용자 수정·플랫폼/종류 변경·심볼릭 링크와 충돌하면 쓰기 전에 중단한다. 다른 변형의 기존 하네스 설치에도 혼합 적용하지 않는다.

바뀐 파일은 .bak-UUID로 백업하며 해당 패턴만 기존 .gitignore에 추가한다. 업데이트는 같은 명령을 다시 실행한다. --dry-run은 쓰기 없이 변경 목록만 보여준다. 배포 원본은 codex/이고 사용자 수정은 AGENTS.md의 관리 구간 밖과 verify.json에 둔다.

설치 후 **대상 프로젝트**에서 새 Codex 채팅을 열고 다음을 실행한다.

```text
$harness-init 실제 프로젝트의 구조·명령·필수 검사 집합을 확인해서 설정해줘.
```

AGENTS.override.md가 있으면 같은 디렉토리의 AGENTS.md가 선택되지 않으므로 기존 override와 적용 지침을 확인한다. Skills가 보이지 않으면 새 채팅/재시작으로 다시 확인한다.

## 설치 구성

```text
<프로젝트>/
├── AGENTS.md
├── .agents/skills/harness-*/SKILL.md
└── .codex/harness/
    ├── manifest.json     # 개인용 변형, 프로필/종류, 관리 파일 해시
    ├── references/       # 공통 기준 + 선택한 프로필의 추가 기준
    ├── verify.json       # 사용자 관리 검증 명령
    └── verify.cjs        # 명시 실행 검증기
```

프로젝트에 필요한 공유 파일은 검토 후 git에 포함할 수 있다. 백업·비밀·개인 설정은 포함하지 않는다. 설치기는 git add/commit/push를 실행하지 않는다.

## 작업 Skills

| 목적 | Skill |
|---|---|
| 온보딩·실제 검증 명령 설정 | $harness-init |
| 기능·모듈·CLI·화면의 최소 뼈대 | $harness-feature |
| 요청한 기능 전체 구현 | $harness-implement-feature |
| UI가 있을 때 디자인 구현 | $harness-design |
| 업무 동작·검증·상태·오류 | $harness-logic |
| 외부 API/데이터 연결이 있을 때 | $harness-connect-api |
| 변경분 리뷰·수정·재판정 | $harness-review-loop |
| 1회 기계적 유지보수 | $harness-maintain |
| 라이브러리 모듈/컴포넌트·릴리스 | $harness-component / $harness-publish |

app/tool은 일반 구현 Skills를, library는 feature·component·publish를 설치한다. UI가 없는 프로젝트에 Figma·Preview·Storybook·Navigation을 요구하지 않는다. API가 없는 작업에는 connect-api를 생략한다. 선택한 architecture·framework·코드 스타일을 유지한다.

독립 checker를 사용할 수 있고 위임이 허용된 경우 references/checker.md 기준으로 판정받는다. 그렇지 않으면 자가 검증으로 밝힌다. 수정·재판정은 같은 문제에 최대 3회다. Skills의 실행만으로 배포·외부 게시가 승인되지는 않는다.

## 검증 명령

대상 프로젝트 루트에서:

```powershell
node .codex/harness/verify.cjs
```

검증기는 턴 종료 훅으로 자동 등록되지 않는다. AGENTS/Skills가 완료 전 명시 실행하도록 지시한다. CI 강제가 필요하면 해당 프로젝트의 승인된 CI 작업에서 별도로 연결한다.

verify.json의 commands가 있으면 그 집합을 실행한다. 명령은 저장소 루트의 셸에서 실행되므로 신뢰하는 검증 명령만 설정하고 비밀·배포·의존성 설치를 넣지 않는다. 아래는 pytest가 이미 구성된 프로젝트의 예시이며 실제 환경의 명령으로 바꾼다.

```json
{
  "platform": "generic",
  "timeoutMs": 210000,
  "commands": [
    { "name": "test", "command": "python -m pytest" }
  ]
}
```

컴파일이 없는 프로젝트에 build 검사를 강제하지 않는다. 명시한 검사들이 통과하면 그 **검사 집합**의 PASS다. 프로젝트 전체 DoD·렌더링·실제 외부 서비스·기기 실행 성공은 별도로 확인한다.

commands가 비었을 때:

- JS/TS manifest가 있으면 기존 타입 검사/lint script와 로컬 Vitest/Jest를 제한적으로 감지한다. lockfile 기준 package manager를 사용하고 npx 다운로드를 하지 않는다.
- Android는 표준 Gradle 모듈의 compileDebugKotlin·적용된 ktlint/detekt를 감지한다. 복잡한 모듈/variant/테스트는 실제 명령을 지정한다.
- iOS의 scheme/destination과 기타 언어의 필수 검사 집합은 명시 설정한다. 판별 불가를 PASS로 취급하지 않는다.

종료 코드는 0=설정/감지된 검사 통과, 1=검사 실패, 2=검증 불가/필수 집합 미확인/변경 없음이다. JSON의 results와 skipped를 함께 확인한다. 환경 오류·시간 초과·락 경합은 SKIP이다.

staged·unstaged·untracked를 포함해 변경을 찾으며 명시 commands는 변경 유무와 상관없이 실행한다. 결과 캐시는 쓰지 않는다. 검증기끼리는 저장소 단위 락으로 직렬화하고 기존 IDE/셸 빌드는 제어하지 않는다. 락 잔재는 owner.json의 활성 세션 여부를 확인한 뒤 정리한다.

명령당 최대 240초, 전체 실행 예산 240초이며 시간 초과 시 이 검증에서 시작한 프로세스 트리를 종료한다. 다른 세션의 빌드·캐시·로그를 정리하지 않는다.

## 범용화 검증

```powershell
node --test codex/tests/harness.test.cjs
node --check codex/install.cjs
node --check codex/scripts/verify.cjs
```

프로필·app/library/tool 설치, 자동 감지, 사용자 파일 보존, 충돌/링크 방지, 언어 중립 검증, PASS/FAIL/SKIP, 설치 자산의 조직 의존성 제거를 확인한다. 테스트는 임시 Git 저장소를 만들고 정리하며 실제 앱·사용자 홈에는 설치하지 않는다.

설정 형식 근거: [AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md), [Skills](https://learn.chatgpt.com/docs/build-skills).
