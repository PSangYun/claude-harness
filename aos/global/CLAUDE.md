# 글로벌 규칙

<!-- 코딩 스타일·응답 방식·파일 작업·보안·커밋 금지 규칙(4·7·8·9·12절)은 SessionStart 훅(hooks/inject-model-rules.js)이 모델에 맞는 판을 주입한다: sonnet 계열 → prompts/SONNET_STYLE_SYSTEM_PROMPT.md, 그 외 → prompts/OPUS_4_8_STYLE_SYSTEM_PROMPT.md. 여기에 중복 추가하지 말 것 -->

## 언어

- 항상 한국어로 답변
- 코드 주석은 한국어로 작성

## Git

- 커밋 메시지는 Conventional Commits 형식 사용

# 루프 운영 규약 (모든 프로젝트 공통)

## maker/checker 분리

- `/design`·`/logic`·`/connect-api` 등 구현 커맨드에 `Definition of Done` 섹션이 있으면, **완료 선언 전에 checker 서브에이전트의 PASS 판정이 필수**다. 구현한 쪽이 스스로 통과를 선언하지 않는다.
- checker는 판정만 한다 (수정 제안 금지). FAIL이면 maker가 수정 후 재판정, 최대 3회. 3회 후에도 FAIL이면 사용자에게 보고하고 멈춘다.
- 턴 종료 시 stop-gate 훅(`.claude/hooks/stop-gate.js`)이 변경 코드의 Kotlin 컴파일(compileDebugKotlin)/린트(설정 존재 시)를 자동 검증한다. 차단되면 에러를 수정한 후에만 완료를 선언할 수 있다.

## 무인 자동 수정 금지

- 루프(`/loop`, `/maintain`)는 **기계적 수정만** 한다 (포맷터, 명백한 금지 패턴 제거). 동작 변경·리팩토링·삭제는 보고만 하고 사람 판단에 맡긴다.
- 루프가 임의로 커밋/푸시하지 않는다.

## 학습 승격 파이프라인 (기록 → 규칙 → 자동화)

1. **세션 메모리**: 환경 quirk, 일회성 발견은 프로젝트 메모리에 기록
2. **프로젝트 CLAUDE.md**: 같은 실수가 재발하면 해당 프로젝트 CLAUDE.md의 `## 반복되는 실수` 섹션에 `### 제목 (YYYY-MM-DD)` 형식으로 추가
3. **훅 승격**: 같은 실수가 2회 이상 기록되면 그 프로젝트의 `.claude/hooks/quality-check.js`에 정규식 검사로 승격하여 편집 즉시 자동 차단 — 사용자에게 승격을 제안할 것

## 온보딩

- 새 프로젝트나 하네스 미적용 프로젝트를 만나면 `/harness-init` 실행을 제안한다.

# 코드 리뷰 작성 방식

PR/코드 리뷰 요청 시(예: "PR #N 리뷰해줘", `/review`) 아래 규칙을 따른다.

1. **인라인 코멘트가 기본.** 단순 텍스트 응답이나 PR 본문(이슈) 코멘트로 끝내지 않는다. `gh api -X POST repos/<owner>/<repo>/pulls/<n>/reviews`에 `commit_id`(head SHA) + `event: "COMMENT"` + `comments` 배열(`path`/`line`/`side: "RIGHT"`/`body`)을 한 번에 제출.
2. **라인 번호는 patch에서 직접 계산.** `gh api .../pulls/<n>/files`로 받은 `patch` 필드를 파싱해 hunk `@@ -A,B +C,D @@`의 새 라인 번호를 추적한다. `+`와 context 라인만 카운트, `-` 라인은 스킵.
3. **사람이 쓴 톤, 이모지 금지.** "~할 것 같습니다", "~어떠실까요", "확인 부탁드립니다" 같은 동료 개발자 톤. AI가 작성한 듯한 어색한 표현·이모지 절대 금지.
4. **단정이 아니라 제안.** "~해야 합니다"가 아니라 "~하는 게 좋아 보입니다", "~검토 부탁드립니다", "~방향 어떠실까요"처럼 제안형. 좋은 변경은 함께 칭찬한다.
5. **머지 커밋으로 들어온 파일은 인라인 불가.** dev 등에서 머지되어 들어온 파일은 GitHub API가 `Path could not be resolved`로 거부함. 이 경우 같은 PR에 별도 리뷰를 게시하되 본문에 `**파일경로:라인** — 내용` 형식으로 정리.
6. **에러 디버깅.** `Unprocessable Entity` + `Line/Path could not be resolved`가 떨어지면 코멘트 배열을 이등분/제외하며 실패 항목을 격리한다. 더미 코멘트("test", "dbg" 등)는 실제 PR에 절대 게시하지 않는다(분류기에서 차단되며 협업자에게 노이즈).
7. **리뷰 본문 제목.** 분할 제출하더라도 사용자에게 노출되므로 "리뷰 1/2" 같은 디버깅 흔적 대신 의미 있는 한 줄로.
8. **마지막 단계로 사용자에게 PR URL과 등록 결과(인라인 N건, 본문 정리 M건)를 요약해서 알린다.**

