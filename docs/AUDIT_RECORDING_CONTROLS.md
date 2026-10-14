# Recording-control audit

Date: 2026-10-02
Task: TASK-025
Reviewed baseline: `dc977548c5d3e402de9a80bfa4681a2ec9829b5d`, unchanged implementation from `5307fda`.
PRD: F-03, F-09, section 8 criterion 2.

Current result: TASK-026 active-duration repair, TASK-029 attempt 2 navigation/visible-feedback repair and parent TASK-025 attempt 3 scoped recording controls have independent PASS. This is native synthetic-device capture with an intercepted upload boundary, not live provider transcription or full pilot completion. TASK-027's exact reviewed recording source is published, passed fresh 93-check CI and is independently verified in the protected preview below. TASK-028 actual local durable reminders remains queued.

## Evidence boundary and feasibility

The prior [verification report](VERIFICATION_REPORT.md) proves manual intake and consent-disabled capture. The earlier actual-PostgreSQL recording suites prove persisted ordering, invalidation, retry/discard and compensated object cleanup. They do not exercise the browser's `MediaRecorder` start, pause, resume or stop controls. The [completion matrix](CONTINUOUS_GAP_REVIEW.md) correctly retains live transcription, representative devices and full provider timing as open gates.

Browser capture controls are independently runnable without model access. The actual Consultation callback crosses into `/api/recordings` and then asynchronous provider processing. This audit intercepts that POST before transport, observes the real captured `File` and FormData metadata, and deliberately rejects it. A controlled failure is evidence for the browser's capture/error path, not successful upload, transcription or generation.

Guidance read: mandatory Vercel Plugin `agent-browser`, `agent-browser-verify` and `verification`, from `skill://plugin_connector_690a90ec05c881918afb6a55dc9bbaa1`; installed Next.js 16.3.8 Playwright and environment-variable documentation. AGENTS boot files and Auditor persona were read. Root ICM folders and authored Eve/Workflow layout were retained.

## Attempt 1

Actual environment access was confirmed current, connected and running. The previously built optimized Next.js 16.3.8 application ran at `localhost:4177`. Both fixture creation and server startup explicitly required `TEST_DATABASE_URL`, loopback `127.0.0.1:55432`, database `dripwell_verification`, and equal `DATABASE_URL`. Hosted `.env.local` was never selected as a fixture binding. The child server used `ALLOW_REAL_CLIENT_DATA=false` and empty AI/Blob/billing/email credential overrides.

One explicitly synthetic `isTest=true` consultation and staff session were created. Agent-browser 0.38.1 used Chromium's fake media device and automatic synthetic microphone permission. A wrapper observed native `getUserMedia` and native `MediaRecorder`; it did not replace audio capture with a fabricated file. Device simulation is not physical iPad/Safari evidence.

The actual authenticated dashboard rendered meaningful content with no framework overlay or browser page errors. The secure localhost context exposed the microphone API. The actual consultation then passed these bounded observations:

- Before consent, Start recording was disabled, with zero microphone requests and zero upload attempts. Explicit consent enabled the control without opening the microphone.
- A foreground Start click invoked native `getUserMedia` once and native `MediaRecorder` with `audio/webm;codecs=opus`. The visible timer reached `00:02`.
- Pause changed the recorder to `paused`; the visible `00:02` timer remained unchanged over a measured 1.4-second check.
- While paused, the sidebar Consultations link and Sign out were blocked with visible explanations. The location selector was disabled, the visit remained open and no logout POST occurred.
- Resume changed native state back to `recording`; the visible timer advanced to `00:03`.
- Stop produced an inactive recorder and an ended microphone track, with one explicit track stop. The actual nonempty captured file contained 26,497 bytes. Its FormData carried consent `true`, stable segment identity and sequence `0`. The POST was deliberately rejected before transport and the real UI showed the synthetic failure, Retry 1 unsaved segment and deliberate local discard.

### Blocking finding

`apps/web/components/audio-recorder.tsx:126` calculates duration from `Date.now() - started`, so it includes all paused time. In the actual browser result above, the UI displayed three seconds of capture while the FormData reported `durationMs=24089`. The file was real synthetic Chromium capture; upload/provider I/O was intercepted.

