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

## L-012 — Wrong branded ID factory used for cross-entity references
Date: 2026-04-22
Task: TASK-009
What went wrong: Coder used `makeSafetyFlagId()` to construct a `ProviderId` value in three places within safety.ts, defeating the branded nominal type system that prevents mixing entity IDs at compile time.
Root cause: The Coder needed to convert raw database strings into branded types but used the wrong factory function and suppressed the type error with `as unknown as ProviderId` rather than using the correct `makeProviderId`.
Avoid by: When mapping database records to branded ID types, always use the factory function that matches the target entity. If one does not exist, add it to `@dripwell/shared` instead of bypassing the type system with casts.
Seen N times: 1

---

## Entries

## L-001 — pnpm catalog for shared dependency versions
Date: 2026-04-22
Task: TASK-001
What went wrong: Coder did not use pnpm catalog feature to centralize shared dependency versions (typescript, vite, etc.) across packages. Versions are duplicated in each package.json.
Root cause: Task NOTES suggested it but it was not treated as a hard requirement.
Avoid by: When scaffolding monorepos, check if pnpm catalog is appropriate and apply it to dependencies used in multiple packages. This reduces version drift.
Seen N times: 1

## L-002 — Redundant service worker registration when VitePWA injectRegister is active
Date: 2026-04-22
Task: TASK-002
What went wrong: main.ts manually registers the service worker, but VitePWA with injectRegister: 'script-defer' already injects registerSW.js into the built HTML. This creates two registration attempts.
Root cause: Coder did not notice that VitePWA handles registration automatically when injectRegister is configured.
Avoid by: When using VitePWA, check the injectRegister setting. If it's set, remove manual navigator.serviceWorker.register() from main.ts. If you need custom registration logic, set injectRegister: false.
Seen N times: 1

## L-003 — innerHTML injection of large static markup adds LCP overhead
Date: 2026-04-22
Task: TASK-002
What went wrong: Landing page content was injected via container.innerHTML = `...` in TypeScript, meaning the browser must download, parse, and execute JS before any page content renders. On slower connections this delays LCP compared to static HTML.
Root cause: Coder chose developer convenience (single TS file) over rendering performance. No templating engine was available and no requirement to prerender was given.
Avoid by: For landing pages with hard LCP targets, prefer static HTML in index.html or build-time prerendering (e.g., vite-plugin-ssr, or simple string replacement in index.html during build). Only use JS injection when the content is genuinely dynamic.
Seen N times: 1

## L-004 — JWT payload staleness after database mutation
Date: 2026-04-22
Task: TASK-004
What went wrong: Super user registered and logged in (JWT issued with tenantId: null). Then created a tenant, which updated their tenantId in the database. But subsequent API calls with the old JWT still had tenantId: null, causing all tenant-scoped operations to fail with 403.
Root cause: JWT is stateless and signed at login time. Mutations that change tenant membership do not automatically refresh the token.
Avoid by: When an API mutation changes a field that is embedded in the JWT (tenantId, role, etc.), re-issue the JWT in the response payload so the client can update its stored token.
Seen N times: 1

## L-005 — Fastify v5 reply.status().send() chaining breaks TypeScript strict mode
Date: 2026-04-22
Task: TASK-004
What went wrong: Using `return reply.status(201).send({ ... })` in route handlers caused `TS2554: Expected 0 arguments, but got 1` across multiple route files.
Root cause: Fastify v5's TypeScript types for `FastifyReply` after `.status()` do not allow `.send(payload)` chaining in strict mode with bundler moduleResolution.
Avoid by: Set status code on reply first (`reply.status(201)`), then return the response object directly from the handler (`return { ... }`). Fastify sends the returned value automatically. Same for error handlers.
Seen N times: 1

