# TASK-016 — Feedback & Internal Kanban Board

```
TASK_ID: TASK-016
TITLE: Feedback system with internal Kanban board
PARENT_REQUEST: Loyd wants clinic feedback to go to an internal Kanban board for triage before becoming actual work.

GOAL (one sentence):
Build a feedback submission system for clinics and a Kanban board in the vendor layer for triaging, categorizing, and prioritizing feedback before it becomes development work.

SCOPE:
In scope:
- Feedback submission (from admin panel):
  - Simple form: type (bug, feature request, general), title, description, urgency (low/medium/high)
  - Submitted by any super user
  - Goes directly to vendor Kanban board

- Vendor Kanban board (new page in vendor dashboard):
  - Columns: Backlog / Not Started, In Progress, Done, Won't Do
  - Cards show: title, type, urgency, clinic name, submitted date
  - Triage fields (vendor-only):
    - Category: Software Issue, Process Issue, Documentation, Other
    - Decision: Do It, Don't Do It, Maybe, Needs More Info
    - Priority: P0 (critical), P1 (important), P2 (nice to have)
    - Assigned to: (team member)
    - Notes: (internal discussion)
  - Drag cards between columns
  - Filter by: category, decision, priority, clinic
  - Search cards

- Integration with task system:
  - When card moves to "In Progress" and category is "Software Issue", optionally create a GitHub issue or task brief
  - Link back to original feedback card

Out of scope:
- Do NOT build real-time collaboration (comments on cards)
- Do NOT build email notifications for feedback status changes
- Do NOT build advanced reporting/analytics on feedback
- Do NOT allow clinics to see the Kanban board (vendor-only)

FILES LIKELY INVOLVED:
- New vendor dashboard app (or extend admin with vendor routes)
- apps/api/src/routes/feedback.ts — feedback submission API
- apps/api/src/routes/vendor.ts — vendor Kanban API
- packages/shared/prisma/schema.prisma — Feedback model
- Vendor frontend pages: FeedbackKanban.ts, FeedbackCard.ts

RELEVANT MEMORY ENTRIES:
- PRD: Vendor layer (System Admin role)
- PATTERNS: P-001 — branded ID types

ACCEPTANCE CRITERIA:
- [ ] Super user can submit feedback from admin panel
- [ ] Feedback lands in vendor Kanban as "Backlog"
- [ ] Vendor can triage: set category, decision, priority
- [ ] Vendor can move cards between columns
- [ ] Filter and search work
- [ ] Software issues can be promoted to actual tasks
- [ ] Multi-tenant: feedback tagged with clinic

NOTES / HINTS:
- Keep the Kanban simple — no need for complex drag-and-drop libraries
- The vendor layer is separate from the clinic admin panel
- Feedback is read-only for clinics (they submit, you manage)
- This is your product management tool — keep it fast and functional
```
