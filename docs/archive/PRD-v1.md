# PRD: DripWell.ai

**Version:** 1.0 (APPROVED)
**Owner:** Loyd Hale
**Managed by:** Jeff (CTO)
**Last updated:** 2026-04-22

---

## 1. One-liner
DripWell is an AI-powered, in-room wellness assessment tool for IV therapy clinics that observes visual wellness signals through computer vision, conducts adaptive follow-up questioning, and generates provider-approved recommendations drawn from the clinic's actual drip catalog.

## 2. Why it exists
IV therapy clinics today rely on brief anecdotal intake conversations ("How are you feeling?") to determine what a patient needs. This produces subjective, inconsistent recommendations and leaves clinics competing on price. There is no in-room assessment tool purpose-built for IV therapy that bridges the gap between a 30-second intake chat and full diagnostic blood work. DripWell fills this gap with a clinically-grounded, 5-minute assessment that standardizes care quality across every provider and every visit.

## 3. Target users

| Role | Who they are | What they need |
|------|-------------|----------------|
| **Super User** | Clinic owner or lead provider | Configure catalog, manage providers, view analytics, control settings |
| **Provider** | RN or licensed provider running the assessment | Run assessments, review AI recommendations, approve/overrides, capture patient data |
| **Patient** | Person receiving IV therapy | Understand why they're getting a specific drip, see progress over time |
| **System Admin** | Growlocals/vendor team | Platform-wide support, pattern library updates, multi-tenant oversight |

## 4. Core user outcomes
When this product is complete:
- A provider can run a full wellness assessment in under 5 minutes, from photo capture to provider-approved recommendation
- A clinic owner can onboard their clinic and configure their full catalog in under 10 minutes
- Every patient receives a consistent, clinically-grounded recommendation regardless of which provider is on shift
- A returning patient can see their progress compared to baseline signals at reassessment
- The clinic operates with standardized assessment quality that stops revenue from depending on who's working

## 5. In-scope features

### Feature F-1: Conversational Clinic Onboarding & Catalog Ingestion
- **Description:** Super user creates account and configures their clinic through a conversational AI interface. Two paths: (1) conversational walkthrough capturing drips, add-ons, injections with ingredients, or (2) photograph existing menu and AI extracts structured catalog.
- **Acceptance criteria:**
  - Super user can complete full catalog setup in under 10 minutes
  - System captures drip names, active ingredients, add-ons, injections, peptides
  - AI verifies extracted items with super user through short back-and-forth
  - System asks capability questions (appointment length, out-of-stock items, state restrictions, refer-out protocol)
  - Super user can review and edit assembled catalog inline before going live
- **Priority:** P0

### Feature F-2: Digital Patient Intake (Photo or Digital Form)
- **Description:** Patient intake can be completed two ways: (1) digital form on tablet, or (2) patient fills a paper intake form and provider photographs it for AI OCR extraction. No patient names stored in the app.
- **Acceptance criteria:**
  - Digital form captures: medications, conditions, allergies, menstrual status, recent illness, current supplements, visit goals
  - Photo intake mode: provider photographs paper form, AI extracts text fields via OCR, provider verifies/corrects
  - Visit goals: 1-3 selections from energy, recovery, immunity, beauty, hangover, athletic, stress, hydration, other
  - No patient name, DOB, or other PII stored. Patient identified by anonymous assessment ID + timestamp only
  - Data stored per-tenant with strict isolation
  - Provider can review and confirm with patient before proceeding
- **Priority:** P0

### Feature F-3: Standardized Photo Capture with Direct Upload
- **Description:** Provider captures standardized wellness photos with AR guidance. Photos upload directly to the app — no local storage on device. Required angles: face, under-eyes, back of hand/forearm, optional tongue.
- **Acceptance criteria:**
  - AR overlay shows correct positioning, lighting checks, and capture confirmation
  - Photos captured in under 90 seconds total
  - **Photos upload immediately to app — never stored on device camera roll or local storage**
  - Images encrypted in transit (TLS 1.3) and at rest (AES-256)
  - Offline capture with deferred sync if network unavailable (still not stored locally after sync)
  - Provider confirms upload success before proceeding
- **Priority:** P0

