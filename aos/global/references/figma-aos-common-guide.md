# 피그마 · aos-common 구현 가이드 (매핑 테이블 + 파싱·검증 규칙)

> 이 파일은 글로벌 CLAUDE.md에서 분리된 참조 문서다. 피그마 디자인 구현, aos-common 컴포넌트 사용,
> 디자인 토큰(색상/폰트/간격) 매핑 작업 시 **코드 작성 전에 반드시 전체를 읽는다.**
> 피그마 분석 서브에이전트를 띄울 때도 이 파일 경로를 프롬프트에 포함시켜 에이전트가 직접 읽게 한다.

# aos-common — 피그마 디자인 시스템 ↔ 코드 매핑

- 저장소: `github.com/itandsy/aos-common` — GitHub Packages 배포 `com.itappandsy:aos-common` (모듈 `:AosCommon`, namespace `com.itappandsy.aoscommon`)
- 피그마 파일: `D-펫포션_디자인 시스템` (fileKey: `b40fvavILA2SJpQkH9lZO9`)

> 피그마 MCP로 디자인을 가져올 때, aos-common의 기존 컴포넌트를 먼저 확인하여 사용할 것.
> **새 컴포넌트를 만들지 말고**, 기존 컴포넌트를 import하여 사용할 것.
> **API 확인은 소스 탐색보다 `AOS_COMMON_GUIDE.md`를 먼저 볼 것** (사용처 저장소에 사본이 있음 — 단, 사본 버전이 라이브러리 최신과 다를 수 있으니 버전 표기를 확인).

## aos-common 자동 사용 (필수)

피그마 디자인 구현 요청을 받으면 **구현 시작 전에 반드시** 다음을 확인한다.

1. 프로젝트의 `build.gradle` 또는 `build.gradle.kts`에서 `aos-common` 의존성 포함 여부를 grep으로 확인한다
2. **aos-common이 연동되어 있으면** 사용자가 별도로 언급하지 않아도 아래 매핑 테이블의 컴포넌트를 우선 사용한다
3. aos-common이 없는 프로젝트에서만 직접 구현한다

```
# 확인 명령 예시
grep -r "aos-common\|aoscommon\|itappandsy" app/build.gradle* settings.gradle*
```

## 컴포넌트 탐색 규칙

aos-common은 피그마 디자인 시스템과 동일한 아토믹 구조를 따른다 (`com.itappandsy.aoscommon.common` 하위):

```
component/
├── atoms/      — avatar, badge, button, category/{chip, segment, tabs},
│                 check, checkbox, decorate, divider, icon, indicator,
│                 label, radio, scrollbar, switch, thumbnail, toast,
│                 toggle, tooltip
├── molecules/  — actions, keyboard, login, navigation, textBox
└── organisms/  — bottomsheet, dialog, list
ui/theme/       — Area.kt(간격), Color.kt(색상 토큰), Font.kt, Opacity.kt
```

- 피그마 컴포넌트 `Button/...` → `component/atoms/button/` 안의 기존 구현을 먼저 확인
- 색상 hex·치수 하드코딩 금지 — `ui/theme`의 토큰 사용 (초기화는 `initPrimaryColor` 등 가이드 참조)

## 배포·소비 방식 주의 (공개 API 변경 시)

- **공개 API(컴포저블 파라미터) 변경은 반드시 사용자 확인 후 진행** — 소비 앱이 버전 고정으로 쓰므로 파괴적 변경은 업그레이드를 막는다.
- 라이브러리 수정 후 배포 절차: 버전 갱신 → `AOS_COMMON_GUIDE.md` 갱신 → `./gradlew :AosCommon:publishReleasePublicationToGitHubPackagesRepository` → `feat: x.y.z publish` 커밋 (aos-common CLAUDE.md의 Publish 절차 준수)
- 소비 앱(예: ParkGolfAOS)은 `implementation("com.itappandsy:aos-common:x.y.z")` 버전 고정 — 라이브러리 publish 후 **앱의 버전과 가이드 사본을 함께 갱신**해야 드리프트가 안 생긴다.
- 빌드에는 GitHub Packages 자격증명 필요: `local.properties`의 `gpr.user`/`gpr.key` (또는 env `GPR_USER`/`GPR_KEY`) — 없으면 sync 자체가 실패한다.

# 피그마 구현 워크플로우

## 피그마 API 호출

