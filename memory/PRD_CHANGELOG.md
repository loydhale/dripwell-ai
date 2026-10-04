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

## 2026-10-01 — v2.0 — MINOR
Section changed: Architecture/development requirements.
Summary: Owner explicitly confirmed mandatory use of the downloadable Vercel Plugin for coding and review.
Task trigger: V2-PLUGIN, direct.
CTO: Development workflow clarification, no new product feature or hosted-service requirement.
Auditor co-sign: documentation_audit, PASS, 2026-10-01.
Owner authorization: 2026-10-01 conversation.

## 2026-10-01 — v2.0 — MINOR
Section changed: Implementation status, architecture, explicit defaults and scope governance.
Summary: Recorded the authorized implementation, pinned runtime, registration-based trial activation and recipient-email sharing controls. Preserved open credit terms and distinguished source verification from live deployment.
Task trigger: Owner instruction to finish the software; V2-COMBINED.
CTO: Implementation details within the existing v2 scope; no new feature.
Auditor co-sign: implementation_audit, PASS, 2026-10-01. Minor implementation details remain within owner-authorized v2 scope; source/local runtime verification is distinct from live deployment and commercial decisions.

## 2026-10-03 — v2.0 — MINOR, OWNER-DELEGATED COMMERCIAL CHOICES

Section changed: Product purpose, F-11, explicit defaults and scope governance.
Summary: Owner explicitly authorizes choosing editable starter pricing and clarifies conversion/client-satisfaction goals. CTO chooses USD199 per clinic account/month and USD50 one-time qualifying paid-referral credit with30-day attribution/refund reversal/no expiry/no cash payout. Existing trial, clinical suitability, authority and historical version controls remain. Post-visit satisfaction collection is a proposal only; no feature was silently added.
Task trigger: TASK040 and direct Owner clarification2026-10-03.
Owner authorization: "You can decide on that pricing... we can change it later." No paid service purchase, real charge, clinical-rule change or full-pilot claim is inferred.
Auditor co-sign: commercial_auditor, PASS,2026-10-03. Minor Owner-delegated commercial choices and product-goal clarification are within existing scope; source/runtime verification remains a separate task boundary.

## 2026-10-04 — v2.0 — MINOR, SCOPED SETUP VERIFICATION

Section changed: Section8 factual verification checkpoint and Updated date.
Summary: Records independently verified inactive two-clinic setup/tests/questions/tenant-denial/cleanup evidence. Preserves identical synthetic-fixture limits and every pilot completion criterion unchanged.
Task trigger: TASK-045, existing F-01/F-02 and tenant-boundary verification.
CTO: No scope, authority, clinical-rule, architecture or completion-definition change.
Auditor co-sign: commercial_auditor, PASS, 2026-10-04. Minor factual evidence checkpoint only; all nine pilot criteria remain byte-identical, and identical-price/inactive-version limits remain explicit. Exact whole-document publication review is separate.

## 2026-10-04 — v2.0 — MINOR, OWNER SECURITY CHECKPOINT

Section changed: Section8 factual verification checkpoint only.
Summary: Records scoped normal-owner MFA/recovery/session/account/cleanup evidence and the accepted existing-maintenance source/compiled/Blob verification split; all nine pilot criteria remain unchanged.
Task trigger: TASK046, existing role/security and F09 service/retry scope.
CTO: No scope, clinical authority, architecture or completion-definition change.
Auditor co-sign: commercial_auditor, exact final package review required before publication; genuine review receipt accompanies this closure.
