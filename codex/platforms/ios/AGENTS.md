### iOS

- SwiftUI/UIKit, Observation/ObservableObject, MVVM 등 구조는 실제 프로젝트의 선택을 따른다. 새 프레임워크나 화면 구조를 강제하지 않는다.
- UI 작업에서는 기존 컴포넌트·Asset Catalog·디자인 토큰을 확인한다. Preview가 가능한 구성에서만 해당 검증을 사용한다.
- workspace/project·scheme·destination·서명 정책을 실측해 verify.json에 설정한다. Xcode 없는 머신은 빌드 미검증이다.
- 순수 Swift 패키지·서버·CLI는 generic 구성을 사용하고 해당 패키지의 실제 검증 명령을 설정할 수 있다.
- 공개 API 수정 시 소비 방식·지원 OS·호환성을 확인한다. release/tag/push의 배포 트리거는 실제 설정에서 확인한다.