## L-006 — Wrong error class for auth failures produces misleading HTTP status
Date: 2026-04-22
Task: TASK-004
What went wrong: Coder used ConflictError (HTTP 409) for invalid email/password and missing user scenarios, which are authentication/authorization failures that should return 401 or 404.
Root cause: ConflictError was the closest available custom error class, but the Coder did not map error semantics to correct HTTP status codes.
Avoid by: When adding auth or resource-not-found errors, always match the error class to the intended HTTP status. Auth failures = UnauthorizedError (401). Missing resources = NotFoundError (404). Resource conflicts = ConflictError (409).
Seen N times: 1

## L-007 — State transition helper call order can suppress UI state
Date: 2026-04-22
Task: TASK-005
What went wrong: `setError()` displayed an error message, but `setCaptureMode()` was called immediately afterward. `setCaptureMode()` unconditionally set `errorMsg.style.display = 'none'`, hiding the error before the user could see it.
Root cause: State transition helpers were designed to reset all UI state to a known baseline, including clearing errors. When composed sequentially, the second helper overwrote the first helper's visible state.
Avoid by: Either call `setCaptureMode()` first and then `setError()`, or remove error-clearing from `setCaptureMode()` and make callers explicitly clear errors when they intend to. Prefer helpers that are composable without side-effect collisions.
Seen N times: 1

## L-008 — CSS pseudo-elements cannot be driven by JavaScript style assignments
Date: 2026-04-22
Task: TASK-005
What went wrong: A progress bar used `::after` for the fill color and tried to update its width via `element.style.width = ...` from JavaScript. The pseudo-element width stayed at `0%` because JS cannot directly style pseudo-elements.
Root cause: The Coder treated `::after` as a regular child element that could be manipulated via inline styles.
Avoid by: For any UI element that needs its style updated from JS, use a real child DOM element or a CSS custom property (`--var`). Pseudo-elements are for decorative/static content only.
Seen N times: 1

## L-009 — Static question bank IDs must match database rows or FK constraints fail at runtime
Date: 2026-04-22
Task: TASK-007
What went wrong: The static question bank uses hardcoded UUIDs (e.g. '11111111-1111-1111-1111-111111111111') but the Prisma seed generates auto-generated UUIDs for QuestionBank rows. The QuestionAnswer model has a foreign key constraint on questionBankId referencing QuestionBank.id. Any attempt to record an answer fails with a foreign key constraint violation because no QuestionBank row exists with the hardcoded ID.
Root cause: Coder treated the static question bank and the database schema as independent without ensuring referential integrity between hardcoded IDs and actual DB rows.
Avoid by: When using static hardcoded IDs that must reference database rows, either (1) seed the DB with those exact IDs, (2) remove the foreign key constraint for static references, or (3) use a separate nullable field for static question references. Always verify a create path end-to-end before considering a task done.
Seen N times: 1

## L-010 — Mock mode auto-fallback can mask production data issues
Date: 2026-04-22
Task: TASK-007
What went wrong: The next-question endpoint automatically enables mock signals whenever signals.length === 0, regardless of the QUESTION_MOCK_MODE env var. In production, if photo analysis fails or is bypassed, the system silently injects synthetic signals instead of surfacing the missing-data condition.
Root cause: The Coder conflated "no signals available" with "test mode" for convenience, creating a hidden production risk.
Avoid by: Mock mode should be strictly opt-in via explicit configuration. The "no signals" path should either return an error, use zero-signal baseline, or require explicit provider confirmation before proceeding. Never auto-inject synthetic data in production paths.
Seen N times: 1

## L-011 — Semantic confusion between "first-visit" and "returning patient" logic
Date: 2026-04-22
Task: TASK-008
What went wrong: The Coder implemented "returning patient consistency" (boost confidence when current pattern matches prior session) but the task and PRD required "first-visit consistency bias" (logic for new patients, isReturning === false). These are opposite conditions.
Root cause: The Coder read "consistency" and assumed it meant "keep consistent with prior visit" rather than "be consistent for first-time visitors". They did not re-read the PRD default list carefully.
Avoid by: When implementing bias or default logic, always map the condition explicitly: write the if (isReturning === false) branch first, then the if (isReturning === true) branch. Do not assume the named bias applies to the more complex condition.
Seen N times: 1
