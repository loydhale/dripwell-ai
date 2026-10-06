# PRD: DripWell.ai

**Version:** 2.0, consultation workflow  
**Status:** Owner-authorized v2 source implemented; release verification and live service status are recorded in [verification evidence](docs/VERIFICATION_REPORT.md)\
**Owner:** Loyd Hale  
**Updated:** 2026-10-05\
**Plan:** [Implementation plan](docs/IMPLEMENTATION_PLAN.md)  
**Previous scope:** [Archived v1 PRD](docs/archive/PRD-v1.md)

## 1. Product and purpose

DripWell is a multi-tenant PWA for IV clinics. It records a consented new-client consultation, guides staff through necessary questions, prepares recommendations from that location's approved catalog, captures staff review and actual treatment, and produces an attractive wellness takeaway. Owners can standardize consultations, understand staff adjustments, track care starts and client decisions, and improve recommendation configuration through owner-controlled review.

The primary commercial goal is to help an IV spa present and sell a suitable clinic membership or program during its new-client workflow, while improving client satisfaction. Connect reviewed goals/preferences to approved benefits, official prices and terms so staff can explain the offer clearly. Track care starts, client decisions and confirmed enrollment/purchase separately, with consultation-visit denominators, missing outcomes and suitability context. Accepting a wellness plan does not establish enrollment or collected payment; ordinary visit documentation requires no membership result. Client satisfaction remains an intended outcome; a post-visit rating stays a separate scope proposal. [Reviewed membership-conversion research](docs/MEMBERSHIP_CONVERSION_RESEARCH.md) supports the queued reporting and offer-presentation improvements without claiming measured sales lift.

Use OpenScribe as the reference for recording, transcription, and reviewed documentation. Use Vercel, AI SDK, Workflow, and eve for application and agent infrastructure. Preserve existing project instructions/context/memory conventions and use eve's documented filesystem layout. The owner's separate ICM/eve example has not yet been identified; do not claim an exact template match until verified.

This replaces v1's photo-first assessment. Patient photo signal extraction is not required; catalog/menu photos remain part of setup.

## 2. Users and authority

| Role | Responsibility |
| --- | --- |
| Clinic owner | Configure products, prices, memberships, services, staff, questions, and policies; test setup; review adjustments; approve/reject improvements; view reporting, billing, trials, referrals |
| Staff/provider | Initiate consultations, record with consent, correct summaries/answers, adjust recommendations within authority, obtain clinical approval, record actual care and decisions, approve/share takeaways |
| Client | Receive a clear explanation and approved document through controlled sharing or download |
| Platform admin | Manage clinics, subscriptions, trials, credits, operational metrics and support; no routine access to client conversations or clinic clinical-policy approval |

A location is a tenant with its own catalog, prices, policies, and consultation records. Verify tenant membership and role server-side. Clinical authorization may be narrower than ordinary staff access. Only the owner login can interact with the improvement workbench and publish configuration changes.

## 3. End-to-end workflow

1. Owner uses text, recorded voice messages, and catalog photos/files to set up the clinic.
2. Assistant asks about gaps and organizes draft products, prices, memberships, services, questions, and recommendation rules into editable settings.
3. Owner reviews, tests synthetic consultations, and activates a versioned configuration.
4. Staff initiate a consultation; its board card appears immediately.
5. Staff obtain and record consent before recording, with visible start/pause/resume/stop controls.
6. The app shows required questions and follow-ups. Transcription helps identify answers; staff verify/correct clinically relevant facts.
7. Software produces initial recommendations. Staff review, adjust, and approve the exact revision, then convey its explanation.
8. Staff record what care actually started and was provided.
9. After treatment, software produces a wellness plan and branded takeaway using the reviewed conversation, actual treatment, and approved services/memberships/prices. Staff review and approve client-facing output.
10. Staff manually record acceptance, rejection, or TBD. Reminders address missing outcomes. Archive removes cards from the active board while preserving history.

Initial recommendation, care start/treatment, wellness acceptance, membership enrollment, and collected payment are separate facts. Accepting a plan does not automatically mean care started or a membership was sold.