`apps/web/components/audio-recorder.tsx:208` also resets the segment timer to another full 60 seconds on every resume. `apps/web/lib/recordings.ts:105` accepts no more than 600,000 duration milliseconds, so a long paused interval can cause a short captured recording to be rejected. The server rejection consequence follows the authored validation, not an executed provider operation.

Required bounded repair: retain monotonic active capture duration per segment, exclude pauses, preserve the remaining 60-second active segment budget across resume, and keep saved duration/segment identity unchanged for retry. Do not change provider selection, authorization, consent, trial usage or the real-data gate. CTO routed this as TASK-026. Verification stopped at the first broken metadata boundary, before remaining permission/interruption/unmount/retry cases.

## Cleanup and remaining proof

The browser session was closed, the owned Next.js server terminated and the owned fixture tenant removed. Actual cleanup returned `tenantRemaining=0`, recordings `0`, generation jobs `0` and trial usage `0`. No model, transcription, email, billing, hosted clinical write, migration or purchase occurred. Private session state, capture metadata and screenshots remain outside Git. The hosted preview and its protection were untouched.

After TASK-026, retest the repaired native controls and remaining permission/error, interruption, cleanup and immutable retry metadata paths. Any synthetic event injection or intercepted I/O must be disclosed.

The remaining durable reminder proof is not wholly provider-dependent: `consultationReminderWorkflow` uses Workflow sleep and database reconciliation, and ordinary in-app notification delivery can be verified with a guarded fictional regular visit and actual local Workflow runtime. Previous clinic tests call the reconciliation helper directly and do not prove durable sleep/resume followed by actual browser notification delivery. Such work requires a separate scoped task; it does not establish the currently unavailable hosted production schedule.

The protected `/api/jobs/reconcile` route can separately exercise authorization, database-only recovery and missing-storage reporting locally, but it scans all local records. Its actual Blob retention deletion needs a selected real isolated storage binding; do not claim that from prior controlled upload cleanup. Any new route proof must account for every affected synthetic fixture and avoid touching unrelated rows or triggering provider processing. Full hosted scheduling, real transcription, recipient email, service eligibility and the combined two-clinic pilot remain open.

## Verdict

AUDIT: TASK-025
VERDICT: FAIL, bounded recording-duration source defect routed to TASK-026
ATTEMPT: 1
PATTERN_VIOLATIONS: none
GOTCHA_HITS: G-001, synthetic Chromium does not establish physical iPad gesture/permission behavior
PRD_AUDIT: pass, no scope change
LEARNING: L-028, paused wall time is not captured audio duration

This verdict does not withdraw the previous 87 CI checks or 19 bounded hosted checks. Those checks did not cover this native recording path, and the full pilot was already explicitly incomplete.

## TASK-026 independent repair review

Reviewed change: `components/audio-recorder.tsx`, new `lib/recording-clock.ts` and six `lib/recording-clock.test.ts` regressions. Each native recorder owns a monotonic active-duration clock. Pauses retain elapsed capture and cancel its timer; resume schedules only the remaining minute. Stop freezes duration before asynchronous media delivery; old callbacks cannot cancel a newer segment timer. The display sums completed/current active capture, and retries retain the saved metadata snapshot. No provider, schema, authorization or server limit changed.

The Auditor independently ran the six focused cases in the normal Vitest runner: all six passed, zero skips. They cover a 15-minute pause, repeated fractional captures, paused stop, repeated resume against one minute, independent rollover/cleanup and wall-clock changes. The Coder separately reported shared/web TypeScript, required optimized Next build, formatting and diff checks passing, then released the shared build before native runtime verification. Applicable Next/React Plugin guidance and installed documentation were read.

The rebuilt actual optimized Next application ran again under the same explicitly guarded local database, false real-data flag, empty provider overrides and one newly owned synthetic test fixture. Browser microphone capture was native Chromium fake-device audio; only the upload boundary was intercepted. Independent observation listened to native recorder start/pause/resume/stop events using `performance.now()`.

