# TASK-073: Refresh saved care commercial fields with the visit

TASK_ID: TASK-073
PARENT_REQUEST: Owner: "Please keep working to get this done." Standing until-done authorization, feat/dripwell-consultation-v2, PR #2.
STATUS: IMPLEMENTED_SOURCE_REVIEW_PENDING. Coder handoff is frozen; independent applied-source review, first changed-source CI and distinct learning remain pending.
BASELINE: 6e9eb0ccf22d5d9517cbb1252923484f0310fd98. Local checkout and normal GitHub ref/open PR2 match; checkout clean before this brief. Only Root and its single read-only Coder assessment were active.

## Goal and scope

Keep the actual-care commercial form consistent with the saved visit after a successful reload, so a later current-version save cannot silently restore stale enrollment, service-purchase or collected-amount values.

Continuous-mode Tier2 candidate under existing F06 and PRD8 criteria3/5/9. The Coder's new source assessment identified that CareOutcome initializes commercial fields from actualCare, but its reload effect only refreshes clinical outcome/items/observations/reason. The same component survives Consultation.load while the loaded visit version changes. Independent Auditor must confirm a reachable stale overwrite, its distinction from ordinary version-conflict denial and its small proposed repair before implementation. This is a newly identified interface-state defect, not a production layout selection or a reset of an old verification allocation.

In scope:
- Correct the existing actual-care form's synchronization with saved actualCare, retaining its current authoritative reload boundary and clinical fields.
- Preserve confirmed enrollment, explicit decline, unknown/not-recorded, selected membership, service purchases and collected amounts as separate facts. Preserve false, null and zero according to the existing contract.
- Add meaningful real-component DOM regression coverage for loaded saved commercial changes followed by a save using the newly loaded version. Drive the actual Consultation/CareOutcome handlers and actual client request functions with controlled transport/context leaves.

Out of scope:
- GUI redesign or selection of the final production prototype; new outcomes, billing rules, clinical protocols, approvals, stage transitions or persistence contracts.
- New auth/account authority, admin bootstrap, providers, purchases, email/DNS/account changes, real client data, migrations or deployment.
- Local application import/test/build/typecheck/generation or any retained TASK066 process/database/node_modules effect, inventory or disposal. TASK057 remains permanently parked.
- Replay of accepted application checks/provider probes or resetting TASK052/TASK061R1/TASK064/TASK066 allocations. This independent UI task owns no existing service/gate clock.

## Coder paths and role split

- apps/web/components/consultation.tsx: minimal existing CareOutcome refresh correction, no new public test hook or backend change.
- apps/web/lib/care-outcome-refresh.test.ts: new actual-component DOM regression using the already-pinned jsdom27.4.0 and React19.3 act/createRoot conventions.

No dependency or lockfile change is planned. If a genuinely necessary directly related additional source path is discovered, report the reason for a revised bounded brief before changing it. Root owns brief/queue/STATE/CHANGELOG; the Coder implements these paths; an independent Auditor reviews and owns distinct learning. The independent Auditor also co-signs final documentary evidence before publication.

## Memory and required guidance

Read the current nine boot files, Coder persona and CODING_LOOP before implementation. Apply L-016 (every fetched edit field), L-013/L-035 (writer/reader contracts), L-037 (actual test selection/reporter), L-042 (test helper boundaries), P-027 (saved offer facts), G-005 (avoid implicit pnpm install) and G-019 (read actual evidence envelopes).

Mandatory open-source Vercel Plugin guidance is available through connector skills c12/react-best-practices and c12/verification; record exact skill resources actually read. Use version-matched installed React/ReactDOM19.3, Next16.3.8 and Vitest5/jsdom27.4 documentation/types when choosing APIs. Relevant guidance and post-TSX React review are required. No framework installation or full Software Factory activation is selected.

## Acceptance and validation

