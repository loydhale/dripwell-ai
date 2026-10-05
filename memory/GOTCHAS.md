# GOTCHAS.md

Non-obvious quirks about this project. Reading this file before starting a task prevents wasted time on things that look wrong but are intentional (or look fine but secretly aren't).

Format per entry:

```
## G-<number> — <short name>
Date discovered: <YYYY-MM-DD>
Where: <file paths, service, config area>
The gotcha: <what's weird>
Why it's like this: <if known>
What to do: <how to handle it>
What NOT to do: <common wrong fix>
```

Rules:
- New gotchas append to the bottom
- Lessons that hit 3+ times get promoted here during weekly review
- Every agent reads this file before every task
- Gotchas don't get deleted unless the underlying issue is actually fixed in the codebase

---

## G-004 — persistSafetyFlags deletes all flags before recreate, dropping acknowledgments
Date discovered: 2026-04-22
Where: apps/api/src/services/safety.ts persistSafetyFlags
The gotcha: `persistSafetyFlags` calls `prisma.safetyFlag.deleteMany({ where: { assessmentSessionId, tenantId } })` before creating new flags. If `generate-recommendation` is ever invoked more than once for the same assessment, any provider acknowledgments on Tier 3 flags are silently lost.
Why it's like this: The Coder treated flag persistence as a simple snapshot that should be recomputed fresh each time.
What to do: If recomputation is needed, either (1) upsert existing flags instead of deleting, (2) preserve acknowledgments by copying them to the new records, or (3) guard `generate-recommendation` so it can only be called once per assessment.
What NOT to do: Do not assume `generate-recommendation` will only ever be called once per assessment without an explicit guard.

## Entries

(none yet — will populate as the team works)

## G-001 — iPad Safari getUserMedia may require a recent user gesture context
Date discovered: 2026-04-22
Where: apps/web/src/components/CameraCapture.ts, camera.ts
The gotcha: iPad Safari allows `navigator.mediaDevices.getUserMedia()` only when called from a user gesture handler or a frame created by one. If the camera component mounts programmatically (e.g., after a route change or state update) without a recent click/tap, the call may be rejected even if permission was previously granted.
Why it's like this: iOS Safari's media permissions model ties getUserMedia to user gesture context for privacy.
What to do: Add an explicit "Start Camera" button that the provider taps before calling `getUserMedia`, or ensure the component is rendered synchronously inside a click handler.
What NOT to do: Do not call `getUserMedia()` immediately on component mount and assume it will work on iPad.

## G-002 — Prisma @default(uuid()) generates IDs that never match hardcoded static values
Date discovered: 2026-04-22
Where: packages/shared/prisma/schema.prisma QuestionBank model, apps/api/src/services/questions.ts STATIC_QUESTION_BANK
The gotcha: When a model uses `@id @default(uuid())`, Prisma generates a random UUID on every create. If your code references hardcoded UUIDs (e.g. a static question bank in TypeScript), those IDs will never match the database rows unless you explicitly set the id during seeding.
Why it's like this: Prisma's default UUID generator is random per insertion.
What to do: Either (1) seed QuestionBank rows with the exact hardcoded IDs from the static bank, (2) remove the foreign key from QuestionAnswer to QuestionBank and use a separate non-FK string field for static references, or (3) load the static bank into the DB at app startup instead of hardcoding.
What NOT to do: Do not assume hardcoded UUIDs in code will match auto-generated database rows.

## G-003 — Mock signal auto-fallback hides missing photo analysis in production
Date discovered: 2026-04-22
Where: apps/api/src/routes/assessments.ts next-question endpoint, apps/api/src/services/questions.ts computePatternConfidences
The gotcha: The next-question endpoint passes `mockSignals: QUESTION_MOCK_MODE || signals.length === 0`. When no visual signals exist, it silently injects three synthetic signals with high confidence. This makes it impossible to detect when photo analysis failed or was skipped.
Why it's like this: The Coder wanted a smooth dev/test experience and conflated "no signals" with "test mode".
What to do: Make mock mode strictly opt-in via env var only. For the no-signals case, either return a 400 error, proceed with zero-signal baseline (prior only), or require explicit provider confirmation.
What NOT to do: Do not auto-inject synthetic data in any endpoint that can be hit in production.

## G-005 — The environment's bare pnpm is an auto-install shim
Date discovered: 2026-10-01
Where: managed coding environment command runner
The gotcha: Bare `pnpm` may run an implicit dependency installation before a test script and abort without a TTY. It can interfere with parallel work when package files are changing.
Why it's like this: The environment supplies an automatic dependency-status wrapper.
What to do: Use the explicitly pinned `npx --yes pnpm@10.32.1` or installed task binaries. Centralize installation and frozen-lock verification with the foundation owner.
What NOT to do: Do not start independent implicit installations from multiple agents.

## G-006 — Next bundling can virtualize runtime asset resolution
Date discovered: 2026-10-01
Where: apps/web/lib/sharing.ts PDF font loading, apps/web/next.config.ts outputFileTracingIncludes
The gotcha: `createRequire(import.meta.url).resolve('geist/font/sans')` passed direct node PDF checks but produced a virtual project path in the actual Next runtime, causing approved downloads to return HTTP 500.
Why it's like this: Framework bundling changes module identity and resolution; a resolved module path is not necessarily a physical filesystem path.
What to do: Resolve these installed font assets from the known application root, include them in the actual API routes' output-file traces, and verify a real Next PDF download plus the optimized build artifacts.
What NOT to do: Do not claim asset-dependent routes work in Next solely because node unit or integration tests pass.

## G-007 — Preview assembly still validates production cron configuration
Date discovered: 2026-10-02
Where: Vercel Hobby plan, apps/web/vercel.json and eve 0.69.0 Build Output composition
The gotcha: A 15-minute cron rejects even an explicit preview deployment on Hobby. A private CLI local-config override did not remove the nested authored cron from the final assembled output.
Why it's like this: The framework preserves authored Next application cron entries when composing its service output, and the platform validates the resulting schedule during deployment.
What to do: For an isolated synthetic preview, stage an exact reviewed source archive with only crons empty, compare every tracked file with Git blobs, retain protection and the real-data gate, and explicitly target preview. Use a supported plan for the required production cadence.
What NOT to do: Do not silently weaken the repository's production schedule or claim preview reminders run when its scheduler is omitted.

## G-008 — Native Node provider fetches need this workspace's HTTP proxy
Date discovered: 2026-10-02
Where: managed coding environment, Node 24 provider SDK verification
The gotcha: The environment provides HTTP/HTTPS proxy variables, but ordinary Node fetch did not use them. Blob SDK uploads and reads timed out even while the Vercel CLI and Python HTTPS requests worked.
Why it's like this: These clients use different proxy defaults. This is a coding-environment transport issue, separate from hosted provider readiness.
What to do: Run local Node provider checks with Node 24 --use-env-proxy, retain the configured certificate trust, use bounded requests and compensate synthetic writes. Confirm exact authenticated bytes and anonymous denial.
TASK034 recurrence,2026-10-03: Stripe23 supplies its own HTTPagent, so the Node global flag alone did not route the normal SDK request. A supported per-client httpAgent using Node24's proxy-enabled HTTPS global agent recovered through the unchanged inherited sidecar/CA with the same deterministic idempotency keys. Keep this private setup transport distinct from deployed application code and provider entitlement.
What NOT to do: Do not disable TLS verification or change deployed application code to accommodate a local proxy default.

## G-009 — Next and eve require separate native-asset verification
Date discovered: 2026-10-02
Where: apps/web/lib/db.ts, standalone eve build/service artifact
The gotcha: Next.js Prisma authentication worked after deployment, while the independently bundled eve service omitted the native Prisma query engine and failed its first authenticated session request. Eve public health still reported ready.
Why it's like this: Next.js and eve compile and trace independent service artifacts. One framework's asset handling does not prove the other artifact includes the same native dependency.
What to do: Inspect native assets in each actual service output, validate its packaged runtime, and verify an authenticated endpoint that exercises Prisma in each service after deployment.
What NOT to do: Do not infer agent database readiness from the web dashboard or the public eve health route, or replace real authentication to hide a packaging error.

## G-010 — Gateway free-tier access can reject a catalog-listed model
Date discovered: 2026-10-02
Where: Vercel AI Gateway, actual hosted owner setup workflow
The gotcha: Project OIDC, a listed openai/gpt-6-luna model and successful eve session creation did not grant model access. Gateway returned HTTP 403 RestrictedModelsError/no_providers_available with zero provider attempts, requiring paid credits.
Why it's like this: Model discovery and authenticated account/model entitlement are separate provider controls.
What to do: Use actual workflow logs and durable job/usage evidence to identify the gate. Obtain owner-funded access, then repeat the explicitly synthetic model request without changing identity or protection controls.
What NOT to do: Do not claim inference passed from catalog presence, fabricate a response, purchase credits without authorization or silently substitute a model.

## G-011: Local World restart recovery needs lifecycle initialization
Date discovered: 2026-10-02
Where: installed Workflow5.0.1 Local World, optimized Next16.3.8 runtime, TASK-028
The gotcha: Persisted runs and WORKFLOW_LOCAL_RECOVER_ACTIVE_RUNS=true did not resume outstanding sleeps when only the optimized Next process restarted. The original five waits remained pending after their measured due times.
Why it's like this: Local World recovery is performed by its supported start() lifecycle; merely selecting getWorld() or retaining files does not initialize that lifecycle in the observed bare Next startup.
What to do: Verify actual run identity, future wait, process restart and recovery. When initializing a retained local World, use the installed documented start()/close() lifecycle with the same owned directory and compiled callback runtime. TASK-028 did this and recovered the same original runs without replacement kickoff.
What NOT to do: Do not label explicit lifecycle initialization as automatic Next restart, infer recovery from files or a configuration flag, substitute a direct helper, or transfer a local-world result to Vercel production scheduling semantics.

## G-012: agent-browser0.38.1 batch rows inherit outer flags
Date discovered: 2026-10-02
Where: pinned agent-browser0.38.1 run_batch/parse_command/navigation handlers, protected-preview verification
The gotcha: A batch row containing open URL --headers JSON does not set headers. run_batch passes the outer Flags directly to parse_command; it does not parse flags in each stdin row. A successful batch therefore does not prove that its intended authentication was sent.
Why it's like this: Navigation headers are populated from Flags and then keyed by URL origin before native navigation. Cookie staging and daemon reuse are supported separately from flag parsing.
What to do: Navigation authentication must come from the outer flag/config path, not inner batch flags. For the memory-only credential boundary, TASK044 uses a standalone open with --config /dev/stdin and the documented headers JSON string, then the same nonsecret config for later commands. Keep normal CLI62.1 selected-project token/header values out of argv/env/files/logs and bound to the selected origin. Import only the new normal app cookie through the supported batch command with explicit host/path/expiry/Secure/HttpOnly/SameSite attributes and in-memory redaction. Native --curl JSON omits security attributes and must not be used for this faithful import. Four actual fictional parser cases passed. The original cookie command succeeded, then its collector rejected the extensible reply. Fifteen separately executed pure cases validated the correction, including that saved reply. The independently reviewed fresh-context owner settings screen passed in ef5b5138; actual separate two-context cleanup6219ca19 restored the original database/rate state and removed only three owned inputs. Config.defaultTimeout is unsupported in0.38.1; documented AGENT_BROWSER_DEFAULT_TIMEOUT is the accepted nonsecret input. Successful native data also includes lifecycle metadata; require essential fields and allow that source-traced addition. Preserve collector failures, owned process/session closure and prior whole-data state before a separately reviewed continuation. Saved Trusted Sources rules remain a separate fact.
What NOT to do: Do not use global set headers, place auth options inside batch rows, forward the header to another origin, forge claims, infer a Hobby-plan denial from login, or modify protection to conceal the harness failure.

## G-013: An explicit SDK dispatcher bypasses Node's global proxy setting
Date discovered: 2026-10-03
Where: installed Workflow5.0.1 World HTTP client, managed environment, TASK-037
The gotcha: A normal owned-run inspection received Node24 --use-env-proxy but failed before HTTP because World supplied its own direct undici Agent. WORKFLOW_NODE_HTTP also selects explicit Agents without proxyEnv and was not tried.
Why it's like this: Global native-fetch proxy configuration does not replace a client's explicit dispatcher. This workspace routes HTTP through its inherited sidecar proxy and certificate trust.
What to do: Trace the exact installed transport. For separately reviewed private verification, use the supported per-World APIConfig.dispatcher with EnvHttpProxyAgent and the unchanged default RetryAgent policy, normal selected CLI identity, inherited proxy/CA and a bounded owned watchdog. Distinguish logical reads from observed attempts.
TASK034 recurrence,2026-10-03: Stripe23's own HTTPagent is a separate example of an explicit client transport overriding global proxy defaults. Its documented httpAgent option plus Node24--use-env-proxy accepts the inherited proxy-enabled HTTPS global agent. Preserve the first StripeConnectionError, unchanged identity/TLS/idempotency keys and actual successful result; do not infer an account denial or reconstruct missing raw timestamps/streams.
What NOT to do: Do not infer an account denial from a non-HTTP transport failure, try an equivalent direct route, weaken TLS, patch global fetch/SDK source, substitute identity or alter the deployed application.

## G-014: Browser command output and launch state need explicit contracts
Date discovered: 2026-10-03
Where: pinned agent-browser0.38.1, TASK-037 private orchestration
The gotcha: Successful cookies set emitted plain "✓ Done"; a generic JSON parser failed before navigation. An immediate page read still showed the normal loading screen, and a later probe with incomplete launch settings restarted the owned browser to about:blank.
Why it's like this: Commands have different output contracts, client rendering is asynchronous, and the daemon may recreate browser state when effective launch settings change.
What to do: Parse each documented command response, preserve one complete session/prefix/environment across operations, and wait boundedly for actual normal UI readiness alongside authenticated API identity. Use a fresh owned context deliberately after a lost browser and disclose normal token mints without persisting them.
TASK040 recurrence,2026-10-03: The generated namespace/session combination produced a148-byte Unix socket pathname, exceeding installed agent-browser0.38.1's103-byte limit. The command rejected before browser launch or cookie import. Preserve that failure and original selectors, validate the full derived socket path and collision absence, then shorten only the unique owned naming input while retaining the reviewed helper/config/trust/domain/no-restore contract. A parameter-length error is not application or TLS failure and does not justify rebuilding or changing security controls.
TASK040 command-sequencing recurrence: `find ... uncheck` is unsupported in this installed finder; a supported checkbox click works. Dependent browser commands were incorrectly batched after the failed action, overlapping waits/reload and overwriting one counter-named private receipt. The observed outputs/failures are preserved, but they do not reconstruct the overwritten original receipt or prove a disabled policy. Complete each command, inspect its response and actual page/API state, and persist a unique receipt before dispatching a dependent step. A separately completed supported disable/save/reload passed; it does not retrospectively turn the failed phase into PASS.
What NOT to do: Do not treat plain success or a loading screen as an access denial, silently change launch settings during a read, reuse the original owner cookie for a new fictional staff member, or resend a journaled restore.

## G-015: Public World storage listing has a different filter contract from analytics
Date discovered: 2026-10-03
Where: installed Workflow5.0.1 World storage runs.list and TASK-038 cleanup reader
The gotcha: Storage runs.list supports workflowName, one status and pagination limit/cursor/sortOrder, with resolveData none mapping to lazy payload-free reads. It does not support analytics startTime/endTime server filters. Optional list expiry/lookback fields may be absent; the targeted run can expose a future expiration separately.
Why it's like this: Storage and analytics are separate public read surfaces with different parameter/schema contracts. A successful later storage read does not prove why an earlier analytics selection returned no matching candidate.
What to do: Read the installed implementation/types, use only supported parameters, bound metadata and apply exact original creation-window/deployment/workflow guards on the client. Persist safe selection diagnostics, handle absent optional lookback/dates, verify targeted input availability and keep actual provider expiry separate from project deletion-policy claims.
What NOT to do: Do not silently pass unsupported time filters, follow unapproved cursors, decode unrelated runs, infer analytics freshness or entitlement from one guard result, or relax original proof deadlines after recovery.

## G-016: Notification read state uses isRead and dismissedAt
Date discovered: 2026-10-03
Where: packages/shared/prisma/schema.prisma Notification model, private hosted reminder verification
The gotcha: Notification has boolean isRead and nullable dismissedAt; it has no readAt field. A retained PostgreSQL JSON row therefore cannot satisfy an assertion that indexes readAt.
Why it's like this: The Prisma persistence contract and ordinary inbox use explicit read/dismissal state rather than an optional read timestamp.
What to do: Check authoritative schema and the actual row. Require isRead to be present native booleanfalse and dismissedAt present null for unread/undismissed proof, with exact tenant/staff/visit/idempotency-key ownership. Verify the visible normal inbox separately without clicking mark-read.
What NOT to do: Do not treat a missing field as null, coerce 0 or stringfalse into booleanfalse, mutate a notification to satisfy a harness, or infer a product/provider failure from an absent verification-only field.


## G-017 — Native full-URL curl can create a protection-bypass token
Date discovered: 2026-10-04
Where: installed Vercel CLI62.1, protected Preview verification, docs/AUDIT_PROTECTED_COMMERCIAL_PREVIEW.md
The gotcha: The installed full-URL vercel curl path calls getOrCreateDeploymentProtectionToken with createIfMissing=true. A nominal request can therefore PATCH project protection-bypass configuration before reaching the URL.
Why it's like this: The native convenience command can prepare its own deployment-protection access. A read-shaped command is not proof that all underlying operations are reads.
What to do: Trace the actual installed transport before a bounded read. TASK043 excluded that path and used the normal selected project-token interface, kept the token in memory and sent the trusted header only to the approved origin. Record ordinary authentication issuance separately from app GETs and validate actual protection/response/owned-process closure.
What NOT to do: Do not call native curl under a scope prohibiting protection changes, describe one CLI invocation as GET-only wire traffic, discover auth files, persist raw credentials or weaken protection to conceal a test-helper failure.


## G-018: Caller and preservation reads need distinct evidence filenames
Date discovered: 2026-10-04
Where: Private TASK045 registration/setup/isolation verification tools, not application source
The gotcha: A direct after-register-rates observation and preserved(after-register) generated the same SQL intent filename. Exclusive file creation correctly stopped the second query before dispatch after signup had already committed. The same source family affects setup and foreign-POST checkpoints; browser callers do not have the preceding direct read.
Why it happens: A shared preservation helper reused the caller's observation namespace without considering all composed evidence names.
What to do: Check the assembled label family and use a distinct preservation-rate suffix. Preserve query text, parameters, order, contracts and exclusive-create protection. Continue only unattempted actions in a distinct reviewed entry; do not retry registration or weaken the file guard. The corrected source change was confined to private evidence-label composition. Live operations required separate concrete onceGO.


The first13-case checker stopped before all cases because its whole-module AST inventory omitted the existing baseline-rates branch. Factual review3c91ab89 verifies FAILED/exit1/count0 with no allocator compile or operations. Its original plan PASS9783a9da is retained; the helper final source guard was not reached, while separate saved metadata confirms source/ten leaves. Static whole-module inventories must include unreachable branches they collect; this does not add that branch to the allowed live requests. Only the exact four-caller inventory, new exclusive output and explicit current source/result ancestry binding are in the bounded next derivative. The separate corrected13-case entry then passed all13 outcomes,11 unique groups and2 expected collisions, independently reviewedf45dc7cd. Original zero-case FAILED remains exact. No earlier39/27 or hosted control was rerun.

Actual reporting also exposed two metadata assumptions after successful A execution: a collector expected51 table entries instead of50 plus the separate table-set guard, and an Auditor lookup expected a savedEvidence alias absent from that typed manifest. Both collector errors are preserved; corrections consumed already-retained typed artifacts only, with no operation replay. Derive counts and paths from the actual declared schema, and keep metadata-collector failure distinct from application or transport failure.

## G-019: Independently authored reviews do not have one uniform JSON envelope
Date discovered: 2026-10-04
Where: Private TASK045 final compensation eligibility, not application code
The gotcha: The proposed begin_final_compensation gate required reviewer=/root/commercial_auditor on every review, but the genuine independently returned browser receipt has role=INDEPENDENT_AUDITOR and no reviewer key. Independent source review found this before any new guard case, credential read or compensation dispatch.
What to do: Bind the exact independently returned receipt path, bytes, mode, SHA and PASS through the actual role handoff. Parse each source-traced typed envelope explicitly. Keep scope and provenance constraints; never manufacture a new PASS, rewrite the original receipt or accept arbitrary self-declared reviewer values. Cover actual known receipt shapes and the composed eligibility boundary, since selected pure ownership/rate/context/input guards alone do not exercise begin_final_compensation. The fixed-binding adapter was then independently source-reviewed911f5bb7, and its first focused plan40ed81d6 passed. The sole actual28-case entry passed4 accepted/24 rejected, including the genuine API914/browserb5 prefix and eleven new authority/verdict/task/source/binding negatives. The old17-case snapshot remains zero-run. Actual result reviewa1a1bbb7 PASS is complete. Exact final binding review04f430aa and sole live compensation closure7c4fdccc PASS are complete; all50 original table maps/32 rows/seven rates were restored before four owned input unlinks. Source-plan PASS and inert checks alone do not establish database execution; the later actual transport/CAS/post-state evidence provides that scoped proof.

Final cleanup evidence also uses its own typed manifest envelope: entries, rather than the earlier artifactPairs shape. Auditor collector4fbdb3e7 retains the metadata-only KeyError before projected output. Read the actual declared schema before choosing aliases; correct only the saved-evidence projector and never replay the operation.


TASK-046 recurrence, 2026-10-04: the terminal helper already passed before three saved-evidence collectors failed on a full50 wrapper comparison, wrong wrapper scalar counts and an assumed universal mutation key. Full50 evidence stores its map under tables, with49 model tables and1 ledger table containing10 migration rows. SQL intents use either mutation or noMutation/statementCount according to their declared source. A failure-recording command also stopped at SyntaxError before executing its body. Preserve each original record, project the actual typed fields and correct reporting only; never rerun cleanup. Genuine closurefb4ad9ce verifies the original7SELECT/oneCAS, restored50 maps/32 rows/seven rates and four unlinks. These are G-018/G-019 metadata-shape recurrences, not application, provider or cleanup failures.

TASK047 application,2026-10-04: Root reported a final integrity collector guessing undeclared PLAN.json, receiving FileNotFoundError before writes or operations, then using rg to locate the actual PLAN.md and verifying its declared descriptors. No exact failure-artifact descriptor was supplied for that reported selector error. Earlier saved-data schema/name projector limits remain in their original reviews. These are reporting failures; preserve them without reclassifying successful build/cleanup or rerunning operations. Use the actual manifest schema and declared filenames. Extend existing G-019; no new Seen increment, lesson or corpus is proposed.


TASK048 application,2026-10-05: Root's seed-acceptance collector assumed result.rows; the saved result uses fixtureRows. Its KeyError was retained in e5031aff before acceptance writes or operations. A later runtime-acceptance collector assumed the Coder manifest verdict was PASS; the actual label was ACTUAL_HELPER_PASS_PENDING_INDEPENDENT_REVIEW. That assertion43715d28 also preceded acceptance/GO/operations. Project the declared saved schemas and bind the genuine independent PASS separately; correct consumer metadata only. Neither failure changes successful init/seed/runtime/cleanup or authorizes replay. Preserve both original records; no new Seen increment, lesson or corpus is proposed.

TASK048 publication compatibility retained at TASK049 closure, 2026-10-05: gh pr edit failed on the deprecated GraphQL repository.pullRequest.projectCards field. Normal publication had succeeded; this was a PR-body transport compatibility failure, not an app or build failure. A fresh normal REST GET proved the old 4,850-byte body, then one equivalent structured REST PATCH and final GET proved the approved 5,622-byte body. The raw.pr projection intentionally retains the pre-update body; finalPR is the updated readback. Keep both actual receipts (TASK048_ACTUAL_PR_BODY_UPDATE.json b9327414; TASK048_ACTUAL_REST_PR_BODY_UPDATE.json 31a17cd5) and use the normal supported REST body transport without replaying publication, discovering credentials or silently treating a historical projection as current.

TASK050 application, 2026-10-05: descriptor roles original/compatible are separate from scope metadata, and direct input membership is separate from retained genuine review authority. A saved-map assertion also incorrectly demanded the retired separate Workflow step endpoint; the actual43 displayed/44 mapped routes match the retained combined-flow contract, with /_global-error as the extra map entry. Preserve read-only collector stops and correct only their declared-data projection. They do not relabel actual test/build results, require recursive history inventories or authorize rerunning checks.

TASK050 CI recovery, 2026-10-05: normal check annotations5901391e provide the actual stale promptVersion assertion even though normal raw job-log redirect access failed. Bind the check/head/title/path and stated mismatch; do not invent whole-suite counts or other failure causes from omitted properties or successful preceding steps. Source/plan PASS is distinct from future corrected-source CI. Keep four unfinished private files UNEXECUTED/PARKED, with no local dispatch and no global absence probe. Proportionate typed evidence does not require recursive unchanged-history inventories, transport bypass or passing-check replay. Existing incidental Workflow transport limits remain; no new gotcha or corpus is added.

TASK051 application, 2026-10-05: use actual typed handoff names such as caseSelection/validationAndLimits, and validate a superseded original-current descriptor against its retained snapshot rather than the changed repository path. A receipt-only name projector and a Vitest-spelling assumption for Node producer titles stopped before writes; correct only saved-data projection and preserve the stop. Historical no-case-yet paragraphs are dated checkpoints, not current outcomes. Normal annotations identify the original strict-target caller failure; corrected run/job/check/suite metadata proves all22 listed steps succeeded, not a fresh17/21-case total or zero skips. Keep originalCI37290153415 FAILED and the static review miss, reuse accepted unchanged source/publication evidence, and avoid recursive inventories, raw-log retries or passing-check replay. No new gotcha/corpus or other Seen change.

TASK052 pre-execution review: the source handoff declares sourceManifest/sourceDiff and other descriptors at top level, not members. Auditor collector15dc0d stopped at KeyError before source projection or any operation; corrected only the typed saved-data read. The factual documentation co-sign explicitly preserves the independent source blocker and grants no source or publication PASS.
TASK052 publication/CI continuation, 2026-10-05: native commit messages omit exactly one canonical terminal LF; prove canonical commit SHA/tree/parent parity before normalizing only that boundary. Read keyed leaf maps as maps and native wrapper stdout explicitly. Receipt-only projection stops preceded writes and did not replay publication. Completed run/job/check/suite and normal annotations establish failed web build; generic .github annotation paths require separate exact-source attribution. Skipped later stages do not establish passing nineteen-case results or raw counts. Preserve original source/static review and FAILED CI; source/plan approval remains distinct from future corrected-head CI.


## G-020: Private predecessor approval remains a Root operator boundary
Date discovered: 2026-10-04
Where: Private TASK046 TRANSPORT.py:272 predecessor and Root acceptance/once-GO handoffs
The gotcha: Frozen helpers check listed descriptor integrity, exact source/task/phase/status and the stage result PASS. They do not enforce the required evidence list membership, parse the independent verdict, or read a once-GO file.
What to do: Root must verify the genuine independent PASS and required actual evidence before authoring each acceptance, then issue the exact separate once-GO. Auditor binds those genuine reviews and descriptors during the next phase review. Preserve this external authorization rule in every copied tool plan. Exact binding review073f2eef and actual closurefb4ad9ce verify the bounded046 handoff; no generic cryptographic-review-authority claim follows.
What NOT to do: Treat matching hashes or stagePASS as independent approval, manufacture or rewrite a PASS, silently dispatch a next phase, or replay a closed helper after its owned inputs are gone.

TASK047 application,2026-10-04: Root verifies genuine independent reviews, required descriptor membership/modes and actual prerequisite evidence, accepts them, then issues each separate once-GO. Exclusive intents, source hashes and a pinned review alone do not parse authorship or authorize a phase. Preserve distinct source/pure/readiness/case/type/build/cleanup gates in copied tools. Actual Webpack before/after guards and then separately authorized cleanup bound exact original OID23592/nonce/profile/container, owned51 empty/ledger0/zero connections and shared50/101. The cleanup completed once; original database and profile were removed, shared whole-table counts/digests and final143 source pins preserved. Current filesystem inspection independently confirms profile absence including dangling links. Database absence and container preservation are supported by successful executed source/final result/outer completion; separate raw internal command outputs were not retained. Closed isolation entries are now ineligible for replay.

TASK048 application,2026-10-05: Each init/seed/runtime/cleanup dispatch required Root's genuine independent-review/evidence-membership checks and separate once-GO. Source/exclusive intents and descriptor hashes support integrity; they do not establish cryptographic Root authorship. All four operations are terminal and closed entries are ineligible for replay.


## G-021: Artifact output paths can overwrite pinned inputs
Date discovered: 2026-10-04
Where: TASK047 private verification tooling
Private metadata collection reused a path variable and wrote21830-byte manifest JSON over the installed1102-byte pnpm.cjs. The prior snapshot enabled byte-identical restoration, SHA b276da51dc8ca5b0d3ee3371695b50fc8b3244b281b091c63a3f082a88dadeb9. Separate immutable input descriptors from explicit private output paths; require containment/exclusive creation and reject output aliases of pinned tool/source/input files. Preserve the real overwrite/failure/first handoff and restoration. Current independent byte/mode equality proves restoration. No process used the transient overwrite remains Coder attestation, not retrospective process proof. This was a real metadata write, not a read-only projector failure.

Evidence:5ee76279 failure;0eae6263 original source review metadataCorrection.

## G-022: Copied dependency symlinks can escape Turbopack's root
Date discovered: 2026-10-04
Where: TASK047 private verification tooling
The isolated package build regenerated Prisma/shared output and compiled26 Workflow steps/3 workflows, then Next16.3.8 Turbopack rejected the prepared apps/web/node_modules link outside its filesystem root. This is copied-build tooling failure, not demonstrated application failure or completed build. Installed docs require linked dependencies within a common root. Installed CLI/dispatcher support build --webpack. A private direct CLI continuation can avoid the package wrapper's repeated prerequisite generation, with unchanged app config and a reviewed explicit environment. Strip conflicting inherited bundler selectors; do not assume the supplemental skill's bundler config/BUNDLER examples are installed APIs. Preserve failed output/reached subprocesses. A later Webpack success must be labeled by bundler and cannot establish default Turbopack, independent Eve runtime or natural recurrence.

Evidence:48b2e2d actual failure/scope;1e2a71ed private build-only plan;3dd24059 actual Webpack/post-state review;ffd7d22f actual cleanup review. The supported direct Next16.3.8 Webpack command completed with a new BUILD_ID pEa-kRSVkNVP08orJiPdq, 44 emitted routes,26 steps/3 workflows and integrated TypeScript/static31 output. This does not convert the original default Turbopack failure into PASS.


TASK050 reinforcement, 2026-10-05: installed Next16.3.8 preserves an existing NODE_ENV, and the installed Eve integration selects a development-service branch from that value. A source-supported zero-run plan finding was corrected by setting production only for the reviewed build child, without inspecting inherited environment values or changing app config. Actual direct production Webpack then passed; its .env.local filename banner does not prove values were inspected or network traffic captured. Packaging output remains separate from default Turbopack, standalone Eve/native runtime and hosted delivery.

## G-023: Serialized Workflow errors need supported hydration
Date discovered: 2026-10-04
Where: Private TASK048 failed-run observer, installed Workflow5.0.1
The gotcha: Native run.error is serialized data; reading an assumed error.message does not establish the actual failure cause, even when an observation requests resolveData:none. Independent original plan25f465d5 caught this before runtime dispatch.
What to do: For an already failed run ID, use the installed public workflow/api getRun(id).returnValue to hydrate in RAM, then the exported workflow/internal/errors WorkflowRunFailedError.is classifier and exact cause.message === MAINTENANCE_STALE. Bound the observation to2000ms and check the overall monotonic deadline after it returns. Persist only a safe STALE/OTHER classification, never raw hydrated error data. Do not wake, start or cancel a run to inspect its cause. The corrected derivative61c2f966 preserved the strict stale assertion; actual runtime81414db8 classified the third failed run through this supported path.
