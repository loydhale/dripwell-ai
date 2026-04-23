# TASK-006 — Vision AI signal extraction (F-4)

```
TASK_ID: TASK-006
TITLE: Vision AI signal extraction
PARENT_REQUEST: PRD requires AI-powered extraction of discrete wellness signals from photos with calibrated confidence scores.

GOAL (one sentence):
Integrate Gemini 2.5 Pro vision API to analyze uploaded photos and extract structured wellness signals with confidence scores, stored in the database.

SCOPE:
In scope:
- Create vision AI service module (apps/api/src/services/vision.ts)
- Integrate Gemini 2.5 Pro API via Google AI SDK
- Define signal taxonomy (enum): conjunctivalPallor, underEyeDarkness, underEyePuffiness, scleraTint, lipDryness, lipPallor, angularCheilitis, tongueColor, tongueSurface, facialDullness, facialRedness, skinTexture, nailBedColor, nailRidging, nailSpooning, hairQuality, postureAffect
- API endpoint: POST /assessments/:id/analyze-photos
  - Accepts assessment session ID
  - Fetches uploaded photos for that session
  - Sends photos to Gemini with structured prompt
  - Parses JSON response into VisualSignal records
  - Stores signals with confidence scores (0.0-1.0)
- Structured prompt template requesting JSON output only
- Confidence calibration (basic threshold at 0.6, configurable per signal)
- Error handling for API failures, timeouts, malformed responses
- Audit logging of all AI calls
- Cost tracking per assessment (token usage)

Out of scope (do NOT do these even if tempting):
- Do NOT build self-hosted model (Gemma/MedGemma) — deferred to later
- Do NOT implement advanced confidence calibration or model fine-tuning
- Do NOT build signal validation beyond basic schema checks
- Do NOT add human-in-the-loop review of AI outputs at this stage
- Do NOT implement batch processing or async queues

FILES LIKELY INVOLVED:
- apps/api/src/services/vision.ts — Gemini API integration, prompt engineering
- apps/api/src/routes/assessments.ts — add POST /:id/analyze-photos endpoint
- apps/api/src/lib/gemini.ts — Gemini client setup and configuration
- apps/api/src/lib/prompts.ts — prompt templates for signal extraction
- packages/shared/prisma/schema.prisma — may need minor adjustments to VisualSignal model
- apps/api/src/services/signals.ts — signal processing and storage logic
- apps/api/.env — add GEMINI_API_KEY placeholder

RELEVANT MEMORY ENTRIES:
- PRD F-4: Vision AI signal extraction with structured JSON output
- PRD F-3: Photo capture (photos now available for analysis)
- PRD: Gemini 2.5 Pro confirmed as vision model
- PRD: Model contract — structured JSON only, no free-form prose
- LESSONS: L-004 (JSON double-encoding), L-006 (error classes)
- PATTERNS: P-001 — branded ID types

ACCEPTANCE CRITERIA (Auditor will check these):
- [ ] POST /assessments/:id/analyze-photos endpoint exists and is protected by auth
- [ ] Endpoint fetches photos for the assessment session
- [ ] Photos are sent to Gemini 2.5 Pro with appropriate prompt
- [ ] Response is parsed as structured JSON (not free-form text)
- [ ] Extracted signals stored in VisualSignal table with confidence scores
- [ ] Each signal has: name, confidence (0.0-1.0), photoAngle, assessmentSessionId
- [ ] Low confidence signals (< 0.6) are flagged or filtered
- [ ] API failures handled gracefully (returns 502 with error message, doesn't crash)
- [ ] Audit log entry created for each AI call
- [ ] Multi-tenant isolation enforced (only analyzes photos for requesting tenant)
- [ ] TypeScript types for all signal data structures

NOTES / HINTS:
- Use @google/generative-ai SDK (official Gemini SDK)
- Prompt engineering is critical — the prompt must force JSON output and specify the exact signal taxonomy
- Example prompt structure: "Analyze this medical wellness photo and return ONLY a JSON object with detected signals and confidence scores..."
- Set responseMimeType: "application/json" and provide responseSchema if the SDK supports it
- For v1, process photos synchronously (not async queue). Max 4 photos per assessment, should complete in under 15 seconds total.
- Store the raw AI response in addition to parsed signals (for debugging and model improvement)
- The signal taxonomy should match the ClinicalPattern model's expected signals
- Consider rate limiting this endpoint (expensive API calls)
- For local development without API key, provide a mock mode that returns realistic demo signals
```
