# AOS ktlint 도입 가이드

현재 aos-common·ParkGolfAOS는 린트가 없어 결정적 게이트가 `compileDebugKotlin`뿐이다.
ktlint를 도입하면 **stop-gate 훅과 /maintain이 자동으로 감지해 `ktlintCheck`를 실행**한다 (훅 수정 불필요).

## 1. Gradle 플러그인 선언

루트 `build.gradle.kts`의 `plugins` 블록에 추가:

```kotlin
plugins {
    // ...기존 플러그인...
    id("org.jlleitschuh.gradle.ktlint") version "12.1.1" apply false
}
```

각 검사 대상 모듈(`app/build.gradle.kts`, `AosCommon/build.gradle.kts`)에 적용:

```kotlin
plugins {
    // ...기존 플러그인...
    id("org.jlleitschuh.gradle.ktlint")
}
```

> 버전 카탈로그를 쓰는 프로젝트면 `gradle/libs.versions.toml`에 등록 후 `alias(libs.plugins.ktlint)`로 선언해도 된다.

## 2. 스타일 설정

같은 폴더의 `.editorconfig`를 저장소 루트에 복사한다. 핵심:

- `ktlint_code_style = android_studio` — 안드로이드 스튜디오 기본 포맷과 일치
- `ktlint_function_naming_ignore_when_annotated_with = Composable` — 컴포저블 PascalCase 허용 (100% Compose 프로젝트 필수)

## 3. 사용

```bash
./gradlew ktlintCheck    # 검사 (stop-gate/maintain이 자동 실행하는 태스크)
./gradlew ktlintFormat   # 자동 수정 (/maintain의 기계적 수정 단계에서 사용)
```

## 4. 기존 코드 일괄 정리 (도입 직후 1회)

기존 코드베이스에 위반이 쌓여 있으면 첫 도입 시 게이트가 계속 차단된다.
도입 커밋에서 `./gradlew ktlintFormat`을 1회 돌려 전체를 정리한 뒤 시작할 것 (기계적 포맷 변경만 발생 — 동작 변경 없음).

> detekt(정적 분석)까지 원하면 별도 도입 가능하나, 규칙 튜닝 비용이 있어 ktlint 정착 후 검토 권장. detekt를 선언하면 stop-gate가 마찬가지로 자동 감지한다.
