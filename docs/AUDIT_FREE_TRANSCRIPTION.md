# TASK-033 independent setup transcription audit

AUDIT: TASK-033
VERDICT: PASS, bounded actual API upload/transcription fallback
ATTEMPT: 1
PRD_AUDIT: pass, F-01/F-03 evidence is scoped; PRD section 8 remains incomplete.

The independent Auditor verified the retained actual operation and cleanup without repeating an upload, model request, balance check, deployment, migration or passing source suite. The continuation's connected managed runtime129 and real shell/Git access were confirmed. Application source remains reviewed `b61f6aa`, protected preview `dpl_232QhM74EuWYYnq1vSfAEaqNDo57`, with `ALLOW_REAL_CLIENT_DATA=false`.

## Actual operation

The existing fictional owner, selected location and bound setup conversation were used. Fresh selected-account metadata at21:53:20 to21:53:21 UTC returned HTTP200 from AI7 `gateway.getCredits()`, with balance `4.99956995` USD and total used `0.00045665`. That response does not expose free-versus-paid provenance or establish hosted execution. Normally minted same-project development OIDC was validated separately; its temporary raw environment profile was deleted and only OIDC was selected. No credits were purchased or provider/model changed.

The owned offline fixture used installed ffmpeg/libflite, with nonclinical text: “This is a synthetic DripWell setup transcription check. No client information is included.” Its actual WAV is203534 bytes, SHA256 `70c20611c6c4a6087e15360b879575b9d48546790464f34b52ef1b469da85e4f`, mono16kHz PCM16,6.358 seconds. The resumed Auditor independently checked the file bytes and WAV framing. It is synthetic speech, not a physical microphone recording.

One normal protected CLI API request to `/api/setup/upload`, `purpose=voice` and consent=true, ran at22:18:43.850 to22:18:49.817 UTC and returned202. No manual retry or duplicate kickoff occurred. It created job `9b35bdeb-cd5c-4d4a-a17f-71e2d7c3d068`, kind `SETUP_TRANSCRIPTION`, selected model `openai/gpt-4o-transcribe`, prompt `setup-upload-v2.1`. It completed at22:18:53.719 UTC. The unchanged source finishes this branch without calling the denied language-model summary or setup chat.

The actual hosted Workflow run `wrun_41M3ZB5NDY0GTJTEF2RMMQS9XT` identifies the selected team/project, `preview` environment and exact protected deployment. Its status is completed. The supported retained run/step reads show one completed `processRecordingJob` step, attempt1, with no remaining step page. This measures a Workflow attempt, not the number of external SDK/provider transmissions. Installed AI7 defaults to two retries and Workflow5 to three step retries; neither setting was changed and no exact monetary cap is claimed.

The authenticated addressable job GET returned200 at22:25:31 to22:25:37 UTC. Its saved result matches the durable job and recording transcript exactly:

> This is a synthetic well-set-up transcription here; no client information is included.

The wording is recognizable but misrecognizes part of the source. `needsReview=true` and `speakerAttribution=UNKNOWN` remain intact. The job has a real usage object, but transcription duration, provider usage, estimated cost and measured cost are all null. WAV duration is fixture evidence, not a provider-duration measurement. Cost reporting and accurate staff review remain separate verification boundaries.

## Native browser limit and preserved controls

The earlier owned native-browser attempt reached Vercel login before recording or upload. [TASK-035's reviewed diagnosis](NATIVE_PREVIEW_ACCESS.md) proves that its trusted header appeared only inside a stdin batch row; agent-browser0.38.1 parses those navigation headers from outer CLI flags. The header was therefore omitted. The redirect is a harness failure, not demonstrated account/rule denial. This task proves real API upload and transcription. Native hosted capture and real editable-composer rendering remain unverified; no callback, transcript or UI state was injected to claim them.

Independent offline comparison confirms the fresh baseline and immediately-before-upload snapshot match. After compensation, both historical FAILED/null-usage jobs have the same whole-row digests and all12 captured controls match: Tenant, User, Location, SetupConversation, Subscription, AuthSession, ClinicConfigurationVersion, Consultation, TrialUsage, Notification, AuditLog and RecordingSegment excluding only the new owned recording. Consultation/active-configuration/trial-usage counts remain0; allowance10, used0. The unchanged conversation is also compared directly. This is the captured scope, not every database table.

The expected setup-upload rate bucket has count1. No unrelated-rate before-baseline was captured, so preservation of all unrelated rate rows is not claimed.

## Exact cleanup and retained result

Recording `6393042b-18ce-481f-b0ff-64834c01a220` is bound to the returned job, retained owner, tenant, location and conversation. After actual run completion, an authenticated `useCache:false` read returned its exact203534-byte fixture from the already-selected private Blob store. Only its returned owned pathname was deleted. A second uncached read established404/absence at22:26:43.844 UTC, before metadata compensation.

A conditional selected-Neon update at22:27:37 to22:27:38 UTC changed exactly one owned row to EXPIRED and cleared its deleted pathname. Only status, blobPath and updatedAt changed; actual transcript, whole completed job, result, usage and conversation remain identical. This is operator compensation of a synthetic test, not a demonstrated application discard endpoint. The expired recording and completed addressable job are intentionally retained, with zero live owned upload path. No global cron, historical-job edit, shared-target sweep or migration occurred.

The original owned browser was closed. A resumed local session-list check at23:18:07 UTC reports no browser sessions. Temporary raw profiles are absent. Only TASK-033's copied private application cookie jar was removed; the original retained selector was preserved. No credential contents were output or included in publication. Evidence remains outside Git in private0700 directories with0600 files.

FINDINGS: no blocking defect in this bounded fallback operation. Native capture/composer, language-model recommendations, cost visibility, two-clinic pilot, health-data eligibility and production rollout remain open.
PATTERN_VIOLATIONS: none.
GOTCHA_HITS: G-008/G-010; preserved default retry boundaries.
LEARNING: P-018, preserve addressable provider evidence while compensating only owned synthetic audio. Original TASK-032 frozen audit/learning bytes remain immutable.
