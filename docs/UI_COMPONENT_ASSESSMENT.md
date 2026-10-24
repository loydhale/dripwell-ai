# Once UI and AI Elements for DripWell

Owner-requested reference assessment, October 11, 2026. This is a design recommendation, not an implemented frontend or a selected production layout.

## Recommendation

Use Once UI Core as a candidate for DripWell's visual foundation: consistent typography, spacing, navigation, cards, forms and status displays. Use a small set of AI Elements for the owner's setup conversation. Develop these around the [existing board/visit prototype](prototypes/dripwell-gui/index.html) and the approved PRD workflows.

The clearest starting point is a daily consultation board with one prominent start action and a separate visit workspace. Inside a visit, keep recording, reviewed facts, recommendations, actual care and the approved takeaway in clearly labeled sections. Show the next available action and the reason an action needs attention. Owner configuration and platform administration remain separate, role-controlled surfaces.

Once UI Core is MIT-licensed. AI Elements is Apache-2.0-licensed. Once UI's documentation separately describes the composed block references as Pro. Its published [Pro license agreement](https://once-ui.com/license-agreement) prohibits using the Products to create or operate a commercial SaaS platform and uploading the Products or their source files to public repositories; MIT components are excluded from those restrictions. Ordinary Pro access therefore does not clear copying Pro implementation into DripWell. Study composition patterns and recommend the open-source Core components; any Pro copying would need a separately applicable grant covering the intended use. Repository visibility was not checked, so the public-repository restriction is conditional. No purchase or paid entitlement was selected.

## Component map

| DripWell surface | Candidate components | Intended improvement |
| --- | --- | --- |
| Daily board | Once UI Grid, Card, Scroller, Tag, StatusIndicator and Button | Clear visit cards, readable stage columns, visible outstanding actions and one main start action. |
| Visit workspace | Once UI Card, SegmentedControl, Heading, Feedback and Button | Separate recording, fact review, plans, actual care and approved takeaway sections, with visible saved and pending states. |
| Owner setup conversation | AI Elements Conversation, Message, MessageResponse, PromptInput and Suggestion | Readable message history, focused input, clear request status and useful setup prompts. |
| Configuration review and account settings | Once UI Table, Dialog, Input, Select and Feedback | Review saved versions and explicit changes without crowding the daily consultation workflow. |

These are proposed presentation components. They do not grant authorization, make clinical approvals, activate configuration, perform transcription or establish model access. Existing server permissions, durable jobs and revision checks continue to determine available actions.

## Composed blocks worth studying