| Actual case | Evidence |
| --- | --- |
| Active duration across two pauses | Real payload 4,148 ms versus independently measured native active 4,121 ms during 14,521.6 ms wall time; display `00:04`, nonempty file 29,899 bytes. |
| Immutable failed-upload retry | Segment ID, sequence, duration, MIME, bytes and SHA-256 remained identical. Both upload attempts were deliberately rejected before transport. |
| Deliberate local discard | Discard cleared the unsaved capture block and reenabled the location selector. |
| Stop while paused | Payload 1,345 ms versus native active 1,310.7 ms; display `00:01`, track ended. |
| Real one-minute segment budget | No fake clock. Pause after approximately 25 active seconds, resume then pause around 47; the next resume rolled over at payload 60,000 ms versus native active 59,968.7 ms. |
| Ordered rollover and independent next segment | Sequences 4 and 5, distinct segment IDs, nonempty files 482,397 and 13,418 bytes. The next segment captured 1,671 ms; stop released the microphone. |

The small native-event difference is browser start/event scheduling, not included paused time. A physical iPad, real-provider latency and successful hosted transcription remain unverified. This completes TASK-026's bounded independent source/native-runtime acceptance; fresh published-source CI is still required before deployment.

AUDIT: TASK-026
VERDICT: PASS
ATTEMPT: 1
PRD_AUDIT: pass, no scope change
LEARNING: P-014, per-segment monotonic capture budgets

## TASK-025 attempt 2, remaining controls

Native permission rejection was tested in a separate Chromium session with fake-device media but without fake automatic permission. CDP set the real local browser microphone permission to denied. Native `getUserMedia` rejected, the app showed permission/manual-note guidance and no recorder, track, segment or upload attempt was created. The audit did not inject a replacement rejection for this case. Chromium's fake automatic-permission flag overrides permission policy, so that flag was intentionally omitted for the denial case.

Two browser-error branches used disclosed injection: making the API unavailable showed supported-browser/manual-note guidance without requesting capture; rejecting `getUserMedia` with `NotFoundError` showed microphone-open guidance without a new track. Native capture still handled the subsequent tests.

Disclosed synthetic `ended` and recorder `error` events each triggered visible capture-interruption guidance, stopped the native recorder and released the actual synthetic microphone track. The captured nonempty segment reached the observed upload boundary. That boundary was held pending while observing the capture warning, then deliberately rejected and locally discarded. An immediate injected upload failure otherwise replaces the shared error banner; these checks do not claim simultaneous-error persistence or successful upload.

### Blocking navigation finding

`apps/web/components/app-shell.tsx:55` renders the wordmark Link without the existing `captureBusy` protection. In the real application, clicking `dripwell .` while recording navigated from the consultation to `/dashboard` and unmounted the recorder. Cleanup correctly stopped native capture and released the track, and a 9,001-byte final segment reached the intercepted upload callback. Its deliberately failed upload had no retry/discard UI after navigation. The existing sidebar navigation and logout guards did protect capture in attempt 1; the wordmark bypasses them. `beforeunload` does not protect this Next SPA navigation.

The Open consultation notification Link at `app-shell.tsx:208` has the same missing guard by source inspection; no notification click was fabricated in this attempt. Required bounded fix: apply established busy-capture prevention and its visible explanation consistently to app-shell links that leave the visit. Preserve idle navigation and existing authorization. Do not invent a new recording persistence feature or disable cleanup.

Verification stopped at this first navigation break. Both owned browser sessions were closed, the owned Next server terminated and the fixture cleaned again. Actual cleanup returned tenant `0`, recordings `0`, generation jobs `0` and trial usage `0`. No provider transport, hosted mutation, migration or spend occurred.

AUDIT: TASK-025
VERDICT: FAIL, unguarded SPA navigation loses unsaved audio recovery UI
ATTEMPT: 2
PRD_AUDIT: pass, no scope change
LEARNING: L-029, every visit-exiting link must honor capture state

The bounded TASK-027 exact-stage deployment and TASK-028 durable-reminder plans were independently co-signed, with actual runtime/deployment evidence still required. Installed Workflow 5.0.1 Local World docs permit an owned data directory, explicit local base URL and active-run recovery, but disclose an in-memory queue; restart/resume must be measured. `isTest=true` is excluded from reminders. The existing compiled restore API can kick off explicitly fictional regular fixtures with preseeded future due dates while `ALLOW_REAL_CLIENT_DATA=false`; direct uncompiled workflow calls do not prove a real run. No new application route is needed for that plan.

## TASK-029 attempt 1, guard and visible-feedback review

