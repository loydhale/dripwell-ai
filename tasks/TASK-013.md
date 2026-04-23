# TASK-013 — Login-As Provider Feature

```
TASK_ID: TASK-013
TITLE: Login-As Provider
PARENT_REQUEST: Loyd wants admin to impersonate providers to see what they see.

GOAL (one sentence):
Build the "login as" feature that lets a super user temporarily impersonate any provider in their clinic.

SCOPE:
In scope:
- Backend: POST /admin/login-as/:providerId endpoint
  - Validates requester is SUPER_USER
  - Generates a temporary JWT with provider's identity but marks it as impersonation
  - Returns token + provider info
- Frontend: "Login As" button in Provider Manager
  - Each provider row has "Login As" action
  - Click opens PWA in new tab with provider's context
  - Pass token via URL hash or postMessage
- PWA: Detect impersonation mode
  - Show banner: "Impersonating [Provider Name] — Admin View"
  - Banner has "Exit" button that returns to admin
  - All actions work as the provider (create assessments, etc.)
  - Audit log marks actions as impersonated
- Security:
  - Impersonation token expires in 1 hour
  - Cannot impersonate a deactivated provider
  - Cannot impersonate another super user
  - Audit log records who initiated impersonation

Out of scope:
- Do NOT allow providers to impersonate other providers
- Do NOT allow impersonation of system admins
- Do NOT persist impersonation state across browser sessions

FILES LIKELY INVOLVED:
- apps/api/src/routes/admin.ts — add login-as endpoint
- apps/api/src/services/admin.ts — impersonation logic
- apps/admin/src/pages/ProviderManager.ts — add Login As buttons
- apps/web/src/main.ts — detect impersonation token in URL
- apps/web/src/components/ImpersonationBanner.ts — banner component
- apps/web/src/lib/auth.ts — handle impersonation tokens

RELEVANT MEMORY ENTRIES:
- PRD F-11b: Login-As Provider
- PATTERNS: P-001 — branded ID types

ACCEPTANCE CRITERIA:
- [ ] Admin sees "Login As" button next to each provider
- [ ] Clicking opens PWA in provider context
- [ ] PWA shows impersonation banner with provider name
- [ ] Banner has Exit button returning to admin
- [ ] All PWA actions work as the provider
- [ ] Audit log marks impersonated actions
- [ ] Token expires in 1 hour
- [ ] Cannot impersonate deactivated providers
- [ ] Cannot impersonate super users

NOTES / HINTS:
- Use URL hash or query param to pass impersonation token: http://localhost:3002/#impersonate=TOKEN
- The PWA auth system should detect this param, validate token, and switch context
- Keep the banner fixed at top of screen, clearly visible
- Make sure the Exit button clears the token and redirects to admin
```