- 토큰: 환경변수 `$FIGMA_TOKEN`이 설정돼 있으면 사용한다. 없으면 사용자에게 토큰 설정(셸 환경변수 또는 `~/.claude/settings.json`의 `env`)을 안내한다. 토큰 값은 파일·로그·보고에 적지 않는다
- API 호출 시 헤더: `X-Figma-Token: $FIGMA_TOKEN`

## 구현 전 기존 코드 참조 필수

새 화면이나 컴포넌트를 구현하기 **전에 반드시** 프로젝트 내 기존 구현 코드를 먼저 확인한다.

1. 동일하거나 유사한 컴포넌트(예: PointCard, LottoBall, BannerCard)가 다른 화면에 이미 구현되어 있는지 grep으로 확인
2. 있으면 **동일한 색상 토큰·스타일을 그대로 재사용** (Figma 에이전트 분석보다 기존 코드를 우선 신뢰)
3. 특히 `bannerBlue`, `primaryNormal` 등 **프로젝트 커스텀 토큰**은 이 가이드의 매핑 테이블에 없으므로 반드시 기존 코드에서 확인

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

예: `GiftScreen`에서 아이콘이 20dp라도, `GiftExchangeScreen`의 동일 아이콘이 24dp일 수 있다. 기존 코드 값을 그대로 옮기면 안 된다.

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
  - 확인한 변수명 → 토큰 매핑 테이블에서 aos-common 토큰으로 변환 (예: `Label/Neutral` → `labelNeutral`)
- **🚫 절대 금지 — 아래 행위는 규칙 위반이다:**
  - RGB 수치(rgba 값)만 보고 토큰을 추측하는 것 (`r=0.18, g=0.18` → `labelAlternative` 같은 추측)
  - 이전 화면에서 같은 rgba 값을 봤다고 동일 토큰으로 가정하는 것
  - API 조회 없이 에이전트가 자체 판단으로 토큰명을 결정하는 것
- Figma 에이전트에게 분석을 요청할 때 **반드시 프롬프트에 명시한다**: "boundVariables.color.id가 있는 모든 노드에 대해 Figma Variables API를 호출하여 변수명을 확인한 후 토큰을 매핑하라"
- 토큰이 확인된 경우 **토큰을 그대로 사용**하고 opacity는 무시한다
- 트리 파싱 스크립트에서 fill 출력 시 raw 색상값뿐 아니라 **opacity 값과 boundVariables color ID**를 반드시 함께 출력한다

**텍스트 스타일 ID — 화면(노드)별 개별 확인**
- 하나의 화면 데이터만 분석하고 다른 화면에 동일한 스타일을 가정하지 않는다
- 텍스트 노드의 `styles.text` ID는 화면마다 다를 수 있으므로 구현 대상 화면의 노드를 직접 조회한다

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

# Figma → aos-common 컴포넌트 매핑

피그마에서 아래 컴포넌트 이름이 보이면 반드시 aos-common의 대응 컴포넌트를 사용한다.

**⚠️ 절대 규칙: 직접 구현 전에 반드시 아래 매핑 테이블을 먼저 확인한다.**
- 피그마 노드의 컴포넌트 이름을 그대로 테이블에서 찾는다
- "이건 라디오 버튼이다", "이건 다른 패턴이다" 등 임의로 재해석하지 않는다
- 테이블에 없을 때만 직접 구현을 고려한다
- 버튼 순서·텍스트가 디자인과 달라도 매핑 컴포넌트를 우선 사용한다 (직접 구현 금지)

**🚫 Figma 에이전트 출력을 그대로 신뢰 금지**
- Figma 에이전트가 내부 구조(`CommonSolidButton`, `TextButton` 등)를 분해해서 보고하더라도, **코드 작성 전에 반드시 부모 컴포넌트 이름을 매핑 테이블과 먼저 대조한다**
- 에이전트가 "메인 버튼 → CommonSolidButton, 서브 버튼 → TextButton"으로 분해했어도, 피그마 노드 이름이 `Actions/Buttons`이면 → `ActionsButtons`를 사용한다
- 에이전트 출력은 참고용이고, 매핑 테이블이 최우선이다

## Navigation

| Figma | aos-common |
|---|---|
| `Navigation/Top Navigation` (Variant: Title Back / Title Close / Logo / TextField) | `CommonTopNavigation(navigationType=TITLEBACK/TITLECLOSE/LOGO/TEXTFIELD)` |

## Atoms - Button

| Figma | aos-common |
|---|---|
| `Button/Solid` (Large/Medium/Small, Primary/Secondary/Assistive) | `CommonSolidButton(size=LARGE/MEDIUM/SMALL)` |
| `Button/Outlined` (Large/Medium/Small, Primary/Secondary/Assistive) | `CommonOutlinedButton(size=LARGE/MEDIUM/SMALL, backgroundColor, cornerRadius)` |
| `Button/Text List` | `CommonTextListButton` |
| `Button/Text` | `TextButton` |

