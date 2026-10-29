# 개인용 범용 Codex 하네스

codex-reuse는 chore/reuse를 기반으로 만든 개인 프로젝트용 Codex 하네스다. 특정 회사·공통 라이브러리·프레임워크·디자인 시스템·배포 저장소에 의존하지 않는다.

## 적용

Node.js 18 이상과 Git이 필요하다. 이 저장소 루트에서 실행한다.

```powershell
# 실제 프로젝트 폴더를 지정한다. 프로필은 자동 선택하며 불명확하면 generic이다.
node codex/install.cjs --project "C:\Projects\MyProject" --dry-run
node codex/install.cjs --project "C:\Projects\MyProject"
```

대상 프로젝트를 Codex에서 열고 새 채팅에 다음을 입력한다.

```text
$harness-init 실제 프로젝트의 구조와 검증 명령을 확인해서 설정해줘.
```

- Python·Rust·Go·Node 서버·CLI·순수 패키지: generic 프로필
- Web UI·Android·iOS: 필요할 때 web·aos·ios 프로필
- 라이브러리: --kind library, CLI/개발 도구: --kind tool
- 앱 아키텍처는 기존 선택을 유지한다. 신규 Android 앱의 UDF·Data 가이드는 --new-project로 명시 선택할 때만 씨딩한다.

설치되는 파일은 AGENTS.md, .agents/skills/, .codex/harness/다. 사용자 홈이나 실제 앱 의존성·CI·권한은 변경하지 않는다. 기존 지침·검증 명령·가이드는 보존하고 사용자 수정과 충돌하면 중단한다.

자세한 설치 옵션·Skills·검증 결과 의미는 [Codex 안내](codex/README.md)를 참고한다.

## 이 저장소 검증

```powershell
node --test codex/tests/harness.test.cjs
node --check codex/install.cjs
node --check codex/scripts/verify.cjs
```

Codex용 정본은 codex/다. 기존 web/·ios/·aos/·install.sh는 기반 브랜치의 Claude 자산이며 Codex 설치에 사용하지 않는다.
