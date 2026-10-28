# 피그마 구현 가이드 (공용 디자인 시스템 사용 + 파싱·검증 규칙)

> 이 파일은 글로벌 CLAUDE.md에서 분리된 참조 문서다. 피그마 디자인 구현, 공용 컴포넌트 라이브러리 사용,
> 디자인 토큰(색상/폰트/간격) 매핑 작업 시 **코드 작성 전에 반드시 전체를 읽는다.**
> 피그마 분석 서브에이전트를 띄울 때도 이 파일 경로를 프롬프트에 포함시켜 에이전트가 직접 읽게 한다.

# 공용 디자인 시스템 우선 사용

프로젝트가 사내·공용 컴포넌트 라이브러리(디자인 시스템 모듈)를 의존하고 있으면, 피그마 디자인 구현 요청을 받았을 때 **구현 시작 전에 반드시** 다음을 확인한다.

1. `build.gradle(.kts)`·`settings.gradle(.kts)`에서 디자인 시스템 라이브러리/모듈 의존 여부를 grep으로 확인한다 (프로젝트 CLAUDE.md에 라이브러리 이름이 적혀 있으면 그것을 기준으로)
2. **연동되어 있으면** 사용자가 별도로 언급하지 않아도 그 라이브러리의 컴포넌트와 테마 토큰(색상·폰트·간격)을 우선 사용한다. 새 컴포넌트를 만들지 말고 기존 컴포넌트를 import한다
3. API 확인은 소스 탐색보다 라이브러리 가이드 문서(프로젝트에 사본이 있으면 그것 — 버전 표기가 의존 버전과 같은지 확인)를 먼저 본다
4. 라이브러리가 없는 프로젝트에서만 직접 구현한다

**피그마 ↔ 컴포넌트 매핑표가 있으면 (프로젝트 CLAUDE.md·라이브러리 가이드)**
- 피그마 노드의 컴포넌트 이름을 그대로 매핑표에서 찾는다. "이건 라디오 버튼이다" 식으로 임의로 재해석하지 않는다
- 표에 없을 때만 직접 구현을 고려한다. 버튼 순서·텍스트가 디자인과 달라도 매핑된 컴포넌트를 우선 사용한다
- Figma 에이전트가 내부 구조(하위 버튼·텍스트 등)를 분해해서 보고하더라도, **코드 작성 전에 부모 컴포넌트 이름을 매핑표와 먼저 대조한다** — 에이전트 출력은 참고용이고 매핑표가 최우선이다

# 피그마 구현 워크플로우

## 피그마 API 호출

- 토큰: 환경변수 `$FIGMA_TOKEN`이 설정돼 있으면 사용한다. 없으면 사용자에게 토큰 설정(셸 환경변수 또는 `~/.claude/settings.json`의 `env`)을 안내한다. 토큰 값은 파일·로그·보고에 적지 않는다
- API 호출 시 헤더: `X-Figma-Token: $FIGMA_TOKEN`

## 구현 전 기존 코드 참조 필수

새 화면이나 컴포넌트를 구현하기 **전에 반드시** 프로젝트 내 기존 구현 코드를 먼저 확인한다.

1. 동일하거나 유사한 컴포넌트(예: 카드·리스트 아이템·배너 등)가 다른 화면에 이미 구현되어 있는지 grep으로 확인
2. 있으면 **동일한 색상 토큰·스타일을 그대로 재사용** (Figma 에이전트 분석보다 기존 코드를 우선 신뢰)
3. 특히 **프로젝트 커스텀 색·스타일 토큰**은 디자인 시스템 매핑표나 아래 파싱 규칙만으로는 알 수 없으므로 반드시 기존 코드에서 확인

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
  - 확인한 변수명 → 프로젝트/디자인 시스템의 대응 토큰으로 변환 (예: `Label/Neutral` → `labelNeutral`)
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
