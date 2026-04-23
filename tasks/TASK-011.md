# TASK-011 — Super User Admin Panel (F-11)

```
TASK_ID: TASK-011
TITLE: Super User Admin Panel
PARENT_REQUEST: PRD requires a super user admin interface for catalog management, location settings, user management, analytics, and audit logs.

GOAL (one sentence):
Build the desktop admin panel (apps/admin) where super users manage their clinic catalog, providers, settings, and view analytics.

SCOPE:
In scope:
- Admin app scaffold in apps/admin (already exists, needs pages built)
- Auth: Login screen for super users only
- Dashboard overview: assessment counts, provider activity, recent assessments
- Catalog management:
  - View all catalog items (drips, add-ons, injections, peptides)
  - Add new items via form
  - Edit items inline
  - Toggle items in/out of stock
  - Soft delete items
- Provider management:
  - Invite new providers (generate invite link or email)
  - List providers with status
  - Deactivate/reactivate providers
- Location settings:
  - Update clinic name, state
  - Set medical director contact
  - Configure intake form length
  - Toggle patient-visible progress
- Analytics (basic):
  - Assessments run (total, this week, this month)
  - Recommendation acceptance rate
  - Override reason distribution
  - Flag tier distribution
- Audit log viewer:
  - Exportable table of all actions
  - Filter by date range, action type, user
- Multi-tenant: super user only sees their own clinic data
- Responsive desktop layout (admin is desktop-first, not tablet)

Out of scope (do NOT do these even if tempting):
- Do NOT build complex charts or graphs (tables and numbers are fine for v1)
- Do NOT add real-time notifications
- Do NOT build role/permission editor (SuperUser vs Provider is hardcoded)
- Do NOT add billing or subscription management
- Do NOT add multi-location support (one tenant = one location for v1)

FILES LIKELY INVOLVED:
- apps/admin/src/main.ts — entry point, router setup
- apps/admin/src/pages/Login.ts — admin login
- apps/admin/src/pages/Dashboard.ts — overview dashboard
- apps/admin/src/pages/CatalogManager.ts — catalog CRUD
- apps/admin/src/pages/ProviderManager.ts — provider invites/management
- apps/admin/src/pages/Settings.ts — location settings
- apps/admin/src/pages/Analytics.ts — basic analytics
- apps/admin/src/pages/AuditLog.ts — audit log viewer
- apps/admin/src/components/ — shared admin components
- apps/admin/src/lib/api.ts — API client
- apps/admin/src/styles/admin.css — admin styles
- apps/api/src/routes/ — new admin-only routes if needed

RELEVANT MEMORY ENTRIES:
- PRD F-11: Super user admin panel
- PRD F-1: Catalog configuration (during onboarding)
- PRD: Role-based access (SuperUser vs Provider)
- LESSONS: L-006 (error classes), L-009 (static IDs)
- PATTERNS: P-001 — branded ID types, P-003 — Fastify plugin + Zod validation

ACCEPTANCE CRITERIA (Auditor will check these):
- [ ] Admin app builds and runs on port 3001
- [ ] Login screen for super users
- [ ] Dashboard shows assessment counts and provider activity
- [ ] Catalog manager: view, add, edit, toggle stock, delete items
- [ ] Provider manager: invite, list, deactivate providers
- [ ] Settings: update clinic info, configure features
- [ ] Analytics: basic numbers for assessments, acceptance rate, overrides, flags
- [ ] Audit log: view and filter actions
- [ ] All routes enforce SuperUser role (403 for Provider)
- [ ] Multi-tenant isolation enforced
- [ ] API endpoints for admin operations exist and are protected

NOTES / HINTS:
- The admin app is a separate Vite app (already scaffolded at apps/admin/)
- Use vanilla TypeScript (no React framework) for consistency with the PWA
- Style should be clean, clinical, functional — not flashy
- Tables are fine for v1 — no need for fancy data grids
- API endpoints may need to be added to apps/api for admin operations
- Use the same auth pattern as the main app (JWT stored in memory)
- Provider invites can be simple: generate a signup link with a token
- Analytics can be computed from existing DB tables — no new tables needed
- The admin panel is desktop-first (clinic owners use laptops, not tablets)
```