# Android 전용 규칙 (Android/Kotlin 프로젝트에서만 적용, iOS 프로젝트에서는 무시)

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
- 항상 프로젝트 `R.drawable.ic_<name>`를 사용한다

# 피그마 구현 워크플로우

## 피그마 API 호출

- 토큰: 환경변수 `$FIGMA_TOKEN`이 설정돼 있으면 사용한다. 없으면 사용자에게 토큰 설정(settings.json의 env 또는 셸 환경변수)을 안내한다
- API 호출 시 헤더: `X-Figma-Token: $FIGMA_TOKEN`

## 구현 전 기존 코드 참조 필수

새 화면이나 컴포넌트를 구현하기 **전에 반드시** 프로젝트 내 기존 구현 코드를 먼저 확인한다.

1. 동일하거나 유사한 컴포넌트(예: 카드·리스트 아이템·배너 등)가 다른 화면에 이미 구현되어 있는지 grep으로 확인
2. 있으면 **동일한 색상 토큰·스타일을 그대로 재사용** (Figma 에이전트 분석보다 기존 코드를 우선 신뢰)
3. 특히 프로젝트 커스텀 색·스타일 토큰은 아래 파싱 규칙만으로는 알 수 없으므로 반드시 기존 코드에서 확인한다

```
# 예시: 유사 컴포넌트 기존 구현 확인
grep -r "ComponentName\|tokenName" app/src/main/java/
```

**🚫 기존 코드에서 절대 재사용 금지: 크기·간격 값**
기존 코드 참조는 **색상 토큰과 스타일 토큰 확인 전용**이다. 아래 값은 화면마다 다를 수 있으므로 반드시 **구현 대상 피그마 노드**에서 직접 확인한다.

- 아이콘 크기 (`Modifier.size(...)`)
- padding / gap / margin 수치
- cornerRadius 수치
- 컴포넌트 내부 자식 요소의 크기

예: A 화면에서 아이콘이 20dp라도, B 화면의 동일 아이콘이 24dp일 수 있다. 기존 코드 값을 그대로 옮기면 안 된다.

## Figma 파싱 필수 규칙

**컴포넌트 Variant**
- `INSTANCE` 노드의 `componentProperties` 필드에 variant 값이 있으면 **반드시 해당 값을 그대로 사용**한다
- **🚫 절대 금지: 이미지나 색상을 보고 variant를 시각적으로 추측하는 것**
  - 예: 버튼이 파란색으로 보인다고 `Strong`으로 추측 → `componentProperties.Priority = 'Neutral'`이면 `Neutral`이 정답
- 확인 방법: 피그마 API 트리에서 해당 INSTANCE 노드의 `componentProperties`를 출력하여 `Priority`, `Size`, `Type` 등 variant 키를 직접 읽는다

**visible 필드**
- 노드의 `visible` 필드가 `false`인 요소는 구현하지 않는다
- Figma API 파싱 시 항상 `visible: false` 여부를 먼저 필터링한 뒤 구현 대상을 결정한다
- visible 확인 없이 노드 이름/텍스트만 보고 구현하면 안 된다

**fill 색상 — opacity와 boundVariables를 반드시 함께 확인**
- fill에 `opacity` 필드가 있어도 **절대 `.copy(alpha = ...)`로 직접 적용하지 않는다**
- fill의 `boundVariables.color.id`가 있으면 **반드시 해당 변수 ID로 Figma Variables API를 호출하여 변수명을 확인한다**
  - 조회 방법: `GET /v1/files/:file_key/variables/:variable_id` 또는 `GET /v1/files/:file_key/nodes?ids=<variable_node_id>`
  - 응답의 `name` 필드(예: `Label/Neutral`, `Label/Alternative`)를 확인한다
  - 확인한 변수명 → 프로젝트/디자인시스템의 대응 토큰으로 변환한다
