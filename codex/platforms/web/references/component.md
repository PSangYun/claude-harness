> Codex 이식 기준: 이 문서의 플랫폼별 구현·DoD를 사용한다. 실행과 권한 규칙은 프로젝트 AGENTS.md 및 선택한 harness Skill을 따른다. verify.json은 `commands: [{name, command}]` 형식이다. 검증기는 자동 턴 종료 훅이 아니며 명시적으로 실행한다. 특정 버전·브랜치·프로젝트명은 실제 코드에서 재확인한다.

# $harness-component — DS 컴포넌트 구현 (react-common)

입력: 피그마 컴포넌트 URL + 분류(atoms/molecules/organisms/templates). 루트의 `code_convention.md`와 `storybook_convention.md`가 이 커맨드의 상위 규범이다 — **구현 전 두 문서의 해당 섹션을 Read로 확인**할 것.

## Phase A: 피그마 변형 전수 분석

1. 피그마 MCP로 컴포넌트의 **모든 변형(variant)·상태(state)·Props**를 전수 목록화: `Prop | 타입 | 값 목록 | 기본값`
2. 색상·간격·타이포는 실측 → `theme/`의 기존 토큰·Tailwind 프리셋과 매칭. 매칭 토큰이 없으면 하드코딩하지 말고 토큰 추가를 먼저 제안
3. 애매한 동작은 추측하지 말고 사용자에게 질문

## Phase B: 기존 자산 확인

1. 같은/유사 컴포넌트가 `src/components/{atoms,molecules,organisms,templates}`에 이미 있는지 확인 — 있으면 신규 대신 **variant 추가**로 접근
2. **기존 공개 API(Props) 파괴적 변경이 필요하면 중단하고 사용자 확인** — 소비 앱들이 `@itandsy/react-common` 버전 범위(^)로 쓰므로 minor 업데이트에 파괴적 변경이 섞이면 안 된다
3. 네이밍·파일 구조는 인접 컴포넌트와 `code_convention.md`를 따른다

## Phase C: 구현

- 분류 디렉토리에 작성, Props 타입 분리·`import type` 등 컨벤션 준수
- radix-ui 프리미티브·기존 유틸(cn 등) 우선 재사용
- 서브패스 export가 필요한 위치면 `package.json` `exports`/배럴(index) 등록 확인

## Phase D: Storybook 스토리 (필수)

- `storybook_convention.md` 규칙대로 스토리 작성 — Phase A의 변형이 스토리로 확인 가능해야 한다
- `npm run storybook`으로 렌더 확인 (불가 환경이면 사유 보고)

## Phase E: 자가 확인

- `npm run type-check` 에러 0, `npm run lint` 에러 0, `npm run build` 성공

## Definition of Done

1. Phase A 변형 목록이 전수 구현됨 (목록 ↔ Props/분기 대조 근거)
2. `code_convention.md` 핵심 규칙 위반 없음 (확인한 섹션 명시)
3. 기존 공개 Props 파괴적 변경 없음 (변경했다면 사용자 승인 근거 명시)
4. 변형을 확인할 수 있는 Storybook 스토리 존재 (`storybook_convention.md` 준수)
5. `type-check` 0 / `lint` 0 / `build` 성공 (실행 결과 근거)
6. 서브패스 export/배럴 등록 확인됨 (신규 컴포넌트인 경우)
