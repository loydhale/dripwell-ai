# PATTERNS.md

Reusable approaches that work in this specific codebase. These are not general best practices. These are "here's how this project does X, match it."

Format per entry:

```
## P-<number> — <short name>
Date: <YYYY-MM-DD>
Where in codebase: <file paths or module>
The pattern: <description of the approach>
When to use: <conditions>
Example: <pointer to a reference implementation in the code>
```

Rules:
- New patterns append to the bottom
- Coders must follow documented patterns even if they personally prefer alternatives
- Auditor enforces patterns during review
- If a pattern is no longer used in the codebase, delete it during weekly review

## P-007 — Declarative rule engine with condition + getTriggers pairs
Date: 2026-04-22
Where in codebase: apps/api/src/services/safety.ts
The pattern: Define flag/detection rules as an array of objects where each rule has a `condition` function (boolean check) and a `getTriggers` function (extracts matching evidence). This separates detection logic from evidence collection and makes rules self-documenting and testable in isolation.
When to use: For any rule-based detection, scoring, or classification system that needs to map raw inputs to structured outputs with traceability.
Example: `FLAG_RULES` array in safety.ts with `condition(ctx)` and `getTriggers(ctx)` on each rule.

---

## Entries

## P-001 — Branded ID types for domain entities
Date: 2026-04-22
Where in codebase: packages/shared/src/types/index.ts
The pattern: Use intersection types (`string & { __brand: 'TypeName' }`) to create nominal types for IDs, preventing accidental mixing of TenantId, AssessmentId, ProviderId at compile time.
When to use: For every domain entity ID that should not be interchangeable with a plain string.
Example: `export type TenantId = string & { __brand: 'TenantId' };`

## P-002 — vite-plugin-pwa with external manifest.json
Date: 2026-04-22
Where in codebase: apps/web/vite.config.ts, apps/web/manifest.json
The pattern: Set `manifest: false` in VitePWA config and provide a standalone manifest.json. This keeps the manifest editable without rebuilding and makes it inspectable in DevTools.
When to use: For all PWA projects where the manifest is static and should be version-controlled separately.
Example: apps/web/vite.config.ts plugins array

## P-004 — XHR with FormData for upload progress when fetch ReadableStream is overkill
Date: 2026-04-22
Where in codebase: apps/web/src/lib/upload.ts
The pattern: Use XMLHttpRequest (XHR) instead of fetch for file uploads when upload progress tracking is required. XHR exposes `xhr.upload.onprogress` natively. Wrap it in a Promise and always resolve with an `{ ok, error?, photoCapture? }` result object so callers never need try/catch.
When to use: For any file upload that must show a progress bar to the user.
Example: `uploadPhoto({ assessmentId, angle, blob, onProgress: (p) => { ... } })` in upload.ts

