# STATE.md

Single source of truth for where the team is. Any agent can read this and know what to do next.

## Current status
TASK-008 under Auditor review. Coder implemented three-layer recommendation engine. Auditor found one blocking issue: first-visit consistency bias missing (coder implemented returning-patient consistency instead).

## Active task
TASK-008 — Recommendation engine (IN_REVIEW)

## Tasks completed since last drift check
1. TASK-004: Fastify backend with auth, tenants, catalog, providers, assessments
2. TASK-005: Camera capture component with AR guidance
3. TASK-006: Photo upload pipeline with S3 storage
4. TASK-007: Adaptive questioning engine

## Last action
2026-04-22: Coder built pattern matching service, recommendation service, generate-recommendation endpoint, and RecommendationPreview frontend component.

## Next step
Coder to fix blocking issue: add first-visit consistency bias for isReturning === false in generateRecommendation. Then Auditor will re-review.

---

### TASK-008 — Recommendation engine
Status: IN_REVIEW
Assigned: AUDITOR
Attempt: 1
Brief: /tasks/TASK-008.md
PRD refs: F-6
Last update: 2026-04-22 — Auditor review complete. FAIL on attempt 1. One blocking finding: first-visit consistency bias not implemented (coder built returning-patient consistency instead). Three suggested fixes also noted.
Next step: Coder fixes blocking issue, Auditor re-reviews.

### TASK-004 — Build backend API skeleton
Status: DONE
Assigned: CODER
Attempt: 1
Brief: /tasks/TASK-004.md
PRD refs: F-1, F-5, F-6, F-7, F-8, F-11
Last update: 2026-04-22 — Coder implemented all routes, plugins, auth, validation. 22-point curl smoke test passed. Committed to main.
Next step: Complete.

---

## Format reference (do not delete)

Each task entry:

```
### TASK-001 — <short title>
Status: QUEUED | IN_PROGRESS | IN_REVIEW | BLOCKED | DONE
Assigned: CTO | CODER | AUDITOR
Attempt: 1 | 2 | 3
Brief: <link to brief or inline summary>
PRD refs: <F-numbers from PRD this task fulfills>
Last update: <timestamp> — <what happened>
Next step: <concrete next action>
```

Escalation block:

```
ESCALATION: TASK-001
(see workflows/ESCALATION.md for format)
```

PRD approval block:

```
PRD_APPROVAL_PENDING: <id>
Drafted: <timestamp>
Summary: <one line>
Blocking tasks: <task IDs that depend on this>
Workaround active: <yes/no, description>
```

Continuous mode report (written when mode turns OFF):

```
CONTINUOUS_MODE_REPORT
(see workflows/CONTINUOUS_MODE.md for full format)
```
