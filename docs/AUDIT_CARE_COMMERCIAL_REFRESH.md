# TASK073 care commercial refresh audit

AUDIT: TASK-073
PHASE: SOURCE_FINDING and PLAN_ADMISSION
VERDICT: PASS for this phase only
ATTEMPT: 1
REVIEWER: /root/care_refresh_auditor, independent Auditor
DATE: 2026-10-10
BASELINE: 6e9eb0ccf22d5d9517cbb1252923484f0310fd98, feat/dripwell-consultation-v2, PR #2

The current source contains a reachable F06 stale form overwrite after a version-conflict reload. The revised TASK073 brief admits a minimal correction to the four optional-field setters in the existing saved-care refresh effect and meaningful DOM coverage through the real exported Consultation. This is admission to implement one independent defect, not implementation PASS, runtime PASS, learning completion, publication authority or pilot completion.

## Current inputs and role boundary

All current required boot files were read, followed by Auditor/CTO personas, root/apps/web AGENTS, CODING_LOOP and the new brief. The original combined tool display truncated; retained complete outputs were displayed in bounded parts before the source verdict. Source reads and descriptor checks were the only local operations. Native pwd154ee0 proves /workspace access; current managed status reports running/connected, observations_current:true, revision779. No application was imported or executed.

Local HEAD and branch in native6aa9ae match the baseline above. Before this report, Git status contained only Root's modified memory/STATE.md and untracked tasks/TASK-073.md. The refreshed current brief is7416bytes/SHA2560962573ee4c85fae76c48201d89ec309164e88c0fc571b1485cb2c024b3415f6; current STATE is33162bytes/SHA256edc461ce9cdebc991a4966c7bc637db6e15a78beb380f575e1c300de3ec702a4. Both were read after Root recorded the assessment complete and the independent Auditor active. No Coder is implementing concurrently in this phase, per the actual Root handoff.

Normal GitHub ref/open PR parity was established by Root before delegation; this Auditor did not repeat those remote reads. The report binds the actual current local baseline and does not infer deployed source or effective hosted guards from Git.

## SOURCE_FINDING: PASS

Story: an existing care form submits a stale observation correction, receives a version conflict, reloads via the visible retry control, then submits another observation correction using the current visit version.

- apps/web/components/consultation.tsx:719-729 initializes membershipProductId, membershipEnrolled, servicePurchased and confirmedCollectedCents from saved actualCare. Nullable booleans use a null check, preserving false; paid uses decimalPrice with saved currency, preserving zero.
- apps/web/components/consultation.tsx:733-738 refreshes outcome, items, observations and reason when JSON.stringify(visit.actualCare) changes, but omits all four optional commercial values.
- apps/web/components/consultation.tsx:774-778 always serializes those retained optional states, even when the optional controls are hidden. The commercial section begins closed at731 and is conditional at875.
- apps/web/lib/clinic.ts:129-130/186-189/622 rejects the original stale expectedVersion with VERSION_CONFLICT. This guard protects that first request.
- apps/web/components/clinic-context.tsx:187-217 preserves the real API error and same-origin/no-store request contracts. Its actual mutation boundary at325-329 sends postJson('/api/clinic', { action, ...fields }) and refreshes on success.
- apps/web/components/consultation.tsx:1494-1496 renders the save error. ErrorBanner's visible Try again invokes its retry callback at apps/web/components/ui.tsx:175. Consultation supplies load at1615, so retry reloads the current visit through the actual clinic and recording GETs at1437-1446.
- That reload updates visit/configuration and clears the error. It never sets loading back to true, and the recommendation tab remains selected. The same top-level CareOutcome is retained at1672 with no revision key. Its four omitted state variables keep their earlier values.
- The next real action uses current visit.version at1477-1480. The server accepts a correctly versioned full replacement, subject to the existing authority/schema/clinical/currency checks; actualCare is parsed and replaced at apps/web/lib/clinic.ts:727-735. Null, false and zero are legitimate contract values, not automatic merge instructions.

