# TASK-018 — Enhanced Clinical Workflow

```
TASK_ID: TASK-018
TITLE: Enhanced Clinical Workflow (vitals, consent, escalate/defer, change log)
PARENT_REQUEST: Loyd confirmed this is needed for the pilot, not deferred. Based on iv_assessment_workflow_v1.md from Downloads.

GOAL (one sentence):
Enhance the assessment workflow with vitals capture, consent workflow, escalate/defer actions, and a change log to support real clinical decision-making at pilot clinics.

SCOPE:
In scope:

### 1. Vitals Capture (P0 for pilot)
- Add vitals input to assessment flow BEFORE photo capture:
  - Required: blood pressure (systolic/diastolic), pulse (bpm), SpO2 (%)
  - Optional: temperature (°F), respiratory rate, weight (lbs)
- Simple numeric input fields with validation ranges:
  - BP: 70-220 / 40-140
  - Pulse: 40-200
  - SpO2: 70-100
  - Temp: 95-108
- Store vitals in AssessmentSession model (new JSON field)
- Safety check: flag abnormal vitals (e.g., SpO2 < 92%, BP > 180/110, pulse > 120)
- Include vitals in AI signal extraction context (pass to Gemini as additional data)

### 2. Consent Workflow (P0 for pilot)
- Before assessment starts, show consent screen:
  - "I consent to photo capture for wellness assessment"
  - "I consent to audio recording of this session"
  - Provider signature (tap to confirm)
  - Patient initials (tap to confirm)
- Store consent in AssessmentSession model (boolean fields + timestamp)
- Cannot proceed to assessment without consent
- Audit log records consent capture

### 3. Escalate / Defer Actions (P0 for pilot)
- In provider review phase, add two new actions beyond approve/override/modify:
  - **Escalate** — provider refers to MD/DO or senior clinician. Capture:
    - Escalation reason (dropdown: needs physician review, complex case, patient request, other)
    - Notes
    - Status: ESCALATED → tracks in dashboard as "Referred Out"
  - **Defer** — provider postpones recommendation. Capture:
    - Defer reason (dropdown: need more info, patient not ready, follow-up needed, other)
    - Follow-up date (optional)
    - Status: DEFERRED → tracks in dashboard as "Pending Follow-up"
- Both actions generate patient-friendly output explaining next steps
- Both appear in assessment history with filtering

### 4. Change Log (P1 for pilot)
- When provider modifies or overrides a recommendation, record:
  - What AI recommended (original)
  - What provider changed it to (modified)
  - Which fields changed (drip selection, dosage, rationale)
  - Timestamp
  - Provider name
- Show change log in assessment detail view (admin + provider)
- Exportable for quality assurance review
- Stored in new `AssessmentChangeLog` table

Out of scope:
- Do NOT build hardware integration for vitals (manual input only for v1)
- Do NOT build audio recording + transcription for v1 (stretch goal for v1.1)
- Do NOT build full recalculation engine (modify is sufficient for v1)
- Do NOT build automated vitals analysis beyond simple range checks
- Do NOT build patient-visible vitals display

FILES LIKELY INVOLVED:
- apps/web/src/pages/AssessmentFlow.ts — add vitals step, consent step
- apps/web/src/components/VitalsInput.ts — new component
- apps/web/src/components/ConsentForm.ts — new component
- apps/api/src/routes/assessment.ts — vitals API, consent API, escalate/defer endpoints
- apps/api/src/services/assessment.ts — vitals validation, escalate/defer logic
- apps/admin/src/pages/AssessmentDetail.ts — change log display
- packages/shared/prisma/schema.prisma — new fields for vitals, consent, change log

RELEVANT MEMORY ENTRIES:
- PRD: Provider approval gate, assessment workflow
- LESSONS: L-014, L-015, L-016, L-017
- PATTERNS: P-008 (buildAuditLogData helper)

ACCEPTANCE CRITERIA:
- [ ] Provider can enter vitals before photo capture with validation
- [ ] Abnormal vitals trigger safety flag (T2 or T3)
- [ ] Consent screen blocks assessment until both patient and provider confirm
- [ ] Provider can escalate assessment to MD/DO with reason and notes
- [ ] Provider can defer assessment with reason and follow-up date
- [ ] Escalated and deferred assessments show correct status in dashboard
- [ ] Change log records all modifications and overrides with before/after
- [ ] Change log visible in assessment detail view
- [ ] All new endpoints are protected (provider+ role)
- [ ] Audit log captures all new actions (consent, vitals, escalate, defer, modify)

NOTES / HINTS:
- Keep vitals input simple — numeric fields only, no complex devices
- Consent should feel lightweight but legally sound (tap-to-sign, not drawn signature)
- Escalate/defer are new assessment statuses — update all status-filtering queries
- Change log is for QA and learning — don't show it to patients
- Store vitals as JSON in AssessmentSession to avoid schema bloat
- Include vitals in the prompt to Gemini for signal extraction ("Patient vitals: BP 120/80, pulse 72, SpO2 98%")
```