## 4. Feature requirements

All listed features are P0 for the complete v2 pilot unless explicitly optional.

### F-01. Conversational setup and editable settings

- Support chat, typed input, recorded voice with editable transcription, and catalog/menu image/file uploads. A continuous live voice agent is unnecessary.
- Capture products/types, ingredients/quantities where relevant, compatibility, availability, suitability/exclusions, prices/currency, services, and membership benefits/terms/pricing.
- Ask about missing ingredients, unclear OCR, conflicting prices, clinic capabilities, protocols, and approval requirements. Never invent official pricing or medical rules.
- Organize drafts into clinic, products/add-ons, services, memberships, prices, questions, and recommendation-policy settings. Owners can manually edit these later.
- Show proposed changes before saving; distinguish draft from active configuration. Setup conversation cannot silently replace active settings.
- Activation records source, version, approver, and time; support version review and rollback.

### F-02. Stable recommendation configuration and setup testing

- Prepare structured configuration from the approved catalog and validated clinical protocols. Owner approval of commercial data is not clinical validation of invented rules.
- Separate clinical suitability, contraindications, required questions, and compatible options from post-treatment membership/service matching.
- Validated rules determine eligibility and safety gates. AI structures facts and explains eligible choices; it cannot bypass rules.
- Recommendations use only available location items and approved prices/terms, with evidence and rule rationale.
- Pin configuration/catalog/price snapshot, prompt, and model versions per output. Historical visits keep their versions.
- Same structured inputs and configuration yield the same eligibility/rule results; new facts or approved configuration changes explain different results.
- Owners can test multiple synthetic consultations, inspect missing questions/rationale/prices, revise, and activate. Tests do not consume trial consultations or enter client/staff reporting.

### F-03. Consented recording and structured summary

- Create a tenant-scoped encounter ID, assigned staff, and timestamps when initiated.
- Record consent before audio capture; offer manual structured intake if recording is declined.
- Show recording duration, pause/resume/stop, permission errors, upload progress, and processing state.
- Transcribe ordered segments with visible errors and retry handling; preserve original transcript and staff-corrected revisions.
- Structure goals, symptoms, relevant history, medications, allergies, and preferences with evidence. Distinguish missing/uncertain information, reported facts, and staff observations.
- Do not invent answers or speakers. Staff verify relevant information before treatment approval.
- Persist progress server-side; reconnect/retry does not duplicate visits or trial units.
- Default to a neutral encounter identifier. Recordings/transcripts may contain identifiers and health information even without a name field.

### F-04. Questions staff can easily see

- Show concise prioritized required questions, optional follow-ups, and why they matter.
- Update answered/missing/needs-confirmation indicators as transcript segments arrive; support direct entry/correction.
- Low-confidence extraction requires confirmation. An omitted answer is not a negative answer.
- Derive requirements from active clinic rules and relevant suitability/safety concerns.
- Block final treatment approval while required information is unresolved; permit documentation or referral without a treatment recommendation.
- Audit answer corrections and preserve provenance.

### F-05. Initial recommendations and tracked staff review

- Produce a draft IV/add-on recommendation, relevant alternatives, explanation, unresolved questions, and safety flags.
- Staff can correct the summary, change/remove eligible products, and edit the explanation easily.
- Preserve original AI draft and final staff recommendation as separate revisions.
- Capture meaningful before/after changes, fields/items, staff identity, timestamp, reason category, and optional note. Require a reason for material changes.
- Reasons include client choice/budget, availability, contraindication, missing information, unsuitable AI suggestion, and staff judgment.
- Require an authorized provider's explicit approval of the exact revision before client-facing treatment guidance. Later edits invalidate approval.
- Apply clinic medical-director protocols. Chat cannot bypass contraindications; any permitted override requires the authorized clinical process and an audit record.
- Provide an explanation staff can convey: what is recommended today, relevant stated goals, why it is suitable, and its limitations.

### F-06. Actual care and commercial outcomes