Concrete reachable source example: editor A opens a care record whose optional outcomes are unknown. Editor B records true enrollment, a valid selected membership, true service purchase and a known nonzero amount, incrementing the visit version. A's original observation save is correctly rejected. A clicks Try again. The clinical form and version refresh, but A's hidden optional state remains blank. A then edits only observations and saves. The current-version payload includes null optional outcomes/amount and clears B's saved values. All existing adjustment/version history still runs, but it records an unintended replacement.

The defect is distinct from ordinary stale-version denial. It concerns the accepted current-version payload after successful reload. It violates F06's independent accurate outcomes and the existing L-016 every-fetched-field contract. It can affect downstream F12 reporting and wellness invalidation without changing any of their contracts.

This is independently confirmed from the current writer/reader path, not an observed browser, database or deployed overwrite. Source inspection supports reachability; no runtime reproduction or repair has run.

## PLAN_ADMISSION: PASS

The bounded fix is sufficient: add synchronization of membership, membershipEnrolled, servicePurchased and paid to the existing actualCare refresh effect, matching the initializer's null/boolean/decimal conversion. Keep its existing serialized dependency and the existing clinical setters. Do not change the backend, add a public testing export, remount on general visit.version, or infer enrollment/service/payment from another outcome.

These values are editable draft state, not a read-only derived label. Deriving every control directly from props would prevent ordinary edits. Re-keying on every visit version would also discard local edits on unchanged saved care. Applying the relevant Vercel guidance proportionately therefore means restoring complete synchronization at this existing explicit boundary, without a new state-management architecture.

The already revised acceptance3 correctly defines the negative: reload a fresh actualCare object with the same JSON.stringify value and a changed visit version, and verify local optional-field edits survive. This tests the existing primitive dependency. It does not impose canonical equality, property-order-insensitive equality or object-reference equality, and the implementation must not add those semantics.

The admitted new regression coverage must:

1. Mount the actual exported Consultation, navigate with its real Recommendation & care tab, edit observations and submit its care form, deliver HTTP409/VERSION_CONFLICT through controlled fetch, then drive visible Try again. Respond with a current saved-care update carrying true enrollment, a valid selected membership, true service purchase and a known nonzero amount. Preserve the same mounted form. Assert the refreshed optional DOM controls and the next observation-only request's current expectedVersion and exact four saved values, including currency/minor-unit round trip.
2. Cover a later saved change to explicit false enrollment, null membership, false service purchase and zero collected amount. Assert zero stays a displayed nonblank value and returns0 in the request. Cover unknown/not-recorded null fields as distinct from decline and zero, either in another named case or a separately asserted transition.
3. Include the unchanged-serialized-saved-care negative above. Prove ordinary DOM editing is retained across that reload and submitted with the new version. The test must not pass merely because a CareOutcome remount reinitializes state.
4. Use the actual apiRequest/postJson transport implementation. A controlled useClinic/context leaf may bridge mutate to actual postJson, but it must not replace the form save handler, the version selection, the refresh effect or the serialization under test. Intercept fetch with bounded disclosed synthetic responses and reject unexpected paths; no real request/provider/database may be dispatched. Keep fake clinical inputs honest and do not claim authority from a stub.
5. Drive DOM input/change/click/submit events within awaited React act, assert actual values and outgoing JSON, settle and join deferred transport work, unmount roots in finally and restore global/property shims. Inspect copied helper boundaries per L-042. Do not assert a duplicated mini state machine.

The production path is only apps/web/components/consultation.tsx; the new test path is apps/web/lib/care-outcome-refresh.test.ts. No dependency/lockfile/CI/schema/agent/workflow or backend change is needed. Any genuinely necessary extra path requires a revised bounded brief before editing.

The existing first ordinary changed-source CI is the admitted validation boundary after independent implemented-source PASS and reviewed same-branch publication. .github/workflows/v2-checks.yml is unchanged and supplies a new isolated PostgreSQL17 service, Node24, frozen lock install/current generation/migrations, builds/types and complete required suites. apps/web/vitest.config.ts includes the proposed new lib/**/*.test.ts file. This does not admit local application tests, imports, types, builds, generation, dependency changes, SQL, old process inspection or target disposal. Accepted earlier checks must not be replayed merely to fill the queue. Genuine future named-case/full-check evidence still requires a separate actual-result review; source admission predicts no result.

