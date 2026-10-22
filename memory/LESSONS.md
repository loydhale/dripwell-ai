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
Recurrence: TASK073,2026-10-10. CareOutcome initialized all optional commercial fields but omitted four buffers when refreshing fetched actualCare. After VERSION_CONFLICT and the visible retry/reload, the same mounted form used the current visit version with stale hidden commercial values. Mirror every saved-care initializer in the existing refresh effect, preserving its serialized dependency, nullable/false/zero values and currency conversion. Independent source/publication review and the five real Consultation/request-helper DOM cases pass at9bd84b46; the first full CI fails a separate recording exhaustion oracle, so TASK073 remains incomplete. This is one field-completeness recurrence, not one per field or test.
Seen N times: 3

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

TASK052 pre-execution review: stricter current-run publication guards exposed a legitimate recovery gap. Failure marks both recording parent and summary child FAILED, while retry resets only the parent; the old child then fails the new-run predicate. Review the complete parent/child retry transition as well as stale-write denial, and verify valid retry completion with old-run writes rejected. This was found before cases or provider work, so no runtime failure or passing recovery is claimed.

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

Recurrence: TASK050, 2026-10-05. A legacy/current wellness union caused the old clinical fixture to fail shared compilation; parse the two generated fixture plans with the strict current schema rather than cast or mislabel their version. A later focused offer case supplied an empty question why, so schema rejection masked its intended eligibility denial and still suppressed the empty-benefit offer. Supply the required synthetic explanation, assert valid configuration, then require the exact missing-eligibility-answer reason. Preserve the subsequent official-terms guard and all other bodies. Earlier independent fixture review missed the empty why. Original compiler/full-unit/focused failures stay FAILED; retain passing identities and correct only the affected case. This is one actual fixture-contract recurrence, not a production defect.

Same-task TASK050 continuation, 2026-10-05: normal CI annotation5901391e exposed one old integration assertion expecting v2.1 for both generated kinds, while the actual wellness result correctly carried v2.2. Preserve the artifact and assert INITIAL2.1/WELLNESS2.2 explicitly. Source review10d6c44a and CI-first planf75b9347 passed, but corrected-source CI is still unobserved. This extends the existing TASK050 contract recurrence; Seen remains4, with no new lesson, counter increment or corpus.

Recurrence: TASK051, 2026-10-05. Original normal CI37290153415 failed before the intended foreign-owner assertion because a full RecordingObjectIdentity was passed to recordingObjectPath, whose runtime target schema strictly accepts only five owner/target fields. TypeScript structural assignability did not remove its six extra identity fields. Project tenantId, recordingId, consultationId, setupConversationId and uploadAttemptId at that caller; retain the full wrong-owner identity, canonical foreign path, all denial/detached-read assertions and production strictness. Independent static review missed this call; preserve its PASS, the original failed test/CI and the pre-execution CI-target guard finding. The exact caller-only repair was independently reviewed and normally published at7d3dff99; corrected automatic fresh-PG CI37295713374/job/check111716307472/suite101015127561 completed SUCCESS with all22 listed steps successful. Individual test counts/skips remain unknown. This is one distinct actual TASK051 fixture-contract recurrence, not a production/provider defect or proof of deletion/hosted/pilot readiness.

Recurrence: TASK052, 2026-10-05. Normal source CI37318520247 failed web build before typecheck and test stages. Three owner/processing/adoption guards used user?.tenant.isActive, but authoritative Prisma User.tenantId and User.tenant are nullable; narrowing the user does not narrow that relation. The reviewed proposal adds tenant?. at only those three sites so a missing or inactive tenant still reaches the original denial, preserving every sibling authority/run/input/expiry/adoption guard. Independent static review fe521ad4 missed this type-contract boundary; retain that PASS, original869a rejection and actual failed CI. The nineteen authored cases remain unexecuted, and no missing-tenant runtime or provider failure is established. This is an open-task production type-contract correction, not a new passing recovery or executed fixture result.

Same-task TASK052 continuation, 2026-10-05: corrected publication6866860 passed normal web build, typecheck and stages13-16, but CI37323916952 failed an older adoption-cleanup assertion expecting an immediate path delete, with calls0. Current cleanup queues the exact returned identity and settlement as CLEANUP_PENDING and never invokes the legacy deletion adapter. The reviewed one-assertion proposal forbids that call while preserving the throwing sentinel, wrong-target/no-put/no-job denials, original adoption-error identity and full trailing pending-object assertion. Independent static review520ce22f missed this stale expectation. Preserve both failed runs; the trailing assertion and nineteen individual outcomes remain unproved, with no corrected assertion result or provider failure inferred. This extends the same open TASK052 contract recurrence; Seen remains5.

Same-task TASK052 import-collection continuation, 2026-10-05: CI37329950115 reached billing/sharing after build/types passed, but the consumer PG suite collected zero tests because its clinic import reaches the default throwing server-only marker. Static source review missed the standalone harness boundary. Installed Vitest hoists the established file-local empty marker mock before imports; the reviewed one-line proposal preserves production server-only imports, all eleven case bodies, real Prisma transactions, strict disposable target guard and exact teardown. Actual consumer unit8 and foundation12 passed as subsets of195 passing tests; no consumer PG outcome is proved. This is proposed third changed-head recovery after initialDaf and two corrections. Preserve failures and stop for structural escalation if that third correction fails. Extend this same open-task L-035 recurrence with Seen remaining5.