- **🚫 절대 금지 — 아래 행위는 규칙 위반이다:**
  - RGB 수치(rgba 값)만 보고 토큰을 추측하는 것
  - 이전 화면에서 같은 rgba 값을 봤다고 동일 토큰으로 가정하는 것
  - API 조회 없이 에이전트가 자체 판단으로 토큰명을 결정하는 것
- Figma 에이전트에게 분석을 요청할 때 **반드시 프롬프트에 명시한다**: "boundVariables.color.id가 있는 모든 노드에 대해 Figma Variables API를 호출하여 변수명을 확인한 후 토큰을 매핑하라"
- 토큰이 확인된 경우 **토큰을 그대로 사용**하고 opacity는 무시한다
- 트리 파싱 스크립트에서 fill 출력 시 raw 색상값뿐 아니라 **opacity 값과 boundVariables color ID**를 반드시 함께 출력한다

**텍스트 스타일 ID — 화면(노드)별 개별 확인**
- 하나의 화면 데이터만 분석하고 다른 화면에 동일한 스타일을 가정하지 않는다
- 텍스트 노드의 `styles.text` ID는 화면마다 다를 수 있으므로 구현 대상 화면의 노드를 직접 조회한다
- 조회한 노드의 `name`에서 스타일명(예: `Heading 5/Regular`)을 확인해 프로젝트의 대응 타이포 토큰으로 매핑한다. 수치(`fontSize`/`fontWeight`)로 토큰을 추측하지 않는다

**텍스트 노드 lineTypes**
- 텍스트 노드에 `lineTypes` 필드가 있으면 반드시 확인한다
- `lineTypes` 배열에 `"UNORDERED"`가 있으면 → 불릿 리스트(`•`)로 구현한다
- `lineTypes` 배열에 `"ORDERED"`가 있으면 → 번호 리스트(`1. 2. 3.`)로 구현한다
- `lineTypes`를 확인하지 않고 단순 `Text`에 `\n`으로 이어붙이면 안 된다
- 트리 파싱 스크립트에서 텍스트 노드 출력 시 `lineTypes`, `lineIndentations` 필드를 반드시 함께 출력한다

**아이콘 컴포넌트 색상 파싱**
- 피그마 Icon 컴포넌트 내부에는 Vector 레이어와 Color 오버레이 레이어가 별도로 존재한다
- Vector 레이어의 fill color만 보고 tint를 결정하면 안 된다
- **"Color"라는 이름의 RECTANGLE 레이어**가 있으면 그 레이어의 boundVariables → 토큰이 실제 렌더링 색상이다
- Compose `Icon`의 `tint` 파라미터에는 Color 오버레이 레이어의 토큰을 사용한다

## 구현/수정 후 검증 (필수)

피그마를 참조한 **구현 또는 수정 작업 완료 후 반드시 아래 순서대로 검증한다.**

**Step 1 — 피그마 스크린샷 비교**
1. 구현 대상 피그마 노드의 이미지를 API로 export한다 (`GET /v1/images/:file_key?ids=<node_id>&format=png`)
2. export된 이미지를 Read 도구로 열어 시각적으로 구현 결과와 비교한다
3. 레이아웃 구조, 컴포넌트 배치, 전체적인 비율이 일치하는지 눈으로 확인한다

**Step 2 — 피그마 API 데이터 재조회 대조**
1. 구현 대상 노드를 피그마 API로 재조회한다
2. 아래 항목을 코드와 1:1로 대조한다:
   - 색상 (fill, stroke, background)
   - 간격 (padding, gap, margin)
   - 폰트 (style ID 조회 후 토큰 매핑)
   - 레이아웃 정렬 (`layoutMode`, `primaryAxisAlignItems`, `counterAxisAlignItems`, `itemSpacing` — 시각적으로 추측 금지, API 값으로만 결정)
   - 컴포넌트 타입 및 variant
   - visible 여부
   - effects (DROP_SHADOW, INNER_SHADOW, LAYER_BLUR 등 — visible: true인 것만 구현)

**Step 3 — 불일치 즉시 수정**
- Step 1 또는 Step 2에서 불일치가 발견되면 사용자에게 묻지 않고 즉시 수정한다
- 수정 후 Step 1부터 재검증한다
- 모든 항목이 일치할 때만 "완료"로 마무리한다