## Required guidance actually read

Connector guidance is available and was actually read, satisfying the mandatory open-source Vercel Plugin rule for this phase:

- skill://plugin_connector_690a90ec05c881918afb6a55dc9bbaa1/react-best-practices/SKILL.md
- skill://plugin_connector_690a90ec05c881918afb6a55dc9bbaa1/react-best-practices/rules/rerender-derived-state-no-effect.md
- skill://plugin_connector_690a90ec05c881918afb6a55dc9bbaa1/react-best-practices/rules/rerender-dependencies.md
- skill://plugin_connector_690a90ec05c881918afb6a55dc9bbaa1/verification/SKILL.md

Actual installed package metadata in native5378fc reports Next16.3.8, React/ReactDOM/@types React/@types ReactDOM19.3.0, Vitest5.0.3 and jsdom27.4.0. Relevant installed documents/types were read without importing those packages: Next dist/docs/01-app/02-guides/testing/vitest.md and 01-app/01-getting-started/05-server-and-client-components.md; React/ReactDOM README; @types/react/index.d.ts state/act declarations; @types/react-dom/client.d.ts createRoot/Root.unmount; Vitest dist/index.d.ts hoisted mock/global restoration contracts; jsdom README DOM/event and nonvisual limitations. Existing setup-conversation.test.ts is the read-only actual-component DOM reference.

Next's installed guide permits synchronous Client Component unit testing; Consultation is such a component, not an async Server Component. Existing React createRoot/awaited act and Vitest jsdom conventions require no package install. jsdom does not perform physical layout/rendering; DOM regression results must not become device, hosted browser or full-story proof.

Full-story guidance was applied to the UI trigger, request/error, authoritative writer and reload-to-form boundary. No secrets or .env values were inspected. This phase stops at the confirmed source defect and prescribes the bounded next fix; unrelated live service checks are not admitted.

## Evidence and limits

Primary read receipts: boot b1a5f6/42d839/740558/5e0be1/1928c1; source8e9b56/e2c90e/ab3c01/de162e/c5b60d/9b90c2/c8ab69; real DOM reference d3a224; installed docs3bfbef/d7c648/869e12/55a254; current brief03886a/STATE25d854; installed versions5378fc; final descriptors6aa9ae.

Three guessed read paths were absent: apps/web/lib/client.ts, apps/web/app/api/consultations and Vitest dist/environments.d.ts. Existing imports/rg resolved the actual clinic-context transport, api/clinic route and available Vitest types. Their read errors are preserved in ab3c01/de162e/e31c99; they are not application failures or executed checks.

FINDINGS:
- consultation.tsx:733 incomplete saved-care form synchronization permits the accepted current-version stale overwrite described above, severity:blocking for this defect's completion.
- No blocking defect remains in the revised bounded TASK073 plan. Its same-serialized-value negative was clarified before this admission report.

PATTERN_VIOLATIONS: none introduced; P-027's immutable saved offer facts remain unchanged.
GOTCHA_HITS: G-005/G-019 are respected; no implicit pnpm operation or assumed review envelope.
PRD_AUDIT: PASS for existing F06 repair under criteria3/5/9. PRD text and scope are unchanged.
REQUIRED_PLAN_FIXES: none. Implemented source and actual outcomes remain pending.

Learning is a distinct later phase after genuine implemented-source and actual-result review, as the brief requires. No lesson/pattern/gotcha, NO_NEW_LEARNING receipt, completed count, Seen counter or service-clock event is authored in this admission phase. L-016 recurrence disposition must be decided from the completed task's actual evidence, not preemptively counted.

