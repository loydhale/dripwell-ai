import { z } from 'zod';
import { getVisionModel, VISION_MOCK_MODE } from '../lib/gemini.js';
import { buildVisionPrompt, SIGNAL_TAXONOMY, type SignalTaxonomyName } from '../lib/prompts.js';
import { getPhotoStorage } from '../lib/storage.js';
import { ServiceUnavailableError } from '../lib/errors.js';

type PhotoAngle = 'FACE' | 'UNDER_EYES' | 'HAND_FOREARM' | 'TONGUE';

interface PhotoCapture {
  id: string;
  angle: PhotoAngle;
  url: string;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExtractedSignal {
  name: SignalTaxonomyName;
  confidence: number;
  value?: string;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  [key: string]: unknown;
}

export interface PhotoAnalysisResult {
  photoCaptureId: string;
  angle: PhotoAngle;
  signals: ExtractedSignal[];
  rawResponse: string;
  tokenUsage?: TokenUsage;
}

export interface VisionAnalysisResult {
  results: PhotoAnalysisResult[];
  totalPhotos: number;
  totalSignals: number;
  lowConfidenceCount: number;
}

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const extractedSignalSchema = z.object({
  name: z.string(),
  confidence: z.number().min(0).max(1),
  value: z.string().optional(),
});

const geminiResponseSchema = z.object({
  signals: z.array(extractedSignalSchema),
});

// ---------------------------------------------------------------------------
// Signal name mapping: camelCase <-> SCREAMING_SNAKE_CASE
// ---------------------------------------------------------------------------

const signalNameToPrisma: Record<string, string> = {
  conjunctivalPallor: 'CONJUNCTIVAL_PALLOR',
  underEyeDarkness: 'UNDER_EYE_DARKNESS',
  underEyePuffiness: 'UNDER_EYE_PUFFINESS',
  scleraTint: 'SCLERA_TINT',
  lipDryness: 'LIP_DRYNESS',
  lipPallor: 'LIP_PALLOR',
  angularCheilitis: 'ANGULAR_CHEILITIS',
  tongueColor: 'TONGUE_COLOR',
  tongueSurface: 'TONGUE_SURFACE',
  facialDullness: 'FACIAL_DULLNESS',
  facialRedness: 'FACIAL_REDNESS',
  skinTexture: 'SKIN_TEXTURE',
  nailBedColor: 'NAIL_BED_COLOR',
  nailRidging: 'NAIL_RIDGING',
  nailSpooning: 'NAIL_SPOONING',
  hairQuality: 'HAIR_QUALITY',
  postureAffect: 'POSTURE_AFFECT',
};

export function toPrismaSignalName(name: string): string | null {
  return signalNameToPrisma[name] || null;
}

// ---------------------------------------------------------------------------
// Confidence threshold (configurable per signal in future)
// ---------------------------------------------------------------------------

const DEFAULT_CONFIDENCE_THRESHOLD = 0.6;

export function isConfidenceAcceptable(confidence: number): boolean {
  return confidence >= DEFAULT_CONFIDENCE_THRESHOLD;
}

// ---------------------------------------------------------------------------
// Core analysis
// ---------------------------------------------------------------------------

export async function analyzePhotos(params: {
  photos: PhotoCapture[];
}): Promise<VisionAnalysisResult> {
  const { photos } = params;

  if (photos.length === 0) {
    return { results: [], totalPhotos: 0, totalSignals: 0, lowConfidenceCount: 0 };
  }

  if (photos.length > 4) {
    throw new ServiceUnavailableError('Cannot analyze more than 4 photos per assessment in this version');
  }

  const results: PhotoAnalysisResult[] = [];

  if (VISION_MOCK_MODE) {
    for (const photo of photos) {
      const mockResult = generateMockSignals(photo);
      results.push(mockResult);
    }
  } else {
    for (const photo of photos) {
      const result = await analyzeSinglePhoto(photo);
      results.push(result);
    }
  }

  const totalSignals = results.reduce((sum, r) => sum + r.signals.length, 0);
  const lowConfidenceCount = results.reduce(
    (sum, r) => sum + r.signals.filter((s) => !isConfidenceAcceptable(s.confidence)).length,
    0
  );

  return {
    results,
    totalPhotos: photos.length,
    totalSignals,
    lowConfidenceCount,
  };
}

async function analyzeSinglePhoto(photo: PhotoCapture): Promise<PhotoAnalysisResult> {
  const storage = getPhotoStorage();
  const photoBuffer = await storage.getPhotoBuffer(photo.url);
  const base64Data = photoBuffer.toString('base64');

  const mimeType = inferMimeTypeFromUrl(photo.url);
  const prompt = buildVisionPrompt({
    angle: photo.angle,
    taxonomy: SIGNAL_TAXONOMY,
  });

  let rawText: string;
  let tokenUsage: TokenUsage | undefined;

  try {
    const model = getVisionModel();
    const result = await model.generateContent([
      { text: prompt },
      {
        inlineData: {
          mimeType,
          data: base64Data,
        },
      },
    ]);

    rawText = result.response.text();

    const usage = result.response.usageMetadata;
    if (usage) {
      tokenUsage = {
        promptTokens: usage.promptTokenCount ?? 0,
        completionTokens: usage.candidatesTokenCount ?? 0,
        totalTokens: usage.totalTokenCount ?? 0,
      };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new ServiceUnavailableError(`Gemini vision API failed: ${message}`);
  }

  const signals = parseAndValidateSignals(rawText);

  return {
    photoCaptureId: photo.id,
    angle: photo.angle,
    signals,
    rawResponse: rawText,
    tokenUsage,
  };
}

function inferMimeTypeFromUrl(url: string): string {
  if (url.endsWith('.png')) return 'image/png';
  if (url.endsWith('.jpg') || url.endsWith('.jpeg')) return 'image/jpeg';
  if (url.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}

function parseAndValidateSignals(rawText: string): ExtractedSignal[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new ServiceUnavailableError('Gemini returned malformed JSON');
  }

  const validation = geminiResponseSchema.safeParse(parsed);
  if (!validation.success) {
    throw new ServiceUnavailableError('Gemini response does not match expected schema');
  }

  const validSignals: ExtractedSignal[] = [];
  for (const s of validation.data.signals) {
    if (!SIGNAL_TAXONOMY.includes(s.name as SignalTaxonomyName)) {
      continue;
    }
    validSignals.push({
      name: s.name as SignalTaxonomyName,
      confidence: s.confidence,
      value: s.value,
    });
  }

  return validSignals;
}

// ---------------------------------------------------------------------------
// Mock mode: realistic demo signals per photo angle
// ---------------------------------------------------------------------------

function generateMockSignals(photo: PhotoCapture): PhotoAnalysisResult {
  const signalsByAngle: Record<string, ExtractedSignal[]> = {
    FACE: [
      { name: 'facialDullness', confidence: 0.72, value: 'moderate' },
      { name: 'underEyeDarkness', confidence: 0.68, value: 'mild' },
      { name: 'lipDryness', confidence: 0.81, value: 'moderate' },
      { name: 'skinTexture', confidence: 0.55, value: 'rough' },
      { name: 'hairQuality', confidence: 0.63, value: 'dull' },
    ],
    UNDER_EYES: [
      { name: 'underEyeDarkness', confidence: 0.78, value: 'moderate' },
      { name: 'underEyePuffiness', confidence: 0.65, value: 'mild' },
      { name: 'conjunctivalPallor', confidence: 0.71, value: 'mild' },
      { name: 'scleraTint', confidence: 0.52, value: 'normal' },
    ],
    HAND_FOREARM: [
      { name: 'nailBedColor', confidence: 0.74, value: 'pale' },
      { name: 'nailRidging', confidence: 0.61, value: 'mild' },
      { name: 'skinTexture', confidence: 0.58, value: 'dry' },
      { name: 'nailSpooning', confidence: 0.42, value: 'none' },
    ],
    TONGUE: [
      { name: 'tongueColor', confidence: 0.83, value: 'pale pink' },
      { name: 'tongueSurface', confidence: 0.69, value: 'smooth' },
      { name: 'angularCheilitis', confidence: 0.44, value: 'none' },
    ],
  };

  const rawResponse = JSON.stringify({
    signals: signalsByAngle[photo.angle] || [],
  });

  return {
    photoCaptureId: photo.id,
    angle: photo.angle,
    signals: signalsByAngle[photo.angle] || [],
    rawResponse,
    tokenUsage: {
      promptTokens: 1200,
      completionTokens: 180,
      totalTokens: 1380,
    },
  };
}