### Feature F-4: Vision AI Signal Extraction
- **Description:** Vision AI extracts discrete wellness signals from photos with calibrated confidence scores. Structured JSON output only — no free-form prose.
- **Acceptance criteria:**
  - Signals include: conjunctival pallor, under-eye darkness/puffiness, sclera tint, lip dryness/pallor, angular cheilitis, tongue color/surface, facial dullness/redness, skin texture, nail bed color/ridging/spooning, hair quality, posture/affect
  - Each signal returned with confidence score
  - Extraction completes in under 15 seconds per photo
  - Model contract: structured JSON only, no hallucinated signals
- **Priority:** P0

### Feature F-5: Adaptive AI Questioning
- **Description:** After vision signals, system enters adaptive questioning loop. AI selects highest information-gain questions to disambiguate between candidate patterns. Bayesian-style confidence updating after each answer.
- **Acceptance criteria:**
  - Question bank covers: energy/sleep, hydration, stress/recovery, women's health, diet pattern, medical history/medications, specific symptoms
  - System selects next-best question based on current pattern confidences
  - Termination when: pattern confidence ≥ 0.75, max 5 questions reached, provider ends questioning, or no meaningful information gain remains
  - Provider asks questions in conversation; provider taps/captures patient response
- **Priority:** P0

### Feature F-6: Clinical Pattern Library & Recommendation Engine
- **Description:** Three-layer recommendation system. Layer 1 (universal clinical patterns) → Layer 2 (location catalog mapping) → Layer 3 (universal clinical defaults).
- **Acceptance criteria:**
  - Pattern library includes: iron deficiency cluster, B12/folate cluster, dehydration, stress/magnesium depletion, inflammatory/recovery state, etc.
  - Each pattern has supporting signals, question answers, conflicting signals, generic recommendation intent, safety flags, clinical rationale
  - Location layer maps generic intents to actual catalog items (e.g., "B-complex IV support" → "Myers' Cocktail" at this clinic)
  - Universal defaults: hydration bias, ambiguity default (conservative broad-spectrum), first-visit consistency
  - No commercial weighting, pricing, packages, or seasonal logic
- **Priority:** P0

### Feature F-7: Three-Tier Safety Flag System
- **Description:** AI identifies and categorizes concerns into Tier 1 (Informational), Tier 2 (Recommend Follow-up), Tier 3 (Urgent/Contraindication).
- **Acceptance criteria:**
  - Tier 1: Surfaces to provider, provider chooses whether to mention to patient
  - Tier 2: Surfaces with suggested script language, provider chooses whether to share
  - Tier 3: Hard stop. Recommendation locked. Provider must acknowledge and follow medical director protocol. Cannot generate standard recommendation without explicit override + reason capture
  - All flags logged in audit trail regardless of provider handling
- **Priority:** P0

### Feature F-12: Photo Intake Form OCR (Paper-to-Digital)
- **Description:** Provider photographs a paper intake form and AI extracts structured data via OCR. Provider verifies extracted fields before proceeding.
- **Acceptance criteria:**
  - Camera captures paper form, OCR extracts: medications, conditions, allergies, supplements, goals
  - Provider reviews extracted data and corrects any OCR errors inline
  - Extracted data fed directly into assessment workflow (same as digital form)
  - Paper form image discarded after extraction (not retained)
- **Priority:** P1

### Feature F-8: Provider Approval Gate & Override Capture
- **Description:** Every recommendation surfaced to provider for review before any patient-facing output. Provider can approve, adjust, or override. Override reasons captured for model learning.
- **Acceptance criteria:**
  - Pre-recommendation summary shows: primary recommendation, alternatives, confidence, rationale, safety flags
  - Provider can approve, modify, or reject with reason code
  - Override reasons captured and logged for quarterly clinical review
  - No patient-facing output generated without explicit provider approval
- **Priority:** P0

### Feature F-9: Patient-Facing Recommendation Output
- **Description:** Provider-approved recommendation displayed on tablet. Optional PDF generation (provider handles delivery). Plain language, non-alarming, no pricing or promotional content.
- **Acceptance criteria:**
  - Output shows on tablet: what's in the drip and why, what assessment identified, what to track next time, any shared flags, required disclaimers
  - Optional PDF generation for provider to print/email manually
  - No pricing, membership references, or promotional content
  - Required medical/legal disclaimers present
  - Pre-approved language library only — no LLM freeform prose in patient output
- **Priority:** P0