Only this new audit document was authored by the independent Auditor. No application source edit, test/build/import/generation, SQL/migration, dependency/process/browser, provider/account/DNS/email/admin, deployment or publication operation occurred. Root must fully read/adopt this report before separately dispatching the Coder. TASK057 remains permanently parked; TASK066 retained local/process/database and prior consumed scopes remain held. Count42, seven unstarted clocks, protected previews, requested ALLOW_REAL_CLIENT_DATA=false, effective hostedfalseUNVERIFIED, default-disabled maintenance and all nine pilot/production gates are unchanged.

## Captured current file descriptors

These bind this phase, before any implementation. Future source/doc changes need their own final pins and genuine review.

| Path | Bytes | SHA256 | Git blob |
| --- | ---: | --- | --- |
| tasks/TASK-073.md | 7416 | 0962573ee4c85fae76c48201d89ec309164e88c0fc571b1485cb2c024b3415f6 | 12260072d7e36c06d9d7008546fd6872a080f265 |
| memory/STATE.md | 33162 | edc461ce9cdebc991a4966c7bc637db6e15a78beb380f575e1c300de3ec702a4 | a10f5294ebcc612fe7cba442176e0e8f1fbb9f51 |
| apps/web/components/consultation.tsx | 65990 | a2c5ff242d327799fe97a2aff0182da19df2f76aed175d0d6a84f909d7a16376 | 669887b9facaa53a17be53d7481e1d34d979f958 |
| apps/web/components/clinic-context.tsx | 11349 | d390088c7274c5d18316cef19eecdcea20caf3b6aa1ff0e1608df56922516b43 | a548d7c96f3dd43d3a6e615fad2366320ffb77ab |
| apps/web/components/configuration-editor.tsx | 34797 | ce14e523a31c88b0454de23ded8dd7f153a4e5a4f4f68bd2579d77308c601141 | ec75d483641a1e7ebf79cdfb860b6110ea693e3b |
| apps/web/components/ui.tsx | 6275 | c46af2b417c0f24ec2adae886f51221addded78d4dae28668cead4f115217bd2 | db1d6500c8e62f0ad82df175a2452998a88b37b4 |
| apps/web/lib/clinic.ts | 92403 | 041953475192e4a88ddee11abd6c227466ca8512113ebf279d838d42709c62ef | 31dc0766a149b2760cc4129d91dceba9acd7af03 |
| packages/shared/src/v2/contracts.ts | 10081 | 78617ce7684e1f72a2000a38e4cdcc1daf02f91dba53d84605bf3f2aa49105b1 | 5c5501db01502f2fdd9dc515391e61bbd6f56356 |
| apps/web/app/api/clinic/route.ts | 1803 | 0a200143b44be5cdc0126b514c181660e0452c9ea1983e28383536fca9a44534 | 6f21786c41d90abf121c282dd6aa7ac1b848e408 |
| apps/web/lib/setup-conversation.test.ts | 12859 | 9cbd64e65d8bbbbef3c3a88db1ba2b199a685d3297b0c887cb5f4b91a613314d | 9bc7f007c3c11203b5c525450ed812b4b3ecbab4 |
| .github/workflows/v2-checks.yml | 2000 | ec4b680617aa6a60b52d0ae9bc0d0c07de4ac7ab72a43275a36b984a558a87e0 | f20ba3e6b3c7fada6ebd92dc35380cf27fa71cab |
| apps/web/package.json | 1728 | c13124d18427e5a7a688c548e98fe0937a9ee0d0976e2f681f2c739ba05c3054 | e83eac4038897fb20574f584baf93009b3f3e2d5 |
| apps/web/vitest.config.ts | 425 | 13820ee67141b6c144e325f0cee697f209c5e8acee91b0c0ef80fa51ab4df498 | 506ecef09607e40f5e461a65dab52feb0aa9ab95 |