## Atoms - Icon

| Figma | aos-common |
|---|---|
| `Button/Icon/Normal` / `Icon/Normal/*` | `IconNoraml(icon, size, color, onClick)` |
| `Button/Icon/Outlined` | `IconOutlined` |
| `Button/Icon/Background` | `IconBackground` |

## Atoms - Label / Badge / Chip / Segment / Switch / Divider

| Figma | aos-common |
|---|---|
| `Label` (XSmall/Small/Medium, Outlined/Filled, Neutral/Accent) | `CommonLabel(labelSize, labelType, labelColor)` |
| `Badge/Push` (Dot/New/Number, Default/Red) | `Badge(variant, color)` |
| `Category/Chip` (Medium/Small, Outline/Select) | `CommonChip(size, variant, rightIcon)` |
| `Category/Segment` | `CommonSegment` |
| `Basic/Divider` | `CommonDivider(variant=Normal/Thick)` |
| `Toggle/Switch` | `CommonSwitch` |

## Atoms - CheckBox

| Figma | aos-common |
|---|---|
| `Input/Checkbox` (Square, with label text) | `InputCheckBox(size=Small/Medium/Large, text, checked)` |
| `Input/CheckBox` (Round, with label text) | `InputRoundCheckBox` |
| `CheckBox` (Square, standalone) | `CommonCheckBox` |
| `CheckBox` (Round, standalone) | `CommonRoundCheckBox` |

## Molecules

| Figma | aos-common |
|---|---|
| `Actions/Buttons` (Strong/Neutral/Compact) | `ActionsButtons(priority=Strong/Neutral)` / `ActionsCompactButton` |
| `Input/Text Field` | `CommonTextField(size, state)` |
| `Input/Text Box` | `CommonTextBox` |
| `Login/Buttons` | `LoginButtons(onKakaoClick, onNaverClick, onGoogleClick)` |

## Organisms

| Figma | aos-common |
|---|---|
| `Dialog` | `CommonDialog` |
| `Bottom Sheet` | `BottomSheetDialog` / `BottomSheetContent` |
| `List/Select Button` | `CommonListSelectBtn` |

## 폰트 토큰 (Font.kt)

피그마에서 텍스트 스타일명이 보이면 아래 aos-common 토큰을 사용한다. Bold=SemiBold(600), Medium=Medium(500), Regular=Regular(400).

**⚠️ 폰트 토큰 파싱 규칙: Figma API 텍스트 노드에서 `fontSize`/`fontWeight` 수치를 직접 쓰지 않는다.**
1. 텍스트 노드의 `styles.text` 필드가 있으면 해당 스타일 ID로 추가 API 조회를 반드시 한다.
2. 조회한 노드의 `name`에서 스타일명(예: `Heading 5/Regular`)을 확인한다.
3. 아래 테이블에서 매핑하여 aos-common 토큰(`heading5Regular`)을 `style =` 파라미터에 사용한다.
4. `styles.text`가 없을 때만 수치 직접 사용을 고려한다.

**🚫 절대 금지: 수치 추측 매핑**
- `14px + Medium` → `body2NormalMedium` 같은 추측 금지 (실제로는 `label1NormalMedium`일 수 있음)
- `22px + SemiBold` → `heading3Bold` 같은 추측 금지 (실제로는 `heading4Bold`일 수 있음)
- 수치가 같아도 스타일명이 다르면 다른 토큰이다. 반드시 style ID 조회 후 매핑한다.

