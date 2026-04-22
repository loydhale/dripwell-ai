# CODING_LOOP.md — The Plan → Code → Audit → Learn Cycle

This is the core workflow the team runs for every code change. Read it. Follow it. Do not skip steps.

## The loop

```
Owner request
    │
    ▼
┌─────────────────────────────┐
│ 1. CTO: Plan                │  reads memory, writes task queue to STATE
└─────────────────────────────┘
    │
    ▼
┌─────────────────────────────┐
│ 2. CODER: Implement task    │  reads memory + brief, writes code
└─────────────────────────────┘
    │
    ▼
┌─────────────────────────────┐
│ 3. AUDITOR: Review          │  PASS or FAIL with findings
└─────────────────────────────┘
    │
    ├── FAIL (attempt < 3) ──► back to CODER with feedback
    │
    ├── FAIL (attempt = 3) ──► CTO writes ESCALATION, moves to next task
    │
    └── PASS ──► AUDITOR extracts lessons ──► CTO updates STATE ──► next task
```

## Step-by-step rules

### Step 1 — CTO plans
- CTO reads all memory files
- CTO breaks request into tasks (small, testable, single-shot)
- CTO writes task queue to `memory/STATE.md`
- CTO dispatches task 1 to Coder with a brief using `templates/TASK_BRIEF.md`

### Step 2 — Coder implements
- Coder reads memory
- Coder does missing context check (##SEARCH lines if needed)
- Coder writes code
- Coder self-checks against brief
- Coder returns to CTO with a status report

### Step 3 — Auditor reviews
- Auditor reads brief + diff + memory
- Auditor returns PASS or FAIL with specific findings
- Auditor ALWAYS runs the learning extraction phase (see AUDITOR.md)

### Step 4 — Loop or advance
- FAIL attempts 1 or 2: CTO sends findings back to Coder
- FAIL attempt 3: CTO escalates via STATE.md, moves to next task
- PASS: CTO updates STATE, dispatches next task

### Step 5 — Queue empty
- CTO writes session summary
- CTO checks if weekly review is due
- CTO stops cleanly

## Critical rule: the resume contract

Every agent, at the end of every response, must leave the system in a state where a different agent (or the same agent after a restart) can pick up with no human input by reading only the memory files. This means:

- STATE.md must always reflect current reality
- If the Coder is mid-task, STATE says which task, which attempt, and what the last Auditor feedback was
- If Escalation fires, STATE says which task is blocked and why
- If the queue is empty, STATE says "IDLE — waiting for next request from Owner"

Never end a response with the system in an ambiguous state.

## Timing guardrails

- A single task > 15 min of model time: CTO splits it
- A single file > 500 lines changed in one task: CTO splits it
- An audit cycle >3 attempts: escalate
- A session >8 hours with no human input: write session summary and pause for weekly review check