The bounded AppShell change attaches one existing-state guard to all three authored Link paths: wordmark, sidebar navigation and notification visit links. It uses the same `captureBusy` authority, prevents navigation and adds the existing explanation as a main-content `role=alert`. It does not change capture, data authority or idle destinations. The Coder reported shared/web types, optimized guarded Next build, scoped format and diff checks passing; TASK-026 timing files were unchanged.

Actual desktop browser regressions passed against the rebuilt app, with two owned `isTest=true` visits and one explicitly seeded fictional notification targeting the other visit. This notification is a navigation fixture, not evidence of durable reminder delivery. Both wordmark and notification link preserved the current visit, native recorder state and segment buffer during active capture, pause, an upload held pending and a failed local upload. Enter-key wordmark activation and the refactored sidebar guard also preserved the visit. The failed upload remained actionable and retry retained identical metadata. After deliberate discard, both idle links reached their correct destinations. Provider transport was always intercepted.

### Blocking mobile feedback finding

At actual Chromium viewport 390 by 844, tapping the guarded Open consultation notification link correctly prevented navigation while native capture remained `recording`. The newly rendered main warning was nevertheless fully covered by the still-open notification panel. Its actual rectangle was x 18, y 83, width 354, height 71.1875; `elementFromPoint` at its center returned `notification-panel`, not the alert. Independent screenshot inspection confirmed no visible warning. DOM alert presence alone is not visible feedback.

`guardNavigation` leaves the notification/menu presentation overlays open after setting the warning. Required scoped correction: close those overlays on a blocked exit so the existing main warning and capture controls are visible, while retaining native/visit/unsaved state and normal idle navigation. This remains within TASK-029's original visible-warning acceptance. Parent TASK-025 attempt 3 stays pending; no third parent verdict or full pilot PASS is claimed.

The Auditor stopped native capture, deliberately discarded the controlled failed local segment, closed the owned browser and terminated the owned Next server. Cleanup again returned tenant `0`, recordings `0`, generation jobs `0` and trial usage `0`; the owned notification/visits were deleted with their fixture. Shared build/server was released to Coder before attempt 2. No hosted setting or real data changed.

AUDIT: TASK-029
VERDICT: FAIL, mobile notification overlay hides blocked-exit explanation
ATTEMPT: 1
PRD_AUDIT: pass, no scope change
LEARNING: L-030, DOM presence is not visible error feedback

## TASK-029 attempt 2, visible-feedback repair

The Coder added only closing of the menu and notification presentation state inside the existing busy-navigation guard, after `preventDefault` and before the established explanation. Idle navigation returns before those setters. Source review confirmed the three authored Link paths still use the same capture authority; the TASK-026 timing files were unchanged. The Coder separately reported shared/web types, the required optimized guarded Next build, scoped formatting and diff checks passing, and released the build before independent browser work.

The real rebuilt Next application ran again at `localhost:4177` with an explicitly guarded disposable PostgreSQL binding, `ALLOW_REAL_CLIENT_DATA=false`, empty provider overrides, two owned fictional `isTest=true` visits and one explicitly seeded notification targeting the other visit. The seeded notification is only a navigation fixture. The browser still used native synthetic-device Chromium capture, with actual audio files observed and all upload attempts intercepted before transport.

Desktop checks passed for wordmark and actual different-visit notification links during active capture, pause, held-pending upload and failed local upload. The current consultation, native recorder state and buffer remained intact. Enter-key activation and the shared sidebar guard passed. Failed audio retained retry/discard controls; retry preserved the identical segment ID, sequence, duration, MIME, bytes and SHA-256. After deliberate discard, idle wordmark and notification links reached `/dashboard` and the other owned visit respectively.

At actual 390 by 844 viewport, blocked notification navigation closed the notification panel and preserved native recording with a live track. Blocked wordmark navigation closed the mobile menu and also preserved capture. Both screenshots visibly show the main explanation and usable Pause/Stop controls. The alert rectangle remained x 18, y 83, width 354, height 71.1875, but its center hit-test now returned the alert, and the Stop & save control was independently unobscured. Paused capture and failed local upload likewise retained the visit and visible warning; retry remained available. Final deliberate discard released the location/navigation block. Browser page errors were empty, and no framework error overlay appeared.