- Record care started, not started, or pending separately from the wellness decision.
- Capture actual IV/add-ons/services provided, substitutions, relevant observations, and optional reasons for not starting.
- Optional fields capture confirmed membership enrollment or service purchase and known amount.
- Keep recommended, accepted, administered, enrolled, and paid distinct. Staff confirmation is not proof of payment collection.
- Corrections preserve audit history; no membership result is required to complete visit documentation.

### F-07. Post-treatment wellness plan and polished takeaway

- After actual treatment is recorded, generate a client-friendly summary and draft wellness recommendations based on reviewed facts and actual care.
- Include suitable services/memberships with approved benefits, official prices, and terms in easy-to-convey language.
- Clinical selection remains independent of sales targets, pricing, and referral incentives. Commercial matching respects suitability and client preferences.
- Staff can edit/approve the wellness plan; log changes and bind approval to its revision.
- Distinguish future suggestions from care received. Do not invent medical claims, guaranteed results, or treatment cadence.
- Render an attractive, branded, responsive, accessible document and downloadable PDF.
- Secure share links expose only the approved takeaway, require appropriate recipient verification, expire, and can be revoked. Internal transcripts/adjustments stay private.
- Show a brief sharing/download reminder: “Contains private health information. Share only with the intended recipient using your clinic's HIPAA-compliant process.”
- The reminder accompanies actual access controls. Explain that downloaded copies cannot be remotely revoked.

### F-08. Kanban, manual decisions, and archive

Labels may be polished; these meanings and triggers are required.

| Stage | Stored value | Trigger |
| --- | --- | --- |
| Consultation started | CONSULTATION_STARTED | Automatically when a consultation is successfully initiated in software |
| Initial recommendations given | INITIAL_RECOMMENDATIONS_GIVEN | Automatically when initial recommendations are produced and persisted |
| Wellness recommendations produced | WELLNESS_RECOMMENDATIONS_PRODUCED | Automatically when a wellness plan is produced and persisted |
| Wellness recommendations accepted | WELLNESS_RECOMMENDATIONS_ACCEPTED | Staff manually indicate client acceptance |
| Wellness recommendations rejected | WELLNESS_RECOMMENDATIONS_REJECTED | Staff manually indicate client rejection |
| Wellness recommendation TBD | WELLNESS_RECOMMENDATION_TBD | Staff manually indicate a pending decision |

- Cards show encounter identifier, assigned staff, dates, stage, and outstanding actions.
- Failed generation does not advance a card. Background retries cannot duplicate milestones or regress a manual decision.
- “Produced” means a saved artifact, not clinical approval. Approval/share readiness are separate metadata.
- Accepted/rejected/TBD requires a produced, approved wellness revision and explicit staff action.
- Staff can resolve TBD or correct a decision with audit history. A materially changed approved plan requires explicit reconsideration; acceptance is not inherited silently.
- Archive is a reversible actor/time/reason flag independent of stage. Preserve recommendations, adjustments, outcomes, and audit history; support search/restore.
- Archive suppresses active reminders and retains unresolved-decision markers. It is not rejection, completion, or deletion. Restore returns the saved stage and reconciles reminders.
- Log actor/system event, before/after stage, time, and artifact revision.

### F-09. Reminders and encouraging animations

- Persistent in-app notifications remind staff about missing care outcomes and absent/pending wellness decisions. Owners see overdue records.
- Owners configure timing; reconcile/cancel on decisions, archive, or reassignment. Delivery is deduplicated and rechecks current state.
- Reminders survive page closure/server restarts. Browser push is optional where supported; in-app notifications suffice. Patient SMS/email is unnecessary.
- Brief celebrations mark setup completion, complete documentation, actual care starts, and optionally confirmed enrollment.
- Respect reduced motion, dismissibility, and no repeat confetti on retries. Encourage accurate recording of every outcome.

### F-10. Owner-only human review and improvement