## P-003 — Fastify plugin + Zod validation helper for route validation
Date: 2026-04-22
Where in codebase: apps/api/src/plugins/auth.ts, apps/api/src/lib/validate.ts, apps/api/src/routes/*.ts
The pattern: Use a centralized `parseBody(schema)` helper that wraps Zod safeParse and throws a `ValidationError` with structured issue details. Register auth, tenant, and error-handler as Fastify plugins, then apply them via `preValidation` hooks per-route.
When to use: For all API routes that need request body validation, JWT auth, tenant isolation, or role-based guards.
Example: `const data = parseBody(createTenantSchema)(request.body);` in tenants.ts

## P-005 — Polymorphic catalog with type enum
Date: 2026-04-22
Where in codebase: packages/shared/prisma/schema.prisma CatalogItem model, apps/api/src/services/recommendations.ts
The pattern: Catalog items share a single table with a `type` enum or string discriminator (e.g., DRIP, INJECTION, ADD_ON). Recommendation logic can apply type-specific scoring or filtering without separate tables.
When to use: When a clinic catalog contains multiple product types that share most fields (name, description, ingredients, price) but need behavioral differentiation.
Example: `if (item.type === 'DRIP') score += 0.5;` in recommendations.ts scoreCatalogItems.

## P-006 — Store full match metadata in JSON audit columns, not just IDs
Date: 2026-04-22
Where in codebase: apps/api/src/services/patterns.ts persistPatternMatches
The pattern: When persisting structured match data to JSON columns, store the full metadata object (including confidence, weight, values) rather than flattening to bare IDs or names. This preserves audit granularity and prevents data loss when the upstream source changes.
When to use: For any Json field in Prisma that captures derived match or scoring data.
Example: `matchedSignals: p.matchedSignals as unknown as object` instead of `.map(s => s.signalName)`.

## P-008 — Database-backed sessions reread current authority
Date: 2026-10-01
Where in codebase: apps/web/lib/auth.ts, apps/web/tests/auth.node.test.ts
The pattern: Store only a random opaque cookie token in the browser, hash it in the session table, and load the current active user, tenant, location and approval authority for every request. Role changes, deactivation and revocation apply to existing sessions.
When to use: V2 authenticated routes and agent channel identity.
Example: `userFromToken` and its actual PostgreSQL authority/revocation integration test.

## P-009 — One typed eligibility gate for clinical outputs
Date: 2026-10-01
Where in codebase: packages/shared/src/v2/engine.ts
The pattern: Validate declared condition semantics at configuration activation, evaluate only confirmed answers of the configured type, and centralize required clinical screening in product eligibility. Initial and wellness selection both use the same gate.
When to use: Any generated or staff-selected clinical item, including future services.
Example: `evaluateConfiguredCondition` and `evaluateProductEligibility`, covered by the foundation audit regression cases.

## P-010 — Bind agent context to the selected location and owner
Date: 2026-10-01
Where in codebase: apps/web/app/api/setup/route.ts, apps/web/agent/channels/eve.ts, apps/web/agent/lib/scope.ts
The pattern: Persist the validated tenant, owner, location and agent session binding when creating a conversation. Recheck that exact binding on continuation, tools and approved memory recall; older unbound conversations remain unavailable instead of inheriting a default location.
When to use: Multi-location durable setup assistants and private agent sessions.
Example: The actual PostgreSQL setup-scope suite uses a selected second location and rejects foreign, mismatched, legacy unbound and deactivated-owner contexts.

## P-011 — Reviewed preview adaptation has an exact source manifest
Date: 2026-10-02
Where in codebase: docs/AUDIT_DEPLOYMENT.md, external isolated preview stage
The pattern: Compare every staged tracked file directly against the selected Git commit, allow only the documented preview configuration difference, and exclude credentials from the upload. During initial approved provisioning, apply exact migrations once to an isolated database and compare schema/ledger/checksums. Later source deployments reuse that verified history without migration replay. Read the actual stable Preview alias after deployment; if a manual alias remains on the prior source, preserve that result, separately review a same-project Preview alias assignment and read back its actual new deployment ID.
When to use: A platform-plan limitation requires an isolated synthetic preview adaptation without changing approved production behavior.
Example: The d4239d5 stage compared 293 tracked files, changed only apps/web/vercel.json crons, added only the nonsecret Vercel project link and contained zero environment files. TASK043 independently compared353 tracked807 blobs/354 actual leaves, deployed READY with two native-runtime bundles and observed the manual alias still on oldb61. One separately reviewed Preview alias set/readback selected the new READY deployment; no second build, production promotion, protection change or hosted migration replay occurred.

## P-012 — Verify native dependencies from each deployed agent bundle
Date: 2026-10-02
Where in codebase: apps/web/agent/agent.ts, apps/web/scripts/verify-eve-prisma-output.mjs
The pattern: Use the installed framework's supported external-dependency tracing, generate the deployment runtime's native engine, and fail the build if package or engine resolution leaves a physical function bundle. Validate each packaged client with its own engine against isolated PostgreSQL, and prove the guard rejects an artifact with the engine removed.
When to use: Agent or workflow service bundles use a native dependency independently of the Next.js service.
Example: Both Node 24 eve server and workflow bundles passed real Prisma queries with their bundled RHEL engine; an external missing-engine copy failed validation.

## P-013 — Separate retained archive paging from reporting dates
Date: 2026-10-02
Where in codebase: apps/web/lib/clinic.ts, apps/web/components/clinic-context.tsx, apps/web/components/dashboard.tsx
The pattern: Validate bounded server-backed search and keyset pages under the current tenant/location/filter, ordered by immutable creation time plus unique ID. Archive browsing includes every retained age while historical metrics keep their own date predicates. New client filter requests invalidate stale responses; page failure preserves loaded records.
When to use: Retained-record search and pagination that must coexist with period-based outcome dashboards.
Example: TASK-020 actual PostgreSQL walks 251 tied-time records, finds/restores a 500-day-old visit and retains metric denominators; browser failure/retry and stale-response checks pass.

## P-014 — Each audio segment owns a monotonic active capture budget
Date: 2026-10-02
Where in codebase: apps/web/lib/recording-clock.ts, apps/web/components/audio-recorder.tsx
The pattern: Give every native MediaRecorder its own monotonic active-time clock and remaining-limit timer. Pause cancels its timer without losing fractional elapsed capture; resume schedules the remaining budget; stop freezes duration before asynchronous delivery. Completed durations plus the current clock drive the visible timer, and captured retry metadata remains immutable.
When to use: Shared consultation and setup voice recording, including pauses, rollover and interrupted/unmounted capture. Do not reuse wall time or a shared old-segment timer to account for audio duration.
Example: TASK-026 six focused timing regressions plus real synthetic Chromium event observations prove pause exclusion, paused stop and a 60,000 ms rollover after repeated resumes, with ordered nonempty segments.

## P-015: Isolate global maintenance verification with owned schema-only data
Date: 2026-10-02
Where in codebase: apps/web/app/api/jobs/reconcile/route.ts, TASK-030 verification
The pattern: Global recovery/pruning endpoints use a fresh exclusively owned loopback database rather than a shared fixture target. Copy only schema DDL after comparing successful applied migration checksums to reviewed source, keep rolled-back history separate, and prove all initial tables empty. Bind equal explicit DATABASE_URL/TEST_DATABASE_URL and verify database OID, unique shared-object comment marker and container mapping before fixture/server/drop operations. Compare whole-table digests after each auth denial and preserve every shared baseline table through cleanup.
When to use: Actual compiled maintenance/cron verification that can alter unrelated consultation, job, authentication or rate-limit rows. Keep providers blank unless a separately approved bounded provider test selects only owned artifacts.
Example: TASK-030 copied50 empty schema tables, proved401/no mutation twice and one authenticated HTTP reminder/recovery/prune pass, then removed only its OID/nonce-guarded database while all50 shared-table digests and the existing container remained unchanged.

TASK047 application,2026-10-04: Reuse the existing list query and validate exact owned51/shared50 table-name sets/lengths before any per-table content SELECT. Unexpected names must fail before content access or exceeding the106-query read-only ceiling. Preserve failed initialization and bind same-target readiness/independent review/Root acceptance. Schema-only old50 plus one new additive SQL is distinct from migration-ledger replay. Fresh per-phase before/after guards are required; earlier checkpoints or hooks do not prove missing post-state. Identity, individual table, connection and shared observations are sequential, not one cross-target atomic snapshot.

Evidence: finding462aab2e; resolved plan a307c23b; actual readiness ea21d1f3. Extend the existing pattern.


## P-016: Verify physical provider retention before compensation
Date: 2026-10-02
Where in codebase: apps/web/app/api/jobs/reconcile/route.ts, TASK-031 verification
The pattern: Before enabling an already-selected storage binding, prove the exclusively owned isolated database limits every deletion selector to expected unique owned pathnames and zero upload-cleanup jobs. Create tiny expired/unexpired controls with exact returned-path ownership, verify authenticated origin bytes, exercise one real compiled request, and verify uncached absence plus authored row changes before compensating only the surviving control. A successful delete counter or cleared database path alone is insufficient; retain the unchanged object's bytes/ETag/whole row and all unrelated table digests.
When to use: Actual provider retention/deletion verification, where ordinary cached reads or finally cleanup could otherwise make a metadata-only operation appear successful. Keep inference/email/billing identities blank and distinguish local compiled provider proof from hosted scheduling and policy eligibility.
Example: TASK-031's selected private Blob2.8.0 store returned exact72/75-byte objects; one compiled200 request deleted only the expired object, uncached get returned null/notfound before cleanup, the unexpired control and49 other table digests were unchanged, and only the remaining control was compensated. All50 shared digests/resources were preserved.

## P-017: Trace the feature-specific provider chain before parking work
Date: 2026-10-02
Where in codebase: apps/web/app/api/setup/upload/route.ts, apps/web/workflows/recordings.ts, apps/web/components/setup.tsx, TASK-032/033
The pattern: Trace each feature's selected model and complete source branches separately from shared readiness checks. Owner voice upload creates SETUP_TRANSCRIPTION, saves a reviewed editable transcript and awaits an explicit Send action; ordinary consultation transcription continues into the language-model summary. A denied language model therefore need not block a separately eligible setup transcription check. Public capability metadata, selected-account credit/identity readiness and a real completed operation are still three distinct evidence boundaries.
When to use: Resuming dependency-blocked work without buying credits, changing providers/models or fabricating an inference result. Require supported current identity and usable authorized allowance before execution; preserve automatic retry limits and report the exact verified story.
Example: TASK-032 independently identifies the existing openai/gpt-4o-transcribe free-tier candidate while retaining the actual Luna403, historical failed jobs, protection and false real-data gate. TASK-033 requires separate readiness and an owned synthetic job before claiming transcription.

## P-018: Preserve addressable provider evidence while compensating synthetic audio
Date: 2026-10-02
Where in codebase: apps/web/app/api/setup/upload/route.ts, apps/web/workflows/recordings.ts, TASK-033 verification
The pattern: Bind a synthetic operation to its actual returned recording/job/run, retained tenant/owner/location/conversation and exact storage pathname. After terminal execution, verify authenticated uncached bytes, remove only that owned audio and prove uncached absence before a conditional single-row EXPIRED/path-empty compensation. Preserve the real transcript, complete job/result/usage and conversation for addressability, then compare captured before/after controls. State null provider fields and any missing baseline instead of inferring cost, duration or broad preservation.
When to use: Actual selected-provider verification on a protected synthetic preview without a setup discard endpoint. Keep clinical/trial/configuration state and unrelated history intact; do not use global maintenance or erase successful evidence to make cleanup look empty.
Example: TASK-033 retains completed gpt-4o-transcribe output and UNKNOWN/needsReview markers while deleting only its203534-byte private Blob. Its12 control digests/two historical failed jobs remain unchanged; unrelated-rate preservation is explicitly unverified because its before-baseline was absent.

## P-019: Bind hosted reminder evidence and cleanup to the original visit and run
Date: 2026-10-03
Where in codebase: apps/web/lib/clinic.ts consultation.restore, apps/web/workflows/reminders.ts, TASK-037 verification
The pattern: Capture named binding/protection/false-gate and whole prior controls before exact fictional fixtures. Persist the sole compiled POST intent, fixed due and absolute deadline before sending. Select one small original-window metadata candidate and decrypt only its single owned visit argument before using run/step/wait/event evidence. Keep normal browser/inbox proof separate from metadata and missing capture. Compensate only proven terminal owned rows, with complete terminal steps, exact IDs/nonce/row hashes, all tenant-child counts and an atomic rollback on mismatch; preserve original provider metadata and every captured unrelated baseline.
When to use: Bounded real hosted timer verification that can run independently of language-model, Stripe, Resend or global Cron gates. A lost observer result requires a separately reviewed recovery boundary and retained fixtures, not another restore or broad maintenance.
Example: TASK-037's original hosted run naturally completed its exact future wait, two steps and one correct staff notification while the browser was closed. Recovery and the actual normal inbox passed; strict original live future-wait capture remained missing. Nine exact fixture/derived rows were then removed, all34 owned tenant tables were empty, and four retained jobs/two recordings/12 controls/all unrelated rates/original cookie remained exact.

## P-020: Save bounded safe discovery metadata before targeted ownership
Date: 2026-10-03
Where in codebase: TASK-038 hosted verification, installed Workflow5 public World storage runs.list
The pattern: Use the actual supported metadata-only list parameters under the selected project/deployment. Before rejecting coverage or candidate selection, fsync a bounded typed projection of IDs/status/times, payload absence and workflow/deployment/window matching flags. Require complete page, valid ordering, adequate optional lookback and one exact candidate; only then request and decode its owned input/key. Retain one exclusive attempt intent and distinguish logical operations from observed SDK retry attempts.
When to use: Scoped hosted verification or cleanup where failure diagnostics must survive without exposing unrelated payloads or permitting another discovery, cursor or fallback.
Example: TASK-038's separate lazy descending-limit3 storage recovery saved two payload-free rows, selected only the original visit's run and completed seven observed World GET200 attempts. Actual terminal wait/events and exact nine-row compensation passed while the missing earlier future observation remained PARTIAL.

## P-021: Replay the complete eligibility prefix before live compensation
Date: 2026-10-03
Where in codebase: TASK-039 hosted verification, private terminal compensation orchestration
The pattern: Pin authoritative schema, exact helper bytes and the complete actual retained row/reply/terminal/inbox/closure corpus. Execute the entire pure eligibility prefix offline, stopping before its first write and any auth, browser, SQL, World or fixture import. Use separate private copies for negative evidence variants; preserve original failures and every source pin, including mutable pre-cleanup journals. Require original run/due/cutoff ownership and a genuine pre-closure capture, then use the unchanged conditional atomic cleanup and full baseline comparison only after independent review and explicit scoped GO.
When to use: A real operation succeeded but a private completion guard or cross-language field contract needs correction. Unit checks of selected frames alone do not exercise the assembled completion path.
Example: TASK-039 replayed all ten actual observe replies, actual unread Notification, terminal metadata, both browser closes and later normal inbox/story; 26 negative cases passed before the corrected sole finisher deleted exactly nine owned rows with all prior controls preserved.

## P-022: Keep retained billing contracts separate from the current checkout offer
Date: 2026-10-04
Where in codebase: apps/web/lib/commercial.ts, apps/web/lib/billing.ts
The pattern: Authorize older subscription events through bounded explicit server-side price/product/amount/currency/cadence contracts. Match complete provider items and lossless decimal text, retain customer/tenant/subscription/invoice guards, and require exactly one recognized item. Checkout selects only the current active offer. Invalid history fails before side effects and leaves relevant events retryable. Future rotation/rollback uses coherent current-offer/history tuples, preserving old subscribers and immutable trial/referral/credit snapshots.
When to use: An approved platform price changes for new subscriptions while existing subscriptions keep their original terms. Recognition does not authorize provider repricing, processed-event backfill or retroactive awards.
Example: TASK-042 reproduced missed old-price settlement/status events, then passed40 unit and6 actual-PostgreSQL cases with strict quantity/decimal/ambiguity guards and one original-policy award under concurrent qualification/replay. Stripe transport remained an explicit fixture.


## P-023: Normal nonce-owned hosted fixtures and exact rate compensation
Date: 2026-10-04
Task: TASK-044; reusable for approved TASK-045
Use when: A missing deployed boundary can be reached with an ordinary fictional owner and requires exact fixture release without changing another clinic or rate window.
Pattern: Register through the normal owner API using an exclusive visibly fictional nonce/email. Reconcile actual server IDs and canonical hashes; capture complete preexisting50-table/rate state. Use origin-scoped memory authentication for the real UI. Before compensation require every owned browser context released, exact nonce/UUID/FK/canonical-row ownership and the fresh observed rate version. Execute one conditional transaction restoring only that exact shared bucket state and removing only the proved fixture rows. Verify original full-table/rate equality, then remove only hash-owned temporary inputs. Preserve partial failures and stop on uncertain commit rather than replaying mutation.
Concrete evidence: TASK044 normal201/three200/settingsUI,32→37→32rows, one exact rateCAS, both closed contexts and three owned input removals. Independent actual reviews ef5b5138/6219ca19 PASS. Normal owner clinical/MFAfalse and protected false gate remained intact.
Limits: This is scoped verification and preservation, not clinical authority, billing/paid-referral or full-pilot completion. Do not seed privileged users, spoof limiter identity, sweep old records or overwrite concurrent traffic.


## P-024: Bind an accepted continuation to its immutable failed ancestor
Date: 2026-10-04
Task: TASK-045
Use when: An application action succeeds, its legitimate credential is preserved, and a verification collector fails before dependent actions.
Pattern: Independently reconcile the actual success, owned records, credential descriptor and preservation proof. Retain the original FAILED result and exact executed evidence. Prepare a distinct continuation containing only unattempted boundaries, with required fresh RAM-only transport authentication identified separately. Later phases accept only the exact independently reviewed continuation plus its failed ancestor; never overwrite the failure, reconstruct a session or repeat the successful mutation.
Concrete evidence: Recovery signup201/five canonical owned rows/secure245-byte cookie/direct rate proof passed; duplicate evidence filename stopped a second SELECT before dispatch and both ownGETs were unattempted. Factual review6334905a verifies this boundary. The distinct continuation later completed two ownGET200 and six originally unattempted SELECT200 with exit0 and independent review8aeaecb5 PASS. Root acceptance82c3e281 binds its exact result/state/closure/review and the immutable FAILED ancestor. No original signup or server/rate proof was replayed.
Limits: Source-enforced assertions with no retained raw payload must be described as such. Unexpected state or uncertain writes stop execution for reconciliation. This pattern does not authorize clinical approval, trial use, billing or pilot completion.

Final scoped evidence: API review914faa96 and browser reviewb5f18f02 verify two inactive drafts, four saved deterministic tests, two cross-clinic404 denials and four cold desktop images. Exact final binding review04f430aa preceded the sole conditional compensation; actual closure7c4fdccc PASS verifies removal of18 owned rows, restoration of all50 original table maps/32 rows/seven raw rate rows, and four exact owned input unlinks. Identical USD100 fixtures, inactive versions, source-enforced subset proof, combined-stream and device limits remain explicit.


## P-025: Isolate MFA session and recovery effects with checkpoints
Date: 2026-10-04
Task: TASK-046
Where in codebase: apps/web/lib/auth.ts:115-118, apps/web/lib/mfa.ts, private TASK046 protocol verification
The pattern: Pre-enrollment password login omits the registration app cookie, because supplying it can revoke that first session during login. Observe both owned sessions unrevoked immediately before confirmation, then compare the exact enrollment effects. Enabled password logins and challenge/recovery requests also omit prior app cookies. Verify successful recovery removes one hash and consumes its challenge; rejected reused recovery must leave the challenge and canonical auth state unchanged, while documenting its rate-limit effect separately. Ordinary SUPER_USER/clinical=false and platform403 must remain unchanged.
Concrete evidence: Actual API review5c54bc87 verifies genuine installed TOTP enrollment, session1 revoked/session2 verified, one recovery consumed/hash removed, reused recovery401, consumed challenge410 and platform403. Browser34e7d82b verifies the cold enabled account with empty secret/recovery fields. Closurefb4ad9ce verifies exact nine-row cleanup, all50 original table maps/32 rows/seven raw rates and four owned input unlinks.
Limits: Normal enrollment success proves encryption usability for this fictional Preview flow without reading the key. It does not prove fresh authenticator challenge-login/TOTP replay, physical devices, clinical authority or the full pilot.


## P-026: Bind compiled natural timers to artifact, run and closure evidence
Date: 2026-10-05
Task: TASK-048
Where in codebase: apps/web/workflows/maintenance.ts and private local Workflow5.0.1 verification
The pattern: Bind current, prepared and published source inputs to a precisely defined compiled-file digest before reusing an existing build. Record genuine native run IDs, parent/ordinal links and matching wait_created/wait_completed correlations; require completion at or after each resumeAt and two naturally dispatched successors. Bound both blocking observations and final success by a monotonic deadline. Record actual fault/recovery, current-state predicates, deduplication and stop-generation fencing separately from timer progress.
Concrete evidence: Runtime81414db8 verified161 source inputs and the first defined313-file artifact capture (digest89a9dce4), three run IDs/three wait pairs/two natural successors at20-second cadence within180 seconds. The first reminder failure recovered; stop advanced generation and the third run ended with hydrated MAINTENANCE_STALE. All runs were terminal before explicit same-process World close; the owned process subsequently exited and was observed absent. Cleanup50bd031e verified original OID25148/nonce/51-table terminal map, non-FORCE drop, profile/World absence and shared50-table/101-row count/digest preservation.
Limits: Native successor creation can precede its parent's final completion event by a short tail; do not claim strict native-lifetime nonoverlap. World close is not run cancellation. The artifact digest is the first defined capture, not reconstructed TASK047 history. This proves local compiled recurrence and terminal cleanup, not hosted scheduling, Blob/provider work or the full pilot.

## P-027: Version approved offer facts without rewriting historical documents
Date: 2026-10-05
Task: TASK-050
Where in codebase: packages/shared/src/v2/{contracts,engine}.ts; apps/web/lib/{clinic,sharing}.ts; apps/web/components/wellness-offer.tsx
The pattern: Put new clinic-approved benefits and matched reviewed goals in the wellness-only v2.2 snapshot and public takeaway2. Keep initial/care v2.1 and legacy wellness2.1/takeaway1 schemas. Derive revision and job provenance from the validated artifact's actual version. Check the hash of the untouched saved raw payload before parsing its public whitelist; parsing may remove private or unsupported fields without changing stored identity/content/hash. Existing saved artifacts return before current-catalog parsing; an approved legacy plan without a document creates v1 without enrichment. A tracked legacy edit becomes a new explicitly reapproved version. Staff, recipient and PDF presentation consume the same approved saved facts, official price/currency and exact terms, with optional labels and no inferred cadence, savings or benefits.
Concrete evidence: Actual review cd5c956e verified the disjoint15+1+1 new-case composite, one affected domain case, three synthetic v2/v2/v1 PDF text extractions, web types and a production Webpack build. Independent public-projection expectations preserved raw legacy identity/hash while omitting clinic currency and new offer fields. Approval rejects independent benefit-only, goal-only and combined fact forgery.
Limits: Mocked persistence/static cards/PDF text establish this source contract, not actual delivery, browser/device layout, payment conversion, deployment or the full pilot.

TASK050 CI recovery, 2026-10-05: mixed-kind provenance assertions must retain the kind-to-version mapping, INITIAL v2.1 and WELLNESS v2.2, rather than a universal historical literal. Change the expectation only when actual artifact provenance and the normal failure annotation support it. The one-expression repair is source-reviewed10d6c44a; unchanged unfiltered CI with a fresh synthetic PostgreSQL service is the accepted integration planf75b9347. Publication and genuine corrected-head CI closure remain required; prior local18/PDF3/type/build evidence is preserved rather than replayed or inflated.