### Feature F-10: Longitudinal Assessment History & Reassessment
- **Description:** Returning patients get fresh assessment with baseline comparison. Progress visualization shows signal changes over time. No patient names stored — provider identifies returning patient by anonymous assessment ID.
- **Acceptance criteria:**
  - System stores baseline signals from first assessment
  - Reassessment reuses relevant prior answers where appropriate (shorter workflow)
  - Progress view shows: signals improved, signals persistent, new signals
  - Optional provider-visible progress (controlled by super user setting)
  - Non-alarming framing throughout
- **Priority:** P1

### Feature F-11: Super User Admin Panel
- **Description:** Admin interface for catalog management, location settings, user management, dashboard, audit logs. Includes notification system, login-as provider feature, and catalog AI enhancement tools.
- **Acceptance criteria:**
  - Catalog: view/edit all items, add new (conversational, manual, CSV upload, or image), toggle in/out of stock, soft delete
  - AI catalog enhancement: upload menu image or CSV, AI extracts structured catalog with descriptions
  - Location settings: state, medical director, default capture preferences, intake form length
  - User management: invite providers, manage permissions, deactivate, login-as provider
  - Notifications: notification icon with recent activity alerts
  - Dashboard: assessment counts, recommendation acceptance rate, override distribution, flag distribution
  - Audit log: exportable record of all actions
- **Priority:** P1

### Feature F-11a: Admin Notifications
- **Description:** Notification bell icon in admin header showing recent system events (new assessments, provider activity, safety flags).
- **Acceptance criteria:**
  - Bell icon with unread count badge
  - Dropdown showing recent notifications
  - Mark as read functionality
- **Priority:** P1

### Feature F-11b: Login-As Provider
- **Description:** Super user can temporarily impersonate a provider to see exactly what they see in the PWA.
- **Acceptance criteria:**
  - Admin can select any provider and "login as" them
  - Opens PWA in provider context (same JWT, provider permissions)
  - Clear indicator that admin is in impersonation mode
  - Can exit impersonation and return to admin
- **Priority:** P1

### Feature F-11c: Catalog Upload & AI Enhancement
- **Description:** Super user uploads spa menu via CSV or photograph. AI extracts structured catalog and generates clinical descriptions for assessment mapping.
- **Acceptance criteria:**
  - CSV upload: map columns to catalog fields, preview before import
  - Image upload: photograph menu, AI OCR extracts items and prices
  - AI description generation: for each catalog item, AI generates clinical description (ingredients, benefits, when to recommend)
  - Manual review: admin verifies AI-generated content before saving
- **Priority:** P1

### Feature F-13: Landing Page (Marketing Site)
- **Description:** Single-page marketing site at dripwell.ai. Positions product, explains methodology, shows pricing, drives early access requests.
- **Acceptance criteria:**
  - Sections: Hero, Spectrum (3-option comparison), How It Works (5 steps), Consistency, Outcomes, Science, Pricing, Final CTA
  - Design follows brand system (teal primary, amber accent, Fraunces + Inter typography)
  - Responsive, WCAG 2.2 AA, respects prefers-reduced-motion
  - Performance: < 3s LCP on 4G
- **Priority:** P1

## 6. Explicitly out of scope
- EHR, PMS, scheduling, CRM, or any external system integration
- Pricing data, package/bundle/membership tier recommendations, or commercial weighting
- Frequency/cadence prescriptions (telling patients how often to come in)
- Diagnosis, treatment, cure, or medical device claims
- Automated patient outreach (no 24/48h outcome check, no SMS, no email automation)
- Patient names, DOB, or any PII stored in the app (anonymous assessment IDs only)
- Patient-visible progress toggle (removed per owner feedback — we handle intake forms)
- Standalone Analytics page (merged into Dashboard per owner feedback)
- Multi-provider workflow routing or complex scheduling
- Dark mode (brand is light/bright by design)
- iPhone version (v1 is tablet-only; iPhone deferred)
- Native mobile app (v1 is PWA; native in v1.5 if needed)

## 7. Stack and architecture decisions

