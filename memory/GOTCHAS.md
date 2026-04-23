# GOTCHAS.md

Non-obvious quirks about this project. Reading this file before starting a task prevents wasted time on things that look wrong but are intentional (or look fine but secretly aren't).

Format per entry:

```
## G-<number> — <short name>
Date discovered: <YYYY-MM-DD>
Where: <file paths, service, config area>
The gotcha: <what's weird>
Why it's like this: <if known>
What to do: <how to handle it>
What NOT to do: <common wrong fix>
```

Rules:
- New gotchas append to the bottom
- Lessons that hit 3+ times get promoted here during weekly review
- Every agent reads this file before every task
- Gotchas don't get deleted unless the underlying issue is actually fixed in the codebase

---

## Entries

(none yet — will populate as the team works)

## G-001 — iPad Safari getUserMedia may require a recent user gesture context
Date discovered: 2026-04-22
Where: apps/web/src/components/CameraCapture.ts, camera.ts
The gotcha: iPad Safari allows `navigator.mediaDevices.getUserMedia()` only when called from a user gesture handler or a frame created by one. If the camera component mounts programmatically (e.g., after a route change or state update) without a recent click/tap, the call may be rejected even if permission was previously granted.
Why it's like this: iOS Safari's media permissions model ties getUserMedia to user gesture context for privacy.
What to do: Add an explicit "Start Camera" button that the provider taps before calling `getUserMedia`, or ensure the component is rendered synchronously inside a click handler.
What NOT to do: Do not call `getUserMedia()` immediately on component mount and assume it will work on iPad.

## G-002 — Prisma @default(uuid()) generates IDs that never match hardcoded static values
Date discovered: 2026-04-22
Where: packages/shared/prisma/schema.prisma QuestionBank model, apps/api/src/services/questions.ts STATIC_QUESTION_BANK
The gotcha: When a model uses `@id @default(uuid())`, Prisma generates a random UUID on every create. If your code references hardcoded UUIDs (e.g. a static question bank in TypeScript), those IDs will never match the database rows unless you explicitly set the id during seeding.
Why it's like this: Prisma's default UUID generator is random per insertion.
What to do: Either (1) seed QuestionBank rows with the exact hardcoded IDs from the static bank, (2) remove the foreign key from QuestionAnswer to QuestionBank and use a separate non-FK string field for static references, or (3) load the static bank into the DB at app startup instead of hardcoding.
What NOT to do: Do not assume hardcoded UUIDs in code will match auto-generated database rows.

## G-003 — Mock signal auto-fallback hides missing photo analysis in production
Date discovered: 2026-04-22
Where: apps/api/src/routes/assessments.ts next-question endpoint, apps/api/src/services/questions.ts computePatternConfidences
The gotcha: The next-question endpoint passes `mockSignals: QUESTION_MOCK_MODE || signals.length === 0`. When no visual signals exist, it silently injects three synthetic signals with high confidence. This makes it impossible to detect when photo analysis failed or was skipped.
Why it's like this: The Coder wanted a smooth dev/test experience and conflated "no signals" with "test mode".
What to do: Make mock mode strictly opt-in via env var only. For the no-signals case, either return a 400 error, proceed with zero-signal baseline (prior only), or require explicit provider confirmation.
What NOT to do: Do not auto-inject synthetic data in any endpoint that can be hit in production.