| Figma 스타일 | aos-common (Bold / Medium / Regular) |
|---|---|
| `Display1` | `display1Bold` / `display1Medium` / `display1Regular` |
| `Display2` | `display2Bold` / `display2Medium` / `display2Regular` |
| `Heading1` | `heading1Bold` / `heading1Medium` / `heading1Regular` |
| `Heading2` | `heading2Bold` / `heading2Medium` / `heading2Regular` |
| `Heading3` | `heading3Bold` / `heading3Medium` / `heading3Regular` |
| `Heading4` | `heading4Bold` / `heading4Medium` / `heading4Regular` |
| `Heading5` | `heading5Bold` / `heading5Medium` / `heading5Regular` |
| `Subtitle1` | `subtitle1Bold` / `subtitle1Medium` / `subtitle1Regular` |
| `Subtitle2` | `subtitle2Bold` / `subtitle2Medium` / `subtitle2Regular` |
| `Body1/Normal` | `body1NormalBold` / `body1NormalMedium` / `body1NormalRegular` |
| `Body1/Reading` | `body1ReadingBold` / `body1ReadingMedium` / `body1ReadingRegular` |
| `Body2/Normal` | `body2NormalBold` / `body2NormalMedium` / `body2NormalRegular` |
| `Body2/Reading` | `body2ReadingBold` / `body2ReadingMedium` / `body2ReadingRegular` |
| `Label1/Normal` | `label1NormalBold` / `label1NormalMedium` / `label1NormalRegular` |
| `Label1/Reading` | `label1ReadingBold` / `label1ReadingMedium` / `label1ReadingRegular` |
| `Label2` | `label2Bold` / `label2Medium` / `label2Regular` |
| `Caption1` | `caption1Bold` / `caption1Medium` / `caption1Regular` |
| `Caption2` | `caption2Bold` / `caption2Medium` / `caption2Regular` |
| `Caption3` | `caption3Bold` / `caption3Medium` / `caption3Regular` |

## 색상 토큰 (Color.kt)

피그마에서 색상 변수명이 보이면 아래 aos-common 토큰을 사용한다. 색상 하드코딩 금지.

**Primary**

| Figma 토큰 | aos-common |
|---|---|
| `Primary/Normal` | `primaryNormal` (앱 시작 시 `initPrimaryColor(hex)`로 설정) |
| `Primary/Strong` | `primaryStrong` |
| `Primary/Heavy` | `primaryHeavy` |

**Label**

| Figma 토큰 | aos-common |
|---|---|
| `Label/Normal` | `labelNormal` |
| `Label/Strong` | `labelStrong` |
| `Label/Neutral` | `labelNeutral` |
| `Label/Alternative` | `labelAlternative` |
| `Label/Assistive` | `labelAssistive` |
| `Label/Disable` | `labelDisable` |

**Line**

| Figma 토큰 | aos-common |
|---|---|
| `Line/Normal/Normal` | `lineNormalNormal` |
| `Line/Normal/Neutral` | `lineNormalNeutral` |
| `Line/Normal/Alternative` | `lineNormalAlternative` |
| `Line/Normal/Strong` | `lineNormalStrong` |
| `Line/Solid/Normal` | `lineSolidNormal` |
| `Line/Solid/Neutral` | `lineSolidNeutral` |
| `Line/Solid/Alternative` | `lineSolidAlternative` |
| `Line/Solid/Strong` | `lineSolidStrong` |

**Background**

| Figma 토큰 | aos-common |
|---|---|
| `Background/Normal/Assistive` | `backgroundNormalAssistive` |
| `Background/Normal/Alternative` | `backgroundNormalAlternative` |
| `Background/Elevated/Alternative` | `backgroundElevatedAlternative` |

**⚠️ 흰색 배경 varID 규칙**
- Figma fill의 `boundVariables.color.id`가 `VariableID:080448dc88a7728d07bade89d13e5cd5ba59ffb5/...` 형태이면 → `Color.White` (순수 흰색)
- 이 varID는 토큰 테이블에 없지만, rgb(255,255,255) = 흰색이므로 `Color.White`로 매핑한다
- **루트 프레임 배경색 반드시 적용**: 화면 구현 시 루트 프레임(최상위 FRAME 노드)의 fill을 확인하여 Root Column에 해당 배경색을 적용한다
- **`weight(1f)` + 배경색 조합 금지**: 섹션 배경은 해당 섹션의 자연 크기에만 적용하고, `weight(1f)` Column에 배경을 채우지 않는다 (빈 공간까지 색이 번짐)

**⚠️ 배경색 토큰 검증 필수 규칙**
피그마 API 분석 에이전트가 VariableID → 토큰명을 잘못 매핑하는 경우가 있다. 배경색 토큰 적용 전 반드시 아래를 확인한다:

1. **export된 피그마 이미지를 눈으로 확인한다.** 배경이 흰색으로 보이면 `Color.White`를 사용한다. `backgroundNormalAssistive` 같은 토큰을 맹목적으로 따르지 않는다.
2. **VariableID가 동일한데 토큰명이 다르게 표기된 경우** → 에이전트 오류로 간주하고 이미지 기준으로 판단한다.
3. 배경색이 명백히 흰색인 화면에 `backgroundNormalAssistive`, `backgroundNormalAlternative` 등을 사용하지 않는다.

