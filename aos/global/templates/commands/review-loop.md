---
description: maker/checker 분리 리뷰 루프 — 변경분을 병렬 리뷰하고 지적사항을 수정한 뒤 checker가 재판정 (최대 3회). 워크플로우로 실행됨.
---

# /review-loop — 리뷰 → 수정 → 재판정 루프

사용자가 이 커맨드를 실행하면 **Workflow 도구**로 저장된 워크플로우를 실행한다 (사용자가 워크플로우 실행을 명시적으로 요청한 것이다):

```
Workflow({
  scriptPath: ".claude/workflows/review-and-fix.js",  // 프로젝트 정본 우선
  args: { base: "<인자로 받은 비교 기준, 없으면 HEAD>" }
})
```

> 경로 규칙: **프로젝트 `.claude/workflows/review-and-fix.js`가 정본**이다(있으면 그것을 실행). 프로젝트에 없을 때만 글로벌 템플릿 `~/.claude/templates/workflows/review-and-fix.js`($HOME 전체 경로로 치환)로 폴백한다.

- 인자 예: `/review-loop dev` → `args: { base: "dev" }` (dev 브랜치 대비 변경분 리뷰)
- 인자 없음 → `base: "HEAD"` (워킹트리의 미커밋 변경분 리뷰)

## 실행 후 보고

워크플로우 결과(JSON)를 받아 사용자에게 정리한다:
1. `status` (CLEAN / PASS / FAIL / BLOCKED)
2. 지적·수정된 항목 요약 (파일별)
3. `remaining`·`minor`·`preexisting`(변경 전부터 있던 문제 — 무인 수정 안 함)이 있으면 "사람 판단 필요" 목록으로 명시
4. FAIL이면 3회 상한에 도달한 것 — 절대 임의로 루프를 더 돌리지 말고 사용자 판단을 기다린다
5. BLOCKED는 리뷰가 시작되지 못한 것(변경 범위 산출 실패 등) — FAIL과 달리 재시도 가능. 사유를 보고하고 재시도 여부를 사용자에게 묻는다
