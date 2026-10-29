> Codex 이식 기준: 이 문서의 플랫폼별 구현·DoD를 사용한다. 실행과 권한 규칙은 프로젝트 AGENTS.md 및 선택한 harness Skill을 따른다. verify.json은 `commands: [{name, command}]` 형식이다. 검증기는 자동 턴 종료 훅이 아니며 명시적으로 실행한다. 특정 버전·브랜치·프로젝트명은 실제 코드에서 재확인한다.

# @itandsy/react-common — 피그마 디자인 시스템 ↔ 코드 매핑

피그마 파일: `D-펫포션_디자인 시스템` (fileKey: `b40fvavILA2SJpQkH9lZO9`)

> 피그마 MCP로 디자인을 가져올 때, 아래 매핑을 참조하여 `@itandsy/react-common`의 기존 컴포넌트를 사용할 것.
> 새 컴포넌트를 만들지 말고, 매핑된 코드 컴포넌트를 import하여 사용할 것.

## Atoms — Button

| 피그마 컴포넌트 | 코드 export명 |
|---|---|
| `Button/Solid/Primary` | `SolidPrimary` |
| `Button/Outlined/Primary` | `OutlinedPrimary` |
| `Button/Outlined/Secondary` | `OutlinedSecondary` |
| `Button/Outlined/Assistive` | `OutlinedAssistive` |
| `Button/Text/Primary` | `TextPrimary` |
| `Button/Text/Assistive` | `TextAssistive` |
| `Button/Text/List` | `TextList` |
| `Button/Icon/Normal` | `IconNormal` |
| `Button/Icon/Background` | `IconBackground` |
| `Button/Icon/Outlined` | `IconOutlined` |
| `Button/Icon/Solid` | `IconSolid` |
| `Button/Floating Action` | `FloatingAction` |

## Atoms — Avatar

| 피그마 컴포넌트 | 코드 export명 |
|---|---|
| `Avatar/Person` | `Person` |
| `Avatar/Company` | `Company` |
| `Avatar/Academic` | `Academic` |
| `Avatar/Avatar Button` | `AvatarButton` |
| `Avatar/Avatar Group` | `AvatarGroup` |

## Atoms — Control

| 피그마 컴포넌트 | 코드 export명 |
|---|---|
| `Control/Checkbox` | `CheckBox` |
| `Control/Round Checkbox` | `RoundCheckBox` |
| `Control/Check` | `Check` |
| `Control/Input Check` | `InputCheck` |
| `Control/Radio` | `Radio` |
| `Control/Input Radio` | `InputRadio` |
| `Control/Switch` | `Switch` |
| `Control/Toggle Icon` | `ToggleIcon` |

## Atoms — Category

| 피그마 컴포넌트 | 코드 export명 |
|---|---|
| `Category/Chip` | `Chip` |
| `Category/Segment` | `Segment` |
| `Category/Tabs` | `Tabs` |

## Atoms — Indicator

| 피그마 컴포넌트 | 코드 export명 |
|---|---|
| `Indicator/Dot` | `DotIndicator` |
| `Indicator/Line` | `LineIndicator` |
| `Indicator/Number` | `NumberIndicator` |

## Atoms — Basic / Decorate / Gradient

| 피그마 컴포넌트 | 코드 export명 |
|---|---|
| `Basic/Divider` | `Divider` |
| `Basic/Tooltip` | `Tooltip` |
| `Decorate/Dimmer` | `Dimmer` |
| `Decorate/Interaction/Outline/Normal` | `Outline` |
| `Decorate/Opacity` | `Opacity` |
| `Decorate/Skeleton` | `Skeleton` |
| `Gradient/Solid` | `Solid` (gradient) |
| `Gradient/Multiple` | `Multiple` (gradient) |
| `Gradient/Mask` | `Mask` (gradient) |

## Atoms — 기타

| 피그마 컴포넌트 | 코드 export명 |
|---|---|
| `Badge` | `Badge` |
| `Badge/Push` | `Badge` (variant: push) |
| `Label` | `Label` |
| `Detail Card` | `DetailCard` |
| `Login` | `Login` |
| `Thumbnail` | `Thumbnail` |
| `Toast` | `Toast` |
| `Scroll Bar` | `Bar` (scroll) |

## Molecules — Button 조합

| 피그마 컴포넌트 | 코드 export명 |
|---|---|
| `Buttons/Login Button` | `LoginButton` |
| `Buttons/Special Button` | `SpecialButton` |
| `Buttons/Actions` | `Actions` |

## Molecules — Input

| 피그마 컴포넌트 | 코드 export명 |
|---|---|
| `Input/Select Box` | `SelectBox` |
| `Input/Combo Box` | `ComboBox` |
| `Input/Text Field` | `TextField` |
| `Input/Text Box` | `TextBox` |

## Molecules — Navigation / List / Option

| 피그마 컴포넌트 | 코드 export명 |
|---|---|
| `Navigation/Top Navigation` | `TopNavigation` |
| `List` | `List` |
| `Option` | `Option` |

## Molecules — Admin 컴포넌트

| 피그마 컴포넌트 | 코드 export명 |
|---|---|
| `Admin Card/Card` | `AdminCard` |
| `Admin Card/Content` | `AdminCardContent` |
| `Admin Edit` | `AdminEdit` |
| `Admin Menu/Menu` | `Menu` |
| `Admin Menu/Sub Menu` | `SubMenu` |
| `Admin Sub Title/Title` | `Title` (admin-sub-title) |
| `Admin Sub Title/Calender` | `Calendar` |
| `Admin Sub Title/Filter` | `Filter` |
| `Admin Sub Title/Sub Title Bar` | `SubTitleBar` |
| `Admin Title/Title Bar` | `TitleBar` |
| `Admin Title/Titles` | `Titles` |

## Molecules — Admin Table

| 피그마 컴포넌트 | 코드 export명 |
|---|---|
| `Admin Table/Title` | `Title` (admin-table) |
| `Admin Table/Description` | `Description` |
| `Admin Table/Row` | `Row` |
| `Admin Table/Cell` | `Cell` |
| `Admin Table/Card Title` | `CardTitle` |
| `Admin Table/Card Row` | `CardRow` |
| `Admin Table Indicator` | `AdminTableIndicator` |

## Organisms

| 피그마 컴포넌트 | 코드 export명 |
|---|---|
| `Admin Table/Table Card` | `AdminTableCard` |
| `Bottom Sheet` | `BottomSheet` |
| `Dialog` | `Dialog` |
| `Dropdown Menu` | `DropdownMenu` |
| `Admin Menus` | `AdminMenus` |
