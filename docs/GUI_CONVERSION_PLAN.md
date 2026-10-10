# DripWell GUI conversion direction

Owner question, 2026-10-09: “What is the best way for me to convert the GUI I want? The current front end looks confusing.” This document answers that design question and preserves the next design step. It is a proposal, not a selected layout or an implemented redesign.

## Recommended handoff

Use an annotated screenshot, rough sketch, existing interface reference, or Figma design to show the desired layout. Figma is useful for direct visual editing; a screenshot or sketch is sufficient to begin. List the parts to retain, the parts that are confusing, and the main action each screen should make obvious.

Start with a clickable prototype of two screens: the consultation board and an individual consultation. Review the daily staff journey in that prototype, including tablet layouts, empty/loading/blocked states, recording, missing facts, review/approval, actual care, wellness and sharing states. Then implement the selected presentation in DripWell's existing Next.js/React frontend, using reusable components and shared styles. A visual export is a reference for implementation, not a functioning application by itself.

Apply the selected design to setup, insights and account screens after the core consultation journey is clear. Keep development ICM folders and the authored apps/web/agent and apps/web/workflows structure. Business records, authenticated authority and durable processing remain part of the working application.

## Source observations

The inspected source is branch feat/dripwell-consultation-v2 at 407b6518f7750d90901e7d8e208945ccf37296a0. Relevant source paths were read and bound to current Git blobs. This is a source inspection, not a visual inspection or functional verification of the current hosted preview.

- [Dashboard](../apps/web/components/dashboard.tsx) places four reporting cards and membership-outcome reporting before the consultation board. A proposed clearer staff layout makes active work and its primary action the main content, with detailed reporting available in the existing insights area.
- [Consultation](../apps/web/components/consultation.tsx) has four numbered navigation tabs, while its panels use five numbered workflow labels. Recommendation review/approval and actual-care recording share one tab. These are potential sources of confusion to test in the prototype, not proven functional defects.
- [App shell](../apps/web/components/app-shell.tsx) already limits clinic setup and insights navigation to owners. Retain that role distinction while making labels and the route back to active work clear.
- [Setup](../apps/web/components/setup.tsx) already separates catalog/prices, questions, protocols, tests/activation and version history. Present that existing process as a guided setup flow without silently activating drafts.

## Proposed interaction direction

The board should make starting or resuming a consultation easy, retain all six approved stage meanings and triggers, and keep overdue outcomes visible. The selected design may simplify density and place reporting elsewhere; it must preserve care outcomes, wellness decisions, sales and missing-data distinctions.

Within a visit, present the existing work in a clear sequence:

1. Record consent and capture audio, or use manual intake.
2. Review facts and required questions.
3. Review the recommendation and obtain authorized approval of its exact revision.
4. Record actual care separately.
5. Review the wellness takeaway and use approved sharing/download controls.

At each point, emphasize the appropriate next action and explain unmet requirements. Recording controls, unsaved-audio navigation guards, permission boundaries, explicit approvals and review history remain available. A navigation step is not a board-stage mutation or automatic approval. Editing an approved revision must continue to invalidate its approval.

## Implementation and review handoff

The CTO asks once whether the desired interface exists as an app/website reference, a Figma/Canva/design file, or a rough idea. That optional question is already pending; do not repeat it. If a reference arrives, inspect it before claiming visual fidelity. If the Owner prefers design help, prepare the two-screen prototype for review. A final visual direction has not been selected in this question.

For a selected in-scope presentation change, the CTO writes bounded task briefs, a Coder implements, and an independent Auditor reviews. Use the mandatory open-source Vercel Plugin guidance and version-matched framework documentation. Validate meaningful navigation, recording guards, approval gates and responsive/keyboard behavior affected by the change; do not replay unchanged passing checks to fill time.

This proposal adds no feature, provider, purchase, account authority or acceptance-criterion change. No application code, tests, migrations, service setup or deployment ran for this guidance. Count42, the seven existing active-work budget clocks, full-story/production gates and the separate permanent release and retained local-effect holds remain unchanged. The current deployed Git source and effective hosted ALLOW_REAL_CLIENT_DATA=false are still unverified. Do not use a GUI prototype as release or clinical evidence, or retry held operations to render it.

Independent [documentary/source review](AUDIT_GUI_CONVERSION_PLAN.md) returned PASS and was fully read/adopted by the CTO in nativec64e76. Distinct later NO_NEW_LEARNING and the actual SESSION_LOG diff were fully read/adopted in native245c1f. Exact final-document co-sign and same-review-branch publication are separate steps; the actual branch/private publication receipt takes precedence over captured phase wording. This records reviewed advice, not an implemented GUI.
