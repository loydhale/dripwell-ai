# TASK-072: Clickable consultation GUI prototype

TASK_ID: TASK-072
TITLE: Reviewable board and visit presentation
PARENT_REQUEST: Owner says the current frontend is confusing, asks how to convert the desired GUI, supplies Vercel/Once UI/Linear-style references, and authorizes continued in-scope work. The saved [GUI conversion plan](../docs/GUI_CONVERSION_PLAN.md) calls for a two-screen prototype upon receiving references. A final application layout has not been selected.

GOAL: Give the Owner an original, self-contained clickable consultation-board and visit prototype that makes the staff's next action clear while preserving the approved workflow distinctions.

## Scope

In scope:
- One original HTML/CSS/JavaScript presentation artifact, `docs/prototypes/dripwell-gui/index.html`, with no dependencies or external assets. Use the supplied references as design inspiration, without claiming visual fidelity or template adoption.
- Fictional sample visits in two explicitly synthetic clinics. Never invent clinic catalogs, prices, clinical recommendations, reviewer identities, account authority or live results.
- Board first, a clear start/resume action, all six approved stage meanings, separate archive and overdue reminder indicators, sample filters, and a route back from a visit.
- Five visit navigation steps: consent/capture, facts/questions, recommendation/approval, actual care, wellness/sharing. Navigation must not mutate a board stage, grant approval, mark treatment, record a sale or imply delivery.
- Disabled operational controls with brief visible reasons. A separate prototype scenario selector may show empty/loading/blocked or fictional approved/revision-changed states. It must be visibly a preview control, not a clinical action.
- Responsive and keyboard-friendly interactions. Keep the normal staff presentation simple; setup/insights and platform administration are not additional prototype screens.
- Meaningful checks only for this new artifact: actual browser navigation, filtering, empty/loading/blocked states, distinct approval/care/revision states, back navigation, desktop/tablet/mobile layout, keyboard focus, page errors and local-only page traffic. Capture useful screenshots and bounded native receipts in a new private task directory.

Out of scope:
- Editing/importing/executing `apps/web`, application tests/build/typechecks, Prisma generation, SQL, migrations, retained targets, old process/session inventory, cleanup or disposal. Preserve ICM and authored `apps/web/agent` and `apps/web/workflows`.
- TASK057's permanent release lane or TASK066's retained local-effect lane. This prototype is a distinct file and fresh anonymous browser session, not a fourth attempt, replacement acceptance check or repair of either hold.
- AI/transcription/camera/microphone/storage/email/PDF/payment calls, new providers/credits, packages, factory activation, production UI selection, new roles, real client data or deployment.
- Live catalog prices, clinical protocols, silently selected administrator, external messages or account/DNS/environment writes. Protected previews and requested ALLOW_REAL_CLIENT_DATA=false remain unchanged; effective hosted values and current deployed source remain unverified.

## Workflow contract

Preserve the PRD's exact board meanings: consultation started after successful initialization; initial recommendations given after the initial artifact is saved; wellness recommendations produced after its artifact is saved; wellness accepted/rejected/TBD through the separate authorized staff decision. Produced is not approved. Material edits invalidate approval of an exact revision. Recommendation, actual care, wellness decision, confirmed purchase/enrollment and collected payment are separate facts. Archive is reversible and separate from the six stages. Prototype selections are fictional views of these states, never application mutations or evidence of any PRD section8 criterion.

## Roles, guidance and resource boundary

CTO plans and maintains STATE; one Coder writes the artifact; an independent Auditor reviews it, actual verification results and later learning before publication. The seven existing60-minute service/gate clocks and application source count42 remain unchanged by this standalone design artifact, subject to independent admission review. No new completion criterion or PRD architecture change is proposed.

Mandatory open-source Vercel Plugin guidance is available through connector skills and the already-pinned local0.53.0 reference at3b472643cbb1a42479d99b0c9a1d27b8bc84aaa7. Root applied the connector `vercel:verification` skill, including the actual story and evidence boundaries. Coder/Auditor read it themselves. No new plugin install or hosted Vercel Agent activation is claimed. For this standalone HTML task, no framework API is chosen. Existing cached agent-browser0.38.1 has version-matched core/session/trust/command guidance under `/home/agent/.npm/_npx/c78630c7afbe38e2/node_modules/agent-browser/skill-data/core`; read it before browser commands. Use that entrypoint consistently, an explicit fresh short named session/namespace, identical complete launch settings on every command, no profile/CDP/restore/auth state, and close only the owned session. Validate the complete Unix socket length before launch. If a command fails, preserve its response and stop dependent commands; do not switch cached copies, weaken containment or continue a hidden retry loop.