1. An independent source review confirms the new reachable defect and admits this scope before the Coder edits application code.
2. A real mounted care form reflects a later successfully loaded actualCare commercial update; all saved commercial controls correspond to that loaded value and the next save sends those values with the current visit version. The previous values are not silently restored.
3. Regression coverage distinguishes enrollment/decline/unknown and preserves supported null/false/zero values. Ordinary form editing remains possible before a reload; no artificial clinical/enrollment/payment linkage is added.
   An unchanged-saved-value control reloads a fresh actualCare object with the same JSON.stringify value and a changed visit version, then checks local optional-field edits survive. Preserve the existing serialized dependency; canonical or property-order-insensitive equality is not added.
4. Tests render actual exported application components and drive DOM events, not a duplicated state machine or exported production testing hook. Intercept only external/context leaves as needed; assert actual rendered controls and outgoing request data. Join deferred work and unmount roots in finally.
5. Existing care controls, exact-revision clinical approval, stage/decision/archive semantics and recording/navigation guards are preserved. No service or database effect occurs in DOM transport fixtures.
6. Independent source PASS precedes publication to the same review branch/PR2. First ordinary changed-source CI must use its existing fresh isolated synthetic service and reviewed lockfile, pass builds/types and the new named DOM regressions/full required checks. No local application check, retained target or old CI replay is admitted.
7. Root reads and adopts genuine independent actual-result review. A distinct subsequent learning phase records a justified lesson/pattern/gotcha or NO_NEW_LEARNING. STATE/CHANGELOG and final task/audit records then receive independent co-sign and same-branch publication.

No completed-task count or learning counter advances at planning or source PASS. A scoped completion is recorded only after actual validation and learning. All nine pilot criteria and production gates remain open where currently unverified; this DOM-only fix supplies no actual capture, provider, clinical, sharing, payment, hosted retention or two-clinic full-story evidence. Preview protection, requested ALLOW_REAL_CLIENT_DATA=false and default-disabled maintenance remain in force.

## Current execution and resume

2026-10-10: Coder completed the two declared paths and stopped editing. Root received the full handoff and independently checked the exact file identities in native d513cd: consultation.tsx66504bytes/SHA256b96dd31a979697a84a6bbe2bbcae4875ac58986e6a0cb2feacad486d57cc6900/blob a8c6c10cc73cb1eb0d8e207e4ef96dc625d77876; new care-outcome-refresh.test.ts16091bytes/343lines/SHA256c9c1216e1aacea4048d8aa269dbf9780768f4f0e4ad059f4bb6d494f405762a8/blob bf849ccba192c4c2f2a2c33ba01317b4f609a30a. The Coder reports source-only diff hygiene PASS in native738abd and five controlled real-Consultation DOM cases: USD and KWD conflict/retry/save, explicit false/zero, unknown/null, and identical-serialized-care version reload preserving local edits. No local application import, test, build, typecheck, generation, SQL, provider or browser operation occurred. Root dispatches independent applied-source and pre-publication documentary review next; no test result or scoped completion is claimed.

2026-10-10: managed runtime revision777 is actually running/connected, native shell works, and no peer worker overlapped. Root read current governance/learning and confirmed all nine required files match the same current Git head. The read-only Coder assessment edited no application code and ran no checks. Independent [SOURCE_FINDING/PLAN_ADMISSION PASS](../docs/AUDIT_CARE_COMMERCIAL_REFRESH.md),17517bytes/SHA256d64684c3f34131537754431b39d0dbe78a6bbec1b7f6bd83a8f9383b8e87d122, was fully read in nativeb8d8af and genuinely adopted in the private ROOT_ADMISSION_ADOPTION.json. The exact original report is retained separately as ADMISSION_AUDIT.md. Root grants the sole Coder the two listed source paths only; no local application operation is granted. Implemented-source review, same-branch publication, genuine first changed-source CI, actual-result review and distinct learning remain separate. All old holds remain unchanged.
