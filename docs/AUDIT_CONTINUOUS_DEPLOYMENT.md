# Continuous preview deployment audit

Date: 2026-10-02. Branch: `feat/dripwell-consultation-v2`.

AUDIT: TASK-023
VERDICT: PASS for the reviewed protected preview deployment and bounded hosted reads
ATTEMPT: 1
SOURCE: `5307fdafd49aea4ddc7a884b9d6e1e03881ef886`
SOURCE TREE: `bc3d2945e2532d96f60f2a8ab7f1c5db5a609303`
DEPLOYMENT: `dpl_2Df4RLG6e8agmaAbNPWA2Kwm3SJq`
TARGET: preview
STATUS: READY
URL: <https://dripwell-ai-preview-loyd-1222s-projects.vercel.app>
UNIQUE URL: <https://dripwell-pl50dr164-loyd-1222s-projects.vercel.app>

The reviewed archive and job-result repairs reached the protected synthetic preview. This audit follows authenticated workspace reads through the Next.js routes, PostgreSQL and saved response contracts, plus an existing location-bound Eve stream. It does not establish a successful hosted model response or the complete PRD section 8 pilot.

## Immutable stage and source CI

The Auditor independently read every tracked stage file directly against Git blobs at the full source SHA above, including executable and symlink modes. All 308 tracked files passed. The only permitted tracked difference is `apps/web/vercel.json` with `crons: []`; every other configuration field is unchanged. The sole extra file is `.vercel/project.json`, byte-identical to the linked source project file and containing only the expected nonsecret project, team and name. The exact tracked `.env.example` has 13 empty credential/service values and `ALLOW_REAL_CLIENT_DATA=false`. There are no private environments, tokens, fixture helpers or unrelated files in the stage.

The immutable repository still schedules `/api/jobs/reconcile` using `*/15 * * * *`. The preview adaptation addresses the existing Hobby limitation; it does not enable the production scheduler or authorize an upgrade. Root ICM instructions/personas/memory/tasks and authored Eve/application Workflow layout are intact.

