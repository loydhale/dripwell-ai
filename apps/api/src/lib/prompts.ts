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
