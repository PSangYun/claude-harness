---
description: 유지보수 루프 — 프로젝트의 결정적 검증(SwiftLint/빌드/테스트)을 돌리고 기계적 수정만 수행한다. /loop와 함께 사용 가능.
---

# /maintain — 유지보수 루프 (iOS 공용)

이 커맨드는 루프 엔지니어링의 유지보수 루브릭이다. **기계적으로 검증 가능한 것만 고치고, 동작 변경은 절대 하지 않는다.**

## 루브릭 (전부 충족 시 CLEAN)

프로젝트에 **존재하는 검증만** 실행한다:

1. **SwiftLint** (`.swiftlint.yml` + swiftlint 바이너리 있으면): `swiftlint lint --strict` — 위반 0 (warning은 보고만)
2. **빌드** — 프로젝트 유형별 (`.claude/stop-gate.json`에 build 명령이 지정돼 있으면 그것을 사용):
   - SwiftPM 라이브러리(Package.swift만 있음, 예: ios-common):
     `xcodebuild -scheme <패키지명> -destination 'generic/platform=iOS Simulator' build` — 성공
   - 앱(xcworkspace, 예: ParkGolfIOS):
     `xcodebuild -workspace <이름>.xcworkspace -scheme <스킴> -configuration Debug -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build` — 성공
3. **테스트** (테스트 타겟 있으면): `xcodebuild test -scheme <스킴> -destination 'platform=iOS Simulator,name=<부팅 가능한 기기>'` — 통과. 테스트 타겟이 없으면 "테스트 없음"으로 보고만 (임의로 타겟을 만들지 말 것)
4. **TODO/FIXME 트리아지**: `grep -rn "TODO\|FIXME" --include="*.swift" <소스루트>/` — 목록화만 (수정은 사람 판단)
5. **프로젝트 루브릭**: 프로젝트 CLAUDE.md에 `## 프로젝트 루브릭` 섹션이 있으면 그 항목들도 검사에 포함

## 절차 (반드시 이 순서)

**Phase 1 — 진단**: 루브릭 전 항목 실행, 결과를 표로 정리 (항목 | 상태 | 에러 수)

**Phase 2 — 기계적 수정만**:
- `swiftlint --fix` (설정 있으면), `swiftformat .` (설정 있으면) 등 도구가 자동으로 고치는 것
- 명백한 단순 위반 (예: 금지된 API 제거, 미사용 import 제거)
- **금지**: 동작 변경 리팩토링, 공개 API 시그니처 변경, 파일 구조 변경, pbxproj/Podfile 수정. 기계적이지 않은 문제는 수정하지 말고 보고 목록에 남길 것

**Phase 3 — 재검증**: 루브릭 재실행. 수정으로 인해 새 에러가 생겼으면 해당 수정을 되돌린다.

**Phase 4 — 보고**:
- 전부 통과면 한 줄: `CLEAN — lint 0 / 빌드 성공 / 테스트 통과(또는 없음)`
- 남은 문제는 "사람 판단 필요" 목록으로 정리 (파일:라인 + 한 줄 설명)
- **재발 패턴 발견 시**: 같은 종류의 위반이 반복되면 프로젝트 CLAUDE.md의 `## 반복되는 실수` 섹션에 날짜와 함께 1줄 추가. 이미 2회 이상 기록된 패턴이면 `.claude/hooks/quality-check.js`에 정규식 검사로 승격할 것을 사용자에게 제안

## 사용법

- 수동 1회: `/maintain`
- 세션 중 백그라운드 루프: `/loop /maintain` (동적 간격) 또는 `/loop 30m /maintain`
