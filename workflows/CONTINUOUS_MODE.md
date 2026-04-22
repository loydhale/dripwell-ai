# CONTINUOUS_MODE.md — The Self-Prompting Loop

Continuous mode is an explicit operating mode the Owner turns on with a command like "run all night," "keep going," "continuous mode on," or similar. When active, the team generates its own next task when the queue empties instead of going IDLE.

Continuous mode is OFF by default. The Owner must turn it on explicitly, each session.

## State flag

Continuous mode state lives in `memory/STATE.md` in a dedicated block:

```
CONTINUOUS_MODE: ON | OFF
Started: <ISO timestamp, only when ON>
Started by: <Owner command that turned it on>
Stop conditions active:
  - Owner stop command
  - PRD fully built
  - Consecutive escalations >= 3
  - Consecutive "no new learning" tasks >= 10 (possible loop)
Tasks completed this run: <counter>
```

## How it turns ON

Owner says any of (or similar):
- "run all night"
- "keep going"
- "continuous mode on"
- "self-drive until done"
- "work through the PRD"

CTO confirms with a one-line response listing the stop conditions, then sets `CONTINUOUS_MODE: ON` in STATE and proceeds.

## How it turns OFF

Continuous mode stops when ANY of these trigger:

1. **Owner command.** Any message containing "stop," "pause," "halt," "continuous mode off," or similar. CTO writes a session summary and sets `CONTINUOUS_MODE: OFF`.

2. **PRD fully built.** All PRD features marked complete AND no quality-tier work identified. CTO writes a completion summary flagging this to the Owner.

3. **Consecutive escalations.** 3 tasks in a row escalate. Something's structurally wrong, stop and wait for the Owner.

4. **Loop suspicion.** 10 consecutive tasks produce "no new learning" AND no meaningful file changes. The team might be spinning. Stop and flag.

5. **PRD approval blocking.** All remaining work depends on a `PENDING_OWNER_APPROVAL` decision. Nothing left the team can do without the Owner.

When any stop condition fires, CTO writes a `CONTINUOUS_MODE_REPORT` block to STATE summarizing the run (see format below) and sets mode OFF.

## The self-prompting loop (when CONTINUOUS_MODE is ON)

When the task queue empties, CTO runs this decision ladder to pick the next task. Stop at the first tier that produces work.

### Tier 1 — New PRD features (highest priority)
Look at PRD.md. Find the highest-priority feature that is:
- Not marked complete
- Not blocked by a `PENDING_OWNER_APPROVAL` item
- Has all dependencies met

Priority order: P0 before P1 before P2. Within a priority tier, order listed in the PRD wins.

If found: create a task brief for it and dispatch. Done.

### Tier 2 — Known bugs or gaps in completed features
If Tier 1 is empty, look for:
- Open findings from Auditor reviews that were "suggested" (non-blocking) and never addressed
- Features marked complete but with no tests (if the project has a test pattern)
- TODO comments left in the code (anywhere, not just recent tasks)
- Imports or exports that exist but aren't used anywhere

If found: task it up and dispatch.

### Tier 3 — Quality and hygiene work
If Tier 2 is empty, pick from:
- Missing or thin test coverage on critical paths
- Code duplication the team has flagged in past tasks (check LESSONS and SESSION_LOG)
- Documentation gaps (functions, modules, or endpoints without comments)
- Dependencies that are outdated (if safe to update without behavior change)
- Small refactors that reduce complexity without changing behavior

Rule: Tier 3 work must be safe. No architectural refactors, no breaking changes, no "while we're here" feature additions. If a Tier 3 candidate would touch more than 3 files, split it or skip it.

### Tier 4 — Stop
If all three tiers are empty, PRD is effectively done. Fire stop condition #2 (PRD fully built).

## What the CTO does NOT do in continuous mode

- Invent new features not in the PRD
- Start major PRD changes (those still require Owner approval)
- Skip the Auditor review step "to move faster"
- Skip the learning extraction phase
- Skip memory file reads at boot of each task
- Run more than 3 tasks in parallel (team is built for serial execution)
- Suppress escalations to keep the streak going

## Per-task checkpoint

After EVERY task in continuous mode (not just when the queue empties), CTO briefly re-evaluates:
1. Any new Owner messages? If yes, process those before continuing.
2. Any stop condition triggered? If yes, stop.
3. STATE.md current? If no, update it.
4. Then pick the next task.

This check is cheap. It catches Owner interventions within one task's latency.

## Continuous mode report format

When mode turns OFF for any reason, CTO writes this block to STATE and to SESSION_LOG:

```
CONTINUOUS_MODE_REPORT
Started: <timestamp>
Stopped: <timestamp>
Duration: <hours>
Stopped because: <one of the 5 stop conditions>

Tasks completed: <count>
Tasks escalated: <count>
Tiers worked:
  - Tier 1 (new features): <count>
  - Tier 2 (gaps): <count>
  - Tier 3 (quality): <count>

PRD progress: <X of Y features complete>
Files changed: <count>
New lessons: <count>
New patterns: <count>
New gotchas: <count>

Notes for Owner: <any flags, surprises, or decisions needed>
Next suggested action: <what the Owner might want to do when they return>
```

## Safety defaults baked into continuous mode

- Every task still goes through the full plan/code/audit/learn cycle
- The Auditor's standards do not lower
- PRD major changes still require Owner approval (cannot self-approve in continuous mode)
- All memory files still get updated every task
- STATE.md remains the resume contract, even mid-loop

Continuous mode accelerates throughput. It does not relax quality bars.
