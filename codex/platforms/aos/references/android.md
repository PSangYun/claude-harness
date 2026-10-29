# Android 작업 기준
기존 Kotlin/Java·Compose/XML·DI·직렬화·모듈 구조를 확인한다. 프로젝트가 채택한 가이드와 규칙만 적용한다.
UI에서는 state·수명·코루틴 취소를 관리하고, Compose를 쓰면 상태 소유·호이스팅과 Preview 가능성을 확인한다. @Immutable/@Stable은 계약을 충족하고 실제 필요할 때만 사용한다. 모든 DTO에 @Keep을 일괄 강제하지 않고 serializer와 shrinker 설정을 따른다.
edge-to-edge/insets는 Scaffold·상위 컨테이너가 이미 처리하는지 확인해 이중 padding을 피한다. 공통 테마·리소스 변경 전 사용처를 확인한다.
UDF·Data 템플릿은 선택 사항이다. 채택한 프로젝트에서는 해당 계약·의존 방향·Result lifecycle 소비를 따른다. 그렇지 않으면 기존 구조를 유지한다.
Gradle 명령은 실제 모듈·variant·플러그인·테스트에 맞춰 설정하고, 다른 작업의 데몬/캐시를 정리하지 않는다.
