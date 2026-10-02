# PATTERNS.md

Reusable approaches that work in this specific codebase. These are not general best practices. These are "here's how this project does X, match it."

Format per entry:

```
## P-<number> — <short name>
Date: <YYYY-MM-DD>
Where in codebase: <file paths or module>
The pattern: <description of the approach>
When to use: <conditions>
Example: <pointer to a reference implementation in the code>
```

Rules:
- New patterns append to the bottom
- Coders must follow documented patterns even if they personally prefer alternatives
- Auditor enforces patterns during review
- If a pattern is no longer used in the codebase, delete it during weekly review

## P-007 — Declarative rule engine with condition + getTriggers pairs
Date: 2026-04-22
Where in codebase: apps/api/src/services/safety.ts
The pattern: Define flag/detection rules as an array of objects where each rule has a `condition` function (boolean check) and a `getTriggers` function (extracts matching evidence). This separates detection logic from evidence collection and makes rules self-documenting and testable in isolation.
When to use: For any rule-based detection, scoring, or classification system that needs to map raw inputs to structured outputs with traceability.
Example: `FLAG_RULES` array in safety.ts with `condition(ctx)` and `getTriggers(ctx)` on each rule.

---

## Entries

## P-001 — Branded ID types for domain entities
Date: 2026-04-22
Where in codebase: packages/shared/src/types/index.ts
The pattern: Use intersection types (`string & { __brand: 'TypeName' }`) to create nominal types for IDs, preventing accidental mixing of TenantId, AssessmentId, ProviderId at compile time.
When to use: For every domain entity ID that should not be interchangeable with a plain string.
Example: `export type TenantId = string & { __brand: 'TenantId' };`

## P-002 — vite-plugin-pwa with external manifest.json
Date: 2026-04-22
Where in codebase: apps/web/vite.config.ts, apps/web/manifest.json
The pattern: Set `manifest: false` in VitePWA config and provide a standalone manifest.json. This keeps the manifest editable without rebuilding and makes it inspectable in DevTools.
When to use: For all PWA projects where the manifest is static and should be version-controlled separately.
Example: apps/web/vite.config.ts plugins array

## P-004 — XHR with FormData for upload progress when fetch ReadableStream is overkill
Date: 2026-04-22
Where in codebase: apps/web/src/lib/upload.ts
The pattern: Use XMLHttpRequest (XHR) instead of fetch for file uploads when upload progress tracking is required. XHR exposes `xhr.upload.onprogress` natively. Wrap it in a Promise and always resolve with an `{ ok, error?, photoCapture? }` result object so callers never need try/catch.
When to use: For any file upload that must show a progress bar to the user.
Example: `uploadPhoto({ assessmentId, angle, blob, onProgress: (p) => { ... } })` in upload.ts