Same-task TASK052 third-recovery structural checkpoint, 2026-10-05: corrected c70 CI37338314508 collected all eleven consumer PG cases, with six failures and five derived passes. Five failures occur when fixtures set RecordingSegment.expiresAt into the past while createdAt remains its current database default; authoritative RecordingSegment_valid_capture requires expiresAt > createdAt. These fixture updates fail before their intended expiry/detachment assertions, not at a proved production denial. The sixth reports masked AI_PROCESSING_FAILED before the summary provider latch; its deeper cause remains unproved. A fixture-change exception releases the late helper but does not await its started processing promise, so cross-case interference is a source-supported diagnostic risk, not an established cause. Valid capture chronology and quiescent owned work must be checked before claiming target-branch evidence. Preserve static review misses and every failed head. Recovery3 is exhausted; park the automatic loop for recorded structural assessment, with no fourth patch/reset or dependent TASK053 advance. This extends the same open-task L-035 recurrence; Seen remains5.

Same-task TASK052 deliberate diagnostic continuation, 2026-10-05: CI37353034613 passed205 and failed1 of206. The failed-summary helper accepts any processing rejection before looking up its child, so subsequent P2025 does not identify the primary cause or loop mode. Prove actual intended summary-fault entry and retain original transaction/processing errors before consuming failed-child provenance; emit only bounded fixed classifications on unexpected setup failure. New isolated/seven-summary controls do not reconstruct the historical masked failure. This is a diagnostic refinement, not a causal production fix or automatic fourth recovery; Seen remains5.

Same-task TASK052 transaction-boundary continuation, 2026-10-05: d186’s bounded record identifies current pre-summary Prisma-known P2034 before provider entry. The workflow supplies existingTx and bypasses append’s standalone retry. Assess recovery at the encompassing DB-only publication boundary: await rollback, reacquire all current guards each attempt, retry only the known P2034 class within the existing twelve-attempt cap, and keep provider I/O outside. Remove the nested caller loop to avoid cap multiplication. Preserve prior static approvals and this failed CI; earlier causes and concurrent participants remain UNKNOWN. These are prospective checks, not corrected results. Seen remains5.

Same-task TASK052 type-boundary continuation, 2026-10-05: manual infrastructure attempt2 acquired a runner, then Next failed TS18046 on result.id/tenantId in the real-update observer. Static a8c9ed67 missed that reflected completion is unknown. Narrow a nonnull object and both keys before exact owner comparisons, without a cast; keep the sole real delegate consumption and returned value unchanged. Bundle compilation did not complete the build, and all25 consumer cases remained unexecuted. Preserve the original failures and Seen5.

Saved-source TASK057 contract refinement, 2026-10-06: the frozen project-name hostname prefix excludes the independently recorded exact old deployment's owned origin. Installed CLI/API source does not guarantee that prefix. Bind any separately reviewed old-metadata contract to the exact deployment ID, project and pinned owned origin; keep new-deployment acknowledgement separate. Preserve earlier static/fake PASS and the generic actual projection failure: this run's discarded response, rejected field and cause remain UNKNOWN. This is an existing L-035 refinement, not a new entry or proven live cause; Seen remains5.
Recurrence: TASK063, 2026-10-07. Original first changed-source CI37615527361 failed the Next web-build type phase before all test stages. Node randomUUID supplies a UUID template type, so the inferred allIds UUID array rejects a value narrowed only to string at exact membership. The cookie shim's inferred const-arrow never call did not establish request presence for its returned closure. Preserve the runtime membership guard and poison-before-throw cookie denial; explicitly type the same ID list as string[] and make the absent-context branch return through the original forbidden call. This is prospective source-only feedback, not an executed repair. Independent static review802d53c2 missed both boundaries; preserve that PASS, the exact failed CI and all unexecuted case/fixture/cleanup limits. Both diagnostics are one distinct TASK063 type-contract recurrence, not two events or a production/provider failure. Earlier375747 recording cause remains UNKNOWN.

Recurrence: TASK064, 2026-10-07. First ordinary changed-source CI37648926351 checked source2136ec5 through actual merge98daf6b and failed Next's TypeScript phase before all tests. Two deferred reflected delegates retained property types unknown at Reflect.apply and returned unknown instead of the query/work PromiseLike contract, producing four diagnostics at196/385/387. The prospective minimal correction binds each already-guarded callable in a stable local and assimilates its one real receiver-preserving result into Promise.resolve; preserve unknown-result narrowing, sticky unsafeOwnership, exact first error and row/oracle/cap/clock/join/cleanup boundaries. Independent static PASS9940054f missed this boundary and remains immutable, as does the failed run. Fresh CI schema generation and all14 disposable migrations succeeded; the nonce fixture/case/frame/cleanup never ran. Four diagnostics in one invocation are one distinct TASK064 type-contract recurrence, not four events, a cohort/product/provider failure or a replay grant.

