# TASK-015 — Lightweight Vendor Dashboard

```
TASK_ID: TASK-015
TITLE: Lightweight vendor/owner dashboard for multi-tenant oversight
PARENT_REQUEST: Jeff decided to build this after TASK-014 passed audit. Defer GPT-5.4 features to v1.5.

GOAL (one sentence):
Build a lightweight vendor dashboard that gives the DripWell.ai platform owner (you) visibility into all tenant clinics, pattern library management, and basic platform health metrics.

SCOPE:
In scope:
- **Vendor login** — separate from clinic admin. Vendor users are hardcoded or env-configured (no self-signup).
- **Clinic overview** — list all tenants with: clinic name, active providers count, assessments this month, last active date
- **Clinic detail drill-down** — click a clinic to see: provider list, recent assessments (anonymized), catalog size, active status
- **Pattern library management** — view all pattern-intent mappings, add/edit patterns, see which patterns are active/deprecated
- **Platform health** — basic metrics: total assessments today, active clinics, API error rate (last 24h), AI token usage estimate
- **Audit log viewer** — view audit logs across all tenants (who did what, when, with impersonation trace)
- **Super user impersonation** — vendor can impersonate any clinic's super user (see their admin panel view)

Out of scope:
- Do NOT build billing/subscription management (out of scope for v1)
- Do NOT build complex analytics charts (keep it table-based)
- Do NOT build real-time monitoring (polling every 30s is fine)
- Do NOT build multi-vendor support (assume single vendor = you)
- Do NOT build automated alerts or notifications
- Do NOT build role-based access within vendor dashboard (single vendor admin role)

FILES LIKELY INVOLVED:
- New app: `apps/vendor/` — or extend admin with vendor routes if simpler
- apps/api/src/routes/vendor.ts — vendor-specific API endpoints
- apps/api/src/services/vendor.ts — vendor data aggregation
- packages/shared/prisma/schema.prisma — may need VendorUser model

RELEVANT MEMORY ENTRIES:
- PRD: System Admin (Vendor) role
- PATTERNS: P-001 — branded ID types
- LESSONS: L-014, L-015

ACCEPTANCE CRITERIA:
- [ ] Vendor can log in with separate credentials from clinic admin
- [ ] Vendor sees list of all clinics with basic stats
- [ ] Vendor can click into a clinic and see anonymized recent activity
- [ ] Vendor can view and manage pattern library (add/edit/deprecate)
- [ ] Vendor sees basic platform health metrics
- [ ] Vendor can view cross-tenant audit logs
- [ ] Vendor can impersonate a clinic's super user
- [ ] All vendor endpoints are protected (vendor-only access)
- [ ] UI is simple tables and forms, not complex dashboards

NOTES / HINTS:
- Keep this lightweight. The vendor layer is for YOU to manage the platform, not for external customers.
- Tables over charts. Simple is better.
- Pattern library is the most important part — this is how you improve the AI over time.
- Consider building this as an extension of the admin app with vendor routes (simpler than new app).
- If extending admin: add a "Vendor Mode" toggle or separate vendor login that shows different sidebar.
```
