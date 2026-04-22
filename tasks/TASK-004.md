# TASK-004 — Build backend API skeleton (Fastify, auth, tenants)

```
TASK_ID: TASK-004
TITLE: Build backend API skeleton
PARENT_REQUEST: PRD requires Fastify backend with multi-tenant auth, role-based access, and core API routes.

GOAL (one sentence):
Build the Fastify backend API with authentication, multi-tenant middleware, role-based access control, and core CRUD routes for clinics, catalogs, and assessments.

SCOPE:
In scope:
- Create apps/api package with Fastify + TypeScript setup
- Authentication: JWT-based auth with bcrypt password hashing
- Role-based access control (SuperUser vs Provider)
- Multi-tenant middleware: extract tenantId from JWT and enforce data isolation
- Core API routes:
  - POST /auth/register — super user registration
  - POST /auth/login — login for super users and providers
  - GET /me — current user profile
  - POST /tenants — create tenant (super user only)
  - GET /tenants/:id — get tenant details
  - PUT /tenants/:id — update tenant settings
  - POST /catalog — add catalog item (super user only)
  - GET /catalog — list catalog items for tenant
  - PUT /catalog/:id — update catalog item
  - DELETE /catalog/:id — soft delete catalog item
  - POST /providers — invite provider (super user only)
  - GET /providers — list providers for tenant
  - POST /assessments — start new assessment session
  - GET /assessments — list assessment sessions for tenant
  - GET /assessments/:id — get assessment details
- Request validation with Zod
- Error handling middleware
- Health check endpoint GET /health
- CORS configuration
- Rate limiting (basic)

Out of scope (do NOT do these even if tempting):
- Do NOT implement vision AI integration (Gemini API calls)
- Do NOT implement adaptive questioning logic
- Do NOT implement recommendation engine
- Do NOT implement photo capture or upload handling
- Do NOT implement SMS/email sending
- Do NOT add Stripe or payment processing
- Do NOT add admin analytics dashboards

FILES LIKELY INVOLVED:
- apps/api/package.json — Fastify dependencies
- apps/api/tsconfig.json — API TypeScript config
- apps/api/src/index.ts — server entry point
- apps/api/src/server.ts — Fastify instance setup
- apps/api/src/plugins/auth.ts — JWT auth plugin
- apps/api/src/plugins/tenant.ts — multi-tenant middleware
- apps/api/src/plugins/error-handler.ts — error handling
- apps/api/src/routes/auth.ts — auth routes
- apps/api/src/routes/tenants.ts — tenant routes
- apps/api/src/routes/catalog.ts — catalog routes
- apps/api/src/routes/providers.ts — provider management routes
- apps/api/src/routes/assessments.ts — assessment routes
- apps/api/src/routes/health.ts — health check
- apps/api/src/lib/prisma.ts — Prisma client import from shared package
- apps/api/src/lib/validate.ts — Zod request validation helper
- apps/api/src/types/index.ts — API-specific types

RELEVANT MEMORY ENTRIES:
- PRD F-1: Conversational clinic onboarding and catalog ingestion
- PRD F-5: Adaptive questioning (routes stubbed, not implemented)
- PRD F-6: Clinical pattern library (routes stubbed, not implemented)
- PRD F-7: Safety flags (routes stubbed, not implemented)
- PRD F-8: Provider approval gate (routes stubbed, not implemented)
- PRD F-11: Super user admin panel (core routes)
- PATTERNS: P-001 — branded ID types
- LESSONS: L-001, L-002, L-003, L-004 (JSON double-encoding), L-005 (polymorphic catalog pattern)

ACCEPTANCE CRITERIA (Auditor will check these):
- [ ] Server starts with pnpm dev (port 4000)
- [ ] POST /auth/register creates super user with hashed password
- [ ] POST /auth/login returns valid JWT
- [ ] JWT contains userId, role, tenantId
- [ ] All protected routes require valid JWT
- [ ] SuperUser routes reject Provider access (403)
- [ ] Provider routes work for both SuperUser and Provider
- [ ] Multi-tenant middleware filters all queries by tenantId from JWT
- [ ] GET /health returns 200 { status: "ok" }
- [ ] Zod validation returns 400 for invalid requests
- [ ] Error handler returns consistent JSON error format
- [ ] All routes documented with request/response types
- [ ] Prisma client used from shared package (not duplicated)

NOTES / HINTS:
- Fastify has great plugin architecture — use it for auth, tenant, error handling
- Use @fastify/jwt for JWT handling
- Use @fastify/cors for CORS
- Use @fastify/rate-limit for rate limiting
- Keep routes thin — controllers/services pattern for v1.5 if needed, but simple handlers are fine for now
- The Prisma client is in packages/shared — import from there
- Use Zod for request body validation, not manual checks
- For tenant isolation: every query must include where: { tenantId: req.tenantId }
- Error format: { error: string, code: string, details?: any }
- Don't over-engineer — this is a skeleton. The fancy stuff (AI, recommendations) comes later.
```
