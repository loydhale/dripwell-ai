import { prisma } from '@dripwell/shared';
import { NotFoundError } from '../lib/errors.js';
import type { PatternMatchDetail } from './patterns.js';
import {
  type AssessmentId,
  type TenantId,
  type ProviderId,
  type RecommendationId,
  type CatalogItemId,
  type LocationId,
  type OverrideId,
  makeRecommendationId,
  makeCatalogItemId,
  makeOverrideId,
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

export interface PatientOutput {
  title: string;
  summary: string;
  whatWasObserved: string;
  whyThisRecommendation: string;
  whatToExpect: string;
  disclaimers: string[];
}

export async function getPendingRecommendation(params: {
  assessmentSessionId: AssessmentId;
  tenantId: TenantId;
}): Promise<{
  recommendationId: RecommendationId;
  primaryItem: CatalogItemMatch;
  alternatives: CatalogItemMatch[];
  confidence: number;
  rationale: string;
  patternName: string;
  genericIntent: string;
  status: string;
} | null> {
  const { assessmentSessionId, tenantId } = params;

  const rec = await prisma.recommendation.findFirst({
    where: {
      assessmentSessionId,
      tenantId,
      status: { in: ['PENDING', 'MODIFIED'] },
    },
    orderBy: { createdAt: 'desc' },
    include: {
      recommendationItems: {
        include: { catalogItem: true },
      },
      primaryItem: true,
    },
  });

  if (!rec) return null;

  const primaryItem = rec.recommendationItems.find((ri) => ri.isPrimary);
  const alternatives = rec.recommendationItems.filter((ri) => !ri.isPrimary);

  return {
    recommendationId: makeRecommendationId(rec.id),
    primaryItem: {
      catalogItemId: makeCatalogItemId(rec.primaryItem.id),
      name: rec.primaryItem.name,
      type: rec.primaryItem.type,
      description: rec.primaryItem.description,
      matchReason: primaryItem?.dosageNote || 'Primary recommendation',
    },
    alternatives: alternatives.map((alt) => ({
      catalogItemId: makeCatalogItemId(alt.catalogItem.id),
      name: alt.catalogItem.name,
      type: alt.catalogItem.type,
      description: alt.catalogItem.description,
      matchReason: alt.dosageNote || 'Alternative recommendation',
    })),
    confidence: rec.confidence,
    rationale: rec.rationale,
    patternName: rec.rationale.split('.')[0].replace('Primary pattern: ', ''),
    genericIntent: rec.rationale.includes('Mapped to clinical intent:')
      ? rec.rationale.split('Mapped to clinical intent:')[1].split('.')[0].trim()
      : '',
    status: rec.status,
  };
}

export async function approveRecommendation(params: {
  assessmentSessionId: AssessmentId;
  tenantId: TenantId;
  providerId: ProviderId;
}): Promise<{
  recommendationId: RecommendationId;
  patientOutput: PatientOutput;
}> {
  const { assessmentSessionId, tenantId, providerId: _providerId } = params;

  const rec = await prisma.recommendation.findFirst({
    where: {
      assessmentSessionId,
      tenantId,
      status: { in: ['PENDING', 'MODIFIED'] },
    },
    orderBy: { createdAt: 'desc' },
    include: {
      recommendationItems: {
        include: { catalogItem: true },
      },
      primaryItem: true,
    },
  });

  if (!rec) {
    throw new NotFoundError('Pending recommendation');
  }

  await prisma.recommendation.update({
    where: { id: rec.id },
    data: {
      status: 'APPROVED',
      approvedAt: new Date(),
    },
  });

  const patientOutput = await generatePatientOutput({
    recommendationId: makeRecommendationId(rec.id),
    primaryItem: {
      catalogItemId: makeCatalogItemId(rec.primaryItem.id),
      name: rec.primaryItem.name,
      type: rec.primaryItem.type,
      description: rec.primaryItem.description,
      matchReason: '',
    },
    alternatives: rec.recommendationItems
      .filter((ri) => !ri.isPrimary)
      .map((ri) => ({
        catalogItemId: makeCatalogItemId(ri.catalogItem.id),
        name: ri.catalogItem.name,
        type: ri.catalogItem.type,
        description: ri.catalogItem.description,
        matchReason: '',
      })),
    rationale: rec.rationale,
    _confidence: rec.confidence,
    _patternName: rec.rationale.split('.')[0].replace('Primary pattern: ', ''),
    assessmentSessionId,
    tenantId,
  });

  return {
    recommendationId: makeRecommendationId(rec.id),
    patientOutput,
  };
}

export async function overrideRecommendation(params: {
  assessmentSessionId: AssessmentId;
  tenantId: TenantId;
  providerId: ProviderId;
  reason: 'CLINICAL_JUDGEMENT' | 'PATIENT_PREFERENCE' | 'CONTRAINDICATION' | 'OTHER';
  reasonNote?: string;
  manualRecommendation?: string;
}): Promise<{
  overrideId: OverrideId;
  recommendationId: RecommendationId;
}> {
  const { assessmentSessionId, tenantId, providerId, reason, reasonNote, manualRecommendation } = params;

  const rec = await prisma.recommendation.findFirst({
    where: {
      assessmentSessionId,
      tenantId,
      status: { in: ['PENDING', 'MODIFIED'] },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!rec) {
    throw new NotFoundError('Pending recommendation');
  }

  await prisma.recommendation.update({
    where: { id: rec.id },
    data: { status: 'REJECTED' },
  });

  const override = await prisma.providerOverride.create({
    data: {
      assessmentSessionId,
      tenantId,
      providerId,
      recommendationId: rec.id,
      overrideType: 'OVERRIDE',
      reason,
      reasonNote: reasonNote || null,
      originalValue: rec.rationale,
      newValue: manualRecommendation || null,
    },
  });

  // Record in change log
  const provider = await prisma.user.findUnique({
    where: { id: providerId },
    select: { firstName: true, lastName: true },
  });

  await prisma.assessmentChangeLog.create({
    data: {
      assessmentSessionId,
      tenantId,
      providerId,
      actionType: 'OVERRIDE',
      originalValue: {
        rationale: rec.rationale,
        primaryCatalogItemId: rec.primaryCatalogItemId,
        confidence: rec.confidence,
      } as unknown as object,
      modifiedValue: {
        manualRecommendation: manualRecommendation || null,
        reason,
        reasonNote: reasonNote || null,
      } as unknown as object,
      changedFields: ['recommendation'] as unknown as object,
      providerName: provider ? `${provider.firstName} ${provider.lastName}` : 'Unknown Provider',
    },
  });

  return {
    overrideId: makeOverrideId(override.id),
    recommendationId: makeRecommendationId(rec.id),
  };
}

export async function modifyRecommendation(params: {
  assessmentSessionId: AssessmentId;
  tenantId: TenantId;
  providerId: ProviderId;
  primaryCatalogItemId?: CatalogItemId;
  rationale?: string;
  confidence?: number;
}): Promise<{
  recommendationId: RecommendationId;
  primaryItem: CatalogItemMatch;
  alternatives: CatalogItemMatch[];
  confidence: number;
  rationale: string;
}> {
  const { assessmentSessionId, tenantId, providerId, primaryCatalogItemId, rationale, confidence } = params;

  const rec = await prisma.recommendation.findFirst({
    where: {
      assessmentSessionId,
      tenantId,
      status: 'PENDING',
    },
    orderBy: { createdAt: 'desc' },
    include: {
      recommendationItems: {
        include: { catalogItem: true },
      },
    },
  });

  if (!rec) {
    throw new NotFoundError('Pending recommendation');
  }

  const originalRationale = rec.rationale;
  const originalPrimaryId = rec.primaryCatalogItemId;

  const updateData: {
    status: 'MODIFIED';
    rationale?: string;
    confidence?: number;
    primaryCatalogItemId?: string;
  } = { status: 'MODIFIED' };

  if (rationale !== undefined) updateData.rationale = rationale;
  if (confidence !== undefined) updateData.confidence = confidence;
  if (primaryCatalogItemId !== undefined) updateData.primaryCatalogItemId = primaryCatalogItemId;

  const updatedRec = await prisma.recommendation.update({
    where: { id: rec.id },
    data: updateData,
    include: {
      recommendationItems: {
        include: { catalogItem: true },
      },
      primaryItem: true,
    },
  });

  // If primary item changed, update recommendationItems
  if (primaryCatalogItemId !== undefined && primaryCatalogItemId !== originalPrimaryId) {
    await prisma.recommendationItem.updateMany({
      where: { recommendationId: rec.id },
      data: { isPrimary: false },
    });
    const existingItem = await prisma.recommendationItem.findFirst({
      where: {
        recommendationId: rec.id,
        catalogItemId: primaryCatalogItemId,
      },
    });
    if (existingItem) {
      await prisma.recommendationItem.update({
        where: { id: existingItem.id },
        data: { isPrimary: true },
      });
    } else {
      await prisma.recommendationItem.create({
        data: {
          recommendationId: rec.id,
          catalogItemId: primaryCatalogItemId,
          isPrimary: true,
        },
      });
    }
  }

  // Log modification for audit / model learning
  await prisma.providerOverride.create({
    data: {
      assessmentSessionId,
      tenantId,
      providerId,
      recommendationId: rec.id,
      overrideType: 'MODIFY',
      reason: 'CLINICAL_JUDGEMENT',
      reasonNote: `Provider modified recommendation. Original rationale: ${originalRationale}`,
      originalValue: originalPrimaryId,
      newValue: primaryCatalogItemId || originalPrimaryId,
    },
  });

  // Record in change log
  const changedFields: string[] = [];
  if (rationale !== undefined && rationale !== originalRationale) {
    changedFields.push('rationale');
  }
  if (primaryCatalogItemId !== undefined && primaryCatalogItemId !== originalPrimaryId) {
    changedFields.push('primaryCatalogItemId');
  }
  if (confidence !== undefined && confidence !== rec.confidence) {
    changedFields.push('confidence');
  }

  if (changedFields.length > 0) {
    const provider = await prisma.user.findUnique({
      where: { id: providerId },
      select: { firstName: true, lastName: true },
    });

    await prisma.assessmentChangeLog.create({
      data: {
        assessmentSessionId,
        tenantId,
        providerId,
        actionType: 'MODIFY',
        originalValue: {
          rationale: originalRationale,
          primaryCatalogItemId: originalPrimaryId,
          confidence: rec.confidence,
        } as unknown as object,
        modifiedValue: {
          rationale: updatedRec.rationale,
          primaryCatalogItemId: updatedRec.primaryCatalogItemId,
          confidence: updatedRec.confidence,
        } as unknown as object,
        changedFields: changedFields as unknown as object,
        providerName: provider ? `${provider.firstName} ${provider.lastName}` : 'Unknown Provider',
      },
    });
  }

  const primaryItem = updatedRec.recommendationItems.find((ri) => ri.isPrimary);
  const alternatives = updatedRec.recommendationItems.filter((ri) => !ri.isPrimary);

  return {
    recommendationId: makeRecommendationId(updatedRec.id),
    primaryItem: {
      catalogItemId: makeCatalogItemId(updatedRec.primaryItem.id),
      name: updatedRec.primaryItem.name,
      type: updatedRec.primaryItem.type,
      description: updatedRec.primaryItem.description,
      matchReason: primaryItem?.dosageNote || 'Primary recommendation',
    },
    alternatives: alternatives.map((alt) => ({
      catalogItemId: makeCatalogItemId(alt.catalogItem.id),
      name: alt.catalogItem.name,
      type: alt.catalogItem.type,
      description: alt.catalogItem.description,
      matchReason: alt.dosageNote || 'Alternative recommendation',
    })),
    confidence: updatedRec.confidence,
    rationale: updatedRec.rationale,
  };
}

async function generatePatientOutput(params: {
  recommendationId: RecommendationId;
  primaryItem: CatalogItemMatch;
  alternatives: CatalogItemMatch[];
  rationale: string;
  _confidence: number;
  _patternName: string;
  assessmentSessionId: AssessmentId;
  tenantId: TenantId;
}): Promise<PatientOutput> {
  const { primaryItem, alternatives, rationale, assessmentSessionId, tenantId } = params;

  // Fetch supporting signals for the patient output
  const signals = await prisma.visualSignal.findMany({
    where: { assessmentSessionId, tenantId },
    orderBy: { confidence: 'desc' },
    take: 3,
  });

  const signalDescriptions = signals.map((s) => {
    const name = s.signalName.replace(/_/g, ' ').toLowerCase();
    return `We observed ${name} during your photo analysis`;
  });

  const title = `Your Personalized IV Therapy Recommendation`;

  const summary = `Based on your assessment, our licensed provider has reviewed and approved a recommendation for ${primaryItem.name}. This recommendation was made after reviewing your photos and responses.`;

  const whatWasObserved = signalDescriptions.length > 0
    ? `${signalDescriptions.join('. ')}. These visual indicators, along with your responses to our follow-up questions, helped us understand your current wellness needs.`
    : `Your responses to our follow-up questions helped us understand your current wellness needs.`;

  const whyThisRecommendation = rationale
    .replace(/Primary pattern: [^.]+\./, '')
    .replace(/Mapped to clinical intent: [^.]+\./, '')
    .trim();

  const altText = alternatives.length > 0
    ? ` Other options that may also support your goals include ${alternatives.map((a) => a.name).join(' and ')}.`
    : '';

  const whatToExpect = `Your provider recommends ${primaryItem.name}.${altText} This therapy is designed to support your wellness goals based on what we observed during your assessment. Every patient responds differently, and your provider will monitor your progress.`;

  const disclaimers = [
    'This recommendation has been reviewed and approved by a licensed medical provider.',
    'This information is for wellness purposes and is not a substitute for professional medical advice, diagnosis, or treatment.',
    'Always seek the advice of your physician or other qualified health provider with any questions you may have regarding a medical condition.',
    'Individual results may vary. Your provider will discuss expected outcomes during your visit.',
  ];

  return {
    title,
    summary,
    whatWasObserved,
    whyThisRecommendation,
    whatToExpect,
    disclaimers,
  };
}

export async function escalateRecommendation(params: {
  assessmentSessionId: AssessmentId;
  tenantId: TenantId;
  providerId: ProviderId;
  reason: 'NEEDS_PHYSICIAN_REVIEW' | 'COMPLEX_CASE' | 'PATIENT_REQUEST' | 'OTHER';
  notes?: string;
}): Promise<{
  escalationId: string;
  patientOutput: PatientOutput;
}> {
  const { assessmentSessionId, tenantId, providerId, reason, notes } = params;

  const rec = await prisma.recommendation.findFirst({
    where: {
      assessmentSessionId,
      tenantId,
      status: { in: ['PENDING', 'MODIFIED'] },
    },
    orderBy: { createdAt: 'desc' },
    include: {
      recommendationItems: {
        include: { catalogItem: true },
      },
      primaryItem: true,
    },
  });

  if (!rec) {
    throw new NotFoundError('Pending recommendation');
  }

  await prisma.recommendation.update({
    where: { id: rec.id },
    data: { status: 'REJECTED' },
  });

  const escalation = await prisma.providerOverride.create({
    data: {
      assessmentSessionId,
      tenantId,
      providerId,
      recommendationId: rec.id,
      overrideType: 'ESCALATE',
      reason: 'OTHER',
      reasonNote: `Escalated: ${reason}. ${notes || ''}`.trim(),
      originalValue: rec.rationale,
      newValue: null,
    },
  });

  const provider = await prisma.user.findUnique({
    where: { id: providerId },
    select: { firstName: true, lastName: true },
  });

  await prisma.assessmentChangeLog.create({
    data: {
      assessmentSessionId,
      tenantId,
      providerId,
      actionType: 'ESCALATE',
      originalValue: { rationale: rec.rationale, primaryCatalogItemId: rec.primaryCatalogItemId } as unknown as object,
      changedFields: ['status'] as unknown as object,
      providerName: provider ? `${provider.firstName} ${provider.lastName}` : 'Unknown Provider',
    },
  });

  const patientOutput: PatientOutput = {
    title: 'Assessment Referred to Physician',
    summary: 'Your assessment has been referred to a senior clinician or physician for review.',
    whatWasObserved: 'Based on your photos and responses, your provider has determined that additional clinical review is needed.',
    whyThisRecommendation: `Reason for escalation: ${reason.replace(/_/g, ' ').toLowerCase()}.${notes ? ` Notes: ${notes}` : ''}`,
    whatToExpect: 'A senior clinician or physician will review your assessment and determine the most appropriate treatment plan. You will be contacted with next steps.',
    disclaimers: [
      'This assessment requires additional clinical review.',
      'Please follow up with clinic staff for scheduling.',
    ],
  };

  return {
    escalationId: escalation.id,
    patientOutput,
  };
}

export async function deferRecommendation(params: {
  assessmentSessionId: AssessmentId;
  tenantId: TenantId;
  providerId: ProviderId;
  reason: 'NEED_MORE_INFO' | 'PATIENT_NOT_READY' | 'FOLLOW_UP_NEEDED' | 'OTHER';
  followUpDate?: string;
  notes?: string;
}): Promise<{
  deferralId: string;
  patientOutput: PatientOutput;
}> {
  const { assessmentSessionId, tenantId, providerId, reason, followUpDate, notes } = params;

  const rec = await prisma.recommendation.findFirst({
    where: {
      assessmentSessionId,
      tenantId,
      status: { in: ['PENDING', 'MODIFIED'] },
    },
    orderBy: { createdAt: 'desc' },
    include: {
      recommendationItems: {
        include: { catalogItem: true },
      },
      primaryItem: true,
    },
  });

  if (!rec) {
    throw new NotFoundError('Pending recommendation');
  }

  await prisma.recommendation.update({
    where: { id: rec.id },
    data: { status: 'REJECTED' },
  });

  const deferral = await prisma.providerOverride.create({
    data: {
      assessmentSessionId,
      tenantId,
      providerId,
      recommendationId: rec.id,
      overrideType: 'DEFER',
      reason: 'OTHER',
      reasonNote: `Deferred: ${reason}. ${followUpDate ? `Follow-up date: ${followUpDate}. ` : ''}${notes || ''}`.trim(),
      originalValue: rec.rationale,
      newValue: null,
    },
  });

  const provider = await prisma.user.findUnique({
    where: { id: providerId },
    select: { firstName: true, lastName: true },
  });

  await prisma.assessmentChangeLog.create({
    data: {
      assessmentSessionId,
      tenantId,
      providerId,
      actionType: 'DEFER',
      originalValue: { rationale: rec.rationale, primaryCatalogItemId: rec.primaryCatalogItemId } as unknown as object,
      changedFields: ['status'] as unknown as object,
      providerName: provider ? `${provider.firstName} ${provider.lastName}` : 'Unknown Provider',
    },
  });

  const patientOutput: PatientOutput = {
    title: 'Assessment Postponed',
    summary: 'Your assessment has been postponed. A follow-up plan will be arranged.',
    whatWasObserved: 'Your provider has reviewed your assessment and determined that additional information or preparation is needed before proceeding.',
    whyThisRecommendation: `Reason for deferral: ${reason.replace(/_/g, ' ').toLowerCase()}.${followUpDate ? ` A follow-up is planned for ${new Date(followUpDate).toLocaleDateString()}.` : ''}${notes ? ` Notes: ${notes}` : ''}`,
    whatToExpect: followUpDate
      ? `Please plan to return on ${new Date(followUpDate).toLocaleDateString()} for a follow-up assessment. Your provider will contact you with any additional instructions.`
      : 'Your provider will contact you with next steps and any additional information needed.',
    disclaimers: [
      'This assessment has been postponed for your safety and wellbeing.',
      'Please follow up with clinic staff for rescheduling.',
    ],
  };

  return {
    deferralId: deferral.id,
    patientOutput,
  };
}

export async function getChangeLog(params: {
  assessmentSessionId: AssessmentId;
  tenantId: TenantId;
}): Promise<Array<{
  id: string;
  actionType: string;
  changedFields: string[];
  originalValue: object | null;
  modifiedValue: object | null;
  providerName: string;
  createdAt: Date;
}>> {
  const { assessmentSessionId, tenantId } = params;

  const logs = await prisma.assessmentChangeLog.findMany({
    where: {
      assessmentSessionId,
      tenantId,
    },
    orderBy: { createdAt: 'desc' },
  });

  return logs.map((log: typeof logs[0]) => ({
    id: log.id,
    actionType: log.actionType,
    changedFields: (log.changedFields as unknown as string[]) || [],
    originalValue: log.originalValue as unknown as object,
    modifiedValue: log.modifiedValue as unknown as object,
    providerName: log.providerName,
    createdAt: log.createdAt,
  }));
}
