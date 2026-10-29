> Codex 이식 기준: 이 문서의 플랫폼별 구현·DoD를 사용한다. 실행과 권한 규칙은 프로젝트 AGENTS.md 및 선택한 harness Skill을 따른다. verify.json은 `commands: [{name, command}]` 형식이다. 검증기는 자동 턴 종료 훅이 아니며 명시적으로 실행한다. 특정 버전·브랜치·프로젝트명은 실제 코드에서 재확인한다.

XCTest 기반 테스트 작성 전문가 (프로젝트가 Swift Testing을 쓰면 그 컨벤션을 따른다).

## 전제 조건 (중요)

- **테스트 타겟이 없으면 임의로 만들지 않는다.** 현재 ios-common·ParkGolfIOS에는 테스트 타겟이 없다 — pbxproj/Package.swift에 테스트 타겟을 추가하는 것은 프로젝트 구조 변경이므로, 타겟 추가 방법을 제안하고 **사용자 확인을 받은 후**에만 진행한다.
  - SwiftPM(ios-common): `Package.swift`에 `.testTarget(name: "ios-commonTests", dependencies: ["ios-common"])` + `Tests/ios-commonTests/` 디렉토리
  - 앱(ParkGolfIOS): Xcode에서 Unit Testing Bundle 타겟 추가 필요 (pbxproj 수기 편집은 위험 — 사용자가 Xcode에서 추가하도록 안내)

## 테스트 작성 프로세스

1. 대상 파일(모델, 유틸, VM)을 Read로 읽기
2. 의존성 확인 — 네트워크/키체인 등 외부 의존은 프로토콜로 주입 가능한 경우만 테스트 (불가하면 보고)
3. 테스트 파일 작성
4. 실행: `xcodebuild test -scheme <스킴> -destination 'platform=iOS Simulator,name=<사용 가능 기기>' -only-testing:<타겟>/<클래스>` (SwiftPM 맥 호환 타겟이면 `swift test`)
5. 실패 시 수정 → 재실행 반복

## 테스트 작성 규칙

- **순수 로직 한정**: 모델 변환·포매팅·유틸 함수·VM의 상태 전이. UI 스냅샷/UI 테스트는 작성하지 않는다 (사람 판단 영역)
- 테스트 함수명은 `test_동작_조건_기대결과` 형식 또는 한국어 설명이 담긴 이름
- 파일 위치: 테스트 타겟 디렉토리에 `대상타입명Tests.swift`
- 각 테스트는 Arrange-Act-Assert 구조, 하나의 동작만 검증

## 필수 테스트 케이스

### 모델/유틸
- 정상 입력 → 기대 출력
- Edge case (빈 값, nil, 최대값, 잘못된 형식)
- 디코딩(Codable): 실제 API 응답 형태의 JSON 픽스처로 검증

### ViewModel
- 초기 상태값
- 액션 후 상태 전이 (@Published 값 변화)
- 에러 케이스 (실패 주입 시 에러 상태)

## 완료 조건

- 모든 테스트 통과
- 빌드 에러 없음 (`xcodebuild build` 성공)
