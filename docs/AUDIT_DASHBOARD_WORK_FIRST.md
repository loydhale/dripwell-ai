TASK083 — Independent actual publication and first-CI audit
Disposition: PASS_ACTUAL_REVIEWED_PUBLICATION_AND_SOURCE_CI

This is the actual-result phase admitted by ACTUAL_RESULT_GO.json (1268 bytes / SHA256 0a073b28ce410cccfe7b052a38840bcc464fc743552396144e35934dbacdc6fb). It follows the genuinely adopted corrected source review and exact prepublication co-sign. The original actual-result review ceiling remains 2026-10-11T17:23:09.774388Z; original task total ceiling remains 17:33:09.774388Z. Earlier source clocks remain closed. No source authoring or learning was performed in this phase.

Published bytes and branch

The actual GitHub canonical commit is 8910001bf26aad0fefff63b79f5e199caf598e25, tree 87ca21056dce02d157be094ec59a221c904af969, sole parent 17001aa879c91e97aba4e232457c3b404963d38f, message “Improve DripWell dashboard work-first layout”. The untruncated recursive remote tree equals the entire local Git leaf map. Against the 500-leaf parent, exactly the seven co-signed paths changed, two are new, all 495 other original leaves remain identical, and the resulting tree has 502 leaves. Independent hashing of every tracked worktree file matches its published Git blob and mode. All seven SHA256/byte/blob pins match SOURCE_PUBLICATION_RECEIPT.json (2894 bytes / SHA256 2c26c6d90625705be784af4f14ca59540faa6e1ff02189a6ca7400648c875b95). HEAD and origin review-branch ref are 8910001; index/worktree are clean.

PR2 is actually open and unmerged at that exact source head on feat/dripwell-consultation-v2. Its title remains “Build DripWell v2 consultation PWA and owner review workflows”. The actual body is byte-identical to the reviewed PR_BODY_DRAFT.txt: 2890 bytes / SHA256 60378e1c2ce6b5951b114587bde8eb9c211d9fa8c9f98ce20baccd818ee1395d. Its publication-time “first CI pending” statement was accurate then; the result and later closure metadata can now advance only through separately reviewed publication.

Actual first changed-source CI

Natural pull_request run 38157961587, attempt 1, job 114524739944 (“verify”), reports head 8910001 and completed/success. Run began 17:02:26Z; job began 17:02:29Z and completed 17:05:08Z. All 22 returned job steps are completed/success, including frozen-lockfile install, database generation/validation/deploy, eve service build, web build, shared and web typecheck, every required source suite and teardown. No manual dispatch or rerun was requested.

The actual checkout log records merge 1ebc34e379f959701f695b930d836860c87d5a52. A narrowly admitted Git-object fetch, without checkout or branch/index/worktree mutation, independently verifies parents 9fa134fc9005dd0d5d351f14b35882d158dc1de4 and 8910001bf26aad0fefff63b79f5e199caf598e25, tree 87ca21056dce02d157be094ec59a221c904af969, and an identical complete leaf map. These results therefore cover the reviewed source bytes, rather than a merely adjacent branch commit.

Observed result counts:
- Deterministic domain: 23/23 passed; fail 0, skipped 0, cancelled 0, todo 0.
- Authentication: 8/8 passed; fail 0, skipped 0, cancelled 0, todo 0.
- Consultation lifecycle: 15/15 passed; fail 0, skipped 0, cancelled 0, todo 0.
- Transcript extraction boundaries: 11/11 passed; fail 0, skipped 0, cancelled 0, todo 0.
- Full unfiltered Vitest unit/integration suite: 27/27 files and 268/268 cases passed. Independently enumerating all 27 successful module lines sums to 268; no failed or skipped cases remain in those totals.
- New lib/dashboard-presentation.test.ts: actually collected, 7/7 passed, 782 ms. This includes the corrected fake-clock expectations, real Dashboard DOM hierarchy/disclosure/focus, filters and scoped visit links, loading/paging/error retry, empty states, setup/readiness guards, and consent/location/idempotency retry behavior reviewed in SOURCE_AUDIT_R1.md.

