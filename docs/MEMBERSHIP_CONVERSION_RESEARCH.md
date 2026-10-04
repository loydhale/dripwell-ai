# DripWell membership/program conversion research

Owner steering, October 4, 2026: help an IV spa convert appropriate new-client visits into clinic memberships or programs and improve client satisfaction. Recording and administration support that purpose. This report informs the existing F-06/F-07/F-10/F-12 scope; it does not expand the pilot definition or claim verified sales lift.

## Findings and priorities

| Priority | Product improvement | Existing coverage and remaining source gap | Scope |
| --- | --- | --- | --- |
| 1 | Make confirmed membership enrollment visible to the owner and staff, alongside care starts and pending decisions. | The backend already supplies `membershipEnrollments`; the consultation can record true/false/unknown. Neither dashboard's primary metrics displays enrollment. Show confirmed enrollment, known non-enrollment and unknown with an explicit consultation denominator. Wellness acceptance remains a separate decision, never a sale or collected payment. | F-06/F-12, existing approved scope. First bounded product task after the active verification queue. |
| 2 | Give staff a clear approved offer they can explain: the client's stated goal, a suitable membership/program, its relevant approved benefit, official price and commitment, plus an optional eligible alternative. | Wellness matching already selects eligible location services/memberships with goal evidence, approved rationale, price and terms. The takeaway renders those fields, but its general explanation is a generic invitation to ask the clinic. Improve presentation and staff wording using those existing facts. Never invent a benefit, savings claim, treatment frequency or guarantee. | F-02/F-07, existing approved scope. Separate small presentation task; retain staff approval and revision invalidation. |
| 3 | Make price and commitment easy to understand before a decision. | Clinic setup already captures membership benefits/prices/terms. Published IV memberships demonstrate that expiry, included credits, excluded services, minimum commitment and location restrictions materially change an offer. Present clinic-provided terms prominently. Missing details should trigger setup clarification, not inferred terms. | F-01/F-07, existing approved scope. A savings calculator or new structured billing model needs its own concrete scope review. |
| 4 | Help staff resolve a TBD decision with context and an obvious next action. | Approved wellness decisions support an optional note; persistent staff reminders and owner overdue views already exist. Clarify the staff workflow around the client's reason and resolving the decision. Preserve the exact six stages, archive semantics and reminders. | F-08/F-09, existing approved scope. Patient SMS/email campaigns and CRM integration remain outside scope. |
| 5 | Let owners improve what fits and what gets explained using actual decisions and staff corrections. | Owner-only adjustment review, reasons, suitability context and tested version activation already exist. Make commercial outcome context easier to inspect alongside an adjustment. Budget, preference and contraindications can explain a decline or appropriate staff change. | F-10/F-12, existing approved scope. No automatic policy changes or pressure to recommend more. |
| Proposal | Collect a brief post-visit satisfaction response. | Satisfaction is an intended outcome, but the PRD explicitly treats a post-visit rating as a separate idea. No current rating measurement is claimed. | New scope, retain as a proposal. Do not implement or send surveys without the appropriate approval. |

The recommended product focus is an understandable offer and an accurately recorded result. DripWell does not collect the clinic's membership payments; its Stripe subscription is the clinic's payment for DripWell. Confirmed enrollment, staff-reported collected amount and provider-verified platform payment remain separate.

## Public sources actually inspected

The public pages below returned HTTP 200 on October 4, 2026, around 19:34 UTC. Captured HTML, extracted visible text and fetch metadata remain in private working evidence. This published report preserves the inspected URLs, observations and research limits. Research used ordinary read-only HTTPS through the environment's inherited proxy and certificate configuration. No account, form, email, checkout, client record or video was accessed.

