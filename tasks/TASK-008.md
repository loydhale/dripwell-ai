# TASK-008 — Recommendation engine (F-6)

```
TASK_ID: TASK-008
TITLE: Recommendation engine
PARENT_REQUEST: PRD requires a three-layer recommendation system that maps clinical patterns to actual drip catalog items.

GOAL (one sentence):
Build the three-layer recommendation engine that maps visual signals + question answers to wellness patterns, then to generic clinical intents, then to the clinic's actual drip catalog items.

SCOPE:
In scope:
- Pattern matching service (apps/api/src/services/patterns.ts)
  - Map extracted signals + question answers to ClinicalPattern matches
  - Calculate pattern confidence scores
  - Identify top 3 candidate patterns
- Recommendation service (apps/api/src/services/recommendations.ts)
  - Layer 1: Clinical pattern library (universal patterns with generic intents)
  - Layer 2: Location catalog mapping (generic intent → actual catalog item)
  - Layer 3: Universal defaults (hydration bias, ambiguity default, first-visit consistency)
- API endpoint: POST /assessments/:id/generate-recommendation
  - Accepts assessment session ID
  - Computes pattern matches from signals and answers
  - Selects highest-confidence pattern
  - Maps to catalog items via location configuration
  - Returns recommendation with confidence, rationale, alternatives
- Pre-recommendation summary for provider review
  - Primary recommendation + 2 alternatives
  - Confidence score
  - Clinical rationale (why this pattern, what signals support it)
- Frontend recommendation preview component
- No commercial weighting, no pricing logic, no package logic (clinical only)

Out of scope (do NOT do these even if tempting):
- Do NOT implement LLM-generated recommendations (use static pattern library for v1)
- Do NOT add provider override capture (that's TASK-010)
- Do NOT add patient-facing output generation (defer until provider approval flow)
- Do NOT implement complex Bayesian networks or machine learning
- Do NOT add seasonal or promotional logic

FILES LIKELY INVOLVED:
- apps/api/src/services/patterns.ts — pattern matching from signals/answers
- apps/api/src/services/recommendations.ts — three-layer recommendation logic
- apps/api/src/routes/assessments.ts — add generate-recommendation endpoint
- apps/web/src/components/RecommendationPreview.ts — provider review UI
- apps/web/src/styles/recommendations.css — recommendation UI styles
- packages/shared/prisma/schema.prisma — verify ClinicalPattern, PatternMatch, Recommendation models

RELEVANT MEMORY ENTRIES:
- PRD F-6: Clinical pattern library and recommendation engine
- PRD F-4: Vision AI signals (input to pattern matching)
- PRD F-5: Adaptive questioning (answers input to pattern matching)
- PRD F-7: Safety flags (separate from recommendation logic)
- PRD F-8: Provider approval gate (next step after recommendation)
- LESSONS: L-004 (JSON handling), L-006 (error classes), L-007 (prompt + Zod)
- PATTERNS: P-001 — branded ID types, P-005 — polymorphic catalog

ACCEPTANCE CRITERIA (Auditor will check these):
- [ ] POST /assessments/:id/generate-recommendation endpoint exists and is protected
- [ ] Endpoint computes pattern matches from signals and answers
- [ ] Top 3 patterns identified with confidence scores
- [ ] Primary pattern mapped to catalog items via location config
- [ ] Recommendation includes: primary item, 2 alternatives, confidence, rationale
- [ ] No commercial weighting applied (clinical only)
- [ ] Hydration default applied when patterns are ambiguous
- [ ] First-visit consistency bias applied
- [ ] Frontend shows recommendation preview for provider review
- [ ] Multi-tenant isolation enforced
- [ ] Mock mode for testing without full signal data

NOTES / HINTS:
- Pattern matching for v1: simple scoring matrix
  - Each pattern has "supporting signals" (e.g., iron deficiency: conjunctival pallor + under-eye darkness)
  - Each pattern has "supporting answers" (e.g., iron deficiency: fatigue=yes + cold extremities=yes)
  - Score = (matching signals * signal confidence) + (matching answers * answer weight)
  - Normalize to 0.0-1.0
- Clinical patterns to seed (minimal set for v1):
  - Iron deficiency cluster
  - B12/folate cluster
  - Dehydration
  - Stress/magnesium depletion
  - Inflammatory/recovery state
- Each pattern maps to generic intents:
  - "Iron deficiency cluster" → "Iron support IV" + "B-complex support"
  - "Dehydration" → "Hydration IV"
- Location catalog maps generic intents to actual items:
  - "Iron support IV" → "Myers' Cocktail" (at this clinic)
  - "Hydration IV" → "Basic Hydration Drip" (at this clinic)
- The recommendation engine is the bridge between clinical observation and the clinic's actual offerings
- Keep the logic transparent and auditable — log how each recommendation was derived
```
