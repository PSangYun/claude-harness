### iOS

- 실제 SwiftUI/MVVM 구조를 유지한다. 디자인 작업 전 `.codex/harness/references/design-system.md`를 읽고 ios-common 사용 여부를 확인한다.
- ios-common의 import 모듈명은 `ios_common`이다. 색상·간격·폰트는 기존 `design/{color,area,text}` 토큰을 사용한다.
- 앱 화면은 design → logic → connect-api, 공통 라이브러리는 component → publish 절차를 따른다. Preview와 공개 API 문서화를 해당 DoD대로 확인한다.
- 빌드는 실제 workspace/project/package와 scheme을 확인해 설정한다. Xcode 없는 머신에서 빌드를 통과했다고 보고하지 않는다.
- 라이브러리 소비 앱이 브랜치를 추적하는지 현재 설정을 확인한다. 추적 브랜치 push가 배포로 이어지는 경우 사용자 요청 범위를 확인한다.