The published [Pro block manifest](https://docs.once-ui.com/ai/examples/blocks/manifest.json) identifies:

- `Productivity1`, an issue/kanban board composed with `Sidebar2`. Its column/card pattern is relevant to DripWell's board.
- `Dashboard1`, a composed analytics shell with cards, scrolling and tables. Its hierarchy can inform existing reporting surfaces.
- `Table1`, a standalone data-table reference with search, pagination and selection. Its pattern can inform version review and settings.

The manifest labels its content reference-only and says not every block runs standalone. `Productivity1` and `Dashboard1` explicitly have `standalone: false`. Public reference availability alone does not establish a right to copy Pro implementation. The published Pro agreement's SaaS and public-source restrictions remain material even if ordinary Pro access is available. Source, exact dependencies and a separately applicable permission for the intended use must precede any Pro adoption. The open-source Core recommendation requires no Pro implementation copying.

## Fit with the current application

The current web manifest declares Next.js 16.3.8, React 19.3.0 and AI SDK 7.0.127. It does not declare Once UI Core, Tailwind or `@ai-sdk/react` as direct web dependencies. This observation is about the manifest, not an inventory of installed packages or proof of integration readiness.

[Once UI installation](https://docs.once-ui.com/quick-start) supports adding `@once-ui-system/core` to an existing project. Its documented minimum Next.js and React versions are compatible with the declared DripWell versions. Its [configuration guide](https://docs.once-ui.com/config) introduces foundation styles/tokens and theme/layout providers. No starter replacement is needed to assess it.

[AI Elements setup](https://elements.ai-sdk.dev/docs/setup) requires React 19, Next.js 14+, an installed/configured AI SDK, Tailwind CSS 4 and initialized shadcn/ui. Its installer can initialize shadcn/ui. Components are copied into the application and remain customizable. Its [Conversation documentation](https://elements.ai-sdk.dev/components/conversation) demonstrates message composition and optional AI SDK React hooks.

There is therefore real integration work: one consistent color/font/spacing theme, deliberate treatment of global styles, and a narrow mapping from DripWell's existing setup/job state to the selected message components. AI Elements will not automatically inherit Once UI's theme. Framework minimum-version compatibility is necessary evidence, not a rendered compatibility test. Pin and verify exact component/package versions before implementation, using the mandatory Vercel Plugin and version-matched framework documentation.

The [chatbot example](https://elements.ai-sdk.dev/examples/chatbot) demonstrates a general chat experience with model selection, web search and attachments. For DripWell, choose the message/input/status components needed by the existing setup workflow. Its generic route is a tutorial, not a verified replacement for DripWell's authenticated, tenant-scoped services.

## Preserve the approved workflow

The board keeps all six PRD F08 meanings and triggers: consultation started, initial recommendations given, wellness recommendations produced, and explicit staff accepted/rejected/TBD decisions. Producing an artifact does not establish clinical approval. Accepted/rejected/TBD still requires an approved wellness revision and explicit staff action. Archive/restore, reminder reconciliation and materially changed-plan reconsideration retain their existing rules.

| Existing stored stage | Required trigger |
| --- | --- |
| CONSULTATION_STARTED | Successful consultation initiation in software. |
| INITIAL_RECOMMENDATIONS_GIVEN | Initial recommendations produced and persisted. |
| WELLNESS_RECOMMENDATIONS_PRODUCED | Wellness plan produced and persisted. |
| WELLNESS_RECOMMENDATIONS_ACCEPTED | Explicit staff acceptance of a produced, approved wellness revision. |
| WELLNESS_RECOMMENDATIONS_REJECTED | Explicit staff rejection of a produced, approved wellness revision. |
| WELLNESS_RECOMMENDATION_TBD | Explicit staff pending decision on a produced, approved wellness revision. |

The clinical recommendation approval, separate actual-care record and separately approved wellness takeaway remain distinct. A generic conversation download does not satisfy secure sharing or the approved PDF requirement. The GUI should display these saved states clearly; component choice cannot replace their application controls.

An implementation brief should first isolate one visible screen, verify keyboard focus and mobile/tablet/desktop layouts, and preserve meaningful existing state/retry/approval checks. Record rendered evidence before describing a library integration or redesigned GUI as complete. The supplied links select references for assessment; the final production composition and exact integration scope are still unselected. The existing standalone prototype has not changed.

## Evidence and limits

Primary documentation and license text were actually retrieved for this assessment. Root's original content-negotiated GET of the supplied `https://docs.once-ui.com/blocks/quickStart` returned HTTP404. A later independent direct GET returned HTTP200 for that exact URL and its Quick Start document. Both observations are retained; their difference establishes no cause or permanent route failure. The current documentation also links to the [Core quick start](https://docs.once-ui.com/quick-start) and [Pro block manifest](https://docs.once-ui.com/ai/examples/blocks/manifest.json).

- [Once UI documentation](https://docs.once-ui.com/): core components and separate Pro products/blocks.
- [Once UI Core license](https://github.com/once-ui-system/core/blob/main/LICENSE.md): MIT, copyright 2024-2026 Dopler.
- [Once UI Pro license agreement](https://once-ui.com/license-agreement): SaaS and public-source restrictions; excludes MIT components.
- [AI Elements](https://elements.ai-sdk.dev/) and [license](https://github.com/vercel/ai-elements/blob/main/LICENSE): component registry built on shadcn/ui, Apache-2.0.
- [AI Elements setup](https://elements.ai-sdk.dev/docs/setup), [Conversation](https://elements.ai-sdk.dev/components/conversation) and [chatbot example](https://elements.ai-sdk.dev/examples/chatbot): prerequisites and composition examples.

This assessment runs no installer, application check, browser session, recording, transcription, inference or service mutation. It changes no application, dependency, CI, schema, migration, ICM root, authored agent or workflow. All nine pilot criteria and production gates remain unverified as a full story. Selected service eligibility/access, Resend, administrator MFA/authentic payment, current protected deployment and the existing internal holds remain separate. The requested real-data guard and protected previews remain unchanged; the effective hosted guard and deployed source are still unverified.
