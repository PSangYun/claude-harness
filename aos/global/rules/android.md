---
paths:
  - "**/*.kt"
  - "**/*.kts"
---

# Android 전용 규칙 (Kotlin/Compose 파일을 다룰 때 자동 로드)

글로벌 CLAUDE.md에서 분리한 Android 세부 규칙이다. `.kt`/`.kts` 파일을 읽거나 수정할 때만 컨텍스트에 올라온다 (매 세션 고정 비용 절감). 프로젝트 CLAUDE.md에 같은 주제의 규칙이 있으면 프로젝트 쪽을 우선한다. iOS 프로젝트에서는 무시한다.

## API 통신 모델 @Keep 필수

API와 통신하는 모든 Kotlin data class 모델에는 반드시 `@Keep` 어노테이션을 붙인다. ProGuard/R8 난독화로 필드명이 제거되어 JSON 파싱이 깨지는 것을 방지한다.

```kotlin
import androidx.annotation.Keep

@Keep
data class SomeModel(
    val field: String
)
```

## Compose Stability (리컴포지션 최적화)

불필요한 리컴포지션을 막기 위해 컴포저블에 넘기는 데이터 타입의 stability를 관리한다.
**무지성으로 다 붙이지 말고, 컴파일러가 추론 못 하는 경우만 대응한다.**

### 자동 추론되는 경우 (어노테이션 불필요)
- 같은 모듈 안의 data class이고, 모든 프로퍼티가 `val`이며, 타입이 전부 stable이면 → 컴파일러가 자동으로 stable 추론. `@Immutable`을 붙이지 않는다.

### @Immutable 붙이는 경우
- UiState 등 화면 상태 data class에는 `@Immutable`을 붙인다 (모든 프로퍼티 `val` 전제).
- 컴포저블에 넘기는 모델 data class 중 다른 모듈에서 참조되거나 stability 분석에서 `unstable`/`runtime`으로 뜨는 타입에 붙인다.
- `@Immutable`은 **클래스 선언 위**에만 붙인다. 컴포저블 호출부에는 붙이지 않는다.

### @Stable 붙이는 경우
- `var` 프로퍼티가 있지만 외부에서 변경하지 않음을 개발자가 보장할 수 있을 때만 사용한다.
- 가능하면 `var` → `val` 전환을 우선한다.

### List / Map 등 컬렉션
- 컴포저블 파라미터의 `List`/`Map`/`Set`은 unstable로 추론된다.
- `kotlinx.collections.immutable`의 `ImmutableList`/`PersistentList`로 바꾼다.
- 변환이 어려우면 그 컬렉션을 감싼 data class에 `@Immutable`을 붙여 우회한다.

### ViewModel
- ViewModel은 unstable이지만 인스턴스 참조가 고정이라 실질 영향이 적다.
- 단, 컴포저블 파라미터로 ViewModel을 통째로 넘기면 해당 함수가 skippable에서 빠진다. 신규 구현 시 ViewModel 대신 **상태 값 + 콜백 람다**로 분리해 넘긴다.

## 패키지 구조 규칙

새 파일 생성 시 아래 패키지 위치를 준수한다. (프로젝트마다 구조가 다르면 프로젝트 CLAUDE.md의 규칙을 우선한다.)

| 파일 종류 | 패키지 위치 |
|---|---|
| Dialog | `component/dialog/` |
| BottomSheet | `component/bottomsheet/` |
| Model (data class 등) | `model/` |

- 화면별 하위 분류가 필요하면 해당 패키지 안에 서브패키지를 만든다 (예: `component/dialog/myinfo/`)
- 위 규칙을 어기는 위치에 파일을 만들지 않는다

## 안전영역 (Safe Area) 처리

`WindowCompat.setDecorFitsSystemWindows(window, false)`로 edge-to-edge가 활성화되어 있으면, **스플래시 화면을 제외한 모든 화면의 루트 컴포저블에 `statusBarsPadding()`을 반드시 적용한다.**

- 하단 네비게이션 바가 있는 화면은 `navigationBarsPadding()`도 추가
- 스플래시는 배경색이 전체를 채우므로 예외

## Compose Modifier 순서 규칙 — drawBehind와 background

`drawBehind`는 modifier chain에서 자신보다 **앞에 오는** modifier가 그린 내용 위에 덧그린다. 따라서:

```kotlin
// ❌ 잘못된 순서 — background가 drawBehind 위를 덮어버림
.clip(RoundedCornerShape(8.dp))
.drawBehind { /* border */ }
.background(Color.White)

// ✅ 올바른 순서 — background 위에 border가 그려짐
.clip(RoundedCornerShape(8.dp))
.background(Color.White)
.drawBehind { /* border */ }
```

- border나 overlay 효과를 `drawBehind`로 구현할 때는 반드시 `background` **뒤에** 배치한다
- shadow(`drawBehind`로 구현)는 `clip` **앞에** 배치해야 클리핑 밖으로 그려진다

## 리소스 파일 수정 전 사용처 확인

- `res/drawable/` 파일을 수정하기 **전에 반드시** 프로젝트 전체에서 해당 리소스를 참조하는 곳을 먼저 grep으로 확인한다
- 여러 화면에서 공유되는 리소스라면 수정 대신 **새 파일을 별도로 생성**한다
- 예: 스플래시(흰색 배경용)와 일반 화면(밝은 배경용)에서 같은 로고를 쓰면 색상별로 파일을 분리한다

## 아이콘 처리

- 피그마에서 아이콘 구현 시 **반드시 피그마 API로 SVG를 직접 가져와** `app/src/main/res/drawable/ic_*.xml`로 생성
- 공용 UI 라이브러리에 동일 이름의 아이콘이 있어도 **디자인이 다를 수 있으니 그대로 쓰지 않는다** — 피그마 원본을 우선한다
- 항상 프로젝트 `R.drawable.ic_<name>`를 사용한다 (라이브러리 리소스 클래스의 아이콘 사용 금지)

## 피그마 작업

피그마 디자인 구현, 공용 컴포넌트 사용, 디자인 토큰(색상/폰트/간격) 매핑 작업은 **코드 작성 전에** `~/.claude/references/figma-guide.md` 전체를 읽는다 (공용 디자인 시스템 우선 사용 + 파싱·검증 규칙). 피그마 분석 서브에이전트를 띄울 때도 이 경로를 프롬프트에 넣어 에이전트가 직접 읽게 한다.