Same-task TASK066 private failure transport refinement,2026-10-08: the once reviewed runner5c3a returned native1 and retained firstNATIVE_NONZERO_EXIT plus secondaryUNKNOWN owned closure. Main reaping/actual pipeEOF/input/local descriptors closed, but three PID/start observations omit terminal states. Checks[] means named outcomes were not retained, not that no cases entered;52empty pre-baseline is known and post-baseline/compensation is unproved. R1 staticPASSf71c9b08 missed that UNKNOWN Halt precedes safe projection, discarding the83stdoutbytes/0stderr after observed EOF. Preserve that PASS, the zero-run ancestor and actualFAILEDfc116. A separately reviewed final private recorder may retain only existing closed diagnostics/case frames, fixed banner-presence classifications/counts/digests and already-owned closed state metadata; never raw output, invented native/zombie cause or zombie-as-closure substitution. Cached shim usesexec, so direct-entry replacement is unjustified. Require fresh exact-owned process/target reconciliation and distinct later effect authority; no migration replay/old allocation refill/TASK057 reopening. This is the same diagnostic task, with completed count40 and Seen7 unchanged.

Same-task TASK066 fresh metadata refinement,2026-10-08: once264466f4 observes exact old467546/start55951438 asZ/ppid1/original467533group+session and other two retained IDsABSENT. Owned/foreign Docker3native0/mainreaping/EOF/parity does not prove clientdescendantclosure: the unrelated global/proc coverage consumed its256statcap and allclosures remainUNKNOWN. Preserve cappedscanreceipt/historicalfc116UNKNOWN; do not infer originalnativecause or post52restoration. A separately admitted one numeric ps snapshot and selected exact-start/parent verification can change relevance selection within unchanged10s/65536output/128owned/256stat/60swhole bounds, with no blindretry/refill. CurrentterminalZ/executiontermination differs from OSreaping; incomplete/reused/stale/clientunknown stillholds. NoSQL/application/disposal is granted by metadata/source-only work. This extends existingTASK066 learning; count40/Seen7 unchanged.

Same-task TASK066 final private source refinement,2026-10-08: exactR2cf227 accepted byindependentsource reviewb707b187 preserves006a/5c3a/fc116 andall21runtime/15supportpins. Failureobservations now precedeHalt and retain only boundedcloseddiagnostics/caseframes orcounts/digests; poison/unknown nevermarksPASS orallows successors. Existingownedstate scans distinguishABSENT/UNKNOWN/executable/Z/actualmainreap withoutZ-closure substitution. Optionalbannerclassifier wasnotauthored, so unframednativecause remainsUNKNOWN. Fourfrozenpuregroups stillneed exactRootonceGO withPythonassertsenabled; sourcePASS isnotcontrol/applicationresult. Unchangedmainusesalreadyspentexclusiveexecutiondirectory, so laterapplicationentry/baseline/client/quiescence/effectauthority remainsseparate. Nooldallocationrefill/TASK057reopening; count40/Seen7 unchanged.

Same-task TASK066 changed numeric inventory disposition,2026-10-08: once13f1f3f3/native0 selected1289numericrows within44399bytes,19directstatreads/0.129436s andconfirms exactoldZ/unreaped plusoldotherworker/clientgroupsABSENT. Newpsmain468265/start56213691 wasaloneinsnapshot andlaterreaped/ABSENT/EOF, yetactualreceiptretainsUNKNOWN_POST_SNAPSHOT_DESCENDANT_CREATION_UNPROVED; no activechild isclaimed orinvented. Preserve thisunknownratherthan commandname-onlywholeclosure, historical264/fc116UNKNOWN, andpriorDockerprojectionvsnewSQL/content distinctions. No secondinventory/SQL/app/disposal isadmitted. AcceptedR2source andseparatepurecontrols stayindependent, notlivequiescence orrecordingPASS. Same-taskcount40/Seen7 unchanged.

Same-task TASK066 actual private pure controls,2026-10-08: onced706e1d4 underRootb909/pinnedPython-I passesallfour recorder/stategroups withfirstnull/native0/internal0.014515s. Thisvalidates onlyclosed failureprojection/caps/poison/redaction andsyntheticPID/start/state/parent/reap/UNKNOWN oracles. NorealappVitest4controls/PG5/full19/typecheck/processquiescence/SQL/after52baseline evidence isinferred. Same-secondUTC isnotzero native duration. Keep13fclientUNKNOWN/historical264/fc116unknown andthe separate locallypersisted166a reportprovenance gate. No rerun/sourcecorrection/oldbudgetrefill orTASK057reopening; count40/Seen7 unchanged.

Same-task TASK066 saved native report refinement, 2026-10-08: the newly discovered local report166a1b3c matches the exact one approved file and nineteen names, with four observer controls passed, the exhaustion case failed and fourteen skipped. Its times/mtime lie within the original once entry; this is supplemental evidence, not a rewrite of canonicalfc116 checks[]/native1/UNKNOWN. Private bounded inspection identifies PrismaClientValidationError/unknown blobObject at the initial fixture RecordingSegment.create679/test1479, before child/publication retry/provider/mapper assertions. Checked-in schemaf15f9c11 includes that field, while the current resolved cached generated schemaaa67b4c8, runtime datamodel and unchecked-create type omit it. Bind generated runtime/types to the checked-in schema before meaningful standalone source validation; no SQL/migration replay or causal historical recording repair follows from this cache mismatch. Initial local admission missed that generated-client prerequisite; preserve prior source/static reviews and the actual failed receipt. The saved JSON retains no approved diagnostic record, which does not prove no other console output; skipped cases, cleanup, exact executed-module hashes and post52 restoration remain unproved. Current metadata13f client closure remainsUNKNOWN. This extends existing L-035/TASK066 learning, with completed count40 and Seen7 unchanged.