| Boot/persona/workflow path | Bytes | SHA256 |
| --- | ---: | --- |
| AGENTS.md | 5086 | a693ef947ea2525a5187178d28c4ee06c1fd7a4edba01703d6f8f15d6257ec98 |
| apps/web/AGENTS.md | 678 | 63f2c50380ed6303237cce215ce27af1d620d094c215e28d1b1538a3c070e3bb |
| PRD.md | 49318 | 82f0f1617883a762a28e4ea3c958532f7efd6a9c244407762a4c712be4374942 |
| memory/PROJECT_CONTEXT.md | 12696 | 21192180199f6e55d3f883e865542e029bb0d91ea1a874a83d3382493a94aa30 |
| memory/LESSONS.md | 69040 | c512890d0cb72f146a751d32073b9f5bb5074bb752344e9a28846ff9f5636f93 |
| memory/PATTERNS.md | 31680 | f61c6aa4b1201b2c640c531bce3af457512e94aa5c136f0fcd183ae2cff77de6 |
| memory/GOTCHAS.md | 42292 | 5099607c324bd04af82c603bf85809bd697171bcf45dd71f0bdc4550601aa25b |
| personas/AUDITOR.md | 3786 | 531db07e5601879b192cf0913e7d0663c264bcc0285e88776f4167eada3e8b59 |
| personas/CTO.md | 5552 | af5d15ed1dcd64a1104584cf6a3528afdceebaec4556c945957585edeae415c0 |
| workflows/CONTINUOUS_MODE.md | 7092 | 1b3140c5ec08b90ef4d9e5b57d7f5dd3b6a8684a756ab374ee6ffd2f72830c6d |
| workflows/CODING_LOOP.md | 3190 | b4ded67a586e49372a315e4734aae5cc132c3842483aa6191176dae7e762b41c |

## Phase 2: IMPLEMENTED_SOURCE review

**Verdict: PASS for the captured implemented source. No required source fix.**

Reviewer: /root/care_refresh_auditor, independent of the Coder and Root. Date: 2026-10-10 UTC. Baseline HEAD remains 6e9eb0ccf22d5d9517cbb1252923484f0310fd98 on feat/dripwell-consultation-v2. The sole Coder completed and is idle; worker reconciliation found Root and this Auditor active. This phase follows Root's genuine full admission-report read and adoption, recorded in /workspace/dripwell-task073-private/ROOT_ADMISSION_ADOPTION.json (full-report read b8d8af, adoption c3e6c9).

The original 17,517-byte admission report is retained verbatim in /workspace/dripwell-task073-private/ADMISSION_AUDIT.md, SHA256 d64684c3f34131537754431b39d0dbe78a6bbec1b7f6bd83a8f9383b8e87d122. Native 01d5a1 independently compared it byte for byte with this report before this appendix. The original phase's findings, limits and pins remain historical admission evidence.

### Applied code and writer path

Native 8aa0cb exposes the complete tracked application diff: exactly twelve added lines in the existing CareOutcome refresh effect. The four added setters at consultation.tsx:738-749 mirror the initializers at :719-729: membership product selection, nullable enrollment, nullable service purchase, and nullable collected amount. Existing clinical field refreshes, form visibility, save parsing, current visit version, authorization, persistence and rendering boundaries remain unchanged.

The serialized dependency at :750 is still JSON.stringify(visit.actualCare). A new saved actualCare value refreshes the full editable form snapshot; a fresh object whose serialization is unchanged does not overwrite ordinary local edits merely because visit.version changed. No general semantic-equality comparison, consultation-version dependency or remount key was added.

The null checks preserve the existing three-state boolean interpretation: unknown becomes the empty select value; false becomes "false"; true becomes "true". Collected null becomes an empty input; zero becomes decimalPrice(0, saved currency); other minor-unit amounts use the existing decimalPrice conversion with saved actualCare.currency. The save path at :758 and :786-790 still converts the decimal input with parsePrice and the clinic currency, posts nullable selections and collected minor units, and preserves currency enforcement by the existing writer. The change does not alter any catalog price or clinical decision.

