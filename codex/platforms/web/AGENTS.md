### Web

- package.json·lockfile·실제 소스 구조를 기준으로 프레임워크, 패키지 매니저, 검증 명령을 확인한다. 과거 Next.js/React 버전을 강제하지 않는다.
- FSD Lite 프로젝트는 app → layouts → features → shared 방향을 유지하고 feature 간 직접 의존을 피한다. 다른 아키텍처를 쓰는 기존 프로젝트는 기존 규칙을 따른다.
- 디자인 작업 전 `.codex/harness/references/design-system.md`를 읽고 `@itandsy/react-common` 소비 여부와 실제 export를 확인한다. 기존 컴포넌트·토큰을 재사용한다.
- 라이브러리에서는 `code_convention.md`·`storybook_convention.md`와 component/publish DoD를 확인한다. 공개 Props·export·Storybook 변형과 소비 앱 영향을 검증한다.
- 자동 검증은 로컬에 설치된 도구와 존재하는 package script만 사용한다. npx가 임의로 도구를 다운로드하게 하지 않는다.