A local browser run may serve only the new prototype directory on a newly allocated loopback port, with no app imports or database. Use browser-level allowed-domain containment for loopback and no external assets; this is not an OS egress guarantee. Own and explicitly close the newly created server and session, retaining actual closure evidence and uncertainty. Do not inventory or signal prior processes. If the browser boundary cannot be established within this scope, record that specific limitation and leave a clean resume point; do not reopen held app tooling to render it.

## Acceptance criteria

1. Artifact opens with an obvious fictional prototype label, one primary staff action, all six stage headings and no invented prices or clinical content.
2. Clicking a sample visit or starting a sample visit opens the five-step visit view. Step changes, filters and back navigation work without operational mutations; back returns to the prior board filters.
3. Approval is bound to a displayed revision and separate from actual care; revision-changed/blocked views lock operational controls. Wellness produced, approval, decision, sales/payment, overdue and archive meanings remain distinguishable.
4. Empty/loading/blocked views are understandable. Desktop, tablet and mobile layouts have no unintended horizontal viewport overflow; native controls have labels and visible focus. Browser keyboard navigation can reach/open a visit and return.
5. Actual artifact/browser evidence, source review and limitations are independently assessed. No app, provider, hosted, retention, subscription, referral, clinical or pilot success is inferred.
6. Independent PASS, distinct later learning, actual STATE/CHANGELOG updates and exact final co-sign precede normal expected-head publication to existing PR2. Publish no screenshots/receipts containing credentials; keep native raw evidence private.

## Relevant memory

- L-044: spa onboarding inputs are not source completion prerequisites. L-045: discover actual available execution routes without inventing global absence.
- P-009/P-010: explicit eligibility and selected clinic context. G-012/G-014: installed browser contracts, complete launch state, sequential dependent commands and unique retained receipts.
- Current STATE: all consumed allocations, permanent release and retained local-effect holds remain unchanged. Accepted application CI is not replayed for this artifact.

## Current phase

PLANNED, awaiting independent plan/admission co-sign. No artifact source, browser launch, server or application operation has run for this task. Base branch publication is dc9c01a6596156054a5232d4bc01b91eecdc01ba, clean local HEAD/origin. Root reconciled actual running managed environment revision769 and no active non-root worker before choosing this independent presentation step. The reviewed reference assessment's actual publication and private final publication audit are complete; captured prospective wording is historical and does not authorize replay.

Plan admission is now PASS in [the independent audit](../docs/AUDIT_GUI_PROTOTYPE.md), initial10547bytes/SHA2569619e4b2bdacccc858608c4e604409d35b48bf8f77e4fee196e662e4924192ff. Root read the complete report in native6af81b and adopted its explicit prelaunch/resource/closure conditions before Coder dispatch. Coder execution is next; source/actual-result review, distinct later learning, final co-sign and publication remain unexecuted. The earlier PLANNED paragraph is preserved phase history. No app operation or service/gate budget is admitted.

### Changed-source responsive correction

Original actual browser verification found a mobile navigation defect at390×844: the recommendation label had89px scroll width in a66px client box, visibly overlapping Actual care (b128/native5e100c and b129/native215f46). Coder preserved the original exact source and failed evidence privately, stopped dependent checks, and corrected only the standalone artifact to use a two-column mobile step grid with the last step spanning the row, wrapping labels, and a decorative inline SVG card arrow. Final correction candidate is50256bytes/SHA256365ae5ada6022367899806a81e5ed4e161e3697d91d2ec57056c145a3aa1881e.

