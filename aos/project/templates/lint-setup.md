# AOS ktlint 도입 가이드

> 이 문서는 신규 저장소에 ktlint를 처음 도입할 때 사용한다.

ktlint를 도입하면 **stop-gate 훅과 /maintain이 자동으로 감지해 `ktlintCheck`를 실행**한다 (훅 수정 불필요).

## 1. Gradle 플러그인 선언

루트 `build.gradle.kts`의 `plugins` 블록에 추가:

```kotlin
plugins {
    // ...기존 플러그인...
    id("org.jlleitschuh.gradle.ktlint") version "14.2.0" apply false
}
```

각 검사 대상 모듈 `build.gradle.kts`의 `plugins` 블록에 적용 + 버전 고정:

```kotlin
plugins {
    // ...기존 플러그인...
    id("org.jlleitschuh.gradle.ktlint")
}

// ktlint — CLI/훅과 동일 버전 고정 (규칙 드리프트 방지)
ktlint {
    version.set("1.8.0")
    android.set(true)
}
```

## 2. 스타일 설정

같은 폴더의 `.editorconfig`를 저장소 루트에 복사한다. 핵심 결정:

- `ktlint_code_style = android_studio` — IDE 기본 포맷과 일치
- 컴포저블 PascalCase 허용 (`ktlint_function_naming_ignore_when_annotated_with = Composable`)
- `max_line_length = off` — 도입 초기 소음 방지
- **네이밍 계열 비활성** (property/backing-property/filename) — 라이브러리처럼 공개 API를 배포하는 저장소는 이름·파일명 변경이 파괴적이므로 비활성 (앱 전용 저장소는 선택)
- wildcard import·인자 옆 주석 계열 비활성 — Android Studio 기본 동작·팀 주석 습관 유지

## 3. 사용

```bash
./gradlew ktlintCheck    # 검사 (stop-gate/maintain이 자동 실행하는 태스크)
./gradlew ktlintFormat   # 자동 수정 (/maintain의 기계적 수정 단계에서 사용)
```

## 4. 기존 코드 일괄 정리 (도입 직후 1회)

기존 코드베이스에 위반이 쌓여 있으면 첫 도입 시 게이트가 계속 차단된다. 도입 커밋에서 전체 포맷을 1회 돌려 정리한 뒤 시작할 것 (기계적 포맷 변경만 — 동작 변경 없음):

```bash
./gradlew ktlintFormat        # 또는 SDK 없는 머신이면: brew install ktlint 후
ktlint --format "app/src/**/*.kt" "*.gradle.kts" "**/*.gradle.kts"   # (1.8.0 — 플러그인 고정 버전과 일치)
```

⚠️ 전체 포맷 커밋은 열려 있는 작업 브랜치와 충돌한다 — 진행 중 브랜치가 정리된 시점에 머지하고, 이후 브랜치는 rebase 권장.

> detekt(정적 분석)까지 원하면 별도 도입 가능 — 선언하면 stop-gate가 마찬가지로 자동 감지한다. ktlint 정착 후 검토 권장.
