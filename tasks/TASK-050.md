# TASK-050: Approved membership and program offer presentation

TASK_ID: TASK-050
STATUS: QUEUED, existing-scope planning only. No source/helper/provider operation is authorized by this brief before Root dispatch.

Planning only. Select after the current verification queue and enrollment-reporting slice, using the actual then-current source. This queued plan addresses approved PRD F-01/F-02/F-07; it adds no payment provider, medical protocol, patient campaign or new catalog type.

## Source observations to verify in the task

The clinic catalog contract already captures `benefits`, `terms`, official price/currency and a validated rationale. `recommendWellness` selects eligible goal-matched services/memberships and snapshots rationale, goal evidence, price and terms. The current takeaway renders name, price, rationale and terms; the general explanation is an invitation to ask the clinic about optional next steps. Do not infer that the current rendered document includes every catalog benefit.

## Intended result

Staff should be able to explain a suitable offer in one short sequence: the client's reviewed goal or preference; why this approved option fits; what the clinic actually includes; the official price and applicable commitment/limitations; the client's decision. Keep offers optional and within approved eligibility/rules. An eligible alternative can appear only when the current approved selection includes it. Do not invent savings, cadence, outcomes, missing terms or benefits.

Improve the staff-facing offer card and approved takeaway clarity. Present official benefits/terms in readable groups; avoid a large block of fine print as the only explanation of commitment. Where billing frequency or commitment exists only in clinic-supplied terms, display that text faithfully. Do not infer a monthly period from a price or introduce an unreviewed terms parser.

## Durability and approval boundary

Any newly presented benefit must come from the offer's approved immutable configuration/revision. Never enrich a historical takeaway with the clinic's current catalog after a price or benefit change. Inspect the exact document/PDF snapshot contracts before choosing the smallest compatible implementation. Preserve historical stored artifacts and source-version provenance. If generation semantics change, use the project's actual versioning contract rather than silently reuse an old engine/prompt identity.

Staff can edit the explanation through existing tracked review. Client output must remain bound to an explicitly approved revision; later edits invalidate approval as currently required. Secure share/PDF must show the same approved offer facts as the on-screen document. Internal transcripts, adjustment notes and medical flags do not become sales material. Any unknown or unsafe choice remains blocked under the existing rules.

## Verification and scope

Use distinct synthetic clinics with different official prices/benefits/terms and the actual current source. Meaningful affected checks should cover missing benefits/terms, a catalog change after a historical approval, staff-edited wording/reapproval, unconfirmed/declined wellness-offer preference, ineligible/unavailable products, no suitable offer and unchanged ordinary visit completion without membership. Confirm output/PDF/share facts agree where the implementation touches those paths.

Root writes the actual bounded task/queue; the same Coder implements using mandatory Vercel Plugin/version-matched framework guidance; the same Auditor independently reviews source, real checks and learning. Source work or provider operations require a concrete Root dispatch and the applicable independent execution-plan review. Keep protected Preview and literal ALLOW_REAL_CLIENT_DATA=false; actual model/full-pilot evidence remains separately required.
