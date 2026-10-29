---
name: harness-review-loop
description: Review and fix the current task's changed code against architecture and conventions, then recheck up to three times using this harness.
---

비교 기준은 사용자 지정 ref, 없으면 HEAD다. git으로 ref를 확인하고 추적·스테이징·미추적 파일을 포함한 범위를 산출한다. 기존 사용자 변경을 구분한다.
`.codex/harness/references/code-reviewer.md`와 적용되는 프로젝트 가이드를 읽고 correctness·아키텍처·컨벤션을 리뷰한다. 기존 코드 문제는 preexisting으로 분리하고 자동 수정하지 않는다.
라이브러리 작업이면 `.codex/harness/references/library-reviewer.md`의 공개 API·호환성 기준도 확인한다.
요청 범위의 새 문제를 수정하고 verify와 DoD를 재검증한다. checker 위임이 허용되고 도구가 있으면 checker.md 기준으로 독립 판정을 받는다. 그렇지 않으면 자가 검증으로 표시한다. 같은 문제는 최대 3회 수정·판정한다.
결과는 PASS/FAIL/BLOCKED와 근거·남은 문제로 보고한다. 독립 검증 여부와 런타임 생략을 명시한다. GitHub 코멘트 게시·커밋·푸시는 별도 사용자 요청 범위에서만 한다.
이 절차는 Codex가 수행하는 Skill이다. Claude Workflow DSL이나 존재하지 않는 Workflow 도구를 호출하지 않는다.
