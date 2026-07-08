---
description: 유지보수 루프 — 프로젝트의 결정적 검증(컴파일/린트/테스트)을 돌리고 기계적 수정만 수행한다. /loop와 함께 사용 가능.
---

# /maintain — 유지보수 루프 (AOS 공용)

이 커맨드는 루프 엔지니어링의 유지보수 루브릭이다. **기계적으로 검증 가능한 것만 고치고, 동작 변경은 절대 하지 않는다.**

## 루브릭 (전부 충족 시 CLEAN)

프로젝트에 **존재하는 검증만** 실행한다 (모듈명은 settings.gradle.kts에서 확인 — 예: 앱 모듈 `:app`, 라이브러리 모듈 `:<yourLibrary>`):

1. **컴파일**: `./gradlew :<모듈>:compileDebugKotlin` — 에러 0 (type-check 대용, 현재 유일한 결정적 게이트)
2. **린트** (ktlint/detekt가 빌드 스크립트에 선언된 경우만): `./gradlew ktlintCheck` / `./gradlew detekt` — 에러 0. 미도입이면 "없음"으로 보고 (도입 제안 가능)
3. **AGP lint**: `./gradlew :<모듈>:lintDebug` — 에러 0 (warning은 보고만). 오래 걸리면 보고 후 생략 가능
4. **테스트**: 실질 테스트 파일이 있으면 `./gradlew :<모듈>:testDebugUnitTest` — 통과 (Example* 템플릿만 있으면 "실질 테스트 없음"으로 보고)
5. **TODO/FIXME 트리아지**: `grep -rn "TODO\|FIXME" --include="*.kt" <모듈>/src/main/` — 목록화만 (수정은 사람 판단)
6. **프로젝트 루브릭**: 프로젝트 CLAUDE.md에 `## 프로젝트 루브릭` 섹션이 있으면 그 항목들도 검사에 포함
7. **가이드 사본 동기화** (공용 라이브러리 소비 앱만 해당): 앱에 복사해 둔 라이브러리 가이드 문서의 버전 표기 ↔ `build.gradle.kts`의 해당 라이브러리 의존 버전 일치 여부 — 불일치면 보고. 공용 라이브러리를 안 쓰면 생략
8. **하네스 자산 사본 동기화**: `.claude/{agents,hooks}` ↔ 글로벌 `~/.claude/{agents,hooks}` 원본, `.claude/{commands,workflows}` ↔ 글로벌 `~/.claude/templates/{commands,workflows}` 템플릿 대조 — 반드시 줄바꿈 정규화 비교(`diff --strip-trailing-cr`)를 사용 (CRLF 차이는 드리프트가 아님). 불일치면 보고만 (동기화 방향은 사람 판단)

## 절차 (반드시 이 순서)

**Phase 1 — 진단**: 루브릭 전 항목 실행, 결과를 표로 정리 (항목 | 상태 | 에러 수)

**Phase 2 — 기계적 수정만**:
- `./gradlew ktlintFormat` (도입된 경우) 등 도구가 자동으로 고치는 것
- 명백한 단순 위반 (예: 미사용 import 제거, 금지 패턴 제거)
- **금지**: 동작 변경 리팩토링, 공개 API/비즈니스 로직 수정, Gradle 스크립트·의존성 버전 변경, 파일 구조 변경. 기계적이지 않은 문제는 수정하지 말고 보고 목록에 남길 것

**Phase 3 — 재검증**: 루브릭 재실행. 수정으로 인해 새 에러가 생겼으면 해당 수정을 되돌린다.

**Phase 4 — 보고**:
- 전부 통과면 한 줄: `CLEAN — 컴파일 0 / lint 0(또는 없음) / 테스트 통과(또는 없음)`
- 남은 문제는 "사람 판단 필요" 목록으로 정리 (파일:라인 + 한 줄 설명)
- **재발 패턴 발견 시**: 같은 종류의 위반이 반복되면 프로젝트 CLAUDE.md의 `## 반복되는 실수` 섹션에 날짜와 함께 1줄 추가. 이미 2회 이상 기록된 패턴이면 `.claude/hooks/quality-check.js`에 정규식 검사로 승격할 것을 사용자에게 제안

## 주의

- 빌드 실패가 `401 Unauthorized`/`Could not resolve <사설 아티팩트 좌표>`면 코드 문제가 아니라 **사설 패키지 저장소 자격증명(예: GitHub Packages `gpr.user`/`gpr.key`) 문제**다 — 수정 시도하지 말고 환경 문제로 보고

## 사용법

- 수동 1회: `/maintain`
- 세션 중 백그라운드 루프: `/loop /maintain` (동적 간격) 또는 `/loop 30m /maintain`
