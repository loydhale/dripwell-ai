import { prisma } from '../lib/prisma.js';
import { NotFoundError } from '../lib/errors.js';
import type { PatternMatchDetail } from './patterns.js';
import {
  type AssessmentId,
  type TenantId,
  type ProviderId,
  type RecommendationId,
  type CatalogItemId,
  type LocationId,
  makeRecommendationId,
  makeCatalogItemId,
} from '@dripwell/shared';

// Keyword scoring for generic intent -> catalog item matching
const INTENT_KEYWORD_OVERRIDES: Record<string, string[]> = {
  'iron-support': ['iron', 'myers', 'energy', 'vitamin'],
  'hydration': ['hydration', 'saline', 'fluid', 'myers'],
  'b-complex': ['b12', 'b-complex', 'myers', 'vitamin', 'complex'],
  'magnesium': ['magnesium', 'myers', 'stress', 'relax'],
  'glutathione': ['glutathione', 'antioxidant', 'recovery'],
  'anti-inflammatory': ['anti-inflam', 'recovery', 'glutathione', 'inflammatory'],
  'vitamin b12': ['b12', 'vitamin', 'injection', 'myers'],
  'folate': ['folate', 'b12', 'vitamin', 'myers'],
};

export interface CatalogItemMatch {
  catalogItemId: CatalogItemId;
  name: string;
  type: string;
  description: string | null;
  matchReason: string;
}

export interface RecommendationResult {
  recommendationId: RecommendationId;
  primaryItem: CatalogItemMatch;
  alternatives: CatalogItemMatch[];
  confidence: number;
  rationale: string;
  patternName: string;
  genericIntent: string;
}

export async function generateRecommendation(params: {
  assessmentSessionId: AssessmentId;
  tenantId: TenantId;
  providerId: ProviderId;
  locationId: LocationId | null;
  topPattern: PatternMatchDetail;
  allPatterns: PatternMatchDetail[];
  isReturning: boolean;
  priorSessionId: AssessmentId | null;
}): Promise<RecommendationResult> {
  const { assessmentSessionId, tenantId, providerId, topPattern, allPatterns, isReturning } = params;

  const catalogItems = await prisma.catalogItem.findMany({
    where: {
      tenantId,
      isActive: true,
      isInStock: true,
    },
  });

  if (catalogItems.length === 0) {
    throw new NotFoundError('Active in-stock catalog items for this tenant');
  }

  // Layer 1: generic intent from top pattern
  let intent = topPattern.genericIntent;

  // Layer 3: First-visit consistency bias
  let adjustedTopConfidence = topPattern.confidence;
  const FIRST_VISIT_INTENTS = ['hydration', 'b-complex', 'vitamin b12'];
  if (!isReturning) {
    const lowerIntent = topPattern.genericIntent.toLowerCase();
    const isConservativeFirstVisit = FIRST_VISIT_INTENTS.some((fi) => lowerIntent.includes(fi));
    if (isConservativeFirstVisit) {
      adjustedTopConfidence = Math.min(1.0, topPattern.confidence + 0.05);
    }
  }

  // Layer 3: Hydration default when ambiguous
  const secondPattern = allPatterns[1] || undefined;
  const secondConfidence = secondPattern?.confidence || 0;
  const isAmbiguous = adjustedTopConfidence < 0.6 || (adjustedTopConfidence - secondConfidence) < 0.15;

  if (isAmbiguous) {
    intent = applyHydrationDefault(intent);
  }

  // Layer 2: Map intent to catalog items
  const scoredItems = scoreCatalogItems(intent, catalogItems);

  // Ensure primary item
  let primaryItem = scoredItems[0];
  if (!primaryItem) {
    const fallback = catalogItems[0];
    primaryItem = {
      catalogItemId: makeCatalogItemId(fallback.id),
      name: fallback.name,
      type: fallback.type,
      description: fallback.description,
      matchReason: 'Fallback: no intent match, using first available catalog item',
    };
  }

  // Build alternatives (up to 2)
  const altItems: CatalogItemMatch[] = [];

  // Try remaining items from the same intent match
  for (const item of scoredItems.slice(1)) {
    if (item.catalogItemId !== primaryItem.catalogItemId) {
      altItems.push(item);
    }
    if (altItems.length >= 2) break;
  }

  // If still short, try other top patterns' intents
  let patternIdx = 1;
  while (altItems.length < 2 && patternIdx < allPatterns.length) {
    const otherPattern = allPatterns[patternIdx];
    if (otherPattern) {
      const otherScored = scoreCatalogItems(otherPattern.genericIntent, catalogItems);
      for (const item of otherScored) {
        if (
          item.catalogItemId !== primaryItem.catalogItemId &&
          !altItems.some((a) => a.catalogItemId === item.catalogItemId)
        ) {
          altItems.push(item);
        }
        if (altItems.length >= 2) break;
      }
    }
    patternIdx += 1;
  }

  // Final fallback: any other catalog item
  for (const item of catalogItems) {
    if (
      item.id !== primaryItem.catalogItemId &&
      !altItems.some((a) => a.catalogItemId === item.id)
    ) {
      altItems.push({
        catalogItemId: makeCatalogItemId(item.id),
        name: item.name,
        type: item.type,
        description: item.description,
        matchReason: 'Alternative catalog item',
      });
    }
    if (altItems.length >= 2) break;
  }

  // Build rationale
  const rationale = buildRationale(topPattern, adjustedTopConfidence, isAmbiguous);

  // Persist recommendation
  const recommendation = await prisma.recommendation.create({
    data: {
      assessmentSessionId,
      tenantId,
      providerId,
      primaryCatalogItemId: primaryItem.catalogItemId,
      rationale,
      confidence: adjustedTopConfidence,
      status: 'PENDING',
      recommendationItems: {
        create: [
          { catalogItemId: primaryItem.catalogItemId, isPrimary: true },
          ...altItems.slice(0, 2).map((alt) => ({
            catalogItemId: alt.catalogItemId,
            isPrimary: false,
          })),
        ],
      },
    },
    include: {
      recommendationItems: {
        include: { catalogItem: true },
      },
    },
  });

  return {
    recommendationId: makeRecommendationId(recommendation.id),
    primaryItem,
    alternatives: altItems.slice(0, 2),
    confidence: adjustedTopConfidence,
    rationale,
    patternName: topPattern.clinicalPatternName,
    genericIntent: intent,
  };
}