The owned browser was closed and server terminated. Cleanup again returned owned tenant count `0`, recordings `0`, generation jobs `0` and trial usage `0`; owned visits, session and seeded notification were deleted. No provider transport, hosted mutation, migration, real client data or spend occurred. The shared build/server was released to CTO.

AUDIT: TASK-029
VERDICT: PASS
ATTEMPT: 2
FINDINGS: none remaining in the bounded brief
PATTERN_VIOLATIONS: none
GOTCHA_HITS: G-001, synthetic Chromium does not establish physical iPad behavior
PRD_AUDIT: pass, no scope change
LEARNING: existing L-029 and L-030 apply; no new lesson, pattern or gotcha

## TASK-025 attempt 3, scoped final verdict

The combined independent evidence now covers consent/start/pause/resume/stop, pause-excluded duration, paused stop, actual one-minute rollover, native permission rejection, disclosed missing-device/API and interruption branches, failed-upload immutable retry/discard, native track cleanup, and blocked shell navigation with visible mobile feedback. The actual unmount proof from attempt 2 remains valid: native recorder stopped and microphone track ended. That earlier navigation defect is separately repaired and retested under TASK-029; it was not recreated as an unsafe exit merely to repeat cleanup evidence.

Unchanged timing, permission and interruption suites were not repeated after the AppShell-only correction. Previous meaningful native/runtime proof is retained, rather than replacing it with handler-mirroring tests. Native fake-device audio and disclosed event/error injections do not prove physical iPad/Safari behavior, provider latency, successful hosted audio upload/transcription, model output or the complete two-clinic story. Those PRD section 8 gates remain open.

Ordinary durable reminder delivery is still independently runnable under the co-signed TASK-028 local Workflow plan. The seeded navigation notification above does not satisfy it. Hosted scheduling and actual selected-provider retention evidence remain distinct requirements. No blanket external-blocker conclusion is justified while that approved local work is queued.

AUDIT: TASK-025
VERDICT: PASS, scoped recording controls only
ATTEMPT: 3
FINDINGS: none remaining in the scoped brief
PATTERN_VIOLATIONS: none
GOTCHA_HITS: G-001
PRD_AUDIT: pass, no scope change
LEARNING: L-028, L-029, L-030 and P-014 retained; no additional learning

## TASK-027, exact source and pre-deployment gates

The complete 18-file publication checkpoint was independently co-signed and frozen at parent `dc977548c5d3e402de9a80bfa4681a2ec9829b5d`, including path, Git mode and SHA-256 for every changed file. The four application/test hashes remained identical to the source reviewed above. A closing learning/checkpoint entry preceded the freeze. Published commit `b61f6aa0f7fa3ca5fa85540bcd1051db87cd4cd7`, tree `87fb50c24aeca9f6c66cb333617c2e693b7e2937`, independently matches exactly that 18-file artifact and parent. The prepared PR body was separately co-signed; all eight evidence blob URLs resolve to existing files in that immutable commit. It preserves the source-versus-deployed and synthetic-versus-provider distinctions.

