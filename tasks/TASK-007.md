# TASK-007 — Adaptive questioning (F-5)

```
TASK_ID: TASK-007
TITLE: Adaptive questioning engine
PARENT_REQUEST: PRD requires an adaptive questioning loop that selects highest information-gain questions to disambiguate between wellness patterns.

GOAL (one sentence):
Build the adaptive questioning engine that selects optimal follow-up questions based on visual signals and patient answers, using Bayesian-style confidence updating.

SCOPE:
In scope:
- Question bank service (apps/api/src/services/questions.ts)
- Question bank data in database: 7 categories (energy/sleep, hydration, stress/recovery, women's health, diet pattern, medical history/medications, specific symptoms)
- Each question tagged with: patterns it splits, expected information gain per answer, category
- API endpoint: GET /assessments/:id/next-question
  - Returns the best next question given current signals and answers
  - Includes question text, category, possible answers
- API endpoint: POST /assessments/:id/answer
  - Records patient answer
  - Updates pattern confidences via Bayesian-style reweighting
  - Determines if questioning should terminate
- Termination conditions (any one triggers):
  - Pattern confidence >= 0.75 (configurable)
  - Max 5 questions reached (configurable)
  - Provider explicitly ends questioning
  - No remaining question has meaningful information gain
- Pattern confidence tracking per assessment session
- Frontend question display component for tablet
- Provider can skip questions or end questioning early

Out of scope (do NOT do these even if tempting):
- Do NOT implement full Bayesian network or machine learning model
- Do NOT implement real-time LLM-generated questions (use static question bank for v1)
- Do NOT implement pattern matching logic (that's part of recommendation engine, TASK-008)
- Do NOT add question randomization or A/B testing
- Do NOT build complex analytics on question performance

FILES LIKELY INVOLVED:
- apps/api/src/services/questions.ts — question selection logic
- apps/api/src/services/patterns.ts — pattern confidence tracking
- apps/api/src/routes/assessments.ts — add next-question and answer endpoints
- packages/shared/prisma/schema.prisma — verify QuestionBank, PatternConfidence, QuestionAnswer models
- apps/web/src/components/QuestionDisplay.ts — tablet question UI
- apps/web/src/pages/AssessmentFlow.ts — update to include questioning phase
- apps/web/src/styles/questions.css — question UI styles

RELEVANT MEMORY ENTRIES:
- PRD F-5: Adaptive questioning with Bayesian-style confidence updating
- PRD F-4: Vision AI signals (input to questioning)
- PRD F-6: Clinical pattern library (patterns being disambiguated)
- PRD: Max 5 questions, confidence threshold 0.75
- LESSONS: L-004 (JSON handling), L-006 (error classes), L-007 (prompt + Zod validation)
- PATTERNS: P-001 — branded ID types

ACCEPTANCE CRITERIA (Auditor will check these):
- [ ] GET /assessments/:id/next-question returns a question based on current signals
- [ ] Question selection considers visual signals from photo analysis
- [ ] POST /assessments/:id/answer records answer and updates confidences
- [ ] Pattern confidences updated after each answer (simple reweighting)
- [ ] Termination when confidence >= 0.75
- [ ] Termination when max 5 questions reached
- [ ] Provider can explicitly end questioning
- [ ] Question text is provider-facing (provider asks patient, not AI speaking directly)
- [ ] Frontend shows question, answer options, and progress
- [ ] Skip button available for optional questions
- [ ] Multi-tenant isolation enforced
- [ ] Mock mode for testing without full signal data

NOTES / HINTS:
- For v1, use a simplified scoring algorithm rather than full Bayesian inference:
  - Each question has weights for each pattern (+1 if answer supports pattern, -1 if contradicts)
  - Start with base confidence from visual signals (e.g., signal present = 0.4 confidence)
  - After each answer, update: confidence = base + sum of question weights for that pattern
  - Normalize to 0.0-1.0 range
- Question bank should be seeded with realistic questions from the PRD categories
- The provider asks the question in conversation, then taps the patient's answer on the tablet
- Keep the algorithm transparent — log how confidence scores are computed for debugging
- Frontend should show: "Question 3 of 5" progress indicator
- This is the bridge between photo analysis and recommendations
```