Independent GitHub API metadata and actual logs confirm [CI run 37011323655](https://github.com/loydhale/dripwell-ai/actions/runs/37011323655) completed successfully at the exact source SHA, attempt 1, at 13:13:24 UTC. All 87 checks executed without skips: 23 domain, 8 authentication, 15 clinic, 11 AI boundary and 30 unit checks. The six actual-PostgreSQL job-result cases executed successfully against the documented CI target. Frozen installation, all ten isolated CI migrations, types and both optimized builds passed. The earlier `0b97022` run failed its test-target guard and its stage was never deployed. Local PASS was not substituted for fixed-head CI.

## Actual deployment and controls

Independent live API/CLI inspection confirms the deployment is READY, belongs to project `prj_fF0yFggYVFN9pI5dQN33glG2wPyW` and team `team_ATVYA30szlVoy5XxAIiaf2OD`, and carries the exact reviewed commit/tree metadata. The stable alias API resolves directly to this deployment and its unique URL. The explicit CLI target is preview; the deployment REST representation uses `target: null` for this preview, not a production target. Build duration was approximately 1 minute 24 seconds.

Actual remote logs show Next.js 16.3.8 compilation, unchanged default Sandbox template initialization, `Verified Prisma RHEL engine in 2 Eve runtime bundles.`, successful output assembly and deployment. The CI build's one local bundle is separate from these two actual Vercel bundles. The new authenticated Eve read also executes its real Prisma session/binding checks; no new Workflow generation was started.

Live project metadata confirms root `apps/web`, Node `24.x`, Next.js, enabled team OIDC, disabled directory listing and Vercel authentication protection. The anonymous unique public root returns HTTP 302 to `vercel.com/sso-api`, so protected content requires authentication. Credentials were supplied normally through the authenticated CLI and existing private fixture helpers; protection was not disabled.

Live environment metadata retains Neon/private Blob and other configured bindings on preview/development only. The already-verified ten hosted migrations were not reapplied. The authenticated dashboard reports real consultation starts disabled, trial limit 10 and usage 0. Its APP_URL-derived referral URL matches the stable alias. No production promotion, Git connection change, secret upload, model/provider substitution or purchase occurred.

## Bounded authenticated hosted reads

The retained fictional owner's app cookie had expired at 12:31 UTC and correctly produced 401. One login refresh used the existing private credentials; the ensuing `/api/auth/me` read verified the same retained owner. No registration or clinical fixture write was needed. Cookies and complete request/response evidence remain private outside Git; the retained cookie jar was refreshed for authorized continuation.

All 19 bounded HTTP cases passed:

| Boundary | Actual evidence |
| --- | --- |
| Protected preview and workspace | Anonymous public root 302 to Vercel SSO; same-owner identity 200; authenticated workspace HTML 200 |
| Archive paging response | Default page size 50 and requested size 2, count 0, empty records, null next cursor and unchanged metric denominator 0 |
| Archive validation and scope | Invalid size/malformed cursor 400 `VALIDATION_ERROR`; unavailable cursor 400 `INVALID_CURSOR`; unavailable location 404 `LOCATION_NOT_FOUND`; no app session 401 |
| Existing saved-job status | Both retained `SETUP_CHAT` jobs return 200, `failed`, `result: null` and `AI_PROCESSING_FAILED` |
| Job validation and access | Malformed ID 400; unknown job 404; no app session 401 |
| Saved owner conversation | Exact existing owner/location/conversation binding returns 200 |
| Native Eve access | Existing bound stream 200 with seven JSON records in a bounded read; unauthenticated 401; unbound owner stream 403 |
| Private response caching | Every tested API response carries private/no-store cache control |

Read-only PostgreSQL snapshots before and after show both complete persisted job rows unchanged, including their stored status/results/versions/usage/timestamps. Both remain FAILED with null usage. Hosted counts remain zero consultations, zero active configurations and zero trial-usage rows, with allowance 10 and used 0. The checks made no model/transcription/email/billing request, clinical write or migration.

The hosted archive contains no visits, so this pass proves its deployed response shape and validation rather than a populated page traversal or restore. [TASK-020 evidence](AUDIT_CONTINUOUS_REPAIRS.md) independently proves those behaviors with 251 retained records, a 500-day-old target, tied timestamps, browser retry/stale responses and real restore. No synthetic success rows were added to the hosted database: both successful result aliases, the actual polling consumer and cross-tenant/role cases are proven by TASK-021's real PostgreSQL checks and the fresh source CI. Existing hosted failed jobs are not represented as successful generations.

## Remaining release boundary

The earlier actual hosted Gateway request remains the latest inference evidence: HTTP 403 `RestrictedModelsError` / `no_providers_available` for `openai/gpt-6-luna`, zero provider attempts and no successful assistant response. This audit did not retry that paid-provider path. A supported AI route consistent with the Owner's ChatGPT subscription preference, transcription, Stripe account-owner terms/connection and actual pricing, a verified Resend domain/sender, explicit referral-credit terms, selected platform administrator/MFA, supported scheduling and service/data-path eligibility remain unresolved. Complete hosted recording, approvals, sharing, billing, retention and two-clinic verification still precede the full pilot and real data.

FINDINGS: none blocking in TASK-023's scoped deployment.
PATTERN_VIOLATIONS: none.
GOTCHA_HITS: G-005, G-007, G-008, G-009, G-010; P-011/P-012 and L-024/L-027 applied.
PRD_AUDIT: PASS, existing F-08/F-12 verification only; no feature or authority expansion.
LEARNING: no new learning; existing exact-source, bundle and provider-boundary guidance applies.

Guidance used: Vercel Plugin deployment/CI, CLI and verification skills from `skill://plugin_connector_690a90ec05c881918afb6a55dc9bbaa1`; installed Next.js 16.3.8 deployment docs and Eve 0.69.0 Vercel docs; actual CLI 62.1.0; managed cloud runtime/networking guidance. Current managed observations report revision 78 running with enforced unrestricted HTTP networking. Private evidence is retained outside the source/stage.

Final documentation co-sign: PASS for the current README, STATE, verification/deployment/work reports, dated gap-review addendum and prepared PR description. They preserve six completed tasks, `WAITING_ON_DEPENDENCIES`, continuous mode ON and the enabled hourly continuation, with specific unresolved release inputs and no full-pilot claim. The one-sentence automation maintenance correctly marks the old source/check count as historical; the CTO's fresh private provider lookup confirms the exact replacement and unchanged enabled schedule. No application, PRD, authority or spending change is introduced by this checkpoint.