| Source | Relevant observed features or terms | Implication for DripWell |
| --- | --- | --- |
| [Zenoti membership and packages](https://www.zenoti.com/platform/membership-and-packages) | Recurring memberships and prepaid bundles, tailored tiers/benefits, front-desk/online presentation, usage/revenue/retention reporting, configurable expiry/rollover. | Make the approved offer clear and track actual outcomes; do not build an entire practice-management billing system. |
| [Boulevard memberships and packages](https://www.joinblvd.com/features/members-and-packages) | Monthly/annual memberships and custom packages, presentation during booking or in-person checkout. | Staff need an easy-to-convey offer at the decision point. DripWell's approved sequence produces the wellness offer after care is recorded. |
| [Pabau memberships](https://pabau.com/features/memberships/) | Membership tiers for different budgets, recurring benefits, membership details in the client record, distinction between recurring membership and upfront package. | Match preferences and budget using approved options; clearly explain the offer type and commitment. |
| [Restore memberships](https://www.restore.com/memberships) | Location-specific pricing, different credit expiration rules, exclusions including a tier's credits not applying to IVs, optional membership, cross-location exceptions. | Price alone is insufficient; display the clinic's own actual benefits and restrictions. |
| [Restore membership options](https://www.restore.com/blog/restore-hyper-wellness-membership-options) | Tier descriptions, credit expiry and published minimum-commitment/renewal terms. | Explain terms before the client decides. These are Restore's terms, never DripWell defaults. |

Vendor claims about higher revenue, retention or health benefits are marketing statements. These sources establish publicly described product features and offer practices; they do not establish a causal conversion improvement for DripWell. No competitor price, service claim or commitment has been copied into a clinic configuration. Research reviewed page text, not an operational competitor account or visual product walkthrough.

## Current source observations

- `packages/shared/src/v2/engine.ts`, `recommendWellness`: reviewed facts, actual care, eligibility, location catalog, goal evidence, approved rationale, official price/currency and terms determine draft offers. The current general explanation asks the client to ask their clinic about optional next steps.
- `apps/web/components/consultation.tsx`: staff can edit/approve the wellness output, indicate accepted/rejected/TBD with a note, and separately record optional membership enrollment/service purchase and an amount. Unknown is supported. These are source observations, not a complete live visit.
- `apps/web/lib/clinic.ts` and `apps/web/components/clinic-context.tsx`: reporting includes `membershipEnrollments` in the selected period; the currently displayed dashboard/owner overview cards focus on care starts and wellness decisions.
- `apps/web/components/dashboard.tsx` and `apps/web/components/owner.tsx`: selected-period denominators and excluded setup tests are described; archived visits remain in historical reporting. Presenting enrollment must preserve those definitions and location/role boundaries.
- The current care mutation also invalidates wellness output/approval when recorded care changes. A future commercial workflow review must account for that dependency; no proposed shortcut can silently preserve a stale approved takeaway.

## Bounded next product brief

Once the current maintenance source and its separately queued recurrence evidence are closed, prepare a small F-06/F-12 task to expose enrollment reporting already supported by the approved data model. Prefer a clear membership enrollment card and owner breakdown. Keep true/false/null distinct, show selected-period/location scope, exclude setup tests, retain archived history and label staff confirmation accurately. Program/service purchases need their own clearly defined aggregate; do not relabel all service purchases as program sales.

Meaningful verification should include two tenants, mixed true/false/null outcomes, wellness acceptance without enrollment, archived visits, date boundaries and excluded setup tests. Only rerun checks affected by the implementation. The same Coder implements and same Auditor reviews; Root owns the brief and queue. The research phase changed no application source or clinic configuration; this report and the minor goal clarification are documentation reviewed at task closure.

Then prepare a separate F-07 presentation brief using existing approved offer fields. Verify absent benefits/terms stay absent or require clarification, different clinic prices remain distinct, staff edits bind to approval, the approved document/PDF shows the same fields, and the ordinary no-membership outcome remains valid.

## Measurement

Report confirmed enrollment / all selected-period new consultations with unknown outcomes shown separately. A known-outcome-only rate may be shown only with its denominator and missing-data count. Show care starts, wellness decisions and service purchases separately. Do not infer collected revenue from enrollment. Do not claim lift until a representative pilot supplies a baseline, comparable periods and sufficient recorded outcomes; suitability, clinic, staff and missing outcomes can change comparisons. Client satisfaction is not yet measured by the app.
