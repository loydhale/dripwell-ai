# TASK-012 — Admin UI Polish: Notifications, Remove Progress Toggle, Merge Analytics

```
TASK_ID: TASK-012
TITLE: Admin UI Polish
PARENT_REQUEST: Loyd's feedback: add notification bell, remove patient-visible progress toggle, merge analytics into dashboard.

GOAL (one sentence):
Polish the admin panel by adding a notification bell, removing the patient-visible progress toggle, and merging the analytics page into the dashboard.

SCOPE:
In scope:
- Add notification bell icon to admin header (top right, next to user name)
  - Bell icon with red badge showing unread count
  - Dropdown on click showing recent notifications
  - Notifications: new assessment completed, provider invited, safety flag triggered, catalog item low stock
  - Mark individual notifications as read
  - Mark all as read button
- Remove "Show patient-visible progress during assessment" toggle from Settings page
  - Remove from UI
  - Remove from database schema (Tenant.config or wherever it lives)
  - Remove from seed data
- Merge Analytics page into Dashboard
  - Move all analytics cards and tables to Dashboard page
  - Remove Analytics from sidebar nav
  - Dashboard now shows: overview cards + recent activity + analytics sections
- Update sidebar: remove Analytics link
- Ensure all changes typecheck and build

Out of scope:
- Do NOT build real-time notification system (polling is fine for v1)
- Do NOT add email/push notifications
- Do NOT add notification preferences/settings

FILES LIKELY INVOLVED:
- apps/admin/src/components/Layout.ts — add notification bell to header
- apps/admin/src/components/NotificationDropdown.ts — new notification dropdown
- apps/admin/src/pages/Settings.ts — remove progress toggle
- apps/admin/src/pages/Dashboard.ts — add analytics content
- apps/admin/src/pages/Analytics.ts — remove or merge
- apps/admin/src/main.ts — remove analytics route
- packages/shared/prisma/schema.prisma — remove progress toggle from config
- apps/api/src/routes/admin.ts — notification endpoints

RELEVANT MEMORY ENTRIES:
- PRD F-11: Super User Admin Panel (updated)
- PRD F-11a: Admin Notifications

ACCEPTANCE CRITERIA:
- [ ] Notification bell visible in admin header
- [ ] Bell shows unread count badge
- [ ] Clicking bell shows dropdown with recent notifications
- [ ] Notifications can be marked as read
- [ ] Patient-visible progress toggle removed from Settings
- [ ] Analytics content merged into Dashboard
- [ ] Analytics removed from sidebar
- [ ] All pages typecheck and build
- [ ] Database schema updated (migration if needed)

NOTES / HINTS:
- For notifications, create a simple Notification model or use AuditLog as source
- Polling every 30 seconds is fine for v1 (no WebSocket needed)
- Keep the notification UI clean — list of items with timestamp and type icon
- The dashboard should feel like a proper home page, not just settings
```
