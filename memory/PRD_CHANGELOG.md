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

## 2026-10-04, v2.0, MINOR, MEMBERSHIP GOAL AND MAINTENANCE CHECKPOINT

Sections changed: Existing product-purpose/F12 clarification and factual section8 checkpoint.
Summary: Owner October4 reaffirms suitable clinic membership/program conversion and client satisfaction. Visible confirmed enrollment, unknown outcomes and explicit consultation-visit denominators clarify existing F06/F12. Records scoped maintenance source/build/cleanup evidence and leaves native recurrence/hosted/Blob work separate. All nine section8 criteria remain byte-identical, SHA25686ecf970a1adca878346cab6836643488d58d539c0cb84691a132cf935ce71ad.
Task trigger: TASK047 closure and Owner product steering; researchscopee8a97e7c/goal-offerscope88098012 independently PASS.
CTO: No new survey, campaign, clinical policy, integration, payment, authority or completion-definition change. Research is vendor product/terms evidence, not measured lift.
Auditor co-sign: Exact frozen whole-package review required before publication; independently approved goal/offer drafts and actual3dd24059/ffd7d22f/learning7877bcc2 are bound as prerequisites.


## 2026-10-05, v2.0, MINOR, COMPILED MAINTENANCE CHECKPOINT

Sections changed: Factual section8 checkpoint only.
Summary: Local compiled timer/recovery/stop/closure evidence81414db8/50bd031e supplements the existing maintenance source checkpoint. All nine acceptance criteria remain exact, SHA2560f7d461c15feb4208c390eeb028948d40edb710e415310586a518691dfdb0456.
CTO: No feature, clinical authority, architecture or completion-definition change. Hosted/Blob/provider/full-pilot gates remain open.
Auditor co-sign: Exact frozen closure-package review required before publication; genuine runtime/cleanup/learning receipts accompany the package.

## 2026-10-05, v2.0, MINOR, CLIENT MEMBERSHIP REPORTING CHECKPOINT

Sections changed: Factual section8 checkpoint only, existing approved F06/F12.
Summary: Same-row complete consultation cohort membership partition and primary UI source/check/build evidence4b16c23d; original failure/focused exclusions and SQL/browser/live-sales limits retained. All nine numbered pilot criteria remain byte-identical, SHA2560f7d461c15feb4208c390eeb028948d40edb710e415310586a518691dfdb0456.
CTO: No feature, authority, price, clinical policy, architecture or completion-definition change. TASK050 and live/full-pilot gates remain separate.
Auditor co-sign: Exact frozen final package review required before publication; genuine source/results/route/learning receipts accompany the package.

2026-10-05 TASK-050 minor source checkpoint: existing F01/F02/F07 approved offer facts/versioning and eighteen distinct composite cases/PDF3/types/production Webpack evidence recorded; all nine section8 criteria and real-data/service gates unchanged. Independent source/results cd5c956e and learning/audit58ba9293 PASS; final whole-package PRD co-sign remains a separate prepublication gate.

2026-10-05 TASK-050 final minor PRD co-sign is independently PASS e5531406 for the exact prior frozen package; all926 bytes of nine pilot criteria unchanged. Source published74086258; CI37269377547 is FAILED at an existing test expectation, so no feature/full-pilot completion checkpoint is added.

2026-10-05 TASK050 CI recovery verification-plan clarification: one old test expectation now distinguishes initialv2.1/wellnessv2.2, with sourcePASS10d6c44a and CI-first planPASSf75b9347 acceptedfeaf93ae. Use the unchanged normal corrected-source disposable-PG CI for meaningful verification; unfinished local preparation is parked/unexecuted. No PRD text, nine numbered pilot criteria, feature completion, provider/clinical authority or price change; current CI37269377547 remainsFAILED and future CI closure is required.

