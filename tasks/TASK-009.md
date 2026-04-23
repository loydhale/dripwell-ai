# TASK-009 — Safety flags (F-7)

```
TASK_ID: TASK-009
TITLE: Three-tier safety flag system
PARENT_REQUEST: PRD requires a three-tier safety flag system that identifies and categorizes clinical concerns during assessment.

GOAL (one sentence):
Implement the three-tier safety flag system that analyzes visual signals and question answers to flag potential clinical concerns, with appropriate escalation per tier.

SCOPE:
In scope:
- Safety flag detection service (apps/api/src/services/safety.ts)
- Three tiers:
  - Tier 1 (Informational): Surfaces to provider, provider chooses whether to mention
  - Tier 2 (Recommend Follow-up): Surfaces with suggested script, provider chooses whether to share
  - Tier 3 (Urgent/Contraindication): Hard stop. Recommendation locked. Provider must acknowledge and follow protocol.
- Flag rules engine: Map signals and answers to flag conditions
  - Example: conjunctival pallor + severe fatigue → Tier 2 (possible anemia, recommend blood work)
  - Example: jaundice (yellow sclera) → Tier 3 (urgent, refer out)
  - Example: cold extremities → Tier 1 (informational)
- API endpoint: GET /assessments/:id/safety-flags
  - Returns all flags for the assessment with tier, description, suggested script
- Integration with recommendation engine: If Tier 3 flag exists, block recommendation generation
- Frontend safety flag display in provider review UI
- Provider acknowledgment for Tier 3 flags
- All flags logged in audit trail

Out of scope (do NOT do these even if tempting):
- Do NOT implement actual medical diagnosis or treatment logic
- Do NOT send automated alerts to patients
- Do NOT integrate with external medical systems
- Do NOT build complex rule builder UI for flag configuration

FILES LIKELY INVOLVED:
- apps/api/src/services/safety.ts — flag detection logic
- apps/api/src/routes/assessments.ts — add safety-flags endpoint
- apps/web/src/components/SafetyFlagDisplay.ts — flag UI component
- apps/web/src/styles/safety.css — safety UI styles
- apps/web/src/components/RecommendationPreview.ts — integrate flag blocking

RELEVANT MEMORY ENTRIES:
- PRD F-7: Three-tier safety flag system
- PRD F-6: Recommendation engine (blocked by Tier 3 flags)
- PRD F-8: Provider approval gate (flags surfaced in review)
- LESSONS: L-006 (error classes), L-009 (static IDs)
- PATTERNS: P-001 — branded ID types

ACCEPTANCE CRITERIA (Auditor will check these):
- [ ] GET /assessments/:id/safety-flags endpoint exists and is protected
- [ ] Endpoint analyzes signals and answers and returns flags
- [ ] Each flag has: tier, description, suggestedScript
- [ ] Tier 3 flags block recommendation generation
- [ ] Tier 1 and 2 flags surface in provider UI
- [ ] Provider must acknowledge Tier 3 flags before proceeding
- [ ] All flags logged in audit trail
- [ ] Multi-tenant isolation enforced
- [ ] Mock mode for testing

NOTES / HINTS:
- Flag rules for v1 (minimal set):
  - Tier 3: jaundice (yellow sclera), severe dehydration + confusion
  - Tier 2: conjunctival pallor + severe fatigue, angular cheilitis + diet concerns
  - Tier 1: cold extremities, mild skin dryness, posture concerns
- Keep rules simple and transparent — log which rule triggered which flag
- The safety system is a clinical safeguard, not a diagnostic tool
- Provider acknowledgment should be a simple "I have reviewed and will follow protocol" checkbox
```
