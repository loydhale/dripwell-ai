# PRD_CHANGELOG.md

Every PRD edit is logged here. This is how Owner spots drift at a glance.

Format:

```
## <YYYY-MM-DD HH:MM> — v<version> — <MINOR | MAJOR | PENDING>
Section changed: <section number or name>
Summary: <one line on what changed>
Task trigger: <task_id if an edit came from a task, or "direct" if CTO edited independently>
CTO: <approval note>
Auditor co-sign: <initials + date, or "N/A for pending">
Owner approval: <date, or "pending">
```

Rules:
- MINOR entries: CTO writes, Auditor co-signs on next task review
- MAJOR entries: CTO writes as PENDING, moves to APPROVED (or REJECTED) after Owner responds
- Never delete entries. History matters for drift detection.

---

## Entries

(no entries yet — first entry will be v1.0 approval from Owner)

## 2026-10-01 — v2.0 — MAJOR, OWNER-REQUESTED DRAFT
Section changed: Full PRD; v1 archived in docs/archive/PRD-v1.md.
Summary: Consultation recording/guidance, tracked staff review, actual care, wellness documents, exact Kanban triggers, owner-controlled improvement, referrals and 14-day/10-consultation trials; Vercel and ICM/eve implementation plan.
Task trigger: V2-PRD, direct owner request.
CTO: Owner explicitly requested the scope rewrite and ICM/eve structure; implementation defaults/open terms are labelled, not presumed approved.
Auditor co-sign: documentation_audit, PASS, 2026-10-01.
Owner authorization: 2026-10-01 conversation authorizes revised requirements and plan; no production deployment or open commercial terms approved.
