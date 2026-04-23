# SESSION_LOG.md

Append-only log of sessions. One line per task or notable event. Used for weekly reviews and debugging team behavior.

Format: `<ISO timestamp> <task_id or event> <brief note>`

---

(no entries yet)

2026-04-22 TASK-004 Auditor review — PASS with 7 suggested fixes. No blocking issues. Semantic error-type mismatches in auth.ts (ConflictError used instead of UnauthorizedError/NotFoundError). All acceptance criteria verified via live server tests.

2026-04-22 TASK-007 Auditor review — FAIL. Blocking issue: QuestionAnswer foreign key constraint fails at runtime because static question bank hardcoded UUIDs do not match Prisma auto-generated QuestionBank rows. Also: wrong audit action in end-questioning endpoint, mock mode auto-fallback masks missing signals, frontend progress tracking fragile.

---

AUDIT: TASK-007
VERDICT: FAIL
ATTEMPT: 1

FINDINGS:
- apps/api/src/services/questions.ts:recordAnswer() The QuestionAnswer.create references questionBankId with hardcoded UUIDs from STATIC_QUESTION_BANK (e.g. '11111111-1111-1111-1111-111111111111'). The Prisma schema requires this to match a QuestionBank row via FK. The seed.ts generates auto-generated UUIDs for QuestionBank, so no row exists with these IDs. Runtime foreign key constraint violation on every answer submission. (severity: blocking)
- apps/api/src/routes/assessments.ts:432 The end-questioning endpoint logs action: 'ASSESSMENT_CREATED' to the audit log. This is semantically wrong — it should log a distinct action such as 'ASSESSMENT_COMPLETED' or a new enum value for provider-ended questioning. (severity: suggested)
- apps/api/src/routes/assessments.ts:260 next-question passes mockSignals: true whenever signals.length === 0, even when QUESTION_MOCK_MODE env var is false. In production this silently injects synthetic signals (conjunctival pallor 0.72, lip dryness 0.68, under-eye darkness 0.55) instead of surfacing a missing-data condition. (severity: suggested)
- apps/web/src/pages/AssessmentFlow.ts:236 showQuestion() uses data.nextQuestion.progress?.questionNumber which is always undefined because the answer endpoint response does not include a progress field on nextQuestion. Falls back to incrementing the previous local progress value, which is fragile and will drift if the server skips questions or changes maxQuestions. (severity: suggested)
- apps/api/src/services/questions.ts:338 findQuestionBankById() is exported but never imported or used anywhere in the codebase. Dead code. (severity: suggested)
- apps/api/src/routes/assessments.ts:298-350 The answer endpoint does not check assessment.status before accepting an answer. If the assessment is already COMPLETED or ABANDONED, it will still record answers. (severity: suggested)
- apps/api/src/routes/assessments.ts:247-293 The next-question endpoint does not check assessment.status before returning a question. Same issue for already-completed assessments. (severity: suggested)
- apps/api/src/routes/assessments.ts:320-322 The answer endpoint fetches assessment signals twice — once for priorConfidences and again for postConfidences. Should fetch once and reuse. (severity: suggested)

PATTERN_VIOLATIONS: none
GOTCHA_HITS: G-002, G-003
PRD_AUDIT: pass — no PRD changes were made for this task

REQUIRED_FIXES:
- Fix the QuestionAnswer foreign key mismatch. Options: (1) update seed.ts to create QuestionBank rows with the exact hardcoded UUIDs from STATIC_QUESTION_BANK, (2) add a prisma migration or startup script that syncs the static bank into the QuestionBank table, or (3) remove the QuestionBank FK from QuestionAnswer and use a separate non-FK string field for static references. Verify by running the answer endpoint end-to-end.
- After fix, re-run all acceptance criteria verification.