Root admitted one explicit changed-source, affected-verification continuation at16:59UTC. Original owned browser close returned closed:true (nativea1f3fb); its socket/pid/version paths disappeared, config remained, and one exact-owned read classified PID510167/start78643388 as terminalZ/ppid1 (native4ef978): execution terminated, OS reaping unproven. Original new static server returned exit0/socket_closed:true with request threads joined (nativef66970). Fresh config-j47/br-j47/namespaceg73/sessionw preflight native1c58c4 validates the68-byte socket and same binary/settings. This continuation preserves the original17:11:57UTC absolute cutoff and action/command timeouts. Only changed mobile/board/SVG layout, short resume/back filter regression and console/errors/local-traffic checks are admitted. Unaffected original functional/scenario/keyboard checks remain their original evidence. This explicit source correction does not convert the original mobile failure into PASS, reopen an app hold, reset a budget or permit any hidden retry. Source/actual-result review, learning and publication remain pending.

### Actual affected-verification completion, pending independent review

Coder reports the fresh changed-source continuation completed before the original cutoff: geometry at390/820/1440px has all five step labels fitting without overlap and the changed SVG cards rendered. Actual filtered resume/back preserves the selected sample filters and focus. Console814e7c and page errors7646d5 are empty; trafficcf21ce records one loopbackGET200 for the final50256byte HTML. Final descriptorc36c8e reports the same source365ae5ada6022367899806a81e5ed4e161e3697d91d2ec57056c145a3aa1881e/Git blob416d51749e063da0a627413e873c213e87506dd8. No unaffected original check was replayed.

Changed-session browser closeaa41b9 reports closed:true; selected socket/pid/version paths disappear and config remains. The one exact-owned observation classifies PID512238/start78735358 as terminalZ at17:04:55UTC, execution terminated and OS reaping false. The separate new static server PTY10320 returns exit0/socket_closed:true/request threads joined at17:04:23UTC (native5d704b). These are scoped closure facts, not complete OS process absence. Coder is packaging original and corrected evidence privately; independent source/actual-result review is next. No app operation, production design selection, service/gate clock, old held allocation, deployment or pilot criterion changed.

### CTO source/actual-result adoption

Independent Auditor SOURCE+ACTUAL PASS is genuinely adopted after Root read the complete27711byte report/SHA256c40b40f5daed22b54523b7acabb40262ee5e081519406127be54bcb1a2b1cbbc in nativec08522 and reconciled source/report/evidence pins in nativeaf6525. No source fix is required. Exact original failure/bytes and final responsive evidence remain separate. The decorative SVG edits a JavaScript template literal, so behavioral logic, not exact script bytes, is unchanged. The skip-link full-page capture interpretation is bounded; live skip-link behavior was not additionally exercised. Viewport emulation, private raw evidence, terminalZ/unproven OS reaping and all no-app/no-pilot limits are adopted. Private SOURCE_ACTUAL_ROOT_ADOPTION.json records the actual adoption before distinct learning. Learning and final closing co-sign/publication remain next.

### CTO learning adoption and closing resume

Root fully read/adopted the distinct later NO_NEW_LEARNING report in native943176 and actual SESSION_LOG/CHANGELOG diff with final pins in nativec1f7e5. The33451byte audit/SHA25666488389298e23522b44a1f59a4b7bc6f797bfdcc30b73e51e9e78105259d7c1 preserves the entire accepted27711byte source/actual prefix. Existing L-030/L-039/L-040, P-011/P-024 and G-012/G-014/G-019 cover the supported findings; no corpus, Seen, application count42 or seven-clock change. Private LEARNING_ROOT_ADOPTION.json records the genuine later adoption.

Implementation, meaningful actual checks, independent SOURCE+ACTUAL PASS, separate learning and required memory entries are complete for this standalone prototype. Exact final closing co-sign and normal expected-head publication to existing feat/dripwell-consultation-v2/PR2 are pending at this capture. After publication, first verify the actual head and private PUBLICATION_RECEIPT.json/ACTUAL_PUBLICATION_AUDIT.json before any repeat action. This is an original fictional design candidate, with final production presentation unselected. The next design step is a bounded implementation of the selected presentation in the existing React app after Owner review; the already-pending optional design question is not repeated. Application work remains WAITING_ON_DEPENDENCIES with the exact parked lanes in STATE; neither pilot nor production is done. No source-check replay, retained-target operation, service activation, deployment or safeguard/budget reset is admitted by this closing checkpoint.
