### 범용 프로젝트

- 언어·도구·서비스·아키텍처는 README, manifest, lockfile, CI, 실제 코드에서 확인한다. Node 백엔드·Python·Rust·Go·Swift 패키지·CLI·기타 도구 프로젝트에도 이 구성을 쓴다.
- `verify.json`의 commands에 실제 검사 명령을 설정한다. 예를 들어 프로젝트에 pytest·cargo test·go test·Make target이 있다면 그 프로젝트가 문서화한 명령을 사용한다. 없는 도구를 설치하거나 임의로 태스크를 만들지 않는다.
- Python 등 인터프리터 언어에 컴파일을 강제하지 않는다. 필수 검사 집합은 프로젝트가 정하고 결과는 그 집합에 한정해 보고한다.
- UI·Figma·디자인 토큰·화면 Navigation은 관련 작업에서만 확인한다. 라이브러리는 UI 컴포넌트 외에도 모듈·함수·클래스의 공개 API와 호환성을 검증한다.