function applyHydrationDefault(intent: string): string {
  const lower = intent.toLowerCase();
  if (lower.includes('hydration') || lower.includes('fluid') || lower.includes('saline')) {
    return intent;
  }
  return `Hydration-supported: ${intent}`;
}

function scoreCatalogItems(intent: string, catalogItems: Array<{ id: string; name: string; description: string | null; type: string }>): CatalogItemMatch[] {
  const keywords = extractKeywords(intent);
  const scored = catalogItems.map((item) => {
    const nameLower = item.name.toLowerCase();
    const descLower = (item.description || '').toLowerCase();
    let score = 0;

    for (const kw of keywords) {
      const kwLower = kw.toLowerCase();
      if (nameLower.includes(kwLower)) score += 3;
      if (descLower.includes(kwLower)) score += 1;
    }

    // Prefer drips for primary recommendation
    if (item.type === 'DRIP') score += 0.5;

    return { item, score };
  });

  scored.sort((a, b) => b.score - a.score);

  return scored
    .filter((s) => s.score > 0)
    .map((s) => ({
      catalogItemId: makeCatalogItemId(s.item.id),
      name: s.item.name,
      type: s.item.type,
      description: s.item.description,
      matchReason: `Matched intent keywords: ${keywords.join(', ')}`,
    }));
}

function extractKeywords(intent: string): string[] {
  const lower = intent.toLowerCase();

  for (const [key, kws] of Object.entries(INTENT_KEYWORD_OVERRIDES)) {
    if (lower.includes(key)) return [...kws];
  }

  // Fallback: extract meaningful words
  return lower
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3 && !['with', 'from', 'this', 'that', 'then', 'than', 'into', 'onto', 'support', 'blend'].includes(w));
}

function buildRationale(
  pattern: PatternMatchDetail,
  confidence: number,
  isAmbiguous: boolean
): string {
  const parts: string[] = [];
  parts.push(`Primary pattern: ${pattern.clinicalPatternName} (confidence ${(confidence * 100).toFixed(0)}%)`);

  if (pattern.matchedSignals.length > 0) {
    const signalNames = pattern.matchedSignals
      .map((s) => s.signalName.replace(/_/g, ' ').toLowerCase())
      .join(', ');
    parts.push(`Supporting visual signals: ${signalNames}`);
  }

  if (pattern.matchedAnswers.length > 0) {
    parts.push(`Supporting patient-reported indicators: ${pattern.matchedAnswers.length} question responses align`);
  }

  parts.push(`Mapped to clinical intent: ${pattern.genericIntent}`);

  if (isAmbiguous) {
    parts.push('Pattern confidence is ambiguous; hydration default applied for conservative support');
  }

  if (pattern.clinicalRationale) {
    parts.push(`Clinical rationale: ${pattern.clinicalRationale}`);
  }

  return parts.join('. ') + '.';
}