- Owners see adjustment patterns and concrete examples, client decisions, care starts, and optional enrollments.
- Interpret changes against suitability, exclusions, stock, client choice, and budget. Lower spending alone is not under-recommending.
- Owners classify appropriate staff corrections, inappropriate AI suggestions, missed suitable options, and catalog/question/policy problems.
- Propose evidence-backed configuration changes; test against synthetic cases before activation.
- Only owner-authorized actions review, approve/reject, publish, and roll back improvements. Clinical changes also require appropriate clinical validation.
- Preserve proposal evidence, review decisions, evaluation results, approver, and configuration versions.
- Staff corrections are evidence, not permission for automatic model retraining or policy rewriting.
- Enforce owner authority in APIs/tools/background work, not just hidden UI controls.

### F-11. Referrals, trials, and account credits

- Clinics get a link/code to refer other IV spa owners, containing no client data.
- Referred clinics receive a **14-day trial including 10 initial consultations**; show days remaining and used/remaining consultations.
- Use that allowance for ordinary trials too as a proposed default unless a separate offer is approved.
- Count a unique initial consultation once; exclude setup tests, retries, reopened records, and regeneration. Proposed start/count policies are in section 9.
- Stop new starts when time/allowance expires; already-started visits can finish. Exhaustion must not unexpectedly hide existing records.
- Award a referring clinic account credit on a qualifying paid platform subscription conversion, the working interpretation of “signs.”
- Record attribution, dates/usage, conversion, earned/applied/reversed credits, amounts, and policy version.
- Prevent self-referrals, duplicates, replayed billing events, and duplicate awards; handle refunds and admin corrections with ledger history.
- On2026-10-03 the Owner delegated initial commercial pricing. Starter platform subscription is USD199 per clinic account per month, using the existing tenant subscription without location metering. Starter referral credit is USD50 once after the first qualifying paid platform subscription, with30-day attribution, reversal on refund and no expiry. Keep credit restricted to future platform invoices with no cash payout. Publish changes through versioned platform authority, preserve historical snapshots and allow later edits. The 14-day/10-consultation trial never auto-enrolls into paid billing.

### F-12. Clinic and platform dashboards

- Clinic reporting covers new consultations, care started/not-started/pending, wellness accepted/rejected/TBD, unresolved outcomes, optional memberships/services, adjustments, and completion time.
- Make confirmed client membership enrollment visible, with enrolled/did-not-enroll/not-recorded distinct. Show the selected-period consultation-visit denominator and missing-data count; visits are not deduplicated first-time clients, and a service purchase is not automatically a program sale.
- Make denominators/date filters explicit; exclude test sessions. Archived visits remain in historical metrics unless explicitly filtered.
- Platform reporting covers clinics, subscriptions, trial utilization, referral funnel, credit liability/application, consultations, failures, latency, model/transcription costs, and support activity.
- Every generation has an addressable ID, tenant/encounter/run, versions, status, and cost. Restrict health-bearing traces separately from operational metrics.
- Sensitive support access is exceptional, time-limited, authorized, and audited.
- Platform subscription billing is separate from products/memberships clinics offer clients.

## 5. Architecture and ICM/eve conventions

| Layer | Direction |
| --- | --- |
| App | Next.js App Router PWA on Vercel; reuse a suitable B2B SaaS shell for account/team/billing/dashboard patterns |
| Agents | eve filesystem instructions/skills/typed tools/channels with authenticated tenant context; AI SDK structured generation and streaming |
| Durable work | eve owns agent conversations; Workflow owns transcription/document/reminder/billing processes; database owns business state |
| Business records | PostgreSQL and one ORM/migration system; audit/reuse existing Prisma contracts where suitable |
| Artifacts | Private scoped audio/upload/document storage, with verified service suitability and retention |
| Integrations | Discover/provision real auth, database, storage, subscription, transcription, and inference services during implementation |

Preserve root AGENTS.md, PRD.md, personas/, memory/, tasks/, templates/, and development workflows/. They contain development context, never client records.

Use apps/web/agent/ for authored eve configuration beside application code, and apps/web/evals/ beside agent/. Follow the pinned framework's instructions/, skills/, tools/, channels/, and memory/ slots. Generated .eve/ is not authored policy or business storage.