배경색 적용 우선순위:
- 디자인 이미지 확인 → 흰색이면 `Color.White`
- 밝은 회색/오프화이트면 → `backgroundNormalAlternative`
- 토큰명이 이미지와 일치할 때만 해당 토큰 사용

**Status**

| Figma 토큰 | aos-common |
|---|---|
| `Status/Positive` | `statusPositive` |
| `Status/Cautionary` | `statusCautionary` |
| `Status/Negative` | `statusNegative` |
| `Status/Information` | `statusInformation` |

**Fill / Material**

| Figma 토큰 | aos-common |
|---|---|
| `Fill/Normal` | `fillNormal` |
| `Fill/Strong` | `fillStrong` |
| `Fill/Alternative` | `fillAlternative` |
| `Material/Dimmer` | `materialDimmer` |

**Interaction**

| Figma 토큰 | aos-common |
|---|---|
| `Interaction/Inactive` | `interactionInactive` |
| `Interaction/Disable` | `interactionDisable` |

## 디자인 토큰 (Area.kt)

피그마에서 토큰명이 보이면 아래 aos-common 토큰을 사용한다. AppResponsive 토큰은 폰/태블릿 반응형이므로 dp 하드코딩 금지.

**디자인 토큰 사용 강제 규칙 — 모든 padding/spacing/radius/color 값에 대해, 숫자를 코드에 쓰기 전에 반드시 피그마 노드의 토큰명을 먼저 확인한다.**

판단 기준:
1. 피그마 노드에 토큰명이 있음 → 아래 테이블에서 대응하는 aos-common 토큰 사용
2. 피그마 노드에 토큰 없이 숫자만 있음 → `.dp` 하드코딩

**🚫 절대 금지: 수치로 토큰 추측**
- 피그마 에이전트가 수치(예: 20dp)만 반환했을 때, 그 수치와 같은 다른 토큰(`appResTop` = 20dp)을 임의로 선택하면 안 된다
- 수치가 같아도 토큰이 다르면 반응형 동작이 달라진다 (`appResTop`은 태블릿에서 32dp, `spaceDefault`는 고정 20dp)
- 에이전트가 토큰명을 반환하지 않았으면 피그마 노드를 **직접 재조회**해서 토큰명을 확인한다
- "아마 이 토큰일 것이다" 식의 추측은 절대 금지. 반드시 피그마 노드에서 확인 후 적용한다

숫자가 같아도 피그마 토큰명이 다르면 다른 aos-common 토큰이다. 예시:
- 8dp인데 피그마 토큰이 `Space/Button Vertical` → `spaceButtonVertical`
- 8dp인데 피그마 토큰 없음 → `8.dp`
- 16dp인데 피그마 토큰이 `AppResponsive/Margin` → `appResMargin`
- 16dp인데 피그마 토큰이 `Space/Control` → `spaceControl`
- 32dp인데 피그마 토큰이 `AppResponsive/Top Title` → `appResTopTitle`

**AppResponsive (반응형, 폰→태블릿)**

| Figma 토큰 | aos-common | 값 |
|---|---|---|
| `AppResponsive/Margin` | `appResMargin` | 16dp → 24dp |
| `AppResponsive/Bottom` | `appResBottom` | 32dp → 48dp |
| `AppResponsive/Top` | `appResTop` | 20dp → 32dp |
| `AppResponsive/Top Title` | `appResTopTitle` | 32dp → 48dp |
| `AppResponsive/Top Add Navigation` | `appResTopAddNavigation` | 88dp → 104dp |
| `AppResponsive/Gutter Horizontal` | `appResGutterHorizontal` | 8dp → 16dp |
| `AppResponsive/Gutter Vertical` | `appResGutterVertical` | 20dp → 28dp |

**Space (고정)**

| Figma 토큰 | aos-common | 값 |
|---|---|---|
| `Space/Default` | `spaceDefault` | 20dp |
| `Size/Divider` | `sizeDivider` | 24dp |
| `Space/Control` | `spaceControl` | 16dp |
| `Space/Button Icon` | `spaceButtonIcon` | 16dp |
| `Space/Button Vertical` | `spaceButtonVertical` | 8dp |

**Radius**

| Figma 토큰 | aos-common | 값 |
|---|---|---|
| `Radius/Thumbnail` | `radiusTunmbnail` | 12dp |
| `Radius/Dialog` | `radiusDialog` | 12dp |
| `Radius/Bottom Sheet` | `radiusBottomSheet` | 12dp |
| `Radius/Dropdown` | `radiusDropDown` | 12dp |
| `Radius/Toast` | `radiusToast` | 8dp |