Same-task TASK066 independent validation disposition, 2026-10-08: frozen standalone cached TSC plan7c2772a3 remains BLOCKED/unexecuted because its current generated Prisma model/types omit repository blobObject. No compiler, generator or private controller was invoked; its dormant timeout180s+15s is not a180s whole-entry proof. The local PG/client hold does not prohibit every independent source check. Root proposes one reviewed diagnostic-only checkpoint of unchanged fddffd33 on the existing review branch/PR2; ordinary first changed-source CI freshly installs and generates from the current schema before builds/types/whole suites. Prospective admissibilityd1af6cf3 grants no Git/CI effect until exact final documentary/body/manifest co-sign, distinct learning, genuine adoption, fresh same-branch/head lease and Root GO. Preserve reported four new app-control passes, fixture validation failure, fourteen skips, old fc116 FAILED/UNKNOWN/initial52baseline-only, current13f closureUNKNOWN and historical376 SQL causeUNKNOWN. Full19/types/new CI/deployed/pilot outcomes remain unverified. No local migration replay, old-run rerun, allocation refill, source repair or TASK057 reopening; same-task count40/Seen7 unchanged.

Recurrence: TASK074, 2026-10-11. The fresh private driver stopped at GENERATED_SCHEMA_NOT_CURRENT after Prisma6.19.3 generation exited0: checked source49939bytes/f15f9c11 and generated schema51502bytes/c4ebce38 differ in whitespace and ordering of intact model-level @@unique/@@index declarations. Independent retained-file review verifies all74 named blocks, ordinary declaration tokens, complete per-model attribute multisets and outside tokens match; generated runtime embeds that exact normalized schema and types/schema expose blobObject. The earlier static admission missed that raw source-byte equality is not generated schema identity. Bind immutable input/output bytes separately and validate complete declarations while preserving field order, string/escape values, ordered attribute members, mapped names and duplicate multiplicity; do not substitute a partial field/count check. Test harmless normalization and meaningful identity mutations offline before a dependent runtime gate. Preserve the original static PASS and actual setup STOP, zero case/migration/shared-emit entries,58 reaped native children and3 exact new-container removals. This internal assertion-contract failure establishes no stale-client/product defect or recording SQL cause; historical CI remains FAILED/UNKNOWN. A separately selected source-only checker grants no closed-driver retry, old-scope reset or pilot completion. One distinct TASK074 recurrence increments Seen7to8; later same-finding TASK075 validation must not increment it again.

Same-finding TASK075 source-validation refinement, 2026-10-11: the separate pure comparator received static source PASS7f284fd8, then its sole actual entry ran34 cases with32 passes,2 errors,0 skips/native1 and a waited/reaped child. Both actual retained-artifact positives errored at the named-argument allowlist, which omitted existing @relation(name: string) in HistorySession/HistoryBaseline declarations at current schema683/687. The32 synthetic passes validate only their limited normalization/negative fixture paths, not the complete current-schema/runtime/type identity composition. Read every supported declaration/argument from the frozen real schema before freezing an allowlist; retain literal relation names and duplicate/unknown/malformed denial, and keep the actual retained positives alongside focused named-relation regressions. Preserve static PASS and the failed native receipt; no parser repair, rerun or recording cause follows automatically. This refines the same TASK074 checker finding, with L-035Seen8/completed count42 unchanged, no new lesson/pattern/gotcha and original05:40:38Z coding ceiling spent.

Seen N times: 8

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
TASK050 reinforcement, 2026-10-05: independent review again caught native/JSON naming and skipped-status assumptions before the focused plan ran. Keep suite > leaf native names distinct from space-joined JSON names; filtered skipped statuses contribute to numPendingTests. Actual runs retained15 passes, then added the disjoint legacy-v1 pass, then one corrected case with16 actual skips. Their17-new-case union plus the separately passed domain case is18 affected identities, not a fresh complete-suite run. Native domain skipped0 and17 explicit source exclusions remain different facts. Preserve all original FAILED results and avoid replaying passing cases or the saved PDF-generation case.
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

## L-043: Failed idempotent operations need an explicit retry transition
Date: 2026-10-08
Task: TASK-067
What went wrong: Owner setup kept its message and idempotency key after HTTP503, but the existing-job branch replayed FAILED forever. The next submission performed no new send even when a transient failure had cleared.
Root cause: Durable identity reuse covered successful and running operations without a failed-operation claim. Existing replay tests omitted failure followed by unchanged resubmission.
Avoid by: Trace the UI's retained key through every job state. Authorize the exact owner, tenant, location, conversation, message and operation kind before claiming a failed job under the same lock used for creation. Clear terminal metadata, retain durable IDs and message dedupe, and keep provider work outside the transaction. Test failed create/send recovery, overlapping retry, completed replay and conflicting identities against the actual handler/database. A failed application job does not establish that its bound eve session remains usable; terminal-session recovery requires separate coverage.
Evidence: Independently reviewed source b4aef87a and first ordinary CI37791656066 passed the four new regressions within the10-case setup handler module and251 Vitest tests. Intercepted eve leaves do not prove live provider or terminal-session recovery.
Seen N times: 1