Load owner-approved immutable clinic context from the database under verified tenant/version scope. Agent memory cannot replace active policies or authorize changes. The implemented v2 runtime is Next.js with the authored eve agent and Workflow processes. Legacy Vite/Fastify sources remain references; deploying v2 requires the linked services and reviewed migrations in the plan.

**Coding requirement:** Use the open-source [Vercel Plugin](https://github.com/vercel/vercel-plugin) with the development team's coding assistant. Apply its relevant skills and current framework documentation during implementation and review. The plugin is development guidance; eve remains the application's agent runtime. Hosted Vercel Agent is not required for this workflow. Infrastructure and model usage costs remain separate.

## 6. Data handling and clinical safeguards

- Treat audio, transcripts, summaries, recommendations, and documents as sensitive health data; neutral IDs do not de-identify conversations.
- Before real client data, verify required agreements and configuration for every relevant service, including Workflow persistence, eve sessions, AI/transcription routes, storage, and traces.
- Use encryption, least privilege, owner MFA/session controls, tenant isolation, audit history, retention, and deletion.
- Cache only the public PWA shell. Do not cache client documents/API results/audio/transcripts in service workers or ordinary browser localStorage.
- Require a foreground recording gesture; handle iPad permissions/interruptions and visible upload gaps.
- Treat transcripts/uploads/memory as data, not instructions that can change roles, official prices, or policies.
- Keep health content out of general analytics, push payloads, billing metadata, URLs, and repository memory.
- Define audio/document/transcript retention, backup lifecycle, deletion, and access review. Archive does not delete.
- Recommendations are authorized-provider decision support under clinic protocols, not autonomous diagnosis or prescribing.

## 7. Non-goals

- Required patient photos, NFPE signal extraction, or photo diagnosis.
- Continuous live voice agent, telephone bot, or autonomous patient consultation.
- Automatic fine-tuning/self-modification of active clinic policies or staff publishing improvements.
- EHR/scheduling/CRM integration or automated patient SMS/email.
- Native mobile app or complete practice management.
- Collecting clinic treatment/membership payments in the platform subscription checkout.

## 8. Pilot definition of done

Verify the full story with synthetic data before real-client rollout:

1. Two isolated clinics set up different catalogs/prices, test cases, and activate versions.
2. Consented capture yields reviewed facts, visible required questions, and valid location-specific recommendations.
3. Adjustments/reasons are retained, exact-revision clinical approval gates output, and actual care is separately recorded.
4. Approved post-treatment wellness output shares/downloads securely with accurate prices.
5. All six stage triggers, decisions/corrections, reminders, archive, and restore work.
6. Owner-only proposals can be tested, activated, and rolled back without changing historical visits.
7. Trial lasts 14 days with 10 initial consultations; concurrent starts/retries cannot exceed or double-count allowance.
8. One qualifying paid referral earns one configured credit; replay cannot duplicate it.
9. Roles, services, retention/deletion, retries, and tenant boundaries pass end-to-end verification.

Pilot targets: immediate recording controls; question updates within 10 seconds of receiving a segment; initial recommendations within 15 seconds of reviewed-summary submission; wellness document within 30 seconds. Measure representative devices/providers before public promises.

Verification checkpoint, October4,2026: [the two-clinic setup audit](docs/AUDIT_TWO_CLINIC_SETUP.md) independently verifies ordinary fictional-owner inactive drafts, saved eligible/missing-answer tests, visible questions, two explicit tenant denials and exact cleanup. Its identical USD100 synthetic fixtures and inactive versions do not satisfy criterion1's different catalogs/prices and activation or the remaining full-story criteria above.

The [normal-owner MFA audit](docs/AUDIT_NORMAL_OWNER_MFA.md) additionally verifies protected fictional enrollment, one-use recovery/challenge denials, session revocation, unchanged ordinary authority and secret-free enabled UI with exact cleanup. This is a scoped security portion of criterion9, not complete roles/services/retention or pilot verification. The next maintenance work is split into bounded default-disabled DB source, actual compiled recurrence and separately reviewed Blob-intent compatibility. Every acceptance criterion and real-data gate remains unchanged.

The [bounded maintenance audit](docs/AUDIT_BOUNDED_MAINTENANCE.md) records independently reviewed default-disabled coordinator/effect fencing,17 unit checks,14 distinct composite PostgreSQL behaviors, typecheck, explicit isolated Webpack build and original-owned-target cleanup. Native starts are mocked in source tests; actual compiled recurrence TASK048, hosted enablement and deferred Blob families remain separate. This scoped checkpoint does not satisfy the full service/retention criterion or change any pilot criterion above.

The [compiled recurrence audit](docs/AUDIT_COMPILED_MAINTENANCE_RECURRENCE.md) additionally verifies local native timer recurrence, first-item recovery/current-state reminder effects, stop fencing and exact owned terminal cleanup on source3203f614. Three waits/two natural successors and full shared-data preservation are scoped service evidence; hosted cadence, deferred Blob/provider families and the complete pilot remain separate. All nine acceptance criteria above are unchanged.

The [client membership reporting audit](docs/AUDIT_MEMBERSHIP_REPORTING.md) records the complete-cohort true/false/unknown partition, explicit consultation and recorded-outcome denominators, both primary displays and scoped source/check/build evidence. Twelve distinct affected cases use retained11 plus corrected1, with eleven deliberate focused exclusions and the original assertion failure preserved. Mocked SQL transport and static markup do not establish live enrollment, payment, browser/device or full-pilot evidence. All nine acceptance criteria above remain unchanged.

The [approved wellness offers audit](docs/AUDIT_APPROVED_WELLNESS_OFFERS.md) records approved immutable benefits/matched reviewed goals in wellness v2.2/public takeaway2, truthful generation provenance, unchanged initial/care v2.1 and historical v1 raw hashes, tracked edits/reapproval and matching staff/share/PDF facts. Eighteen distinct affected identities use retained15 plus separately passed legacy and valid-eligibility cases and one shared-domain case; original failures and deliberate focused exclusions remain preserved. Three saved synthetic PDF text checks, types and explicit-production Webpack packaging passed. Mocked transport/static/text evidence does not establish live approval/delivery/browser/device/paid behavior or complete the pilot. All nine acceptance criteria above remain unchanged.

The [recording consumer audit](docs/AUDIT_RECORDING_CONSUMER_SAFETY.md) records scoped immutable private-read/post-provider publication guards, dedicated non-AI setup settlement and queue-only cleanup, with DB-only known-P2034 bounded publication retries. Actual reviewed source1d32 and ordinary fresh-PG17 CI37376530466 passed both builds/types and all25 consumer cases within212 tests. Passing source-bound owned hooks and injected provider controls do not prove live inference, physical conditional deletion, hosted retention or full-pilot readiness. Both complete Blob families are now integrated in scoped TASK053 source/CI below; the [count30 scope check](docs/PRD_DRIFT_CHECK_030.md) preserves all nine criteria above.

The [recording cleanup pages audit](docs/AUDIT_RECORDING_CLEANUP_PAGES.md) records accepted immutable-provenance fixed5+5 upload/retention pages, original full-URL/exact-ETag conditional adapter, current-token/deadline and atomic non-AI progress fencing, and complete eight-page iteration evidence. Reviewed sourcefa4 and its first ordinary fresh-PG17 PR CI37390452897 passed both builds/types/migrations and230 tests in18 files, including all18 new cleanup identities and17 retained context controls as subsets. Source-bound owned hooks and injected I/O support scoped source/CI completion/count31; physical conditional deletion/uncached absence, hosted migration/explicit enablement/cadence and the full two-clinic story remain gates. SDK internal retries/cooperative abort and the nonisolated provenance-index duplicate assertion remain explicit limits. Maintenance stays default-disabled and all nine criteria above remain unchanged.

The [trusted-store binding audit](docs/AUDIT_RECORDING_STORE_BINDING.md) records accepted source58b and first ordinary fresh-PG17 PR CI37397578008, with all22 stages and236 tests in18 files passing. Six new and20 retained consumer/delete identities are subsets in two13-test passing files. ASCII-before-fold comparison preserves original opaque credentials, immutable URL/ETag and existing authority/deadline fences. Scoped source/CI completion advances count32 once; injected I/O does not establish current real SDK authorization, physical deletion/uncached absence, hosted enablement or the full pilot. TASK055 plans the separately owned compiled/live storage proof; maintenance remains default-disabled and all nine criteria above remain unchanged.

The [compiled private Blob proof](docs/AUDIT_COMPILED_BLOB_PROOF.md) records TASK055 actual default selected SDK verification at source58b, independently PASS03b6ba41 and accepted1706f03b. Wrong-ETag original preservation, original conditional deletion/private uncached subject absence with control intact before compensation, and original-only control cleanup/absence were observed in15 logical calls with pending0/obligations0/dispatcherclosed. Scopedcount33/Seen5 does not complete hosted maintenance, clinical ownership, whole retention or criterion9. Source CI was not replayed; maintenance stays default-disabled, protected807/literalfalse and all nine criteria remain held. Isolated provenance-index attribution is approved next verification work.

The [isolated provenance-index test](docs/AUDIT_RECORDING_PROVENANCE_INDEX.md) adds one existing F03/criterion9 coverage case with exact PostgreSQL error-column attribution and a positive distinct-provenance control. This is an authored source checkpoint; changed-source CI and actual outcome/learning review remain unexecuted. All12 feature requirements and all nine pilot criteria remain unchanged.

## 9. Explicit defaults and open decisions

| Topic | Default or decision needed |
| --- | --- |
| Exact ICM example | Preserve observed root context/memory conventions and verified eve layout; compare the owner's separate example before scaffolding |
| Trial activation/counting | Implemented default: owner registration activates the 14-day trial; reserve/count a successfully initiated unique initial consultation transactionally; failed initiation is not charged; tests/retries never count |
| Trial exhaustion | Implemented default: whichever occurs first, 14 days or 10 initial consultations; finish already-started visits |
| Platform subscription | Owner-delegated starter: USD199 per clinic account/month, existing quantity1; canonical editable configuration and a matching real Stripe recurring price are required. No real customer charge is authorized by starter configuration |
| Referral credit | Owner-delegated starter: USD50 once after first qualifying paid platform subscription,30-day attribution, refund reverses credit, no expiry, future platform invoice credit/no cash payout; explicit versioned activation preserves prior snapshots |
| Catalog/clinical configuration | Owner supplies actual prices/terms/protocols; missing data stays incomplete; clinical rules need appropriate validation |
| Services/framework versions | Pinned Next.js 16.3.8, eve 0.69.0, AI SDK 7.0.127, Workflow 5.0.1 and Prisma 6.19.3; database-backed opaque sessions/MFA, private Blob, Gateway transcription/inference, Stripe and Resend. Actual service provisioning remains required |
| Reminders/retention/sharing | Owner configuration controls timing/retention; sharing uses intended-recipient email verification, bounded expiry and revocation. Confirm clinic settings and service eligibility before real-data sharing |

The Owner's2026-10-03 delegation authorizes the starter commercial choices above. Clinic catalog prices and clinical protocols remain actual owner/provider data; this delegation does not authorize inventing those facts, buying services or changing clinical authority.

## 10. Scope governance

The owner explicitly requested this consultation-centered rewrite, Vercel infrastructure, ICM/eve structure, exact Kanban triggers, and 14-day/10-consultation trial, then authorized finishing the software and delegated initial commercial pricing. Implementation follows that scope. The verification report distinguishes implemented source, synthetic checks and live deployment; publishing starter configuration does not establish actual billing, referral conversion or full-pilot evidence.

Record minor clarifications with review. New scope and active clinic-rule changes require owner decisions/version history. Keep development memory separate from the product's owner-controlled improvement process.
