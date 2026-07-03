# CLAUDE.md — @itandsy/react-common

## 프로젝트 개요

- **리액트 공통 컴포넌트 라이브러리** — GitHub Packages 배포 (`@itandsy/react-common`)
- 기술 스택: Vite 7 + React 19 + TypeScript + Tailwind 3.4 + Storybook 9 + Vitest 3, ESLint 9(flat) + Prettier
- 구조 (아토믹 디자인):
  ```
  src/
  ├── components/{atoms, molecules, organisms, templates}
  ├── hooks/  stores/  theme/  types/  utils/  constants/  assets/
  ```
- 서브패스 exports: `./atoms/*` `./molecules/*` `./organisms/*` `./templates/*` `./hooks/*` `./theme` `./preset` `./styles` — 신규 컴포넌트는 export 등록까지가 완료

## 명령어

```bash
npm run dev              # Vite 개발 서버
npm run storybook        # Storybook (포트 6006)
npm run type-check       # tsc --noEmit (tsconfig.type-check.json)
npm run lint             # eslint .
npm run build            # vite build + post-build
npx vitest run           # 테스트
```

## 핵심 규칙

1. **컨벤션 정본은 문서**: 코드는 `code_convention.md`, 스토리는 `storybook_convention.md` — 구현 전 해당 섹션을 확인할 것
2. **컴포넌트 추가/수정은 `/component` 커맨드 절차(DoD 포함)** — 피그마 변형 전수 반영 + Storybook 스토리 필수
3. **공개 Props/export 파괴적 변경 금지** — 소비 앱들이 `^` 범위로 의존. 불가피하면 사용자 확인 + major 버전
4. **배포는 `/publish` 절차** — semver 갱신 → GitHub Release → `publish.yml`이 GitHub Packages에 publish
5. 피그마 파일: `D-펫포션_디자인 시스템` (fileKey: `b40fvavILA2SJpQkH9lZO9`) — 값은 실측만, 추측 금지

## 프로젝트 루브릭

<!-- /maintain이 검사하는 이 저장소 고유 항목 -->
- `npm run type-check` 에러 0 / `npm run lint` 에러 0 / `npm run build` 성공
- 신규/변경 컴포넌트에 Storybook 스토리 존재

## 반복되는 실수

<!-- 같은 실수가 재발하면 `### 제목 (YYYY-MM-DD)` 형식으로 추가.
     2회 이상 기록된 패턴은 .claude/hooks/quality-check.js 정규식 검사로 승격 제안 (글로벌 규약) -->
