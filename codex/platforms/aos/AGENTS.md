### Android

- Kotlin/Compose 변경 전 `.codex/harness/references/android.md`를 읽는다. 이 파일은 Codex의 경로별 자동 로딩 설정이 아니다.
- 신규 프로젝트에 씨딩된 `UDF_ARCHITECTURE_GUIDE.md`와 `DATA_LAYER_GUIDE.md`가 있으면 화면·데이터 구현 전에 읽고 준수한다. 기존 프로젝트는 실제 아키텍처를 유지한다.
- UDF는 Contract/Route/Screen/ViewModel, 중요한 Result는 상태로 보존하고 Route의 `repeatOnLifecycle(STARTED)`에서 소비한다. Screen에 ViewModel·NavController를 전달하지 않는다.
- data 구현과 DTO는 domain/presentation에 노출하지 않는다. UseCase·DataSource는 가이드의 추가 조건을 충족할 때만 만든다.
- API 공통 헬퍼는 취소를 다시 던진다. 상태 변경 요청은 서버 중복 방지 장치와 확정된 미반영 확인 없이 자동 재전송하지 않는다.
- aos-common 소비 여부와 `AOS_COMMON_GUIDE.md` 버전을 확인한다. 해당 라이브러리를 쓰는 디자인 작업 전 `.codex/harness/references/figma-aos-common-guide.md`를 읽고 기존 컴포넌트·토큰을 우선 사용한다.
- Gradle 모듈명·린트 태스크는 실제 설정에서 확인한다. Windows는 `gradlew.bat`를 사용한다. GPR 자격증명 오류는 환경 문제다.