## P-003 — Fastify plugin + Zod validation helper for route validation
Date: 2026-04-22
Where in codebase: apps/api/src/plugins/auth.ts, apps/api/src/lib/validate.ts, apps/api/src/routes/*.ts
The pattern: Use a centralized `parseBody(schema)` helper that wraps Zod safeParse and throws a `ValidationError` with structured issue details. Register auth, tenant, and error-handler as Fastify plugins, then apply them via `preValidation` hooks per-route.
When to use: For all API routes that need request body validation, JWT auth, tenant isolation, or role-based guards.
Example: `const data = parseBody(createTenantSchema)(request.body);` in tenants.ts

## P-005 — Polymorphic catalog with type enum
Date: 2026-04-22
Where in codebase: packages/shared/prisma/schema.prisma CatalogItem model, apps/api/src/services/recommendations.ts
The pattern: Catalog items share a single table with a `type` enum or string discriminator (e.g., DRIP, INJECTION, ADD_ON). Recommendation logic can apply type-specific scoring or filtering without separate tables.
When to use: When a clinic catalog contains multiple product types that share most fields (name, description, ingredients, price) but need behavioral differentiation.
Example: `if (item.type === 'DRIP') score += 0.5;` in recommendations.ts scoreCatalogItems.

## P-006 — Store full match metadata in JSON audit columns, not just IDs
Date: 2026-04-22
Where in codebase: apps/api/src/services/patterns.ts persistPatternMatches
The pattern: When persisting structured match data to JSON columns, store the full metadata object (including confidence, weight, values) rather than flattening to bare IDs or names. This preserves audit granularity and prevents data loss when the upstream source changes.
When to use: For any Json field in Prisma that captures derived match or scoring data.
Example: `matchedSignals: p.matchedSignals as unknown as object` instead of `.map(s => s.signalName)`.

## P-008 — Database-backed sessions reread current authority
Date: 2026-10-01
Where in codebase: apps/web/lib/auth.ts, apps/web/tests/auth.node.test.ts
The pattern: Store only a random opaque cookie token in the browser, hash it in the session table, and load the current active user, tenant, location and approval authority for every request. Role changes, deactivation and revocation apply to existing sessions.
When to use: V2 authenticated routes and agent channel identity.
Example: `userFromToken` and its actual PostgreSQL authority/revocation integration test.

## P-009 — One typed eligibility gate for clinical outputs
Date: 2026-10-01
Where in codebase: packages/shared/src/v2/engine.ts
The pattern: Validate declared condition semantics at configuration activation, evaluate only confirmed answers of the configured type, and centralize required clinical screening in product eligibility. Initial and wellness selection both use the same gate.
When to use: Any generated or staff-selected clinical item, including future services.
Example: `evaluateConfiguredCondition` and `evaluateProductEligibility`, covered by the foundation audit regression cases.

## P-010 — Bind agent context to the selected location and owner
Date: 2026-10-01
Where in codebase: apps/web/app/api/setup/route.ts, apps/web/agent/channels/eve.ts, apps/web/agent/lib/scope.ts
The pattern: Persist the validated tenant, owner, location and agent session binding when creating a conversation. Recheck that exact binding on continuation, tools and approved memory recall; older unbound conversations remain unavailable instead of inheriting a default location.
When to use: Multi-location durable setup assistants and private agent sessions.
Example: The actual PostgreSQL setup-scope suite uses a selected second location and rejects foreign, mismatched, legacy unbound and deactivated-owner contexts.

## P-011 — Reviewed preview adaptation has an exact source manifest
Date: 2026-10-02
Where in codebase: docs/AUDIT_DEPLOYMENT.md, external isolated preview stage
The pattern: Compare every staged tracked file directly against the selected Git commit, allow only the documented preview configuration difference, and exclude credentials from the upload. Apply exact migrations to an isolated database and separately compare schema plus migration checksums before hosted verification.
When to use: A platform-plan limitation requires an isolated synthetic preview adaptation without changing approved production behavior.
Example: The d4239d5 stage compared 293 tracked files, changed only apps/web/vercel.json crons, added only the nonsecret Vercel project link and contained zero environment files.

## P-012 — Verify native dependencies from each deployed agent bundle
Date: 2026-10-02
Where in codebase: apps/web/agent/agent.ts, apps/web/scripts/verify-eve-prisma-output.mjs
The pattern: Use the installed framework's supported external-dependency tracing, generate the deployment runtime's native engine, and fail the build if package or engine resolution leaves a physical function bundle. Validate each packaged client with its own engine against isolated PostgreSQL, and prove the guard rejects an artifact with the engine removed.
When to use: Agent or workflow service bundles use a native dependency independently of the Next.js service.
Example: Both Node 24 eve server and workflow bundles passed real Prisma queries with their bundled RHEL engine; an external missing-engine copy failed validation.

## P-013 — Separate retained archive paging from reporting dates
Date: 2026-10-02
Where in codebase: apps/web/lib/clinic.ts, apps/web/components/clinic-context.tsx, apps/web/components/dashboard.tsx
The pattern: Validate bounded server-backed search and keyset pages under the current tenant/location/filter, ordered by immutable creation time plus unique ID. Archive browsing includes every retained age while historical metrics keep their own date predicates. New client filter requests invalidate stale responses; page failure preserves loaded records.
When to use: Retained-record search and pagination that must coexist with period-based outcome dashboards.
Example: TASK-020 actual PostgreSQL walks 251 tied-time records, finds/restores a 500-day-old visit and retains metric denominators; browser failure/retry and stale-response checks pass.

## P-014 — Each audio segment owns a monotonic active capture budget
Date: 2026-10-02
Where in codebase: apps/web/lib/recording-clock.ts, apps/web/components/audio-recorder.tsx
The pattern: Give every native MediaRecorder its own monotonic active-time clock and remaining-limit timer. Pause cancels its timer without losing fractional elapsed capture; resume schedules the remaining budget; stop freezes duration before asynchronous delivery. Completed durations plus the current clock drive the visible timer, and captured retry metadata remains immutable.
When to use: Shared consultation and setup voice recording, including pauses, rollover and interrupted/unmounted capture. Do not reuse wall time or a shared old-segment timer to account for audio duration.
Example: TASK-026 six focused timing regressions plus real synthetic Chromium event observations prove pause exclusion, paused stop and a 60,000 ms rollover after repeated resumes, with ordered nonempty segments.
