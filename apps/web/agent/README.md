# DripWell owner setup agent

This authored Eve agent is used by `/api/setup`. `channels/eve.ts` verifies the
application session and binds every session continuation, control request, and
stream to the current owner's durable `SetupConversation` and selected active
location. Legacy unbound conversations and raw session creation without a
validated conversation context are rejected. The separate Eve
home/debug page is disabled. Ambient coding, shell, filesystem, network, and
subagent tools are disabled with `defaultTools: false`; only approved
configuration reads, draft proposals, and the catalog intake skill are exposed.

The assistant proposes catalog data and questions. It cannot activate clinical
configuration. Read-only memory is reconstructed from approved, tenant-scoped
database configuration. Publishing, clinical validation, and synthetic tests
use the separate owner settings flow.

Verified installed documentation: Eve 0.69.0, Workflow 5.0.1, AI SDK 7.0.127,
AI Gateway 4.0.103, and Vercel Blob 2.8.0. `eve build` compiles this folder into
ignored `.eve/` and `.output/` artifacts. The Next configuration composes
`withEve(withWorkflow(...))`. The production agent is a separate Eve service
behind the application's same-origin routing.

## Processing and readiness

- Set `DATABASE_URL`, application authentication secrets, and `APP_URL` for the
  intended environment. Use an authenticated, active clinic owner for setup.
- Connect AI Gateway using its API key or Vercel OIDC. Defaults verified in the
  live Gateway catalog on October 1, 2026 are `openai/gpt-6-luna` for text and
  catalog extraction and `openai/gpt-4o-transcribe` for audio. Override using
  `AI_MODEL` and `TRANSCRIPTION_MODEL` only with a suitable approved route.
  Gateway natively supports transcription; a second OpenAI key is unnecessary.
- Connect a private Vercel Blob store with `BLOB_READ_WRITE_TOKEN`. Audio and
  catalog files are never returned as public URLs. Files are capped at 3.5 MB;
  consultation recording uses independently playable short segments.
- Provision Eve/Workflow durable execution and its default sandbox template.
  Disabling ambient tools does not remove the framework's sandbox artifact.
- Set `CRON_SECRET` for the machine-only `/api/jobs/reconcile` control interface.
  Authenticated GET reports state without starting work; the existing Cron entry
  therefore cannot bootstrap maintenance. Explicit POST controls reserve a
  manual run or opt into the default-disabled durable database coordinator.
  Its six finite pages reconcile outcome reminders, mark interrupted database
  upload/job starts, and expire old authentication/rate records. Native Workflow
  sleep and an immutable-deployment continuation define the requested 15-minute
  cadence. Source/build tests do not prove actual recurring execution. See
  [database maintenance](../workflows/MAINTENANCE.md) for bounds and recovery.
  Blob upload compensation and audio retention remain deferred to their separate
  fenced provider work; this coordinator does not delete remote audio.
- Enable real client data only after the deployment's approved clinical
  protocols, required processing agreements, service configuration, and
  readiness checks are complete. Environment configuration alone is not proof
  that a model or storage route is approved for health data.

Missing model or private storage credentials return an explicit unavailable
response. No generated example data or transcript is substituted. A failed
transcription retains its private file and job for retry until retention expiry.
Accepting new consultation audio immediately invalidates prior approvals and
sharing before the file transfer; unresolved evidence blocks downstream care
and approval. Deliberate discard requires a tracked staff reason, cancels its
processing, and still requires review and regenerated approval.
Each private upload attempt uses an immutable unique path and an independent
durable cleanup pointer. Adoption and cleanup lock the recording and then its
upload job; an adopted object cannot be deleted by stale compensation. A late
discarded upload is deleted after its response, deletion failures retain the
pointer. Dedicated compensation paths are preserved; automatic global Blob
cleanup is deferred until its provider fencing is reviewed. The
Blob 2.8.0 installed API documents private access, overwrite prevention, and
abort signals; requests have a 45-second upload limit under the 60-second route.
Workflow payloads and results contain IDs only; provider errors are sanitized
before durable logs. Transcript, summary, source evidence, and review artifacts
remain in the application database. Staff corrections invalidate approval and
sharing. Summary output never marks AI answers as confirmed or fills absent
medical history with negative answers.

Every provider operation has an addressable `GenerationJob` with model and
prompt version. Transcription and summary are separate metered jobs. Successful
summary artifacts are cached before applying them so retries reuse the exact
output. Measured Gateway cost remains nullable when unavailable; catalog-based
estimates are labeled separately.

The synthetic extraction/audio/cost evaluations run with `pnpm test:ai` from
`apps/web`. Real model transcription and private Blob processing require the
provisioned services and should be verified with consented synthetic content
before a clinic handles real client recordings.
