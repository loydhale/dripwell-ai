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
What to do: Stage only the known application cookie, then use a standalone open with --headers as an actual CLI option in the same owned session. Use the proven normal CLI62.1 project token interface, keep tokens/header values in memory and close the owned session. Record the actual first protected boundary; saved Trusted Sources rules remain a separate fact.
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
