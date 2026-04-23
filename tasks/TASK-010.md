# TASK-010 — Provider approval gate (F-8)

```
TASK_ID: TASK-010
TITLE: Provider approval gate and override capture
PARENT_REQUEST: PRD requires every recommendation to be reviewed and approved by a licensed provider before any patient-facing output is generated.

GOAL (one sentence):
Build the provider approval gate where providers review AI recommendations, approve/modify/override them, and capture override reasons for model learning.

SCOPE:
In scope:
- Provider review UI enhancements (apps/web/src/components/ProviderReview.ts)
  - Display recommendation with confidence, rationale, alternatives
  - Display safety flags
  - Approve button
  - Modify button (edit recommendation details)
  - Override button (reject and provide reason)
- API endpoint: POST /assessments/:id/approve
  - Marks recommendation as approved
  - Generates patient-facing output
- API endpoint: POST /assessments/:id/override
  - Captures override reason
  - Stores provider's manual recommendation
  - Logs for model learning
- API endpoint: POST /assessments/:id/modify
  - Allows provider to adjust recommendation details
  - Stores modification history
- Override reason codes:
  - CLINICAL_JUDGEMENT: Provider disagrees with AI assessment
  - PATIENT_PREFERENCE: Patient requested different treatment
  - CONTRAINDICATION: Known allergy or condition
  - OTHER: Free text reason
- Patient-facing output generation (basic)
  - Plain language description of recommendation
  - What was observed and why
  - No pricing or promotional content
  - Required disclaimers
- Assessment status workflow: IN_PROGRESS → PENDING_REVIEW → APPROVED / OVERRIDDEN

Out of scope (do NOT do these even if tempting):
- Do NOT implement PDF generation for patient output
- Do NOT send email/SMS to patients
- Do NOT build complex modification UI (simple text adjustment is fine)
- Do NOT implement real-time model learning from overrides

FILES LIKELY INVOLVED:
- apps/api/src/routes/assessments.ts — add approve/override/modify endpoints
- apps/api/src/services/recommendations.ts — update with approval logic
- apps/web/src/components/ProviderReview.ts — provider review UI
- apps/web/src/components/PatientOutput.ts — patient-facing output preview
- apps/web/src/styles/provider.css — provider UI styles

RELEVANT MEMORY ENTRIES:
- PRD F-8: Provider approval gate
- PRD F-7: Safety flags (surfaced in review)
- PRD F-6: Recommendation engine (output of review)
- PRD F-9: Patient-facing output (generated after approval)
- LESSONS: L-006 (error classes), L-009 (static IDs)
- PATTERNS: P-001 — branded ID types

ACCEPTANCE CRITERIA (Auditor will check these):
- [ ] Provider review UI shows recommendation, confidence, rationale, alternatives
- [ ] Safety flags displayed in review UI
- [ ] Approve button works and generates patient output
- [ ] Override button captures reason code
- [ ] Modify button allows adjustment of recommendation
- [ ] Assessment status transitions correctly
- [ ] Override reasons logged for model learning
- [ ] Patient output is plain language, no pricing
- [ ] Required disclaimers present
- [ ] Multi-tenant isolation enforced

NOTES / HINTS:
- The approval gate is the final checkpoint before patient output
- Keep the UI clean and clinical — no flashy animations
- Override reasons are critical for improving the model over time
- Patient output should be reassuring and non-alarming
- This is the last step in the assessment flow before completion
```
