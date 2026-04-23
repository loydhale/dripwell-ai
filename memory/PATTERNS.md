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
