export const SIGNAL_TAXONOMY = [
  'conjunctivalPallor',
  'underEyeDarkness',
  'underEyePuffiness',
  'scleraTint',
  'lipDryness',
  'lipPallor',
  'angularCheilitis',
  'tongueColor',
  'tongueSurface',
  'facialDullness',
  'facialRedness',
  'skinTexture',
  'nailBedColor',
  'nailRidging',
  'nailSpooning',
  'hairQuality',
  'postureAffect',
] as const;

export type SignalTaxonomyName = (typeof SIGNAL_TAXONOMY)[number];

export interface VisionPromptContext {
  angle: string;
  taxonomy: readonly string[];
}

export function buildVisionPrompt(ctx: VisionPromptContext): string {
  const taxonomyList = ctx.taxonomy.join(', ');

  return `You are a medical wellness photo analysis assistant. Analyze the provided photo and extract structured wellness signals.

PHOTO ANGLE: ${ctx.angle}

INSTRUCTIONS:
1. Examine the photo carefully for visible wellness indicators.
2. From the following taxonomy, detect only the signals that are clearly visible and assessable from this photo angle:
   ${taxonomyList}
3. For each detected signal, provide:
   - "name": the exact signal name from the taxonomy (use camelCase as shown)
   - "confidence": a number from 0.0 to 1.0 representing your certainty
   - "value": an optional short descriptive value (e.g., "mild", "moderate", "severe", "pink", "pale", "dry", "smooth")
4. Do NOT include signals you cannot confidently assess from this photo.
5. Return ONLY a JSON object. No markdown, no explanations, no prose.

OUTPUT FORMAT (strict JSON only):
{
  "signals": [
    {
      "name": "signalNameFromTaxonomy",
      "confidence": 0.85,
      "value": "mild"
    }
  ]
}

RULES:
- If no signals are clearly detectable, return {"signals": []}.
- Confidence must be a decimal between 0.0 and 1.0.
- Use the exact signal names from the taxonomy. Do not invent new names.
- The response must be valid JSON and nothing else.`;
}

// ---------------------------------------------------------------------------
// Catalog import prompts
// ---------------------------------------------------------------------------

const VALID_CATALOG_TYPES = ['DRIP', 'ADD_ON', 'INJECTION', 'PEPTIDE'];

export interface MenuExtractionContext {
  taxonomy?: string[];
}

export function buildMenuExtractionPrompt(_ctx?: MenuExtractionContext): string {
  const typeList = VALID_CATALOG_TYPES.join(', ');

  return `You are a medical spa menu extraction assistant. Analyze the provided menu image and extract all IV therapy items.

INSTRUCTIONS:
1. Read the menu image carefully.
2. Extract every IV therapy, injection, peptide, or add-on item listed.
3. For each item, provide:
   - "name": the exact item name as shown on the menu
   - "type": one of ${typeList}
   - "description": a brief description of what the item is (copy from menu if available, otherwise summarize)
   - "ingredients": an array of ingredient names mentioned for this item (e.g., ["Vitamin C", "B-complex", "Magnesium"]). If none are mentioned, return an empty array.
4. If you cannot determine the type, use "DRIP" as the default.
5. Return ONLY a JSON object. No markdown, no explanations, no prose.

OUTPUT FORMAT (strict JSON only):
{
  "items": [
    {
      "name": "Myers' Cocktail",
      "type": "DRIP",
      "description": "Classic blend of vitamins and minerals for energy and immunity.",
      "ingredients": ["B-complex", "Vitamin C", "Magnesium"]
    }
  ]
}

RULES:
- If no items are found, return {"items": []}.
- The type must be exactly one of: ${typeList}.
- Ingredient names should be plain text, not dosage amounts.
- The response must be valid JSON and nothing else.`;
}

export interface DescriptionGenerationContext {
  name: string;
  ingredients: string[];
  type: string;
}

export function buildCatalogDescriptionPrompt(ctx: DescriptionGenerationContext): string {
  const ingredientsText = ctx.ingredients.length > 0 ? ctx.ingredients.join(', ') : 'none listed';

  return `You are a clinical wellness copywriter for an IV therapy spa. Generate a concise, clinical description for a catalog item.

ITEM NAME: ${ctx.name}
TYPE: ${ctx.type}
INGREDIENTS: ${ingredientsText}

INSTRUCTIONS:
1. Write a short clinical description (2 to 3 sentences) that includes:
   - Key ingredients and what they do
   - Primary benefits
   - When to recommend this item to a patient
2. Keep it factual, professional, and suitable for a licensed provider to review.
3. Do not include pricing, marketing hype, or guarantees.
4. Return ONLY a JSON object with a single "description" field. No markdown, no explanations, no prose.

OUTPUT FORMAT (strict JSON only):
{
  "description": "Key ingredients: B-complex, Vitamin C, Magnesium. Supports energy, immunity, and hydration. Recommend for fatigue, stress, or general wellness."
}

RULES:
- The response must be valid JSON and nothing else.
- The description field must be a non-empty string.`;
}
