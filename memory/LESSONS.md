# LESSONS.md

Mistakes the team has made on this project and how to avoid them next time. Every lesson should be specific enough that reading it prevents the mistake from recurring.

Format per entry:

```
## L-<number> — <short name>
Date: <YYYY-MM-DD>
Task: <task_id where it happened>
What went wrong: <one or two sentences>
Root cause: <the real reason, not the symptom>
Avoid by: <concrete rule for next time>
Seen N times: <counter, starts at 1>
```

Rules:
- New lessons append to the bottom
- If the same lesson happens again, increment the counter instead of adding a duplicate
- If a lesson hits 3+ times, Auditor promotes it to GOTCHAS.md on the next weekly review (it's now a project quirk, not a team mistake)
- Lessons that no longer apply (code has changed) get deleted during weekly review

## L-012 — Wrong branded ID factory used for cross-entity references
Date: 2026-04-22
Task: TASK-009
What went wrong: Coder used `makeSafetyFlagId()` to construct a `ProviderId` value in three places within safety.ts, defeating the branded nominal type system that prevents mixing entity IDs at compile time.
Root cause: The Coder needed to convert raw database strings into branded types but used the wrong factory function and suppressed the type error with `as unknown as ProviderId` rather than using the correct `makeProviderId`.
Avoid by: When mapping database records to branded ID types, always use the factory function that matches the target entity. If one does not exist, add it to `@dripwell/shared` instead of bypassing the type system with casts.
Seen N times: 1

## L-013 — New status values break downstream status-filtered queries
Date: 2026-04-23
Task: TASK-010
What went wrong: Adding `MODIFIED` to RecommendationStatus broke approve, override, and get-pending queries because they all filtered for `status: 'PENDING'` only. After a provider modified a recommendation, they could no longer approve it.
Root cause: The Coder added a new status without tracing every query that filters by status to see if the new state should be included.
Avoid by: When adding a new enum value to a status or state field, always grep the codebase for every query that filters by that field. Update them to include the new state if it is part of the normal workflow.
Recurrence: TASK-021, 2026-10-02. Deterministic generation wrote `COMPLETED`, while the result route and polling client recognized `COMPLETE`/`complete`. Trace string status writers/readers as well as enums, use a canonical new-write value, and normalize historical success aliases without rewriting persisted results or treating unfinished jobs as complete.
Seen N times: 2

## L-014 — AI-generated flag not propagated through bulk import paths
Date: 2026-04-23
Task: TASK-014
What went wrong: The `aiGeneratedDescription` field exists in the schema and UI, but the bulk import API (`/catalog/import`) does not accept or set it. Items imported from image upload with AI-generated descriptions will not carry the AI flag.
Root cause: The Coder added the flag for individual edits via PUT `/catalog/:id` but did not extend the import item DTO to include it.
Avoid by: When adding a tracking flag for AI-generated content, trace every creation path (individual create, bulk import, AI-assisted flows) and ensure the flag can be set on all of them.
Seen N times: 1

---

## L-015 — CSV DTO fields drift from database schema
Date: 2026-04-23
Task: TASK-014
What went wrong: The CSV preview and import schemas include a `price` field, but `CatalogItem` has no `price` column in the Prisma schema. The field is parsed, validated, and passed through the API but silently dropped during persistence.
Root cause: The Coder added `price` to match the task brief without verifying the database schema actually supports it.
Avoid by: Before adding a field to an import DTO, check the Prisma schema. If the schema lacks the field, either add the migration first or remove the field from the DTO to avoid confusing the caller.
Seen N times: 1

## Entries

## L-001 — pnpm catalog for shared dependency versions
Date: 2026-04-22
Task: TASK-001
What went wrong: Coder did not use pnpm catalog feature to centralize shared dependency versions (typescript, vite, etc.) across packages. Versions are duplicated in each package.json.
Root cause: Task NOTES suggested it but it was not treated as a hard requirement.
Avoid by: When scaffolding monorepos, check if pnpm catalog is appropriate and apply it to dependencies used in multiple packages. This reduces version drift.
Seen N times: 1

## L-002 — Redundant service worker registration when VitePWA injectRegister is active
Date: 2026-04-22
Task: TASK-002
What went wrong: main.ts manually registers the service worker, but VitePWA with injectRegister: 'script-defer' already injects registerSW.js into the built HTML. This creates two registration attempts.
Root cause: Coder did not notice that VitePWA handles registration automatically when injectRegister is configured.
Avoid by: When using VitePWA, check the injectRegister setting. If it's set, remove manual navigator.serviceWorker.register() from main.ts. If you need custom registration logic, set injectRegister: false.
Seen N times: 1

## L-003 — innerHTML injection of large static markup adds LCP overhead
Date: 2026-04-22
Task: TASK-002
What went wrong: Landing page content was injected via container.innerHTML = `...` in TypeScript, meaning the browser must download, parse, and execute JS before any page content renders. On slower connections this delays LCP compared to static HTML.
Root cause: Coder chose developer convenience (single TS file) over rendering performance. No templating engine was available and no requirement to prerender was given.
Avoid by: For landing pages with hard LCP targets, prefer static HTML in index.html or build-time prerendering (e.g., vite-plugin-ssr, or simple string replacement in index.html during build). Only use JS injection when the content is genuinely dynamic.
Seen N times: 1

## L-004 — JWT payload staleness after database mutation
Date: 2026-04-22
Task: TASK-004
What went wrong: Super user registered and logged in (JWT issued with tenantId: null). Then created a tenant, which updated their tenantId in the database. But subsequent API calls with the old JWT still had tenantId: null, causing all tenant-scoped operations to fail with 403.
Root cause: JWT is stateless and signed at login time. Mutations that change tenant membership do not automatically refresh the token.
Avoid by: When an API mutation changes a field that is embedded in the JWT (tenantId, role, etc.), re-issue the JWT in the response payload so the client can update its stored token.
Seen N times: 1

## L-005 — Fastify v5 reply.status().send() chaining breaks TypeScript strict mode
Date: 2026-04-22
Task: TASK-004
What went wrong: Using `return reply.status(201).send({ ... })` in route handlers caused `TS2554: Expected 0 arguments, but got 1` across multiple route files.
Root cause: Fastify v5's TypeScript types for `FastifyReply` after `.status()` do not allow `.send(payload)` chaining in strict mode with bundler moduleResolution.
Avoid by: Set status code on reply first (`reply.status(201)`), then return the response object directly from the handler (`return { ... }`). Fastify sends the returned value automatically. Same for error handlers.
Seen N times: 1

## L-006 — Wrong error class for auth failures produces misleading HTTP status
Date: 2026-04-22
Task: TASK-004
What went wrong: Coder used ConflictError (HTTP 409) for invalid email/password and missing user scenarios, which are authentication/authorization failures that should return 401 or 404.
Root cause: ConflictError was the closest available custom error class, but the Coder did not map error semantics to correct HTTP status codes.
Avoid by: When adding auth or resource-not-found errors, always match the error class to the intended HTTP status. Auth failures = UnauthorizedError (401). Missing resources = NotFoundError (404). Resource conflicts = ConflictError (409).
Seen N times: 1

## L-007 — State transition helper call order can suppress UI state
Date: 2026-04-22
Task: TASK-005
What went wrong: `setError()` displayed an error message, but `setCaptureMode()` was called immediately afterward. `setCaptureMode()` unconditionally set `errorMsg.style.display = 'none'`, hiding the error before the user could see it.
Root cause: State transition helpers were designed to reset all UI state to a known baseline, including clearing errors. When composed sequentially, the second helper overwrote the first helper's visible state.
Avoid by: Either call `setCaptureMode()` first and then `setError()`, or remove error-clearing from `setCaptureMode()` and make callers explicitly clear errors when they intend to. Prefer helpers that are composable without side-effect collisions.
Seen N times: 1

## L-008 — CSS pseudo-elements cannot be driven by JavaScript style assignments
Date: 2026-04-22
Task: TASK-005
What went wrong: A progress bar used `::after` for the fill color and tried to update its width via `element.style.width = ...` from JavaScript. The pseudo-element width stayed at `0%` because JS cannot directly style pseudo-elements.
Root cause: The Coder treated `::after` as a regular child element that could be manipulated via inline styles.
Avoid by: For any UI element that needs its style updated from JS, use a real child DOM element or a CSS custom property (`--var`). Pseudo-elements are for decorative/static content only.
Seen N times: 1

## L-009 — Static question bank IDs must match database rows or FK constraints fail at runtime
Date: 2026-04-22
Task: TASK-007
What went wrong: The static question bank uses hardcoded UUIDs (e.g. '11111111-1111-1111-1111-111111111111') but the Prisma seed generates auto-generated UUIDs for QuestionBank rows. The QuestionAnswer model has a foreign key constraint on questionBankId referencing QuestionBank.id. Any attempt to record an answer fails with a foreign key constraint violation because no QuestionBank row exists with the hardcoded ID.
Root cause: Coder treated the static question bank and the database schema as independent without ensuring referential integrity between hardcoded IDs and actual DB rows.
Avoid by: When using static hardcoded IDs that must reference database rows, either (1) seed the DB with those exact IDs, (2) remove the foreign key constraint for static references, or (3) use a separate nullable field for static question references. Always verify a create path end-to-end before considering a task done.
Seen N times: 1

## L-010 — Mock mode auto-fallback can mask production data issues
Date: 2026-04-22
Task: TASK-007
What went wrong: The next-question endpoint automatically enables mock signals whenever signals.length === 0, regardless of the QUESTION_MOCK_MODE env var. In production, if photo analysis fails or is bypassed, the system silently injects synthetic signals instead of surfacing the missing-data condition.
Root cause: The Coder conflated "no signals available" with "test mode" for convenience, creating a hidden production risk.
Avoid by: Mock mode should be strictly opt-in via explicit configuration. The "no signals" path should either return an error, use zero-signal baseline, or require explicit provider confirmation before proceeding. Never auto-inject synthetic data in production paths.
Seen N times: 1

## L-011 — Semantic confusion between "first-visit" and "returning patient" logic
Date: 2026-04-22
Task: TASK-008
What went wrong: The Coder implemented "returning patient consistency" (boost confidence when current pattern matches prior session) but the task and PRD required "first-visit consistency bias" (logic for new patients, isReturning === false). These are opposite conditions.
Root cause: The Coder read "consistency" and assumed it meant "keep consistent with prior visit" rather than "be consistent for first-time visitors". They did not re-read the PRD default list carefully.
Avoid by: When implementing bias or default logic, always map the condition explicitly: write the if (isReturning === false) branch first, then the if (isReturning === true) branch. Do not assume the named bias applies to the more complex condition.
Seen N times: 1

## L-016 — Form edit mode must populate all fields from fetched record
Date: 2026-04-23
Task: TASK-015
What went wrong: The pattern edit form hardcoded `escapeHtml('')` for the `clinicalRationale` textarea, meaning every edit would silently blank out the existing clinical rationale. The edit button fetched the record but the form did not use it.
Root cause: The Coder wrote a conditional render expression but passed an empty string literal instead of the pattern property.
Avoid by: When wiring an edit form, copy every field from the fetched record into its corresponding form control. Do a visual spot check: open edit, verify every field shows current data, save without changing anything, verify nothing changed.
Recurrence: TASK040,2026-10-03. A disabled referral policy retains immutable publication history while its current active JSON becomes null. The form must reset enabled state and every editable value on reload; the next version must use current and historical publications rather than recreate a disabled version. Focused actual-PG checks and the actual compiled custom-load/starter-draft/publication/disable/full-reload/re-enable/max-version checks pass. Earlier failed private fixture and browser phases are retained and excluded from successful proof; final cleanup/audit is separately recorded.
Seen N times: 2

## L-017 — Prisma relation `take` limit breaks `.length` count semantics
Date: 2026-04-23
Task: TASK-015
What went wrong: The clinic overview query set `take: 1` on `assessmentSessions` to get the latest session for `lastActiveAt`, but then used `t.assessmentSessions.length` for `assessmentsThisMonth`. This made the monthly assessment count always 0 or 1 regardless of actual volume.
Root cause: The Coder conflated a relation array used for display with a relation array used for counting. `take` limits the fetched array, not the underlying count.
Avoid by: When you need both the latest item and the total count from the same relation, use `_count` with a `where` clause for the count and a separate `take: 1` relation for the latest item. Never use `.length` of a `take`-limited array as a count.
TASK049 positive application, 2026-10-05: reporting already fetches the complete tenant/location/isTest:false/createdAt half-open consultation cohort, independently of the board page. The denominator and fully validated true/false/unknown membership partition now share that complete array in the existing Serializable snapshot; this is safe .length use on an uncapped reporting cohort, not on paged board rows. Empty/all-unknown rates stay null, while recorded false-only outcomes yield a real zero rate. The actual twelve-distinct-case composite, type check and current-source Webpack build passed under scoped independent review; SQL, browser and live enrollment evidence remain outside this mocked/static slice.
Seen N times: 1

## L-018 — Invalid activation predicates can hide required safety questions
Date: 2026-10-01
Task: V2-FOUNDATION
What went wrong: Conditional question activation evaluated a confirmed value without checking its configured question type. A wrong-type negative on an optional parent hid a required safety follow-up and allowed an initial recommendation.
Root cause: Product eligibility validated answer types, while question activation used the lower-level condition evaluator directly and configuration validation checked references but not operator/value semantics.
Avoid by: Validate rule types when activating configuration and validate referenced answers before every condition evaluation. Invalid or unconfirmed activation inputs remain unknown, preserving required follow-ups.
Seen N times: 1

## L-019 — Clinical wellness suggestions must share the safety gate
Date: 2026-10-01
Task: V2-FOUNDATION
What went wrong: A clinical wellness service could be suggested and selection-validated despite an unanswered required safety question.
Root cause: Initial treatment checked required questions, while wellness matching checked only individual product predicates.
Avoid by: Apply required clinical screening to every clinical recommendation path, including generated and manually selected future services. Keep nonclinical commercial matching separate.
Seen N times: 1

## L-020 — Pending evidence must invalidate downstream release authority
Date: 2026-10-01
Task: V2-COMBINED
What went wrong: Recording intake queued new evidence while old approvals and shared documents remained valid until transcript processing completed.
Root cause: Only explicit approval actions checked pending jobs; care-start and already-approved exports relied on unchanged old revisions.
Avoid by: Invalidate affected approvals/snapshots atomically when accepting new clinical evidence, or enforce a shared pending-evidence gate at every downstream clinical/export boundary. Preserve idempotent recording retries.
Seen N times: 1

## L-021 — Zero cash collected is not an unpaid subscription
Date: 2026-10-01
Task: V2-COMBINED
What went wrong: A positive invoice-payment requirement intended for referral qualification also controlled subscriber entitlement, excluding invoices settled by account credit.
Root cause: Access eligibility and reward qualification shared one payment-amount gate.
Avoid by: Verify active subscription settlement independently from monetary referral qualification. Cover credit-funded invoices as well as actual free-trial invoices.
Seen N times: 1

## L-022 — A database discard cannot cancel an in-flight object upload
Date: 2026-10-01
Task: V2-COMBINED
What went wrong: Discard could delete a predicted private Blob pathname and clear its cleanup pointer before a concurrent upload completed. Upload completion then rejected the changed recording status without deleting its newly created object.
Root cause: Database state transitions and external storage operations were treated as one atomic cancellation, although object creation can finish after the discard transaction and deletion.
Avoid by: Prevent discard until upload completion or compensate rejected upload completion with deletion of the returned pathname, preserving a durable cleanup pointer when external deletion fails. Exercise the deferred upload/discard ordering in a regression test.
Seen N times: 1

## L-023 — PostgreSQL void results cannot be decoded by Prisma queryRaw
Date: 2026-10-02
Task: V2-HOSTED-PREVIEW
What went wrong: Hosted owner setup failed before model execution because an advisory-lock SELECT returned PostgreSQL void through Prisma queryRaw. Referral-policy publication contained the same query shape.
Root cause: Existing integration checks covered setup scoping but did not execute the HTTP setup preflight's actual lock acquisition.
Avoid by: Acquire transaction advisory locks through a supported non-result operation or a supported typed result, and test the actual business operation against PostgreSQL. A successful build or healthy eve transport does not exercise that preflight.
Seen N times: 1

## L-024 — Model catalogs do not establish account execution permission
Date: 2026-10-02
Task: V2-HOSTED-PREVIEW
What went wrong: The configured Gateway model appeared in the live catalog, but the actual hosted workflow was denied before any provider attempt because the account's free tier could not use it.
Root cause: Metadata availability and runtime account entitlement are different checks.
Avoid by: Verify a bounded synthetic operation with the actual deployed identity and configured model. Record provider denial separately from transport or source failure, and leave spending or model changes to the authorized owner decision.
Seen N times: 1

## L-025 — Separate ordinary API billing from an explicitly supported plan-sharing program
Date: 2026-10-02
Task: V2-SERVICE-PREFERENCE-DOCS
What went wrong: A blanket statement that ChatGPT subscriptions cannot power another app was too broad after official SIWC introduced eligible Plus/Pro plan usage in participating applications.
Root cause: Ordinary API billing separation was generalized into a claim about every supported integration, without checking the current program's eligibility and terms.
Avoid by: Read current official Help, developer documentation and applicable terms together. Distinguish participating commercial approval, user-controlled runtime, cross-user restrictions, free access to plan use, model/audio capability and healthcare coverage from account billing alone. Preserve actual deployed-provider evidence while correcting the overly broad claim.
Recurrence: TASK041,2026-10-03. Normal current CLI status already reports ChatGPT login, and documented noninteractive/local execution includes summaries and data formatting. Technical SDK/app-server embedding is separate from authentication permission: current first-party guidance expressly excludes commercial/hosted services from app-server authentication. Eligible local/open-source SIWC needs its own registered identity; eligible local Healthcare/Regulated Codex needs actual workspace/BAA/controls. Read those exact boundaries before requesting another login or making a blanket claim about subscription use. Eighteen current first-party responses and20 quoted guards were independently co-signed; no provider or login operation was needed.
Seen N times: 2

## L-026 — Client-only archive search cannot reach records omitted by the server
Date: 2026-10-02
Task: TASK-019
What went wrong: Retained archived consultations outside the latest 250 records or older than the UI's selectable year were inaccessible through archive search and restore.
Root cause: The search filtered a capped browser snapshot and reused reporting dates for archive accessibility, with no scoped server search or pagination.
Avoid by: Trace retained-record search from the interface to the actual bounded server query. Verify a record beyond the loaded page and older than report defaults, preserving metric denominators separately from archive access.
Seen N times: 1

## L-027 — Disposable database guards must include the documented CI target
Date: 2026-10-02
Task: TASK-024
What went wrong: A new actual-PostgreSQL job-result suite passed locally but rejected the existing localhost:5432 CI verification database because its guard accepted only 127.0.0.1:55432.
Root cause: The safety guard copied one workspace binding without tracing the repository's explicit CI database configuration; local source review did not catch that environment mismatch.
Avoid by: Read the committed CI environment alongside local verification instructions when adding database-backed regressions. Require an explicit test binding and known disposable database, accept the documented loopback targets, verify rejection before database selection, and require a fresh successful published-head CI instead of generalizing local PASS.
Seen N times: 1

## L-028 — Paused wall time is not captured audio duration
Date: 2026-10-02
Task: TASK-025
What went wrong: Native browser capture correctly paused its visible timer, but the segment payload included the full paused wall interval. A three-second capture reported 24,089 milliseconds; resume also reset the full one-minute segment timer.
Root cause: Segment metadata used elapsed wall time while the UI and MediaRecorder used active capture state. Timer restarts did not retain the segment's consumed active-time budget.
Avoid by: Track monotonic active capture duration per segment, exclude every paused interval and schedule only its remaining capture budget on resume. Preserve those immutable values through retry, and verify real browser metadata alongside visible controls rather than assuming server recording tests exercise the microphone.
Seen N times: 1

## L-029 — Every visit-exiting link must honor capture state
Date: 2026-10-02
Task: TASK-025
What went wrong: The main sidebar links and logout blocked navigation during recording, but the app-shell wordmark bypassed that protection. Actual SPA navigation stopped/unmounted capture and left a failed final segment without retry or deliberate-discard controls.
Root cause: The guard was attached to selected navigation controls instead of every app-shell route exit; beforeunload does not run for this Next SPA link. Notification visit links were also unguarded.
Avoid by: Apply the same busy-capture guard to every app-shell visit-exiting link and verify each destination with active capture, pending upload and failed local segments. Preserve idle navigation and microphone cleanup, and distinguish intentional unmount verification from protected in-app exits.
Seen N times: 1

## L-030 — DOM presence is not visible error feedback
Date: 2026-10-02
Task: TASK-029
What went wrong: The repaired navigation guard rendered a main role=alert, but the still-open mobile notification panel fully covered it after the blocked click. Desktop functional checks passed while the user received no visible explanation at 390-pixel width.
Root cause: Alert semantics and DOM presence were checked separately from the overlay that initiated the action. Presentation state retained the covering panel.
Avoid by: Verify feedback in the actual initiating overlay/viewport and inspect its screenshot or hit-test visibility. Close presentation overlays or otherwise expose the existing explanation when blocking an exit, preserving captured data and idle navigation rather than adding a second capture authority.
Seen N times: 1

## L-031: Nested browser batch flags can omit navigation authentication
Date: 2026-10-02
Task: TASK-035, diagnosing TASK-033 verification
What went wrong: The protected native browser navigation reached Vercel login because its trusted header was placed only inside a stdin batch row, although the evidence field described intended origin-scoped authentication. This could have been mistaken for account or protection-rule denial.
Root cause: Installed agent-browser0.38.1 parses global flags from outer process arguments and passes the same Flags into every batch row. Nested open --headers arguments never populate navigation headers.
Avoid by: Read the installed parser/header path, pass authentication as an actual standalone outer open --headers option and keep values in memory. Verify the first real application boundary before attributing a login redirect to account policy; do not weaken protection or repeat an unchanged provider check to compensate for a harness error.
Seen N times: 1

## L-032: A scheduled payload expiry is not an already expired payload
Date: 2026-10-03
Task: TASK-037
What went wrong: A private hosted-run helper rejected every truthy expiredAt value after a successful HTTP200, although the owned run's expiration was still future. Independent review missed the same distinction.
Root cause: Timestamp presence was treated as elapsed expiration, and absent input was combined with that separate failure.
Avoid by: Trace installed availability semantics and distinguish finite future, elapsed, invalid and absent timestamps from missing input. Preserve the first result and superseded review, repair the guard in separate bytes, verify real retained metadata offline, then make only the separately approved changed-guard read.
Seen N times: 1

## L-033: Preserve classified replies before parsing or closing a hosted inspector
Date: 2026-10-03
Task: TASK-037
What went wrong: A private caller parsed the normal CLI Info line as JSON after the sole hosted restore. Its finally-close discarded a possible later observation, losing run ownership and the required live future-wait capture.
Root cause: Human logs and structured replies shared stdout without a command protocol or response persistence. The first raw failed line was not retained, so the source-backed diagnosis must remain distinct from directly captured output.
Avoid by: Test the actual pinned logger plus fragmented framed replies offline. Accept only classified safe noise and a correlated response, persist that response before EOF/exit/error handling, and reject unknown output without logging credentials. Journal the sole POST before sending; retain fixtures after lost ownership, recover only the original run under a separate reviewed boundary, and never reset its deadline or claim lost evidence was restored.
Seen N times: 1

## L-034: Preserve discovery metadata before interpreting an ownership guard
Date: 2026-10-03
Task: TASK-038
What went wrong: The first analytics GET returned200 within POST+20seconds but the ownership filter found no matching candidate. The raw page was not retained, so that result could not distinguish an empty page, indexing delay or a metadata mismatch. The live future-wait capture remained absent despite successful later delivery.
Root cause: The original observer reported the selection failure without a bounded metadata projection. A later method/time change cannot establish what the earlier page contained.
Avoid by: Persist safe typed counts, coverage, timestamps and exact-match flags before selection; omit payloads, untrusted text and credentials. Bind only one owned input before further reads. Report a later supported storage recovery separately, preserving original deadlines and strict partial results rather than inferring an indexing cause or restoring missing proof.
Recurrence: TASK047,2026-10-04. The original init guard failed after owned target/profile creation; its live identity JSON was not retained. String/integer OID mismatch was initially only a source hypothesis. The separate read-only reconciliation saved raw OID string23592 before strict normalization and verified the original nonce/marker/container/profile. This corroborates the scalar explanation without reconstructing the missing failed payload or changing init FAILED. Save bounded raw type/value first; normalize only trusted database serialization with exact positive integer/canonical decimal-string acceptance and reject boolean/fraction/sign/whitespace/exponent/unsafe/wrong values. Actual25 pure outcomes do not establish real SQL state; genuine readiness is separate.
Seen N times: 2

## L-035: Bind continuation assertions to the actual persisted schema
Date: 2026-10-03
Task: TASK-039
What went wrong: The private post-terminal caller assumed Notification.readAt after a real hosted timer completed. The persisted row and Prisma model instead expose isRead and dismissedAt. Actual inbox/cleanup needed a separately reviewed continuation.
Root cause: An unexecuted completion path was cloned without exercising its assertions against the actual retained row and authoritative schema. The original generic execution error did not capture exception text; offline source replay separately reproduced KeyError(readAt).
Avoid by: Validate actual serialized fields and types before a live completion boundary. Require present booleanfalse isRead, present null dismissedAt and exact row/tenant/staff/visit/key/due ownership. Preserve the original failure and evidence, test missing/wrong/read/dismissed variants offline, then continue only the original case under reviewed source.
Recurrence: TASK040,2026-10-03. The private UI fixture assumed AuditAction UPDATE and UUID AuditLog.entityId='global'; the authoritative product uses SETTINGS_CHANGED with a null entityId for platform settings. The first enum mismatch failed and rolled back the create transaction; all50 owned tables were actually empty and all50 shared digests unchanged. Independent recovery review caught the remaining create/snapshot/cleanup identity mismatch before another attempt. An idle owned Next server had been dispatched before the failed prerequisite result was checked; that sequencing mistake and exact process are retained, with no proxy/browser or second build. Validate the whole create/snapshot/cleanup path against schema and the actual writer, and await each prerequisite result before dependent work. Preserve original helpers/co-sign/failure; recover only in separate reviewed bytes against the original owned target/build.
Recurrence: TASK047,2026-10-04. The corrected full14 PG attempt passed12 and failed2 at RecordingSegment insert, PostgreSQL23514 single-target CHECK. Nullable Prisma relations did not permit both consultationId/setupConversationId null. Existing migration773-776 and schema require exactly one target, same-tenant composite FK, valid capture fields and unique per-consultation sequence. Correct all three sites inside only the two affected bodies using existing owned visits, including the unreached later adopted-record fixture. That third site is a source finding, not a third actual failure. Do not relax constraints or alter the other12 bodies. Earlier independent fixture review missed these omissions; preserve its static PASS and original full14 FAILED.
Recurrence: TASK048,2026-10-05. Independent source review caught shared RecordingSegment fixture bytes=0 before any seed or runtime dispatch. The authoritative existing migration requires bytes>0, one exact consultation/setup target, valid sequence and expiry. The derivative changed only bytes0 to bytes1 while preserving the target, sequences and expiry. Original plan25f465d5 remains CHANGES_REQUIRED/zero-run; no original seed failure is claimed. Actual corrected seed7fe99412 and runtime81414db8 passed. This is a prevented fixture-contract recurrence, not a new application failure; preserve prior static-review misses and failed ancestry.

Seen N times: 3

## L-036: Historical observation flags do not timestamp each later reply
Date: 2026-10-03
Task: TASK-039
What went wrong: The private finisher asserted every nonterminal reply with futureWaitObserved=true preceded browser closure. One genuine pre-closure capture existed, but eight later valid polls retained the historical flag and triggered a captured AssertionError before SQL.
Root cause: Review checked initial/terminal frames without replaying the full eligibility prefix against the complete retained reply sequence. A sticky history marker was interpreted as current phase evidence.
Avoid by: Select a genuine matching capture using its own original timestamp, saved file mtime, scope and actual closure receipt; require that it exists. Preserve ownership checks on later replies while allowing normal later polling. Replay the entire pure eligibility path on actual rows, all replies, terminal metadata and inbox/close receipts, with missing/only-later/wrong-time/wrong-scope negatives, before live compensation. Never replay the timer or reset its deadline to repair a verification assertion.
Seen N times: 1

## L-037: Narrow test filters match the complete suite and test title
Date: 2026-10-03
Task: TASK040
What went wrong: The proposed broad policy-name filter also matched the enclosing setup/policy suite, selecting unrelated existing AI setup cases instead of the intended five database checks. Independent plan review caught this before execution.
Root cause: Vitest's name filter matches the complete hierarchical title, including suite names; reviewing only the individual test labels missed the broader selection.
Avoid by: Inspect full selected titles and expected executed/skipped counts before running a narrowed database continuation. Pin exact distinct name substrings, preserve owned-target/provider guards, and record deliberate exclusions separately from a complete suite PASS. The corrected TASK040 command ran exactly5 focused cases and deliberately left10 unchanged cases unselected.
Recurrence: TASK042,2026-10-03. Installed Vitest5.0.3 matches fullTestName joined with ` > `, while its JSON fullName joins names with spaces and reports filtered cases as skipped rather than pending. The initial Coder/Auditor plan missed both contracts: its exact matcher selected0/all6skipped/exit0, and its collector incorrectly treated non-pending entries as executed. That original attempt and review remain preserved, excluded from product evidence. A separately reviewed selection/collector-only recovery on the same owned database captured exactly2 intended business assertion failures and4 deliberate exclusions with actual shared/owned before/after preservation. Verify the installed matcher and reporter separately, count explicit passed/failed/skipped states, and require the precise expected failures or successes. Exit0 or reporter success with skipped cases does not prove execution. Later cancellation/referral/renewal assertions were not reached in red. The separately reviewed final green execution reached them: all40 new unit and6 actual-PostgreSQL cases passed with zero skips; do not extend the two red failures to assertions that were never reached.
Recurrence: TASK047,2026-10-04. TASK047 correctly applied installed Vitest5.0.3: filter fullTestName uses suite > leaf; JSON fullName uses spaces; filtered status skipped contributes to numPendingTests. Actual focused run selected exactly2 passed, excluded12, recorded pending12/all14 identities/zero selected skips. Twelve source bodies and prior passes remained unchanged. Retained12 plus new2 is combined coverage, not a new complete14 execution. Preserve original FAILED report and gate later phases on actual focused/composite and fresh after guards.
TASK049 reinforcement, 2026-10-05: the first affected run retained eleven passes and one static attribute assertion failure. Installed React19.3.0 emitted dateTime rather than the two expected lowercase datetime literals. Only those expectations changed. An anchored suite > leaf selector then executed exactly the failed case: one pass, eleven filtered/skipped (reported pending eleven), all twelve original identities retained. The final twelve-distinct-case coverage combines retained eleven with corrected one; it is not a fresh complete-suite run. Preserve the original FAILED result and observed serializer contract.
Seen N times: 2


## L-038 — Select the application cookie from a mixed saved jar
Date: 2026-10-04
Task: TASK-043
What went wrong: The protected read helper assumed the known saved jar contained one cookie. It actually contained an expired dripwell_session and a valid _vercel_jwt, so the first attempt failed before any anonymous/application HTTP or native-token request. Initial independent review missed that fixture-shape assumption.
Root cause: Whole-jar cardinality was treated as application-session identity without checking safe metadata for the fixed authorized selector.
Avoid by: Validate the named app cookie and its exact origin/security/expiry metadata. Explicitly exclude stored provider cookies when using normal freshly issued OIDC. Preserve the failed attempt and passing controls, then separately review only the unattempted boundaries. A normal client omits an expired cookie; its actual401 is not evidence of transmitted expired-token rejection.
Seen N times: 1

## L-039 — Assert final source identity before selecting a closure verdict
Date: 2026-10-04
Task: TASK-043
What went wrong: The continuation initially recorded sourceClean and HEAD during input cleanup without requiring their values before reporting PARTIAL. Independent Coder review caught this before continuation execution.
Root cause: A recorded cleanup field was treated as an enforced release condition.
Avoid by: Make exact final HEAD/tree, clean-source state and owned-input/original-cookie preservation explicit assertions before choosing the result. Preserve the original draft/finding, correct only the continuation gate and bind the later actual verdict to its real closure receipt. TASK043's corrected continuation enforced clean807/f61 and safely closed the auth boundary; root documentation edits followed afterward.
Seen N times: 1

## L-040: Check native client fields and extensible response data
Date: 2026-10-04
Task: TASK-044
What went wrong: Initial browser-plan review accepted an unsupported Config.defaultTimeout field. Installed0.38.1 silently ignores that field; the documented AGENT_BROWSER_DEFAULT_TIMEOUT input was needed. After that preparation correction, the sole actual browser attempt successfully opened/waited at the protected login and imported the normal app cookie, but its collector rejected result.set:true because the native response also contained lifecycle metadata. The first equality assertion failed; a second identical assertion was never reached. Both initial independent reviews and actual FAILED evidence remain preserved.
Root cause: The verification tool assumed a configuration key and exact whole-result shape instead of checking the installed schema and successful response decoration path.
Avoid by: Trace version-matched accepted inputs and the complete response path before using them. Require the expected row count, success:true, error:null and result object set isTrue, while allowing the source-traced lifecycle metadata. Keep credential redaction before persistence. Do not treat a collector assertion as a failed app/cookie command. Reconcile the actual closed browser and whole-data controls; any unattempted UI continuation must be separately reviewed in a fresh namespace/context, with required new-context authentication bootstrap recorded distinctly from a prior-command retry. Include both context closures and exact owned inputs in later compensation.
Seen N times: 1

The separately frozen pure collector checker later exercised the saved valid native reply and14fictional cases:15expected outcomes passed,3accepted/12rejected; independent reviewbab685ac resolves the readiness hold. The distinct new-context owner settings continuation returned actualPASS without replaying the original entry. Exact originalFAILED evidence remains retained. Independent actual UI/data/both-context reviewef5b5138 passes screenshot/DOM and all50preservation. Separately reviewed compensation22cd under GO06cbc34d later executed exactly one conditional statement; independent actual review6219ca19 confirms CAS1/1/1, original50-table32-row/rate baseline restored, both exact contexts released and only three owned inputs removed. A read-only Auditor collector first expected a uniform mutation key on inherited SELECT-only intent metadata; that KeyError is retained, then corrected by reading each typed schema on retained copies with no SQL or cleanup replay. Check the recorded kind and corresponding fields when combining metadata sources.


## L-041: Normalize trusted SQL dates at their boundary
Date: 2026-10-04
Task: TASK-045
What went wrong: Normal signup returned201, but the original verifier rejected PostgreSQL TIMESTAMP(3) text without an offset before preserving the valid new session. Source inspection also found the same representation mismatch at two selected-SQL configuration/audit createdAt validation calls before those paths ran.
Root cause: A strict API/request timestamp contract was applied directly to the different trusted SQL representation.
Avoid by: Interpret only the selected SQL rate timestamp and shallow createdAt validation projections as UTC. Keep strict API/request/nested test timestamps unchanged, and preserve raw rows, timestamp text, canonical hashes and compare-and-swap values. The27 affected cases passed8 accepted/19 rejected with independent review85f23046; the source-predicted createdAt issue was not an observed application failure. Preserve a server-validated normal session before later unrelated evidence checks so a tool failure does not require signup replay or credential reconstruction.
Seen N times: 1

## L-042: Inspect copied helper boundaries in every selected test module
Date: 2026-10-04
Task: TASK-047
Occurrence: Two separately selected authored modules in one task.

The unit request() helper and the owned-PG copy each lacked its function-closing brace. Both actual transform failures had zero assertions. Earlier independent static source/plan reviews missed them and remain preserved. After a copied-helper defect, inspect the same boundary in every separately selected new test before refreezing. One module's successful compilation does not cover another. Preserve successful preparation/unit17, make only the needed source/copy repair, and run the affected still-unverified suite under fresh existing guards. Transform errors do not prove production failure.

Evidence: a627cfaf initial unit failure;f2747a8a actual unit17/PG transform;9cf0d62f and8e5a9cb2 one-brace plans.
Seen N times: 1