Independent read of the actual caller and writer confirms the same reachable retry boundary admitted in Phase 1. The server's VERSION_CONFLICT prevents the first stale write. Actual ErrorBanner's visible Try again calls Consultation.load; load replaces the visit without setting the component to an initial loading state or remounting CareOutcome. The subsequent action posts the reloaded visit.version. The clinic.care.record writer still validates and replaces the supplied actualCare, so keeping all commercial buffers aligned with refreshed saved care repairs the later observation-save overwrite. The server, route, shared contracts, request helper, formatter, ErrorBanner, role checks and clinical guards are byte unchanged from the admitted capture.

### Independent source review of the new DOM tests

The complete new care-outcome-refresh.test.ts was read (native 37bb4d, 16,091 bytes, 343 lines). It defines five cases using the real exported Consultation, actual CareOutcome form, actual ErrorBanner, actual postJson/apiRequest error handling and an intercepted fetch transport. The clinic context mock provides a boundary bridge to the actual postJson helper; refresh is a settled synthetic leaf. AudioRecorder and RecordingSegments leaves are mocked because capture and segment processing are outside this repair. These boundaries are disclosed and do not substitute a copied care state machine.

| Source-defined case | Meaningful assertion |
| --- | --- |
| USD recorded true/enrolled/service/nonzero | Hidden initial commercial section; actual stale save receives HTTP 409; visible retry reloads current saved values into the same form; observation save posts current version and the complete expected actualCare, with 12,345 minor units displayed as 123.45. |
| KWD recorded true/enrolled/service/nonzero | The same real retry/save path, with 12,345 minor units displayed as 12.345 and restored to those minor units in the next request. |
| Explicit decline and zero | Previously confirmed true/member/service/payment values refresh to false, null product, false and zero; the next complete payload preserves those exact values. |
| Unknown outcomes and amount | Previously confirmed commercial values refresh to null product, null booleans and null amount; controls and the next complete payload remain unknown. |
| Identical serialized saved care | A fresh object and items array plus a newer visit version have exactly the same JSON.stringify result; ordinary local true/member/false/89.01 edits remain in the same mounted form and the next request uses the new version and 8,901 minor units. |

Each conflictReload checks the old expectedVersion, resolves an actual HTTP 409 response carrying VERSION_CONFLICT, observes the real alert, clicks the visible Try again control, resolves both real load requests, verifies the alert clears, and asserts the exact same form node survives. Each final save checks the current expectedVersion and the whole actualCare payload, then resolves the success reload. Checking only an isolated setter or copied reducer would not establish this path; these source cases exercise the admitted caller and request boundary.

The positive cases would detect the original omission: stale hidden empty buffers would not equal the refreshed true/member/service/amount values, and the following complete payload would clear them. The later false/zero/null cases detect retention of earlier confirmed values. The unchanged-serialization negative checks the existing dependency's precise semantics, so widening the refresh to every visit version or object reference would also be caught.

The transport allows only the two expected GET surfaces and the care POST surface, enforces a finite sixteen-request maximum, records and rejects any other request, and invokes no underlying network transport. Requests resolve at most once. Every test closes in finally; cleanup settles pending synthetic responses, joins recorded mutation promises, unmounts the React root under act and removes the container. afterEach restores globals, clears the mocked context and asserts there are no unexpected or unsettled requests. No retained provider/browser context, service credential or real client fixture is introduced.

These are five meaningful source-defined cases. This phase has not imported or executed the application or tests and does not assert that any case passed at runtime.

### Guidance, scope and hygiene

The previously read mandatory open-source Vercel Plugin React best-practices and verification guidance remains applied. Installed documentation and type declarations were read for Next 16.3.8, React/React DOM 19.3.0, Vitest 5.0.3 and jsdom 27.4.0, including the existing project DOM-test conventions. Native 01d5a1 confirms the twenty-one other admitted boot, persona, workflow, learning, writer, request, formatter, shared-contract, package, Vitest configuration and CI inputs are unchanged. No package or dependency API changed.

The React guidance against unnecessary derived-state effects does not require replacing an editable buffer with a read-only expression. This repair completes the already established saved-care refresh boundary while preserving local-edit semantics. The narrow serialized dependency is intentionally unchanged. jsdom remains a synthetic DOM environment; this review makes no claim about real browser capture, physical rendering, hosted services or full-story eligibility.

