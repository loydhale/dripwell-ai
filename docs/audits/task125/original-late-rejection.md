AUDIT: TASK124_NATIVE_ROLLOVER_UNMOUNT
VERDICT: CHANGES_REQUIRED
ATTEMPT: current independent narrow source rejection
Original total until: 2026-10-13T22:15:00+00:00. No renewal.

Story: the frozen private verifier observes original automatic rollover, clicks the labelled fixture-only React unmount, then observes final drain and quiescence. This is source analysis only, not executed native evidence.

Blocking finding: adapter.mjs:1093 applies ownData(last.recorder, ...) unconditionally whenever last is OBSERVED. ownData at660 rejects null. This is incompatible with the collector's valid post-unmount candidate.

Producer and caller evidence:
- fixture.tsx:260 explicitly sets mountedVisit=false and setShowVisit(false) for the labelled fixture action.
- adapter.mjs:1062-1076 selects UNMOUNTED without mounted panels, requires zero recorder rows, initializes recorder=null and returns that value with the actual proof.
- adapter.mjs:1382-1385 calls waitRecorder for native-unmounted-drained and native-quiescent. The drain predicate explicitly requires v.recorder===null; both phases are admitted by readinessFailureValue at1083.
- deliverRecorderPredicate at1081 assigns cache.last=current.value before calling the predicate. waitRecorder at1165-1180 retains that last delivered candidate on timeout or other failure and rethrows the original error through retainRecorderReadinessFailure.
- readinessFailureValue at1087-1096 validates the observed proof/forward, but rejects the valid null recorder at1093 before copying native or proof fields into its receipt value. capture at1111-1115 seals the original primary, catches this rejection and yields only FAILED/READINESS_RECEIPT_REJECTED; no readiness receipt is persisted. retainRecorderReadinessFailure at1119-1122 returns the original error. Primary is preserved, observed diagnostic fields are lost.
- supervisor.py:392-399 admits both phases but requires every OBSERVED UI flag to be bool; merely allowing null in the producer would also violate the parent contract. Its diagnostic receiver at631-639 accepts the secondary rejection envelope. Normal final-state parent validation at669 accepts unmounted recorder=None.

Required repair: represent observed recorder absence explicitly in the shared readiness producer/serializer/parent contract while retaining observed native and proof fields. Preserve UNKNOWN for an unavailable candidate, strict descriptor/accessor rejection, first-primary sealing, exclusive persistence and bounded data. Independently review the changed shared contract before any execution.

Stop: first confirmed broken boundary, observed post-unmount candidate to readiness-failure serialization. Remaining source paths, command safety, compiled/loaded inputs, installed framework API usage, cleanup implementation and all runtime/browser/provider behavior are UNREVIEWED here. This is no full source PASS and no execution authority. Native grant/once remain absent, executions zero. Prior source-command GO is not upgraded by this rejection.

Count52/Seen and all nine PRD section8 criteria remain open. Protected previews/requested ALLOW_REAL_CLIENT_DATA=false/default-disabled maintenance, provider/sender/admin/payment/retention holds, permanent057/oldSQL, old122 unfinished goal and all old closed onces remain unchanged. No code, Git, memory or proposal was edited.

Guidance: AGENTS.md/personas/AUDITOR.md and scoped boot/PRD/memory/CONTINUOUS_MODE context; connector Vercel verification skill skill://plugin_connector_690a90ec05c881918afb6a55dc9bbaa1/verification/SKILL.md, first broken boundary stop rule. No imports, parsers, checks, compiler, native/browser/permission/provider/API/SQL operation or source edit was performed.
