# CLAUDE.md — ios-common

## 프로젝트 개요

- **iOS 공통 컴포넌트 라이브러리** — SwiftPM 패키지 (import 시 모듈명 `ios_common`), iOS 16+, swift-tools 6.1
- 의존성: Kingfisher, MarkdownUI
- 구조 (아토믹 디자인 — 피그마 디자인 시스템과 1:1 대응):
  ```
  Sources/ios-common/
  ├── component/{atoms, molecules, organism, common}
  ├── design/{area(간격), color(색상 토큰), text(타이포그래피)}
  ├── core/  utils/  Resources/  Assets.xcassets
  ```

## 빌드·검증

```bash
# 유일한 결정적 게이트 (테스트 타겟·린트 없음 — stop-gate가 자동 실행)
xcodebuild -scheme ios-common -destination 'generic/platform=iOS Simulator' build
```

- 테스트 타겟 없음 — 도입하려면 test-writer 에이전트 규칙 참조 (사용자 확인 후 `.testTarget` 추가)

## 핵심 규칙

1. ⚠️ **push가 곧 배포다** — ParkGolfIOS가 이 저장소를 SPM **브랜치 `1.0.0` 추적**으로 소비한다 (semver 태그 잠금 아님). 공개 API 변경과 `1.0.0` push는 반드시 `/publish` 절차(사용자 확인 게이트) 경유
2. **컴포넌트 추가/수정은 `/component` 커맨드 절차(DoD 포함)** — 기존 컴포넌트 중복 구현 금지, 피그마 변형 전수 반영
3. **디자인 값은 토큰만** — 색상·간격·폰트는 `design/{color,area,text}` 참조, hex/숫자 하드코딩 금지 (토큰이 없으면 토큰 추가를 먼저 제안)
4. **공개 API에는 `public` + 문서 주석(`///`) 필수**
5. 피그마 파일: `D-펫포션_디자인 시스템` (fileKey: `b40fvavILA2SJpQkH9lZO9`) — 값은 실측만, 추측 금지

## 프로젝트 루브릭

<!-- /maintain이 검사하는 이 저장소 고유 항목 -->
- 시뮬레이터 대상 빌드 성공
- 신규/변경 컴포넌트에 Preview 존재

## 반복되는 실수

<!-- 같은 실수가 재발하면 `### 제목 (YYYY-MM-DD)` 형식으로 추가.
     2회 이상 기록된 패턴은 .claude/hooks/quality-check.js 정규식 검사로 승격 제안 (글로벌 규약) -->