Native a9ed2c ran only git diff --check and returned exit zero with empty output. Native 01d5a1 additionally read and checked UTF-8, newline termination, control characters and trailing whitespace in all five captured paths, including untracked files; it reported no errors. These are file/diff hygiene observations, not application checks. The current change set is exactly the two application/test paths plus TASK073, STATE and this audit. No schema, migration, provider, lockfile, build configuration, CI workflow, product layout, authored agent/workflow, price, clinical guard or learning-corpus change occurred.

## Phase 2: pre-publication DOCUMENTARY review

**Verdict: PASS for the captured five-path source-publication set. Final task completion and final learning co-sign remain pending.**

TASK073 and STATE accurately describe the frozen Coder handoff, source-review-pending phase, five source-defined cases and separately pending ordinary changed-source CI, genuine independent actual-result review and distinct learning. Their admission and planning entries are explicitly historical. They do not claim a local application check, successful CI, completed pilot, released production, or a new service result. The initial source publication may contain this bounded phase result after Root genuinely reads and adopts the complete appended report. This verdict is pinned to the captured bytes below; later edits require review of the changed bytes.

The accepted count remains 42 and the existing seven service clocks, historical actual results and held-lane restrictions remain unchanged. No failed/accepted/prohibited attempt was reset or relabeled. Protected previews and the requested-false, effective-hosted-false-UNVERIFIED, default-disabled real-client-data posture remain unchanged. Recording/transcription/model eligibility, approved clinic setup, referral/roles, retention, full-story pilot evidence and remaining production gates retain their current limits. The owner-facing interface is not redesigned by this task.

No STATE DONE transition, CHANGELOG completion claim, recurrence increment, new lesson or pattern has been authored in this review. The approved sequence remains: Root's full report read/adoption, reviewed same-branch publication, first ordinary fresh changed-source CI, independent review of actual results, distinct justified learning, updated STATE/CHANGELOG and final documentary co-sign. This source verdict neither consumes nor recreates any held operation.

### Captured immutable inputs for this source verdict

Native 01d5a1 independently recomputed every descriptor below and matched the Coder handoff and Root's independently captured descriptors. HEAD, branch and five-path status also matched. Git blob identifiers here are descriptors of the captured bytes, computed without storing objects.

| Captured path | Bytes | SHA256 | Git blob |
| --- | ---: | --- | --- |
| apps/web/components/consultation.tsx | 66504 | b96dd31a979697a84a6bbe2bbcae4875ac58986e6a0cb2feacad486d57cc6900 | a8c6c10cc73cb1eb0d8e207e4ef96dc625d77876 |
| apps/web/lib/care-outcome-refresh.test.ts | 16091 | c9c1216e1aacea4048d8aa269dbf9780768f4f0e4ad059f4bb6d494f405762a8 | bf849ccba192c4c2f2a2c33ba01317b4f609a30a |
| tasks/TASK-073.md | 8863 | 231c510685ca92dd655aaf1d39cc75d36652c31717ff33a03439a99f3ea3f1fc | 9243a928328502053ce2ccf8f6f48185e26cc193 |
| memory/STATE.md | 35182 | 1ebe9e86e4acd193efd25f0c7e07cad48f32d6e9581f148252caf45aadfc6986 | 56430209a9f045f4413654e91c601bc91c9de51b |
| docs/AUDIT_CARE_COMMERCIAL_REFRESH.md original retained prefix | 17517 | d64684c3f34131537754431b39d0dbe78a6bbec1b7f6bd83a8f9383b8e87d122 | 0026653d5f6dfc5b075fd28393c59236aab3455f |

The final whole-report descriptor, including this appendix, is supplied in the independent handoff after the append; a report cannot contain its own exact hash. Its original prefix remains the retained admission snapshot. There are no required fixes for this captured source/publication phase. Runtime PASS, remote branch adoption, publication, actual CI and learning are not asserted by this phase.