| Layer | Decision | Rationale |
|-------|----------|-----------|
| **Frontend** | Progressive Web App (PWA), tablet-optimized | Fastest v1 delivery, works on iPad, responsive desktop for admin |
| **Backend** | Node.js + TypeScript + Fastify | Performance, type safety, fast iteration |
| **Database** | PostgreSQL + Prisma ORM | Multi-tenant data isolation, relational data model, HIPAA-friendly |
| **Auth** | email/password + MFA minimum, SSO optional | HIPAA requirement, role-based access |
| **Vision AI** | Gemini 2.5 Pro via API (v1), abstracted interface | Best-in-class vision capability; swappable to self-hosted Gemma/MedGemma later |
| **Hosting** | Vercel or Netlify (frontend), AWS/GCP (backend, HIPAA-compliant) | Speed + compliance |
| **SMS/Email** | Twilio + SendGrid | Industry standard, HIPAA BAA available |
| **File Storage** | S3 with AES-256 encryption + presigned URLs | Photo storage, HIPAA-compliant |
| **Repo Structure** | Monorepo: `apps/web` (PWA), `apps/admin` (desktop admin), `packages/shared` | Clean separation, shared types/utils |

## 8. Constraints

### Performance targets
- End-to-end assessment: under 5 minutes (photo capture to approved recommendation)
- Photo capture + signal extraction: under 15 seconds per photo
- Recommendation generation after last answer: under 3 seconds
- Landing page LCP: under 3 seconds on 4G

### Compliance / regulatory
- HIPAA full technical and administrative safeguards
- BAA capability required for every tenant
- AES-256 encryption at rest, TLS 1.3 in transit
- Complete audit log, tamper-evident, exportable
- Data processor agreements with all sub-processors
- Product is a screening tool only — explicit disclaimers everywhere

### Budget
- v1 MVP target: 8-12 weeks build
- Pilot: 8-12 weeks with one clinic
- No explicit budget cap stated — optimize for speed-to-pilot

## 9. Open questions
- **Q1 — Platform confirmation:** PWA for v1, native iPad in v1.5 if camera API demands it. ✅ CONFIRMED
- **Q2 — Vision model provider:** Gemini 2.5 Pro via API for v1. Research task added to evaluate medical-specific models as they mature. ✅ CONFIRMED
- **Q3 — Pilot clinic:** None yet — find before pilot phase. ⏳ OPEN
- **Q4 — Clinical advisor:** Using RD diagnostic literature directly. No human advisor for v1. ✅ CONFIRMED
- **Q5 — Pricing model:** TBD after understanding LLM/COGS. ⏳ OPEN
- **Q6 — Patient data model:** Anonymous assessment IDs, no names/DOB/PII. Photo intake form via OCR. ✅ CONFIRMED
- **Q7 — Email/SMS:** Skip for v1. Tablet display + optional PDF generation only. ✅ CONFIRMED
- **Q8 — Legal counsel:** Skip for v1. ✅ CONFIRMED

## 10. PRD change protocol
- **Minor updates** (clarifications, completion marks, typos): Jeff edits inline, Auditor co-signs
- **Major changes** (new features, scope changes, stack changes): Jeff drafts in `<!-- PENDING_OWNER_APPROVAL: <id> -->` block, workaround in the meantime, Loyd approves before commit

## 11. Glossary

| Term | Definition |
|------|------------|
| **NFPE** | Nutrition-Focused Physical Examination — systematic head-to-toe examination to identify nutritional deficits through visual/tactile observation |
| **Signal** | A discrete visual wellness indicator extracted by AI (e.g., conjunctival pallor, nail ridging) |
| **Pattern** | A named wellness state (e.g., "Iron deficiency cluster") mapped from multiple signals and question answers |
| **Super User** | Clinic owner or lead provider with full admin access |
| **Provider** | Licensed clinician (RN, etc.) who runs assessments |
| **Tenant** | One clinic location in the multi-tenant architecture. Data strictly isolated per tenant |
| **BAA** | Business Associate Agreement — HIPAA-required contract for data handling |
| **Tier 1/2/3 Flag** | Safety classification: Informational, Follow-up recommended, Urgent/Contraindication |

---

## Pending approvals

<!-- PENDING_OWNER_APPROVAL: prd-v1 -->
**PRD v1.0 Draft**
Drafted: 2026-04-22
Summary: Complete PRD drafted from Owner's provided design brief and product requirements document
Blocking tasks: All v1 features depend on this approval
Workaround active: No — waiting for approval before dispatching tasks
<!-- END PENDING_OWNER_APPROVAL: prd-v1 -->