Fresh synthetic boundary and evidence limits

The actual job creates and starts an isolated postgres:17-alpine service for synthetic dripwell_verification data, with initdb/ready markers in the retained log. Workflow and logged command environments use synthetic DATABASE_URL/TEST_DATABASE_URL, APP_URL localhost and ALLOW_REAL_CLIENT_DATA=false. The ordinary workflow applies its 14 migrations to this new service; this is observed CI behavior, not reapplication to any retained local, hosted or production target by the Auditor. Frozen install may restore the pnpm dependency cache; no previously built application directory supplies the observed fresh builds.

The log retains deprecation warnings and SQL/fault-path messages alongside the passing suite results. PASS means the exact source checks passed, not that the raw log contains no warning/error text. This review does not diagnose or relabel any historical SQL cause. The original failed CI38080612363, historical cause UNKNOWN, retained restoration, permanent TASK057 FINAL3, closed process/cache/PGDATA scopes and maintenance DEFAULT_DISABLED remain distinct.

The seven Dashboard cases run in jsdom with the previously reviewed leaf dialog/context/API simulations. They establish the asserted component DOM/state/focus behavior; they do not establish physical-browser keyboard defaults, screen-reader output, rendered desktop/mobile layout, hosted effective guards, tenant authorization or authentic provider/payment behavior. This source CI does not replace the nine approved pilot criteria: actual two-clinic recording/transcription and model output, approvals, sharing/PDF, exact board/outcome/reminder behavior, trial concurrency, authentic paid referral credit, roles and retention. All pilot and production gates remain open; current deployment/effective hosted guard remain UNVERIFIED and requested protected previews/ALLOW_REAL_CLIENT_DATA=false remain.

The Owner’s selected screenshot workspace composition remains the next bounded shell/visit task, separately admitted after TASK083 closure. No library/provider/paid asset was selected or installed. Catalogs/prices/reviewers remain spa onboarding inputs; Stripe sandbox account completion and parked service/admin/payment evidence retain their existing distinctions. Do not repeat the resolved optional GUI selection.

Frozen actual evidence

Completed job logs were retrieved exactly once through the GitHub decoded-log tool, preserved as returned UTF-8 including the BOM, then frozen mode 0400. “Exact bytes” describes those decoded-tool text bytes, not an unobserved compressed transport response.
- ACTUAL_COMPLETED_JOB.log: 202586 bytes / SHA256 4644b1bc976b9da6b842a974af408297121585b42b23533eec9bd08d9904e0e8.
- ACTUAL_RUN_RESPONSE.json: 12698 / a3e2574d88976b582f2665163c0d93fa109094ed3c2cdffb58e8c9b4eebf2c94.
- ACTUAL_JOBS_RESPONSE.json: 4720 / 076eb545c6a57990d02996b23ec05ca264801606bd8fcd805d2698674671364d.
- ACTUAL_PR_RESPONSE.json: 3954 / 820dbdc5c61b1be5ca24e483d167beff77fc194c6f1ff37bdcab15666adcc488.
- ACTUAL_REMOTE_TREE_RESPONSE.json: 149800 / 278e1c827ddc504038b068c78f7b55d3430c3c8bafae21ee25458c3ad5c7567e.
- ACTUAL_REMOTE_COMMIT_RESPONSE.json: 1125 / a3c7cff2b8c7f6bc00ed7aafd0fc87c0925b7d104a913fd7b95bc338cf3c3d31.
All six files are mode 0400 under /workspace/dripwell-task083-private.

The initial single-command evidence persistence attempt was rejected before process creation because the command argument was too large. The successful bounded private-file writes preserved the already fetched log; no second log retrieval or application execution occurred. One broad inspection output was clipped; the exact module list and result/build markers were subsequently read in bounded complete output. Neither tooling event is an application test failure.

Required next step: Root must fully read and genuinely adopt this concrete report before the distinct learning phase or TASK083 closure/task-count change. PASS authorizes that evidence-based transition, not pilot completion, local execution, new provider effects, new source work or a reset of an earlier phase clock.

Frozen at 2026-10-11T17:13:03.259633+00:00; before original actual-result ceiling.
