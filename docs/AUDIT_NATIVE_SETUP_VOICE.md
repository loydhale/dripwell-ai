# TASK-036 independent native setup voice audit

AUDIT: TASK-036
VERDICT: PASS, bounded protected native owner setup flow
ATTEMPT: 1
PRD_AUDIT: pass, F-01/F-03 evidence is scoped; the full pilot remains unverified.

The independent Auditor executed the separately reviewed brief after explicit CTO dispatch, using current connected managed runtime 130 and real shell/Git access. Mandatory Vercel Plugin browser, verification, AI SDK, Gateway, CLI, environment and storage guidance plus installed browser 0.38.1, CLI 62.1, AI SDK 7 and Workflow 5 documentation were used. No application, dependency, migration, deployed source, protection rule or selected model changed. The actual protected deployment remains `dpl_232QhM74EuWYYnq1vSfAEaqNDo57`, source `b61f6aa`, with `ALLOW_REAL_CLIENT_DATA=false`.

## Corrected access and native capture

One supported normal `project token dripwell-ai --scope loyd-1222s-projects --non-interactive` mint supplied same-project development OIDC. Issuer, audience, team/project and current validity were checked; token/header values stayed in memory. No environment profile was pulled or unrelated credential selected. The original retained fictional application cookie was staged through supported controls in a new ephemeral browser, without a profile or restore.

One standalone outer `open ... --headers ...` reached the actual DripWell preview `/setup` at 23:32:08 UTC. After normal hydration, the actual owner/location/conversation, consent checkbox and editable composer were visible. This establishes the corrected browser access that TASK-033 did not test. There was no denied-navigation retry, global header, static bypass, protection write or account upgrade.

The real UI initially disabled Record voice message until consent was checked. The Auditor checked it, used the actual foreground Record voice message control and stopped once with Stop & save. Native getUserMedia observed active user activation, one native MediaRecorder and one nonempty data chunk. Chromium used the already-owned offline libflite WAV as a synthetic fake microphone, not a physical device. Observational wrappers delegated unchanged native recording and fetch calls; no response, callback, transcript or application state was mocked.

Actual native capture ran from 23:34:06.281 to 23:34:13.685 UTC, 7.4038 seconds, before rollover. The browser uploaded one actual File, 60560 bytes, MIME `audio/webm;codecs=opus`, SHA256 `1f040cf0589a3ff98f2e5905d3c9c94c7845f0d25593a6b0d76f8bbfd3a816a3`. Independent local ffprobe identifies mono 48kHz Opus, 7.38 seconds. The API intentionally normalizes persisted MIME to `audio/webm`. The microphone track ended after stop; no capture error was observed.

## Real upload, provider result and editable review

The actual application made exactly one POST to `/api/setup/upload`, purpose=voice, consent=true, with the retained selected owner/location/conversation. It returned HTTP 202 and created job `07c64f20-21b9-4936-96fb-dab1325bf23e`, kind `SETUP_TRANSCRIPTION`, model `openai/gpt-4o-transcribe`, prompt `setup-upload-v2.1`. Its actual durable status is COMPLETE at 23:34:21.250 UTC.

The actual hosted run `wrun_41M3ZFFVTW0GR13YXWQW5Q652X` identifies the selected team/project, preview environment and exact protected deployment. It completed at 23:34:21.476 UTC. Supported retained run/step reads show one completed processRecordingJob step, attempt 1, with no remaining step page. SDK/provider transmission count is not exposed; default bounded AI SDK 7/Workflow 5 retries were unchanged. No exact spend cap or one-transmission claim is made.

The application's real completed-job callback populated the composer with the exact saved result:

> This is a synthetic drivel set up from scratch.

This is an inaccurate, partial transcription of the fixture. It does not establish transcription accuracy or clinical readiness. The saved artifact correctly retains `needsReview=true` and `speakerAttribution=UNKNOWN`. Provider usage, provider duration, estimated cost and measured cost remain null. Browser/ffprobe duration is separately measured capture evidence, not provider telemetry. Installed SDK/source contracts accept optional provider fields; this result does not prove an application defect or justify inventing values.

The actual UI displayed “Your voice message is transcribed below. Review it, then send it to the setup assistant.” Using the real textarea control, the Auditor corrected the text to the original synthetic sentence and verified the edited composer plus enabled Send button. Send was never clicked: observed setup-chat POSTs 0, voice-upload POSTs 1, recorders 1, manual retries 0. The durable original transcript remains unchanged. Screenshots confirm the actual visible review/edit state; the typed correction is not a seeded provider response or clinical approval.

## Preservation and exact cleanup

A fresh pre-operation baseline captured the three prior whole-job digests, TASK-033's exact expired recording, 12 relevant model/owner controls, zero consultation/active-configuration/trial-use state, the exact upload-rate bucket and all unrelated rate-row digests. Immediately-before-capture comparisons matched. Final comparisons at 23:43:12 UTC preserve all three prior jobs, the prior expired recording, all 12 captured controls and all unrelated rate rows. The sole expected upload key resets its expired one-hour window to count 1; this is consistent with the authored limiter. Allowance 10 and used 0 remain unchanged.

The returned new recording `1c0ec521-3794-4992-9571-7412dbf8d316` is bound to the actual job, retained owner/tenant/location/conversation and exact native-upload bytes. After actual run completion, authenticated `useCache:false` Blob reads matched the 60560-byte native File and hash. Only that recording's exact selected-store pathname was deleted; uncached absence was established before one conditional selected-Neon EXPIRED/path-empty update. Only status, blobPath and updatedAt changed. The actual transcript, whole completed job/result/usage and conversation are preserved.

Two expired synthetic recordings and their two completed addressable transcription jobs intentionally remain alongside the two historical failed jobs, four jobs total. No owned live audio pathname remains. This is operator compensation of synthetic verification, not an application discard or scheduled-retention PASS. No old job, unrelated row, shared target, global cron or migration was altered.

The owned browser was closed and subsequent local session-list evidence confirms no sessions; the native track had already ended. Token/header values were never persisted, no raw secret profile was created, and the original application cookie selector remains intact. Private evidence is outside Git, 0700 directory/0600 files. Verification-only guards were corrected for the actual reviewedSourceCommit key, authored MIME normalization and an adapted helper alias before any corresponding write; they caused no additional recording, provider call or application edit. Original TASK-033/TASK-035 evidence and frozen document/learning snapshots remain intact.

FINDINGS: no blocking defect in this bounded native transport/callback/edit flow. Transcript accuracy, measured cost visibility, physical iPad/Safari capture, ordinary consultation summaries/recommendations, two clinics and production eligibility remain unverified.
PATTERN_VIOLATIONS: none.
GOTCHA_HITS: G-008/G-012; P-018 exact compensation/addressability applies.
LEARNING: no new learning; existing P-014/P-017/P-018 and L-031/G-012 govern this verification. No new source repair or justified unchanged-suite rerun was identified.

Remaining execution gates are supported language-model access preserving the subscription preference, actual human Stripe/Resend terms/account completion, sender/DNS/owned-recipient setup, official platform/referral policy, supported hosted reminder/recovery cadence, selected administrator/MFA, service/retention eligibility and the full PRD section 8 story. Successful setup transcription does not grant Luna access or complete those gates.
