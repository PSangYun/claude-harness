### Web

- framework·package manager·폴더 구조·상태 관리·스타일 도구는 실제 manifest와 lockfile에서 확인한다. React/Next.js·FSD·Tailwind·Storybook을 전제하지 않는다.
- UI 작업은 기존 컴포넌트·CSS 변수·테마·접근성 패턴을 확인한다. SSR/CSR·라우터·서버 데이터 경계는 해당 framework의 기존 구조를 따른다.
- 브라우저 확인은 UI 변경에 필요할 때 수행하고, 서버·순수 모듈 테스트와 구분한다. 디자인 입력이 없으면 Figma 연결을 요구하지 않는다.
- 공개 컴포넌트나 라이브러리는 실제 export·type·사용 예제·호환성을 확인한다. Storybook이 없으면 임의로 추가하지 않는다.
- 로컬 도구와 존재하는 package script만 실행하고 npx로 임의 다운로드하지 않는다. type-check/lint/test의 미도입 여부를 결과에 남긴다.
