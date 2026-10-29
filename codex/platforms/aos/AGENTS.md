### Android

- Kotlin/Compose 변경 전 `.codex/harness/references/android.md`를 읽는다. Compose·XML Views·DI·HTTP client는 기존 프로젝트의 선택을 따른다.
- 명시적으로 채택한 `UDF_ARCHITECTURE_GUIDE.md`·`DATA_LAYER_GUIDE.md`가 루트에 있을 때 해당 규칙을 적용한다. references에 템플릿이 있다는 이유로 기존 앱의 아키텍처를 바꾸지 않는다.
- UI 작업은 실제 프로젝트의 공통 컴포넌트와 테마 토큰을 우선 확인한다. 디자인 자료가 있을 때 `.codex/harness/references/figma-guide.md`를 읽는다.
- 공개 계층에 transport DTO를 누출하지 않고 코루틴 취소를 보존한다. 데이터 접근·에러·재시도는 기존 계약과 명세를 기준으로 구현한다.
- Gradle 모듈명·variant·린트·실질 테스트는 실제 설정에서 확인한다. Windows는 `gradlew.bat`를 사용한다. 사설 저장소 인증 오류는 환경 문제로 구분한다.
