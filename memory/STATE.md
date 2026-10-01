# STATE.md

## Current status

V2-PLUGIN coding-guidance clarification complete. Auditor PASS on attempt 1. V2-PRD documentation complete. Auditor PASS on attempt 1. Owner-requested consultation requirements and implementation plan are prepared on the docs/dripwell-v2-icm-eve-2026-10-01 branch.

## Deliverables

- PRD.md: v2 requirements, six exact Kanban triggers, archive, 14-day/10-consultation trial, owner-only improvement.
- docs/IMPLEMENTATION_PLAN.md: source-verified eve layout, preserved project context conventions, migration/work packages/validation.
- docs/archive/PRD-v1.md and STATE-v1.md: preserved historical requirements/state.
- README.md and PROJECT_CONTEXT.md distinguish actual runtime from target architecture.

## Next resume point

Future implementation begins with V2-001 (required Vercel Plugin availability/source, exact ICM reference, and framework versions), V2-002 (starter/ORM/auth decision), and V2-003 (eligible service provisioning/data-path map). Break work packages into small task briefs before execution.

No application code or deployment changed. Continuous mode is OFF. Do not automatically resume the superseded photo-assessment queue.

## Open decisions

- Separate owner ICM/eve example unconfirmed; preserve observed conventions and verified eve layout until compared.
- Trial activation/counting and credit value/qualification/refund terms remain explicit proposals/open decisions.
- Validate actual clinic protocols/prices, sharing verification, retention/reminder timing, and service eligibility before their rollout.

## Historical state

[Archived v1 state](../docs/archive/STATE-v1.md) retains the old task queue.

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