Independent GitHub API run/job metadata and the actual run-log archive confirm [CI 37029651774](https://github.com/loydhale/dripwell-ai/actions/runs/37029651774) completed successfully at this exact source, attempt 1, job completion 2026-10-02 15:51:23 UTC. All 93 checks executed with no skips: 23 domain, 8 authentication, 15 clinic, 11 AI-boundary and 36 Vitest cases. The new recording-clock file executed all six cases. Frozen installation, all ten disposable CI migrations, types and both builds passed. This CI's standalone native guard reports one Eve runtime bundle; the new assembled remote deployment's guard still needs direct inspection. The retained earlier hosted two-bundle proof is not substituted for that new build.

Every staged tracked file was independently compared directly with immutable Git blobs, including actual filesystem mode and symlink handling. All 317 tracked blobs passed, all mode `100644`, with zero symlinks. The former deployed source had 308 files, the later documentation parent has 309, and eight new files yield the actual 317 count. The sole semantic tracked difference is `apps/web/vercel.json` with `crons=[]`; its source `*/15 * * * *` schedule is retained unchanged. The only extra file is a byte-identical `.vercel/project.json` containing just the selected nonsecret project/team/name. Private environment/build/dependency/fixture files were absent, and credential-pattern scanning found no hits. A private manifest retains every compared path/blob/mode/hash and the approved adaptation.

These two pre-deployment gates are PASS. Actual protected READY deployment, current source/tree metadata, stable alias, new remote assembled build/native guard and bounded relevant hosted reads with unchanged safety/data state remain required. No new fixture, rebuild, provider operation, hosted clinical write or migration was started by this review. The full pilot and local durable reminder proof remain open.

## TASK-027, actual protected deployment and bounded runtime proof

Deployment `dpl_232QhM74EuWYYnq1vSfAEaqNDo57` is actually READY at `https://dripwell-ledfgwl3i-loyd-1222s-projects.vercel.app`. Independent Vercel API metadata confirms `reviewedSourceCommit=b61f6aa0f7fa3ca5fa85540bcd1051db87cd4cd7`, `reviewedSourceTree=87fb50c24aeca9f6c66cb333617c2e693b7e2937` and preview target `null`. The stable `dripwell-ai-preview-loyd-1222s-projects.vercel.app` alias independently points to that deployment. Project/root remain DripWell and `apps/web`, Node `24.x`, with team OIDC enabled. SSO protection remains `all_except_custom_domains`; the actual unique preview's anonymous response below proves its enforcement.

The actual normal remote build log runs from 16:00:17 through 16:01:33 UTC. Next/Eve compilation passed, default Sandbox initialization both started and completed for one template, and the assembled native guard verified two physical Eve runtime bundles. This differs from the separately recorded one-bundle standalone CI guard. The CLI downloaded 315 deployment files, a transport count separate from the 317 tracked stage blobs compared with Git. No local-prebuilt substitution, authored Sandbox bypass or production promotion occurred.

The standard environment-list response correctly reports the gate encrypted with `decrypted=false`, so its ciphertext was not called a boolean. A supported selected-variable GET with decryption confirmed literal `ALLOW_REAL_CLIENT_DATA=false` for preview/development. Secrets and all provider/environment/session evidence remain private outside Git. The app's actual clinic response additionally denies new real starts.

| Bounded actual read | Evidence |
| --- | --- |
| Anonymous unique preview root | HTTP 302 to `vercel.com/sso-api`, without a protection bypass. |
| Retained fictional owner | HTTP 200, exact existing owner identity, private/no-store. |
| Current clinic | HTTP 200, zero visits, starts disabled, trial limit 10/used 0, stable configured referral host, private/no-store. |
| Dashboard | HTTP 200, actual DripWell workspace HTML without an application-error response. |
| Clinic without app authentication | HTTP 401 `UNAUTHENTICATED`, private/no-store. |
| Existing location-bound Eve stream | HTTP 200 with seven nonempty stream lines, exercising the newly packaged server's authentication/runtime without sending a message or invoking inference. |

An over-specific private harness initially expected the unauthenticated code `UNAUTHORIZED`; the app correctly returned `UNAUTHENTICATED`. Only that assertion was corrected, and the already successful reads were retained rather than repeated. There was no source defect or application edit.

Read-only hosted SQL before and after these current smoke reads preserves both complete retained GenerationJob rows via their matching whole-row digests, status FAILED and null usage. Counts remain zero consultations, zero active configurations and zero trial-usage rows, with allowance 10 and used 0. Both the current pre-smoke and post-smoke snapshots match the retained earlier inventory. No fresh pre-deployment snapshot was taken for TASK-027, so this is an old-retained-baseline comparison plus before/after current reads, not a fabricated before/after deployment measurement.

All owned check processes ended. No hosted fixture or visit was created, no retained clinical record was mutated, no migrations were reapplied, and no model/transcription/email/billing operation, provider switch, purchase or real-data enablement occurred. The earlier 19-case archive/job/role suite was not rerun. Actual hosted recording/transcription/model success, physical devices, recipient delivery, billing/referral conversion, production schedule/retention and the complete two-clinic pilot remain unverified. TASK-028's approved local durable reminder proof remains independently runnable next.

AUDIT: TASK-027
VERDICT: PASS, exact protected source deployment and bounded reads
ATTEMPT: 1
FINDINGS: none in the bounded brief
PATTERN_VIOLATIONS: none
GOTCHA_HITS: G-007, preview cron adaptation; G-009, separate native runtime proof
PRD_AUDIT: pass, no scope change
LEARNING: no new lesson, pattern or gotcha; P-011/P-012 and existing evidence-boundary guidance apply