2026-10-05 TASK050 actual corrected-source publication/CI closure PASSbcf6fc6c accepted92f56851: scopedDONE/count28, all22listedDripWellsteps successful with individualcounts/skips unobserved and other5suites queued/null. No PRD text, feature criteria, provider/clinical authority or price change; all926 bytes of the nine pilot criteria remain unchanged. TASK051 briefs the already approved deferred recording-deletion queue only. Full pilot incomplete; final closing-doc co-sign remains required before publication.

## 2026-10-05, v2.0, MINOR, RECORDING SAFETY AND COUNT30 DRIFT CHECK

CTO: Added the accepted TASK052 source/CI evidence checkpoint. Numbered section8 criteria, features, clinical/service authority, pricing, architecture and non-goals are unchanged. Count30 drift finds no new approved scope; fixed5+5 TASK053 remains queued independent work and full pilot is open. Auditor minor co-sign is pending the exact final closing package review. Actual source1d32/CI37376530466 PASS751fc776 accepted a43780b3; no source/check/migration/deployment replay.

Auditor CA, 2026-10-05: co-sign MINOR recording-safety evidence checkpoint and count30 drift review; all 12 features and nine pilot criteria remain unchanged.

2026-10-06 TASK053 MINOR evidence checkpoint: record actual fa4/CI37390452897 fixed5+5 cleanup source verification,230tests18files and scopedcount31; all12 features/all9 unchanged pilot criteria, default-disabled maintenance and physical/hosted/full-pilot gates held. Independent Auditor minor co-sign is requested with the complete closing package; no new feature or acceptance criterion.

Auditor CA, 2026-10-06: co-sign MINOR TASK053 cleanup source/first-CI evidence checkpoint at fa4/CI37390452897 and scoped count31; all 12 feature requirements and nine pilot criteria remain unchanged. Default-disabled maintenance, protected807/literalfalse and physical/hosted/full-pilot gates remain held.

2026-10-06 TASK054 MINOR evidence checkpoint: accepted source58b/firstCI37397578008,236tests18files, all22 stages and scopedcount32 recorded. All12 feature requirements and all9 numbered pilot criteria remain byte-identical; no price, authority, architecture, integration or completion-definition change. TASK055 is the existing separate owned compiled/live storage proof. Independent Auditor minor co-sign is pending this exact closing package; physical/hosted/full-pilot gates stay open.

Auditor CA, 2026-10-06: co-sign MINOR TASK054 trusted-store source/first-CI evidence at58b/CI37397578008 and scoped count32. All12 feature requirements and nine pilot criteria remain byte-identical. Maintenance stays disabled; protected807/literalfalse, provenance-index attribution and physical/hosted/full-pilot limits remain held.

2026-10-06 TASK055 MINOR evidence checkpoint: record accepted current compiled/default Blob SDK proof03b6ba41/1706f03b and scopedcount33; all12 feature requirements and nine numbered pilot criteria remain unchanged. No source, price, clinical/service authority, architecture, integration or completion-definition change. Hosted/full-pilot/default-disabled/protected807/literalfalse limits remain. Independent Auditor minor co-sign requested for the exact closing package.


Auditor CA, 2026-10-06: co-sign MINOR TASK055 compiled/default selected Blob SDK evidence03b6ba41/1706f03b and scoped count33. All 12 feature requirements and nine pilot criteria remain unchanged. Hosted/full-pilot, protected807/literalfalse/default-disabled and provenance-index attribution limits remain held.

- 2026-10-06 TASK056 MINOR: record the existing isolated provenance-index source-verification scope. No feature or criterion changes. Combined independent source/package co-sign requested; actual CI remains unexecuted.


Auditor CA, 2026-10-06: co-sign MINOR TASK056 authored provenance-index checkpoint (source c166bc6b). All 12 feature requirements and nine pilot criteria remain byte-held. Static source/package PASS is separate from new compilation, exact P2002/control outcomes and whole retention proof. Count33/Seen5 and all protected/data/default-disabled/full-pilot gates remain held.
