# Two-clinic setup, saved tests and tenant isolation

Status: DONE, scoped verification and learning complete; final document publication review follows. Actual API, all-four-image browser, focused guard and one-time final cleanup results independently PASS. This scoped check does not complete the PRD section8 pilot.

## What was exercised

Two new, normally registered fictional clinic owners used the deployed manual setup flow on protected READY Preview `dpl_AsLremfTJcQ5ew7Cukxn3Ed7n9dJ`, application commit `80729f2f2352fa55b1e0ba911082ab52eeca8032`, tree `f61dbdd0e3e23f0988112b988e4134bc5ef5ab2b`. The stable preview is https://dripwell-ai-preview-loyd-1222s-projects.vercel.app. Preview protection and literal `ALLOW_REAL_CLIENT_DATA=false` remain required.

Each clinic saved an inactive catalog containing the source-reviewed Synthetic IV fixture at USD100, with “Test fixture, not a clinical protocol.” The same price in both clinics is a synthetic verification input, not an approved medical protocol or real clinic price. Each owner saved one eligible and one missing-answer deterministic test and inspected Questions and Test & activate. Owner B exercised the two explicit foreign-clinic access cases. No configuration was activated. Neither owner received clinical-approval or platform-admin authority; MFA remained false. No consultation, trial unit, AI language response, payment, referral credit or email was created.

## Actual application and UI results

| Boundary | Observed result | Independent evidence |
| --- | --- | --- |
| Recovery A continuation | Two originally unattempted own reads returned200; six after-API SELECTs returned200; prior FAILED signup evidence retained | `8aeaecb5`, Root acceptance `82c3e281` |
| Ordered registration/setup/isolation | All four children exited0;8POST/5GET, normal B signup201 | API review `914faa96`, handoff `a17364c5`,546 safe artifact pairs |
| Saved configuration/tests | Both inactive TESTED v1/rev3 configurations, two saved eligible/missing-answer cases and three own audits each; prior audit revisions1/2 preserved | API review `914faa96` |
| Tenant denial | Foreign location GET404 LOCATION_NOT_FOUND and foreign config.test POST404 CONFIGURATION_NOT_FOUND; A records unchanged | API review `914faa96` |
| Ordinary Questions/Tests UI | A thenB,36 successful native commands/four PNGs; required question, saved eligible/blocked cards, inactive Draft v1/rev3, unchecked review and disabled activation | Browser review `b5f18f02`, handoff `cf1617ef`,193 safe artifact pairs |
| Browser closure | Both exact PID/start identities observed Z, no active owned namespace processes or sockets; A remained released through B | Browser review `b5f18f02` |
| Final compensation guard | First corrected28 cases matched,4 accepted/24 rejected; genuine API/browser review formats validated before18-row/three-rate SQL-text construction | Actual guard review `a1a1bbb7` |

All four PNGs were independently inspected at original resolution. Both browser state files equal the API state `2569189f`. Saved console/page-error lists were empty. The Tests screen explicitly says owner MFA is required to publish; this does not prove that MFA is the only backend requirement or grant authority to publish a clinical protocol.

Retained actual screens: [A questions](screenshots/clinic-a-questions-2026-10-04.png), [A tests](screenshots/clinic-a-tests-2026-10-04.png), [B questions](screenshots/clinic-b-questions-2026-10-04.png) and [B tests](screenshots/clinic-b-tests-2026-10-04.png).

## One-time final compensation

Root authorization `53e65c3b` followed exact final binding/manifest/whole-plan review `04f430aa`. The unchanged helper `836fefac` was invoked once and exited0 with empty combined tool output. Actual handoff `25058c26` and50-pair manifest `c6dab2a0` preserve11 SELECT observations plus one conditional CAS,12 Neon HTTPS POSTs, all200.

The write returned guard1, rateRestored1, rateRemoved2, auditsDeleted6, configurationsDeleted2 and tenantsDeleted2. Six owned audits were deleted before two configurations, then two tenants and eight ordinary child rows cascaded, removing18 canonical task rows. The preexisting registration-rate row was restored to its exact original raw window/count; only two proven new mutation buckets were removed.

