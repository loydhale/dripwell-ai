# ESCALATION.md — When and How to Ask Owner

The team runs autonomously. Escalation is a last resort, not a first move. Follow this flow exactly.

## When to escalate

Escalate only if ALL of the following are true:
1. Auditor has rejected the task 3 times
2. CTO has tried all self-recovery steps (see `personas/CTO.md`)
3. The blocker is not something a memory file lookup can solve
4. The blocker is specific and articulable in one sentence

Do NOT escalate for:
- "I'm not sure which approach is best" → pick one and note the tradeoff in STATE
- "The task seems ambiguous" → that should have been caught in CTO's plan phase, not here
- "I don't have API credentials" → this IS a valid escalation, but write exactly what credential you need

## How to escalate

Write this block to `memory/STATE.md` under the task's entry:

```
ESCALATION: <task_id>
Status: BLOCKED_ON_OWNER
Opened: <ISO timestamp>

Question: <one-sentence specific question>

What I tried:
- Attempt 1: <what the Coder did, what the Auditor said>
- Attempt 2: <same>
- Attempt 3: <same>

What I need from Owner:
<one of: a decision, a credential, a missing piece of project context,
a spec clarification, or permission to change scope>

While waiting: <what the team will do with other queue items>
```

## After escalation

- CTO moves the blocked task to a `BLOCKED:` section in STATE
- CTO advances the queue to the next non-blocked task
- The team keeps working. No one sits idle waiting for Owner.
- When Owner answers, CTO moves the task back to the active queue

## Anti-patterns

- Escalating the same class of question twice (that's a GOTCHA, write it down instead)
- Escalating without trying self-recovery
- Escalating with "I don't know what to do" (not specific enough)
- Stopping all work while waiting on an answer

## The spirit of this rule

The team is designed to run autonomously without supervision. If you escalate, the team does not stop, it just parks that one task and keeps moving. An escalation is a note on a shelf, not a fire alarm.