## L-044: Distinguish customer onboarding from software execution blockers
Date: 2026-10-08
Task: TASK-069
What went wrong: Progress answers grouped spa catalogs, prices and clinical reviewers with missing application access as though all were prerequisites for finishing source. Repeated vague dependency status also failed to explain which service operation was denied or which platform identity needed selection.
Root cause: Customer onboarding inputs, synthetic acceptance evidence, real-clinic clinical validation and account-access dependencies were reported as one undifferentiated blocker list.
Avoid by: Identify the boundary each prerequisite gates. Let each spa supply official commercial and clinical inputs during onboarding; use disclosed synthetic inputs to verify normal software controls without inventing real clinic facts or dropping approval safeguards. For a blocked technical action, state the actual operation, returned result and selected scope, with a concrete resume condition. For an identity decision, explain the distinct role and why an existing clinic login cannot silently receive it. Answer the Owner's direct questions before recurring status, and keep source completion separate from pilot verification and real-data rollout.
Evidence: TASK069 reconciles the Owner's four questions with normal setup requirements, the existing AI defaults, three retained Vercel scope403 replies and the separate tenantless SYSTEM_ADMIN/MFA guard. This is communication and dependency classification learning, not a claim of new inference, email configuration, administrator creation or pilot completion. L024/L025/G010 already cover model metadata, subscription eligibility and account execution permission; no recurrence counter for those entries is added.
TASK156 recurrence, 2026-10-18: Repeated status-only resumptions did not clearly distinguish the finite no-candidate queue assessment and missing original private receipts from the ability to perform distinct approved work after the Owner's manual challenge. Keep old custody unavailable and old executions closed, but do not make reconstructing lost records a blanket prerequisite for prospective work after the restored current source/ref and authority are independently checked. A finite assessment establishes only its compared scope, not exhaustion of all independent PRD work. State the exact gated operation, retain the internal and external holds separately, and respond to fresh steering with a bounded assessment rather than another unchanged status. TASK156 found a genuinely missing historical-visit regression, published source903cc229/tree33ae88c3 and passed its exact named case in first ordinary CI39097715187/attempt1. This operational recurrence is recorded only after Root's actual-result acceptance; it does not recover old receipts, reopen permanent057 or establish pilot completion.
Seen N times: 2

## L-045: Check existing authorized routes before making a connector failure universal
Date: 2026-10-08
Task: TASK-070
What went wrong: The resume made restoring the failed Vercel connector a prerequisite for technical email setup. An already-installed cached CLI with existing normal authentication subsequently reached the exact selected project and service metadata without a new login, grant or installation. Resend credentials and DNS control still needed their own evidence.
Root cause: Connector visibility and a bare-command PATH check were treated as sufficient account-access coverage. Managed readiness/secret listings and PATH absence do not inventory every existing authorized workspace route.
Avoid by: Keep each denial bound to its actual route, operation and scope. Before requiring another login or parking all technical work, make a bounded presence-only check for existing tooling/auth selectors, then use the normal documented client without reading or copying credential values. Verify the actual identity and selected linked project from the proven working directory; do not equate whoami, binary presence or a remote Root Directory with that project proof. Use installed help, keep metadata value output private, distinguish branch overrides from shared defaults and preserve all original failures. Recovered metadata access does not establish provider entitlement, working keys, DNS write authority, email delivery or permission to purchase, change providers or weaken protection. Reuse accepted receipts until a relevant prerequisite changes instead of repeating discovery.
Evidence: TASK070's actual whoami e54f77/project inspect7abc25 and five selected service reads succeed through existing CLI62.1.0. Thirteen typed Coder command/presence receipts and corrected repo-root runbook received independent scoped PASS, genuinely read/adopted by Root in d9b0b7. This differs from L-044's onboarding/blocker classification and L-024/L-025/G-010/P-017 model eligibility/provider-chain boundaries; no duplicate recurrence counter is added. The original invalid access-receipt serialization and separate valid derivative remain preserved under existing typed-evidence guidance.
TASK157 tooling/authentication refinement, 2026-10-18: When bounded checks show the known executable locations are absent, an explicitly scoped private official-tool restore can repair tooling without recovering authentication. Verify the exact package, engine requirement and integrity, disable lifecycle scripts, preserve normal proxy/CA, and use installed help before one normal noninteractive identity check. Restoring vercel62.1.0 succeeded here, but whoami returned loggedIn:false and stopped before project inspection or login. Keep binary presence, client authentication, selected-project access, Gateway allowance and actual provider execution separate. A deliberate normal sign-in or changed connector grant would be new route-specific evidence, not a guaranteed cure for another client's403. This refines L-045 after accepted actual revieweca28050, not a new recurrence; Seen remains1. No credential extraction, account change or provider request is authorized by tooling recovery.
Seen N times: 1


