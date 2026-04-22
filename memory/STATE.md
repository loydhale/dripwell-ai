# STATE.md

Single source of truth for where the team is. Any agent can read this and know what to do next.

## Current status
AWAITING_PRD — this CTO instance has been scaffolded but has not yet drafted PRD.md. On next run, CTO should draft PRD from Owner's initial brief.

## Continuous mode
CONTINUOUS_MODE: OFF
(When ON, CTO self-prompts next tasks instead of going IDLE. See workflows/CONTINUOUS_MODE.md)

## PRD version
v0 (not yet drafted)

## PRD approvals needed
(none yet)

## Active task
(none)

## Task queue
(empty)

## Blocked tasks
(none)

## Tasks completed since last drift check
0

## Last action
<timestamp>: CTO instance scaffolded by Chief of Staff

## Next step
CTO reads Owner's initial project brief (provided at scaffold time), drafts PRD.md using templates/PRD_TEMPLATE.md, asks one batched round of clarifying questions.

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
