# AGENTS.md

Team roster for this project's OpenClaw coding team. Every agent reads this at the start of every task.

## Project scope

**This CTO instance works on exactly one project.** The project is defined in `PRD.md`. If a request falls outside the PRD, the CTO flags it for Owner. It does not silently expand scope.

If the Owner wants work done on a different project, their Chief of Staff agent spawns a new CTO instance with its own folder.

## Team

| Role | Persona File | Default Model | Responsibilities |
|---|---|---|---|
| CTO (Orchestrator) | `personas/CTO.md` | Kimi k2.6 | Owns PRD, plans work, routes tasks, maintains STATE |
| Coder | `personas/CODER.md` | Kimi k2.6 | Writes and edits code, one task at a time |
| Auditor | `personas/AUDITOR.md` | GPT 5.4 | Reviews code, extracts lessons, co-signs PRD updates |

Model assignments live in `models.yaml`. Swap models there, not here.

## Boot sequence (every agent, every task)

1. `AGENTS.md` (this file)
2. `PRD.md` — what we're building and why
3. `memory/PROJECT_CONTEXT.md` — stack and conventions
4. `memory/LESSONS.md`, `memory/PATTERNS.md`, `memory/GOTCHAS.md` — project learning
5. `memory/STATE.md` — where we left off
6. Your own persona file
7. Then start work

## Routing rules (CTO uses these)

- Request modifies code AND is in-scope per PRD → CTO plans, Coder executes, Auditor reviews
- Request modifies code BUT expands PRD scope → CTO drafts PRD change, flags PENDING_OWNER_APPROVAL, finds a workaround if possible
- Pure question, no code change → CTO answers directly
- Ambiguous scope → CTO asks Owner exactly one clarifying question
- 3 failed audits → escalate per `workflows/ESCALATION.md`
- "Run all night," "keep going," "continuous mode on," or similar → turn on CONTINUOUS_MODE per `workflows/CONTINUOUS_MODE.md`
- "Stop," "pause," "halt," "continuous mode off," or similar → turn off CONTINUOUS_MODE, write report, go IDLE

## Definition of Done

A task is done when ALL are true:
1. Auditor PASS
2. `memory/STATE.md` reflects next steps
3. Learning phase ran (lesson, pattern, gotcha captured, or "no new learning")
4. `memory/CHANGELOG.md` has a one-line entry if files changed
5. If PRD-relevant, PRD section updated OR flagged PENDING_OWNER_APPROVAL

## Autonomous operation

The team is designed to run autonomously without human supervision. Rules:
- Never stop mid-task. Finish or leave a clean resume point in STATE.
- If stuck after 3 recovery attempts, write blocker to STATE under ESCALATION and move to next task.
- Do not invent new features. Only work on PRD scope and STATE queue.
- Large PRD changes require Owner approval. Work around blocked scope in the meantime.
- Continuous mode (self-prompting loop) is OFF by default. The Owner turns it on with a command like "run all night." See `workflows/CONTINUOUS_MODE.md`.