## L-046 — Preserve cleanup time for known owned children
Date: 2026-10-11
Task: TASK-086
What went wrong: Independent source review found that an optional browser-context or CDP close could consume the entire cleanup reserve before the verifier reached known driver, Chromium and builder termination. The driver kill fallback also checked returncode immediately without awaiting reaping. Execution was blocked; no leaked process was observed.
Root cause: One global cleanup alarm bounded the phase but did not allocate time or priority to mandatory child termination. Catching its timeout then caused every later deadline guard to reject cleanup.
Avoid by: Give optional close operations individual bounded budgets, retain time for unconditional termination and actual wait/reaping of exact owned children/groups and listener closure, and make a failed early close unable to skip that work. Check the current absolute phase/total time after metadata preparation before deriving the monotonic limit. Root exit, SIGKILL dispatch or an UNKNOWN receipt does not prove group closure. Keep failures and spent source clocks; do not execute an unsafe subset or reopen the phase to repair it.
Evidence: Actual frozen verify.py28124/d736d6b5, lines130–159 and394–419; independent SOURCE_AUDIT.md8204/1e66641b, genuinely read and adopted19:53:02.301650Z. This is an authored-tool control-flow finding, not a runtime application, browser or cleanup failure.
Seen N times: 1

TASK087 refinement, 2026-10-11: Register a successfully returned child handle and its known new-session PGID in the unconditional cleanup registry before reading proc metadata or validating ownership. An armed work alarm or metadata exception between process acquisition and registration can otherwise leave a created group outside mandatory TERM dispatch. Make that return-to-registration boundary signal-safe; later bounded lineage discovery is additional evidence, not a replacement for guaranteed acquisition bookkeeping. Static capture.py review found this exact ordering at lines 240-243, with work SIGALRM already armed and final TERM dispatch iterating only registered groups. SOURCE_AUDIT.md7646/a07589db was fully read and genuinely adopted at 2026-10-11T20:42:21.337300+00:00. Execution was refused; no process launch, leak, screenshot or runtime failure was observed. This refines L-046's mandatory-cleanup rule, with its existing Seen1 and all other counters preserved.


## L-047: Latch the first authenticated diagnostic transaction before fallible validation
Date: 2026-10-11
Task: TASK-091
What went wrong: Independent static review found that an authenticated first CSP receipt rejected for a capability-bearing native field, type or size did not consume the Receiver's first-event latch. A later valid authenticated body could then create the purported first native receipt after the original FAILED reason was retained. The source was not executed.
Root cause: diagnostic.py validated native_event at line116 before setting self.seen at line120, so the latch represented the first successfully validated event rather than the first authenticated CSP transaction. Invalid-first controls used fresh receivers and did not exercise a later valid body on the same receiver.
Avoid by: Authenticate and identify the bound CSP transaction first, then latch its first admission terminally before fallible native validation or receipt persistence. Preserve a safe rejection code and original failure without copying capability-bearing native strings. Test denied-first followed by valid-later, including capability/type/size denial and persistence failure; later bodies must not manufacture first-event evidence or replace its rejection. Keep successful-first/later controls and mandatory cleanup separate.
Evidence: Frozen diagnostic.py17571/f3027d44, lines116-143 and Handler.do_POST192-207; SOURCE_AUDIT.md8554/e3afe92d was genuinely read/adopted at2026-10-11T22:53:50.435219Z. The report froze late at22:52:52.717176Z after the22:50:39.300816Z review cap. Preserve LATE_UNAPPROVED / CHANGES_REQUIRED and closed source authority; this learning grants no repair, runtime, passing controls or task completion.
Seen N times: 1


### TASK093 static refinement of L-020: Historical schema acceptance is not current READY authority
2026-10-12: In private diagnostic.py208-212, READY checks schema_gate.accepted but not the shared first_failure. A valid schema receipt followed by a duplicate retains acceptedTrue while signaling terminal failure, so a later bound READY can still be stored/returned200. Outer fatal guards prevent overall PASS; no runtime or false completed appearance was observed. Gate every READY admission on current terminal state while retaining the truthful first receipt. Compose valid-schema, later duplicate/other failure and subsequent READY against the same active host, asserting denial, unchanged first reason/receipt and no active READY. Fixtures must model the actual callback's sticky record.first_failure effect, not only append error labels to a list; G-019's composed-boundary guidance applies. Source review8548/d1e77941 was fully read/genuinely adopted00:01:58.122665Z before this distinct learning. This refines the existing release-authority principle, not a new clinical/runtime recurrence; all existing Seen/count44 remain unchanged and closed source clocks grant no repair.


## L-048: Preserve the thrown primary error across secondary reporting
Date: 2026-10-12
Task: TASK102, retained TASK101 verifier evidence
What went wrong: Two pre-execution source reviews found that the changed viewport setup could replace the actual SDK error even while its first failure reason remained sticky. A generic bounded wrapper first created a new Error; the revised helper then called a fallible reporting callback before its original rethrow.
Root cause: First-reason sealing and thrown-object preservation are different guarantees. Controls first bypassed the production wrapper, then supplied a nonthrowing failure sink, missing the real error composition.
Avoid by: At the changed production boundary, retain the original SDK error object, seal the first reason before secondary reporting, contain secondary report exceptions, clear the bounded timer in finally and rethrow the original primary. Test the same real helper/acquisition path with only native-session, timer and report leaves mocked. Require original-object identity, first-reason sealing before a throwing sink, one exact request, timer cancellation and zero later retries/bootstrap/key/evidence work. Preserve unrelated RPC behavior and mandatory owned cleanup.
Evidence: TASK101 source audits6141/70c4a803 and5846/40b30414 rejected unexecuted source attempts. Final6472/0a2d1556 source review passed; the sole R2 run recorded18 affected control passes, including SDK rejection and throwing-secondary-sink sequences. Current TASK1028595/c29b2220 review was genuinely adopted14:42:38.568277. These are prevented source-contract findings and synthetic negative controls, not an observed native logging failure or application defect. Original TASK101 actual review stays LATE_UNAPPROVED; no old source/once/deadline or completion is renewed.
Seen N times: 1