Fresh final SELECTs proved both owners absent, all50 original table counts/full-row digests equal and total32 rows restored from52, plus all seven original rate rows equal. Four prior jobs, two expired synthetic recordings and the ten-row migration ledger remain preserved. Only after observed restoration were the two exact application cookies and two exact nonsecret configs individually hash/stat-guarded and unlinked. Four physical absences, both fresh inactive context identities/socket absence and exact source/ten-held-leaf/original mixed-jar closure precede helper PASS. The original PIDs remain zombies, rather than absent. Independent actual cleanup review `7c4fdccc` PASS verified the50 safe artifact pairs, actual12-response sequence, exact restoration and physical input/context closure. No cleanup retry or extra operation occurred.

## Preserved failures and learning

The original signup returned201, then its verifier failed on a trusted SQL TIMESTAMP(3) value at a strict request timestamp boundary before preserving a session. A separately reviewed five-row compensation restored its baseline, independently reviewed `8e060fcb`. A distinct recovery cohort corrected only trusted-SQL UTC validation projections and preserved a legitimate server-validated session before later evidence checks. Its27 affected cases passed8 accepted/19 rejected, independently reviewed `85f23046`; strict API/request/nested timestamps and raw canonical hashes remained unchanged.

Recovery signup201 was followed by an exclusive evidence-filename collision. The original FAILED result `ab131faf` remains unchanged; only originally unattempted operations proceeded through the accepted A continuation. The first13-case filename checker failed before all cases because its AST inventory omitted an unreachable baseline caller. A distinct corrected entry passed11 unique groups/two expected collisions with independent review `f45dc7cd`. Reporting-only table-count, typed-path, response-shape, source-filename and UUID-order errors are retained; they were corrected from saved evidence without operation replay.

Before credentials or SQL, independent source review found a final verifier mismatch: the genuine browser review uses role=INDEPENDENT_AUDITOR while API/guard use reviewer=/root/commercial_auditor. A fixed-binding adapter and genuine positive prefix resolved it, with source review `911f5bb7`, check-plan review `40ed81d6` and actual28-result review `a1a1bbb7`. The original17 authored cases remain zero-run historical snapshots. The new28 entry includes those unchanged objects and eleven affected authority/verdict/task/source/binding rejection cases; no historical39/27/13 or passed hosted phase was replayed.

Learning L-041/P-024/G-018/G-019 records the trusted SQL boundary, immutable failed ancestor/accepted continuation, distinct composed evidence filenames and typed genuine-review envelopes. Independent learning/minor-PRD co-sign `2b0ebbee` PASS completed the four entries and task CHANGELOG. Exact final document/factual co-sign and publication readback are separate closing steps.

## Evidence limits and remaining pilot work

The affected-table preexisting-subset assertions are source-enforced with retained transport hashes and consolidated preservation receipts. Their raw row payloads, passwords/session hashes, SQL parameters and request headers are not persisted. Full50 means49 Prisma models plus the migration ledger; count/digest equality is not raw row-content evidence. The outer tool exposes combined output, not separate stdout/stderr or an independently derived full-operation duration.

UI evidence covers desktop Chromium and cold navigation without a separate reload. Automatic assets/prefetch/network were not completely observed. Physical Safari/PWA installation, latency targets and clinical authority are separate gates. Historical failures remain FAILED, and earlier PARTIAL provider/timer/retained-owner checks are not retrospectively completed.

This proves inactive setup/test persistence, visible questions and clinic isolation. Different actual catalogs/prices and activation, consented consultation transcription/model output, tracked clinical approvals/care, accurate approved recipient sharing/PDF, exact stages/outcomes/reminders/archive, trial concurrency, paid referral credit, roles and broader retention/service/data eligibility remain required by PRD section8.

The open-source Vercel Plugin reference is locally available and read at0.53.0, commit `3b472643cbb1a42479d99b0c9a1d27b8bc84aaa7`, including verification, CLI and protected-deployment guidance. This is downloaded guidance, not installed hooks or hosted Vercel Agent. No new application code, migration, provider request, deployment or paid service was required by this task.
