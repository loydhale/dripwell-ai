# TASK-049: Visible client membership outcomes

TASK_ID: TASK-049
STATUS: QUEUED, existing-scope planning only. No source/helper/provider operation is authorized by this brief before Root dispatch.

Status: planning only. Do not dispatch before TASK047 publication/readbacks and TASK048 recurrence checks are closed. Root reconciles actual then-current branch/queue/worker state before dispatch. This draft follows the October4 Owner clarification that membership/program conversion is DripWell's core commercial purpose.

## Approved scope

PRD F-06 already captures optional confirmed membership enrollment/service purchase; F-12 already requires their reporting. Surface that reporting on the clinic dashboard and owner overview using server-scoped selected-period outcomes. This is an existing-scope implementation improvement, not a new payment processor, CRM or clinical recommendation policy.

## Intended behavior

- Clearly label client membership outcomes so they cannot be mistaken for the clinic's DripWell subscription.
- Present confirmed enrolled, did not enroll and not recorded separately. A nullable outcome is unknown, not a decline. Preserve an ordinary visit without enrollment.
- Show confirmed enrollments and an explicit all-consultation denominator; show missing outcomes beside any known-outcome conversion percentage. Avoid division-by-zero or a misleading 0% when no outcome is recorded.
- Preserve tenant/location/date scope, archived historical visits and excluded setup tests. Board search/pagination must not change complete-period metrics.
- Keep care started, approved wellness accepted, membership enrolled, optional service purchased and collected amount separate. Acceptance alone adds no enrollment; enrollment adds no collected-payment proof.
- Existing service-purchase truth may be reported independently with its actual label. Do not label every purchased service a program or create a new catalog type.
- Preserve owner-only improvement access, existing reporting API authority and protected synthetic-data gates.

## Implementation boundary

Coder chooses the smallest change to the existing dashboard aggregation and typed UI contract. Existing `membershipEnrollments` already provides confirmed positives. Additional true/false/unknown counts must use complete server-selected outcomes rather than the paginated visit list. Do not create a migration, add a provider, generate prices, change care/wellness approval behavior or alter trial/referral billing. Preserve current F-08 stage triggers and F-09 reminders.

Use the existing downloaded Vercel Plugin and version-matched Next/React guidance for the affected code. Keep ICM root folders and authored `apps/web/agent` and `apps/web/workflows`. Root plans/docs, same Coder app work, same Auditor independent review/learning, one source writer.

## Meaningful verification

A focused mixed-outcome test must distinguish true, false, null, absent/invalid care, accepted wellness with no enrollment, archived visits, excluded setup tests, another tenant/location and half-open date boundaries. Confirm known counts plus unknown equal the selected consultation denominator. Test filtered/paginated board independence if that path changes. Test empty-period output and accessible labels.

Run only affected tests/types and the necessary application build. Reuse passing migration/ownership guidance; any DB/browser operation uses a separately reviewed exclusively owned synthetic target and exact closure. Do not replay historical181 checks, closed helpers or unrelated hosted provider attempts.

Then independently review the real source/results, update STATE/CHANGELOG/task and learning, and publish only exact reviewed changes to the same open PR2 branch. Describe the verified scope accurately; no sales-lift or full-pilot claim.

## Next separate presentation slice

Following reporting, improve staff-facing offer and approved takeaway clarity under F-07 using existing stated goals, eligible choices, clinic-approved rationale/benefits, official prices/currency and terms. Prepare a concrete separate brief. Missing data stays missing; no invented savings, cadence or clinical claims. Preserve staff edits, exact-revision approval and PDF/share equality.
