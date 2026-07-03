---
description: 디자인 시스템 컴포넌트 구현/수정 (ios-common 전용) — 피그마 변형 전수 분석 → 토큰 기반 구현 → Preview. DoD 게이트 포함.
---

# /component — DS 컴포넌트 구현 (ios-common)

입력: 피그마 컴포넌트 URL + 분류(atoms/molecules/organism). ios-common은 소비 앱(ParkGolfIOS)이 **브랜치 `1.0.0` 추적**으로 쓰므로, 여기서의 공개 API 변경은 푸시 즉시 앱에 전파된다 — 이 커맨드의 최우선 안전 규칙이다.

## Phase A: 피그마 변형 전수 분석

1. 피그마 MCP로 컴포넌트의 **모든 변형(variant)·상태(state)·파라미터**를 전수 목록화: `파라미터 | 타입 | 값 목록 | 기본값`
2. 색상·간격·폰트는 실측 → `design/{color,area,text}` 기존 토큰과 매칭. **매칭되는 토큰이 없으면 하드코딩하지 말고 토큰 추가를 먼저 제안**
3. 애매한 동작(인터랙션·비활성 조건)은 추측하지 말고 사용자에게 질문

## Phase B: 기존 자산 확인

1. 같은/유사 컴포넌트가 `Sources/ios-common/component/{atoms,molecules,organism,common}`에 이미 있는지 확인 — 있으면 신규 대신 **변형 추가**로 접근
2. **기존 공개 API(public 시그니처) 변경이 필요하면 중단하고 사용자 확인** — 브랜치 추적 소비라 파괴적 변경이 즉시 전파됨. 변경 합의 시 소비 앱(ParkGolfIOS) 빌드 확인까지 계획에 포함
3. 네이밍·디렉토리 위치는 인접 컴포넌트 패턴을 따른다

## Phase C: 구현

- 분류에 맞는 디렉토리(`Sources/ios-common/component/<분류>/<이름>/`)에 작성
- 모든 값은 토큰 참조 — 신규 코드에 hex/숫자 리터럴 하드코딩 금지
- 공개 API에는 `public` + 문서 주석(///) 필수 (라이브러리 규칙)
- Phase A의 파라미터 전수를 시그니처에 반영, 합리적 기본값 제공

## Phase D: Preview

- 주요 변형 조합을 보여주는 `#Preview`(또는 PreviewProvider) 작성 — 변형별 렌더 확인

## Definition of Done

1. Phase A 변형 목록이 전수 구현됨 (목록 ↔ 시그니처/분기 대조 근거)
2. 신규 코드에 색상/간격/폰트 하드코딩 0건 — `design/{color,area,text}` 토큰만 사용
3. 기존 공개 API 시그니처 변경 없음 (변경했다면 사용자 승인 근거 + 소비 앱 빌드 확인 계획 명시)
4. 공개 API에 `public` 접근 제어 + 문서 주석 존재
5. 변형을 보여주는 Preview 존재
6. 빌드 성공: `xcodebuild -scheme ios-common -destination 'generic/platform=iOS Simulator' -quiet build` (실행 결과 근거)

> **완료 선언 전 checker 서브에이전트의 PASS 판정 필수.** `1.0.0` 브랜치로의 push는 사실상 배포다 — **사용자 확인 없이 push 금지** (`/publish` 참조).

$ARGUMENTS