## L-049: Normalize native text only after preserving descendant boundaries
Date: 2026-10-12
Task: TASK103, private real-shell verifier
What went wrong: The source-reviewed reader normalized and trimmed every descendant before concatenation. Its actual run stopped at the unread-badge text assertion despite a retained desktop image visibly showing 1 unread. All23 affected mock controls passed, but their badge supplied a single text leaf.
Root cause: The source helper can erase a real separator between native leaves, such as numeric text 1 and literal text with a leading space. A single-leaf mock does not exercise that extraction boundary. The failing native badge count/text/subtree was not retained, so this is a proven source hazard, not a proved runtime cause or application defect.
Avoid by: Concatenate actual descendant nodeValue strings before normalizing whitespace once at the complete subtree. Preserve source bounds and strict exact text/cardinality assertions; do not insert invented spaces, change appCSS or weaken the oracle. Exercise the same reader with split-text positive and missing-separator negative native leaves. Retain bounded first-failure fields when needed to distinguish count, text and extraction without capabilities. Native values not captured remain UNKNOWN.
Evidence: adapter.mjs nodeText667/readReminderState676, source128642/9340fc2d and actual report8238/93dbcbe3. Sole R1 run FAILED with zero accepted states/raw phase receipts; one108290/81af3c31 image was actually viewed by Auditor and Root. Genuine failed-evidence adoption16:27:29.443408Z precedes this distinct learning. No causal repair, mobile/full UI pass, old source/once replay or task completion is established.
Seen N times: 1

## L-050: Optional diagnostic bounds must preserve validated observations
Date: 2026-10-12
Task: TASK104
What went wrong: The first badge-failure collector treated a legitimate selected subtree over32nodes/depth8/text256bytes like an invalid receipt. Its catch discarded already observed cardinality, computed text and whitespace instead of retaining those fields with an unavailable optional selection. Independent source review blocked execution of those bytes.
Avoid by: Separate the safe optional selection limit from source-safety validation. Continue bounded own-data/type/dense-array/capability validation beyond the first soft bound; later unsafe data still rejects the entire receipt. For fully validated legitimate input, preserve actual bounded scalar observations with an empty, explicitly UNAVAILABLE selection, never clipped evidence or invented values. Seal original primary/first attempt before collection, schema or IO. Compose the real gate, collector, serializer, exclusive persistence and actual parent validator; assert original-object preservation, one write and no later reopening on success or rejection.
Evidence: Initial7366/7e787aae rejection was genuinely adopted before freshR1. Corrected7435/3337334f source was accepted; actual31affected controls passed, including three node-count/depth/text-byte production transactions and three exact live-phase parent projections. Current5071/fdc152c5 failed-evidence custody was genuinely adopted18:06:29.864019Z. Native story stillFAILED at Fixed native style with0acceptedphases; its property/value/cause remain UNKNOWN. This is one static collector-contract occurrence, not three native failures or a proved application repair.
Seen N times: 1

Same-rule TASK107 L-047 caller-admission refinement, 2026-10-12: A callee's correct first-attempt latch cannot protect fallible call-argument evaluation that happens before entry. Independent static review rejected an extra node.node wrapper getter used only to construct failure-receipt arguments: the original no-parent guard path made five reads, but a throwing or changing sixth read could prevent first admission or change diagnostic selection. Capture diagnostic primitives at already-existing original evaluation slots, preserving every getter/property/Map count, order, short circuit and required throw; add no preflight read or cache away original reads. Test the actual caller -> collector/serializer/exclusive receipt composition with throwing and changing wrappers, zero input, original primary/first reason, first-terminal persistence and no later reopening. Required original getter errors outside designated guard failures remain unclassified. Corrected R1 source review6421/83cda7d8 and actual6414/1b15ef93 were genuinely adopted; the sole run recorded13 Node/1 shared-parent passes and a bounded native failed-hit receipt. Native DOM identity/map/after-scroll pixels/dispatch trace/cause remain UNKNOWN; UI remains FAILED. This refines L-047 admission scope; its existing Seen1, all other Seen values and count48 are unchanged, with no new lesson number, recurrence or promotion.


### TASK108 static refinement of L-035: Frontend mirrors are not usable native handles
2026-10-13: The first private collector required every describeNode row.nodeId to be positive. Installed CDP declares NodeId as number and says describeNode does not start tracking objects; an earlier getDocument and positive bound-root check do not guarantee positive frontend IDs for every later descendant. Preserve that unsupported first static verdict as unadopted and the late protocol clarification as held CHANGES_REQUIRED; no actual native zero was observed.
Distinguish optional frontend tracking metadata from the positive owned root/action handle. A safe frontend zero in a diagnostic row must not become a valid frontend match or action handle; a positive backend identity may still classify that row. Keep descriptor-only safety, negative/nonfinite/accessor/capability rejection, original property/Map evaluations and the first-attempt seal; do not add a tracking RPC to manufacture evidence.
Exercise actual layoutTree, click guard, collector, serializer, exclusive persistence and shared parent parser with positive acquisition root/action and zero selected/hit/unrelated child mirrors. A separate zero-terminal-root parser/persistence fixture is not reachable native acquisition proof. R1's sixteen Node and one parent controls passed; its native704-byte SUMMARY/DIV/DOCUMENT snapshot records PRE_SCROLL_TREE membership only. Actual frontend zero, which DIV, freshness, post-scroll pixels and cause remain UNKNOWN; whole UI remains FAILED.
This refines the existing authoritative-contract rule. L-047 already covers terminal first-attempt admission and L-050 optional bound preservation; no separate pattern/gotcha, new occurrence, Seen increment or task-count change. Original late/oversize reporting and closed once/caps remain held.


