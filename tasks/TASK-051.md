# TASK-051: Durable recording deletion and adoption safeguards

TASK_ID: TASK-051
STATUS: READ_ONLY_PLANNING. TASK050 actual corrected-source CI closure is independently PASSbcf6fc6c, Root accepted92f56851, scoped count28. No TASK051 source or execution authority yet.
PARENT_REQUEST: Owner-authorized completion; saved deferred recording Blob-intent/adoption/post-provider bookkeeping/metrics queue, PRD section6 and section8 criterion9, with existing maintenance/reminders F09.

## Goal

Make recording-object deletion durable and tied to its original tenant/path/upload identity so retries cannot delete a later recording, with recoverable current-generation bookkeeping after provider completion.

## First bounded deliverable

Same Coder reads the latest boot files, actual source6710ed7e and relevant downloaded Vercel Plugin0.53.0/3b472643 storage/Workflow/verification guidance plus installed version-matched APIs. Identify the smallest compatible internal durable intent representation and precise source split, then a meaningful affected validation plan. Same Auditor assesses the concrete plan before separate Root source GO. Planning is read-only; no app/test/helper/index/SQL/provider/native/build/check operation.

The saved private scope draftbe941560 and genuine parked design review0e88b1cd are planning references, not execution approval. Recheck their historical source observations against current code. Consider a dedicated non-AI record rather than GenerationJob reuse; any reuse needs explicit ownership/public-polling/model/failure/latency exclusions. Use the existing Prisma ORM/migration system. Split foundation and bounded-family integration into smaller separately reviewed tasks if necessary; do not partially enable an unsafe provider family.

## Required behavior for the approved split

- Authenticate trusted maintenance context before any coordinator/domain write. Preserve coordinator, recording, upload-job lock order without an inverse acquisition.
- In one transaction, recheck expiry/adoption/pending-upload state, commit immutable exact tenant/path/recording/upload/object deletion identity and detach its pointer. Upload/read/setup paths must reject late adoption or reuse after committed detachment.
- Consultation uploads have per-attempt UUID paths; setup uses fresh internal recording UUIDs. Validate canonical scope and non-reuse. Legacy, reusable or ambiguous identity fails closed and is explicitly deferred.
- Provider deletion uses only a committed intent and retries that same immutable object. Stop/takeover prevents new claims/intents; a previously committed detached deletion may finish physically afterward. Do not promise instant cancellation.
- Fence post-provider success/error/completion/cursor/metrics writes with the appropriate current generation and immutable identity. Preserve physical deletion versus pending bookkeeping and recover without stale-worker writes.
- Provider-family integration takes one finite five-item upload-cleanup page and one five-item retention-intent page per ordinal, with stable immutable-key sweep ceilings/cursors, advancement past pending/failures and fairness. No fill-until-empty loop or historical job replay.
- Keep current six DB families/default-disabled/manual-scheduled exclusion unchanged, explicitly report deferred families, and never launch on import/build/deploy. Preserve protected Preview and literal ALLOW_REAL_CLIENT_DATA=false.

## Meaningful validation to plan

Cover transactional detachment/rollback, adoption races, late upload completion, canonical tenant/path isolation and reuse denial; stop before/after intent and stale takeover; provider success/error with fenced bookkeeping; identical-path retries; finite fair pages and non-AI metrics/polling boundaries. Source tests fake provider I/O and state that limit.

Prefer new affected pure/mock and actual PostgreSQL cases in the unchanged normal automatic CI workflow's fresh disposable database when sufficient. No bespoke private runtime scaffolding or local passing corpus replay. If a local owned target or another operation is genuinely needed, freeze its concrete ownership/source/selection plan, get independent PASS and separate Root once-GO first. New additive migration may run only through a separately reviewed fresh target/normal new-source CI; no reviewed migration is reapplied to old shared/hosted data. Preserve shared and hosted baselines and original closed-task evidence.

Useful memory: L022 upload/discard race, L023 actual Prisma lock behavior, L027 disposable CI guard, L035 strict persisted contracts, L037 native selection/reporter; P015 global-maintenance isolation, P016 actual physical retention evidence, P026 recurrence limits; G019 typed evidence, G020 genuine Root operator authority, G021 output ownership, G022 build separation, G023 hydrated native errors.

## Closure and limits

Same Coder implements only after concrete plan review/Root GO. Same Auditor reviews source, actual meaningful evidence and learning. Root updates STATE/CHANGELOG and publishes only reviewed changes normally to the same branch/PR2, then requires genuine new-source CI closure. Actual compiled provider operations, hosted migrations/launch/cadence, clinical/service eligibility and the complete two-clinic pilot remain separate.

No provider purchase/switch, personal-subscription pooling, Vercel upgrade, partner application, unselected administrator/clinical-authority bootstrap, email/message or real client data. No new feature, price, rating/video product scope or full-retention/full-pilot completion claim.
