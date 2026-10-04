# TASK-040: Owner-delegated starter platform pricing and referral policy

TASK_ID: TASK-040
STATUS: DONE, scoped independent source/compiled-UI/owned-cleanup PASS. Learning and minor PRD co-sign are recorded; exact reviewed publication at7dd003df and independent remote/new135-test CI PASS are complete. Failed private fixture/browser/collector phases and the overwritten-receipt limitation are retained and excluded from successful proof. Actual hosted activation/billing/full-pilot gates remain open.
ASSIGNED: CODER, independent AUDITOR review required
PARENT_REQUEST: Owner, 2026-10-03: "You can decide on that pricing... we can change it later."
PRD refs: F-11/F-12, section8 trial and qualifying paid referral.

## Goal and authority

Remove the commercial-decision blocker using clear, editable starter values in the existing platform billing/settings flow. CTO selects USD199 per clinic account per month, following the existing tenant subscription and quantity1; do not add location metering or seat-change policy. Referral credit is USD50 once, after the referred clinic's first qualifying paid platform subscription; 30-day referral attribution, refund reverses credit, no expiry, credit applies to future platform invoices and has no cash payout. Existing schema/ledger semantics govern qualification and replay prevention. The normal trial remains14days/10initial consultations without automatic paid conversion. The Owner authorizes these initial commercial choices; this does not authorize buying AI credits, paid Resend/Vercel services or charging real customers.

## Boundaries

Read AGENTS/PRD/boot memory/persona/CONTINUOUS_MODE before work. Workspace /workspace/dripwell-build, branch feat/dripwell-consultation-v2, base2eb79df, PR2. Root CTO owns provisioning and root STATE/PRD/CHANGELOG/session publications; do not edit those files, commit, publish or deploy. Preserve root ICM and authored apps/web/agent/apps/web/workflows. Shared PostgreSQL and hosted apps/web/.env.local are not disposable: no global cleanup, migration replay or provider simulation in deployed code. Use isolated schema-only actual-PG checks if required, clean only owned artifacts, and record exact evidence.

Verify available open-source Vercel Plugin c12 payments/env-vars/Next.js/verification guidance and pinned installed docs. Inspect the existing real Stripe integration and PlatformSettings/referralPolicy version flow before choosing edits. CTO is checking current sandbox provisioning. Initial analysis/planning may run independently; coordinate any real Stripe resource/price creation with CTO. Do not introduce a mock provider, blindly provision another resource or auto-enable an unknown platform administrator. The selected admin/MFA gate remains separate. New configuration must preserve existing overrides and disabled policy choices, immutable historical snapshots, tenant authority and trial accounting.

## Deliverables and checks

- Make the selected platform price and referral terms understandable at the existing owner billing entry points and maintain a canonical editable source/configuration without duplicated inconsistent amounts.
- Provide a safe reviewable mechanism for applying the delegated policy through the existing versioned platform authority. If actual activation requires the still-unselected platform admin, prepare the exact configuration/handoff and report that boundary rather than bypassing it.
- Ensure checkout uses the actual configured recurring Stripe price, never a fabricated price ID or client supplied amount. Coordinate actual sandbox product/price/environment work with CTO only after current resource readiness.
- Preserve first paid qualification, one award, event replay/refund handling, policy versions, referral attribution and future edit behavior. Identify any actual implementation defect in the new path and fix it within the task.
- Meaningful checks should cover canonical amount/currency/interval matching, visible trial/referral terms, version/override behavior and authority/paid qualification relevant to edits. Do not repeat unchanged source or provider checks merely for activity.
- Leave application changes uncommitted, report exact paths/check commands/results, remaining external boundaries and learning candidate to CTO; independent Auditor must PASS before publication. No real clients, charges, emails, provider switch, clinical configuration activation or protection weakening.

ALLOW_REAL_CLIENT_DATA=false remains mandatory. This task does not claim section8 or the pilot is complete.
