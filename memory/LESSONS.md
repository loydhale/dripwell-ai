# LESSONS.md

Mistakes the team has made on this project and how to avoid them next time. Every lesson should be specific enough that reading it prevents the mistake from recurring.

Format per entry:

```
## L-<number> — <short name>
Date: <YYYY-MM-DD>
Task: <task_id where it happened>
What went wrong: <one or two sentences>
Root cause: <the real reason, not the symptom>
Avoid by: <concrete rule for next time>
Seen N times: <counter, starts at 1>
```

Rules:
- New lessons append to the bottom
- If the same lesson happens again, increment the counter instead of adding a duplicate
- If a lesson hits 3+ times, Auditor promotes it to GOTCHAS.md on the next weekly review (it's now a project quirk, not a team mistake)
- Lessons that no longer apply (code has changed) get deleted during weekly review

---

## Entries

## L-001 — pnpm catalog for shared dependency versions
Date: 2026-04-22
Task: TASK-001
What went wrong: Coder did not use pnpm catalog feature to centralize shared dependency versions (typescript, vite, etc.) across packages. Versions are duplicated in each package.json.
Root cause: Task NOTES suggested it but it was not treated as a hard requirement.
Avoid by: When scaffolding monorepos, check if pnpm catalog is appropriate and apply it to dependencies used in multiple packages. This reduces version drift.
Seen N times: 1
