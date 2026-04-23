# TASK-014 — Catalog Upload & AI Enhancement

```
TASK_ID: TASK-014
TITLE: Catalog Upload & AI Enhancement
PARENT_REQUEST: Loyd wants CSV/image catalog upload and AI-generated descriptions for better assessments.

GOAL (one sentence):
Build catalog import tools (CSV + image upload) and integrate AI to generate clinical descriptions for catalog items.

SCOPE:
In scope:
- CSV Upload:
  - Upload CSV with columns: name, type (DRIP/ADD_ON/INJECTION/PEPTIDE), description, ingredients, price (optional)
  - Preview parsed data before import
  - Map CSV columns if headers don't match
  - Validate rows (required fields, valid types)
  - Import creates CatalogItem + Ingredient records
  - Show success/error summary

- Image Upload (Menu Photo):
  - Upload photograph of spa menu
  - AI (Gemini Vision) extracts menu items, types, descriptions
  - Show extracted items in editable preview table
  - Admin reviews/corrects before saving
  - Same validation as CSV import

- AI Description Generation:
  - For each catalog item, AI generates clinical description
  - Description includes: key ingredients, benefits, when to recommend
  - Example: "Myers' Cocktail → B-complex, Vitamin C, Magnesium. Supports energy, immunity, hydration. Recommend for fatigue, stress, or general wellness."
  - Admin can edit AI-generated descriptions
  - Store AI-generated flag (so admin knows which were auto-generated)

- Integration with existing catalog:
  - New items from upload go into catalog with isActive: true
  - Existing items with same name: update or skip (admin choice)

Out of scope:
- Do NOT build price-based recommendations (clinical only per PRD)
- Do NOT auto-publish AI descriptions without admin review
- Do NOT support PDF menu upload for v1

FILES LIKELY INVOLVED:
- apps/admin/src/pages/CatalogManager.ts — add upload buttons and preview
- apps/admin/src/components/CsvUploader.ts — CSV upload + preview
- apps/admin/src/components/ImageUploader.ts — image upload + AI extraction
- apps/admin/src/components/AiDescriptionModal.ts — AI description editor
- apps/api/src/routes/admin.ts — upload endpoints
- apps/api/src/services/catalog-import.ts — CSV parsing, validation
- apps/api/src/services/vision.ts — extend for menu OCR
- apps/api/src/lib/gemini.ts — add menu extraction prompt
- apps/api/src/lib/prompts.ts — add catalog description prompt

RELEVANT MEMORY ENTRIES:
- PRD F-11c: Catalog Upload & AI Enhancement
- PRD F-1: Conversational catalog ingestion (existing, now extended)
- LESSONS: L-007 (prompt + Zod validation)
- PATTERNS: P-005 — polymorphic catalog

ACCEPTANCE CRITERIA:
- [ ] CSV upload button in catalog manager
- [ ] CSV preview shows parsed rows before import
- [ ] Image upload accepts menu photographs
- [ ] AI extracts items from menu photo with editable preview
- [ ] AI generates clinical descriptions for each item
- [ ] Admin can edit all extracted/generated data before saving
- [ ] Import creates valid CatalogItem records
- [ ] Duplicate handling (update or skip)
- [ ] All imported items require admin approval before going live
- [ ] Multi-tenant isolation enforced

NOTES / HINTS:
- Use PapaParse or similar for CSV parsing
- For image upload, reuse the existing photo upload pattern (multipart/form-data)
- Gemini prompt for menu extraction: "Extract all IV therapy menu items from this image. Return JSON array with name, type, description, and ingredients."
- Gemini prompt for description generation: "Generate a clinical description for [item name] with ingredients [X, Y, Z]. Include benefits and when to recommend."
- Keep the AI prompts strict and structured — same pattern as signal extraction
- The catalog import should feel like a superpowered onboarding tool
```