Same-rule TASK110 refinement of L-030: Bind visibility to the intended real error presentation.
2026-10-13: The first recorder verifier required globally unique alert/error-text content. Real AppShell intentionally renders the same denied-navigation/logout message in a sidebar paragraph and main ErrorBanner; the static6252 review rejected that composition before execution. Scope the assertion to the declared product region and exact message subtree, then track and measure the same selected backend/native node. Preserve both legitimate copies and existing cancellation/data guards; a global first alert or duplicate-count assumption is not visible-feedback identity. Exercise the actual component/helper path with both copies present, never a mirrored renderer, suppressed warning or changed CSS. L-049 still governs descendant text boundaries.
Corrected5033 source review and actual4855 review were genuinely adopted. Eight real-component pending-media controls passed and three scoped main/sidebar projections were retained; parent projection/state validators were NOT reached after its failed-story guard. These are SYNTHETIC controls, not native microphone denial or successful recording. Bound-document invalidation case/session/cause remain UNKNOWN. Existing L-030Seen1, all other Seen/counters and late/closed source-once scopes are unchanged; this is an existing-rule refinement, no new occurrence or promotion.

TASK125 static nullable-state refinement of L-050, 2026-10-13: A delivered observation can legitimately contain an absent recorder after the labelled fixture unmount. The readiness collector unconditionally required an object and lost already observed native/proof fields; its parent also required Boolean recorder UI flags for every OBSERVED candidate. Represent PRESENT, ABSENT and unavailable UNKNOWN separately across the actual collector, serializer and parent. For validated absence, retain native/proof observations and use null only for recorder-dependent fields. Reject contradictory phase/state/types, unsafe descriptors and fabricated UNKNOWN values. Exercise the actual delivery/wait caller, collector, bounded serializer, sealed exclusive persistence and exact owned parent reader together; preserve original primary and prohibit later reopening. This is a refinement of existing L-050, with G-019 typed-envelope guidance, not a new lesson or Seen occurrence. Original TASK124 report froze22:15:12 after22:15 and remains late/unapproved, source/native goal unfinished, executions0. Current rejection facts were genuinely accepted under distinct TASK125; proposed correction and new synthetic regressions are unexecuted. Seen1, all corpora counters/count52/nine criteria and old caps/onces remain unchanged.


## L-051: Rescheduling a reminder must retire older schedule notifications
Date: 2026-10-14
Task: TASK-153
What went wrong: Independent source tracing confirmed that a normal TBD decision persists a future wellness due date while the old due-specific notification remains active. Reconciliation at the new due can add a second active notification; this is a source-confirmed finding, not an executed runtime result.
Root cause: The future-date branch returns without retiring superseded schedules. Upsert deduplication covers one due-specific key, not all active keys for the unresolved decision.
Avoid by: Reconcile active notifications against the current canonical schedule key under the existing visit lock before returning a future due date or upserting a due reminder. Scope cancellation to the exact tenant, visit and type, explicitly include null keys, and preserve current-key identity, read state and dismissed history. Verify normal handler rescheduling and seeded supersession/deduplication with the real database and complete unrelated controls before claiming repair success.
Evidence: TASK153 current clinic.ts801-802 and reminders.ts47-65, independently accepted finding review676c18b0 and Root genuine3dfd94d2. The two-file repair and regressions remain prospective; no source/test/runtime/pilot PASS is established.
Seen N times: 1

## TASK162 refinement of existing L-045, 2026-10-22

ChatGPT plugin action-approval settings and service OAuth/team grants are separate evidence layers. The permission tool explicitly excludes OAuth/install/connect diagnostics: its not_installed result did not establish that the working Vercel login was disconnected. Do not prescribe reconnect or alter action approvals as a verified team-access remedy. Bind the actual connected-user result, exact scoped project403/recovery instruction and currently exposed recovery actions separately. A missing authorization/browser action in the current catalog is not universal absence of supported account routes.

Under the Owner's fresh explicit recovery instruction, the normal existing CLI with supported inherited-proxy handling returned a real device action. That established a usable sign-in path, not completed authentication or selected-project access. The original local trigger closed the client with no success/denial observed; its stopped challenge is not live and provider expiry remains unknown. Lost partial output from the earlier30s inspection leaves its cause and any prior server challenge unknown. Do not replay either operation to manufacture missing evidence.

Independent actual-result review98e75f1b was genuinely adopted2026-10-22T01:31:09.011733UTC before this distinct refinement. G-008 already covers Node proxy handling, L-046 bounded owned-child cleanup and G-019 actual typed receipts; no duplicate entry is added for those rules. This refines L-045 without a new lesson ID, Seen increment, promotion or task counter change.
