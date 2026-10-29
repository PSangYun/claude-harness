> Codex 이식 기준: 이 문서의 플랫폼별 구현·DoD를 사용한다. 실행과 권한 규칙은 프로젝트 AGENTS.md 및 선택한 harness Skill을 따른다. verify.json은 `commands: [{name, command}]` 형식이다. 검증기는 자동 턴 종료 훅이 아니며 명시적으로 실행한다. 특정 버전·브랜치·프로젝트명은 실제 코드에서 재확인한다.

# ios-common — 피그마 디자인 시스템 ↔ 코드 매핑

- 저장소: `github.com/itandsy/ios-common` — SwiftPM 라이브러리, **import 시 모듈명 `ios_common`**, iOS 16+, 의존성 Kingfisher·MarkdownUI
- 피그마 파일: `D-펫포션_디자인 시스템` (fileKey: `b40fvavILA2SJpQkH9lZO9`)

> 피그마 MCP로 디자인을 가져올 때, ios-common의 기존 컴포넌트를 먼저 탐색하여 사용할 것.
> **새 컴포넌트를 만들지 말고**, 매핑된 기존 컴포넌트를 import하여 사용할 것.

## 컴포넌트 탐색 규칙

ios-common은 피그마 디자인 시스템과 동일한 아토믹 구조를 따른다:

```
Sources/ios-common/
├── component/
│   ├── atoms/      — avatar, badge, button, check, checkbox, chip, divider,
│   │                 gradient, indicator, label, logo, radio, skeleton,
│   │                 switch, tab, toast, toggleIcon
│   ├── molecules/
│   ├── organism/
│   └── common/
├── design/         — area(간격), color(색상 토큰), text(타이포그래피)
├── core/           — AppMsgState, SwipeState
└── utils/
```

- 피그마 컴포넌트 `Button/...` → `component/atoms/button/` 안의 기존 구현을 먼저 확인
- 색상·간격·폰트는 hex/숫자 하드코딩 금지 — `design/{color,area,text}`의 토큰 사용

## 소비 방식 주의 (공개 API 변경 시)

- ParkGolfIOS는 ios-common을 SPM으로 **브랜치 `1.0.0` 추적** 방식으로 소비한다 (semver 태그 잠금 아님).
- 즉 `1.0.0` 브랜치에 푸시하면 앱이 재-resolve 시 그대로 따라간다 — **공개 API 시그니처를 바꾸는 변경은 반드시 사용자 확인 후 진행**하고, 소비 앱(ParkGolfIOS) 빌드가 깨지지 않는지 확인할 것.
