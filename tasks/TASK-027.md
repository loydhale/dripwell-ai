# TASK-027: Verify the reviewed recording repair in protected preview

TASK_ID: TASK-027
TITLE: Deploy exact independently reviewed recording source
PARENT_REQUEST: Owner's until-done loop; TASK-026 and TASK-029 repair the actual TASK-025 recording duration and navigation defects.

GOAL: Deploy only the independently approved recording repair after successful source CI and verify its exact protected preview boundary.

## Scope and prerequisites

- Wait for TASK-026/TASK-029 source review and TASK-025 complete repaired real-browser proof, learning and CTO checkpoint co-sign. Resolve the full published commit and require actual successful source CI, zero skipped required checks and both builds. No failed or unreviewed stage may deploy.
- CTO handles publication/staging/deployment operations; Auditor independently compares every tracked staged file directly against immutable Git blobs and modes. Only the established preview apps/web/vercel.json crons=[] adaptation and identical nonsecret .vercel/project.json link are allowed. Exclude env files, credentials, private fixtures/harnesses and unrelated differences.
- Retain the original production 15-minute cron, team/project, apps/web root, Node24, OIDC, deployment protection and ALLOW_REAL_CLIENT_DATA=false. Use pinned Vercel CLI62.1.0 and established normal remote build. Do not buy a plan, promote production, connect the old main branch or reapply hosted migrations.
- Verify actual READY, selected source/tree metadata, normal build/native-bundle guard and stable preview alias. Perform only bounded relevant deployed smoke reads and verify unchanged hosted synthetic counts/settings. Existing provider/Blob/archive/job suites do not need repetition absent a relevant change.
- Recording-control behavior is established by the actual repaired local component with native synthetic capture, not by fabricating a successful hosted upload or model response. The hosted two-clinic/provider story remains unverified.

Read the AGENTS boot sequence, Auditor persona and c12 Vercel Plugin deployment/CLI/verification guidance plus current installed framework/CLI docs. Follow P-011/P-012, G-007/G-008/G-009 and L-024/L-028. Root ICM and authored Eve/Workflow folders remain intact.

Auditor owns an append to docs/AUDIT_RECORDING_CONTROLS.md or a dedicated scoped deployment evidence document and append-only CHANGELOG/SESSION_LOG; CTO owns STATE/task briefs and operations. No application edits by Auditor. Do not overlap live fixtures/builds from TASK-025 or TASK-028.

## Acceptance criteria

1. Exact reviewed/published source and successful CI are verified before deployment.
2. Stage files/modes match the immutable commit, with only documented preview adaptation/link and no secrets.
3. Actual deployment/build/alias READY and bounded runtime smoke pass while false gate/protection and hosted data counts stay intact.
4. Evidence, learning, STATE/CHANGELOG and reviewed publication distinguish local synthetic capture from unfinished hosted/provider pilot gates.

2026-10-02 plan co-sign: Auditor PASS for bounded scope and required reviewed-source/CI/protected-stage gates. No PRD change.

2026-10-02 execution: independent Auditor PASS attempt1 at reviewed source b61f6aa/tree87fb50c. Exact18-file artifact,317-file stage and actual93-check CI passed. Normal remote preview dpl_232QhM74EuWYYnq1vSfAEaqNDo57 is READY at the stable alias, with exact metadata, default Sandbox initialization, two native bundles, literalfalse gate/protection and six targeted HTTP cases passing. Retained FAILED/null-usage job digests and zero clinical/configuration/trial-use counts are unchanged; no provider request, hosted clinical write or migration occurred. See docs/AUDIT_RECORDING_CONTROLS.md. Existing learning applies; no new lesson/pattern/gotcha. The full pilot remains open, and independently runnable TASK-028 is next.
