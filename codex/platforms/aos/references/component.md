> Codex 이식 기준: 이 문서의 플랫폼별 구현·DoD를 사용한다. 실행과 권한 규칙은 프로젝트 AGENTS.md 및 선택한 harness Skill을 따른다. verify.json은 `commands: [{name, command}]` 형식이다. 검증기는 자동 턴 종료 훅이 아니며 명시적으로 실행한다. 특정 버전·브랜치·프로젝트명은 실제 코드에서 재확인한다.

# $harness-component — DS 컴포넌트 구현 (aos-common)

입력: 피그마 컴포넌트 URL + 분류(atoms/molecules/organisms). 프로젝트 AGENTS.md의 기존 규칙(VariantsPreview·토큰·가이드 동기화·공개 API 호환성)이 이 커맨드의 상위 규범이다.

## Phase A: 피그마 변형 전수 분석

1. 피그마 MCP로 컴포넌트의 **모든 변형(variant)·상태(state)·파라미터**를 전수 목록화: `파라미터 | 타입 | 값 목록 | 기본값`
2. 색상·치수·폰트는 실측 → `ui/theme`(Color/Area/Font/Opacity) 기존 토큰과 매칭. **매칭되는 토큰이 없으면 hex 하드코딩하지 말고 토큰 추가를 먼저 제안** (AGENTS.md 토큰 추가 규칙)
3. 애매한 동작(인터랙션·비활성 조건)은 추측하지 말고 사용자에게 질문

## Phase B: 기존 자산 확인

1. 같은/유사 컴포넌트가 `component/{atoms,molecules,organisms}`에 이미 있는지 확인 — 있으면 신규 대신 **변형 추가**로 접근
2. **기존 공개 API(컴포저블 시그니처) 변경이 필요하면 중단하고 사용자 확인** — 소비 앱이 버전 고정으로 쓰므로 파괴적 변경은 별도 합의 필요 (AGENTS.md 공개 API 호환성 규칙)
3. 네이밍·패키지 위치는 인접 컴포넌트 패턴을 따른다

## Phase C: 구현

- 분류에 맞는 패키지(`com.itappandsy.aoscommon.common.component.<분류>.<이름>`)에 작성
- 모든 값은 토큰 참조 — 신규 코드에 hex/`.dp` 리터럴 금지
- Phase A의 파라미터 전수를 시그니처에 반영, 합리적 기본값 제공

## Phase D: VariantsPreview (필수 — 프로젝트 규칙)

- **파라미터 전수 카르테시안 곱 `VariantsPreview`** 작성 (AGENTS.md 규칙 그대로) — 모든 조합이 렌더되는지 확인
- `:app` 데모에서 확인 필요하면 데모 화면에 추가

## Phase E: 가이드 갱신

- `AOS_COMMON_GUIDE.md`에 신규/변경 API 반영 (파라미터 표·사용 예시) — **코드와 가이드가 같은 커밋에서 함께 변경**되어야 한다 (동기화 의무)

## Definition of Done

1. Phase A 변형 목록이 전수 구현됨 (목록 ↔ 시그니처/분기 대조 근거)
2. 신규 코드에 hex·`.dp` 하드코딩 0건 — 토큰만 사용 (매칭 불가분은 토큰 추가로 해결했는지)
3. 기존 공개 API 시그니처 변경 없음 (변경했다면 사용자 승인 근거 명시)
4. 파라미터 전수 카르테시안 곱 VariantsPreview 존재
5. `AOS_COMMON_GUIDE.md` 갱신됨 (신규 API가 가이드에 존재)
6. 컴파일 성공: `./gradlew -q :AosCommon:compileDebugKotlin` (실행 결과 근거)
