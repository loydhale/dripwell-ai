import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PDFDocument } from 'pdf-lib';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import {
  actualCareSchema, clinicConfigurationSchema, currentWellnessPlanSchema,
  emptyConsultationSummary, recommendInitial, recommendWellness, wellnessPlanSchema,
  validateWellnessSelection, type ClinicConfiguration, type WellnessPlan,
} from '@dripwell/shared/v2';
import type { ClinicActor } from './auth';

const boundary = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('./db', () => ({ getDb: boundary.getDb }));
vi.mock('next/headers', () => ({ cookies: vi.fn() }));
vi.mock('../workflows/reminders', () => ({
  reconcileConsultationReminders: vi.fn(), startConsultationReminder: vi.fn(),
}));
import { mutateClinicAction } from './clinic';
import { approvedTakeaway, readTakeaway, takeawayPdf, type TakeawayDocument } from './sharing';
import { WellnessOffer } from '../components/wellness-offer';

const tenantId = '11111111-1111-4111-8111-111111111111';
const visitId = '11111111-1111-4111-8111-111111111112';
const configurationId = '11111111-1111-4111-8111-111111111113';
const actor = { userId: '11111111-1111-4111-8111-111111111114', tenantId,
  sessionId: '11111111-1111-4111-8111-111111111115', role: 'SUPER_USER',
  canApproveClinical: false, mfaEnabled: false, mfaVerified: false } as ClinicActor;

function configuration(name = 'Synthetic clinic A', price = 7500, currency = 'USD'): ClinicConfiguration {
  return clinicConfigurationSchema.parse({ schemaVersion: 2,
    clinic: { name, currency, contact: 'Ask this clinic', brandColor: '#0d9488' },
    questions: [], products: [{ id: 'program', name: `${name} option`, type: 'MEMBERSHIP',
      priceCents: price, currency, available: true, clinical: false,
      goalTags: ['synthetic goal'], benefits: [`${name} approved benefit`],
      terms: `${name} terms. No billing cadence stated.`,
      rules: { validated: false, eligibility: [], exclusions: [], rationale: `${name} approved fit` } }],
    recommendationPolicy: { clinicalValidated: false, maxAddOns: 0, maxWellnessOffers: 2 },
    reminders: { careOutcomeHours: 24, wellnessDecisionHours: 24 },
    retention: { audioDays: 30, documentDays: 365, shareExpiryHours: 24 },
  });
}
const summary = { ...emptyConsultationSummary(), goals: [' Synthetic Goal ', 'unmatched goal'],
  staffReviewed: true, wellnessOffersAllowed: true };
const care = actualCareSchema.parse({ outcome: 'NOT_STARTED', items: [], currency: 'USD',
  observations: 'PRIVATE_CARE_OBSERVATION', reason: 'PRIVATE_CARE_REASON', membershipEnrolled: false });
function plan(config = configuration()) {
  return currentWellnessPlanSchema.parse(recommendWellness(config, summary, care, configurationId));
}
function legacyPlan(): WellnessPlan {
  const current = plan();
  return wellnessPlanSchema.parse({ ...current, engineVersion: 'dripwell-rules-v2.1',
    offers: current.offers.map(({ benefits: _benefits, matchedGoals: _goals, ...item }) => item) });
}
function visit(wellnessPlan: WellnessPlan | null = plan()) {
  const now = new Date();
  return { id: visitId, tenantId, isTest: true, reference: 'Synthetic offer fixture',
    version: 1, stage: 'WELLNESS_RECOMMENDATIONS_PRODUCED', archivedAt: null,
    configurationVersionId: configurationId,
    configurationVersion: { id: configurationId, payload: configuration(), version: 1,
      revision: 1, status: 'ACTIVE', tests: [], source: 'Synthetic fixture', createdAt: now, activatedAt: now },
    tenant: { isActive: true }, summary, summaryRevision: 1, careRevision: 1,
    careOutcome: 'NOT_STARTED', actualCare: care, wellnessPlan, wellnessRevision: 1,
    wellnessSummaryRevision: 1, wellnessCareRevision: 1, wellnessApprovedVersion: 1,
    wellnessApprovedAt: now, wellnessApprovedById: actor.userId, wellnessDecision: null,
    wellnessDecisionRevision: null, initialRecommendation: null, initialRevision: 0,
    initialSummaryRevision: 1, createdAt: now, updatedAt: now, completedAt: null as Date | null,
    provider: { firstName: 'Synthetic', lastName: 'Owner' }, adjustments: [], revisions: [], events: [], jobs: [],
  };
}
// Only transport is mocked. Real action, snapshot, approval and hash functions execute.
function transport(record = visit(), existing: unknown = null) {
  const tx = {
    $queryRaw: vi.fn(async () => [{ id: record.id }]),
    user: { findUnique: vi.fn(async () => ({ id: actor.userId, tenantId, isActive: true,
      tenant: record.tenant, role: 'SUPER_USER', canApproveClinical: false, mfaEnabled: false })) },
    authSession: { findFirst: vi.fn(async () => ({ mfaVerifiedAt: null })) },
    consultation: { findFirst: vi.fn(async () => record), update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      const updates = Object.fromEntries(Object.entries(data).map(([key, value]) => {
        if (value && typeof value === 'object' && 'increment' in value) {
          const current = (record as unknown as Record<string, unknown>)[key];
          if (typeof current !== 'number' || typeof value.increment !== 'number') throw new Error('Invalid synthetic numeric update');
          return [key, current + value.increment];
        }
        return [key, value];
      }));
      Object.assign(record, updates);
      return record;
    }) },
    consultationRevision: { create: vi.fn(async (_input: { data: Record<string, unknown> }) => ({})) },
    consultationAdjustment: { create: vi.fn(async () => ({})) },
    consultationEvent: { create: vi.fn(async () => ({})) },
    generationJob: { create: vi.fn(async (_input: { data: Record<string, unknown> }) => ({})), count: vi.fn(async () => 0) },
    recordingSegment: { count: vi.fn(async () => 0) },
    takeaway: { findUnique: vi.fn(async () => existing), findMany: vi.fn(async () => [{ id: 'saved-takeaway' }]),
      updateMany: vi.fn(async () => ({ count: 1 })),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'new-takeaway', ...data })) },
    shareLink: { findMany: vi.fn(async () => [{ id: 'saved-share' }]), updateMany: vi.fn(async () => ({ count: 1 })) },
    shareSession: { updateMany: vi.fn(async () => ({ count: 1 })) },
    notification: { updateMany: vi.fn(async () => ({ count: 0 })) },
  };
  boundary.getDb.mockReturnValue({ $transaction: vi.fn(async (operation: (value: typeof tx) => Promise<unknown>) => operation(tx)) });
  return { tx, record };
}
function action(name: string, record: ReturnType<typeof visit>, fields: Record<string, unknown> = {}) {
  return mutateClinicAction(actor, { action: name, consultationId: record.id,
    expectedVersion: record.version, ...fields });
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort()
    .map(key => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
function saved(payload: unknown) {
  return { payload: payload as Parameters<typeof readTakeaway>[0]['payload'],
    contentHash: createHash('sha256').update(canonical(payload)).digest('hex') };
}
function document(config = configuration()): TakeawayDocument {
  const current = plan(config);
  return { version: 2, clinic: config.clinic, reference: 'Synthetic PDF fixture',
    visitDate: '2026-10-05T00:00:00.000Z', approvedAt: '2026-10-05T00:01:00.000Z',
    visitSummary: current.visitSummary, explanation: current.explanation, careOutcome: care.outcome,
    careReceived: [], warning: 'Synthetic private document only', offers: current.offers.map(item => ({
      name: item.name, quantity: item.quantity, priceCents: item.priceCents, currency: item.currency,
      rationale: item.rationale, terms: item.terms, benefits: item.benefits, matchedGoals: item.matchedGoals,
    })) };
}
beforeEach(() => boundary.getDb.mockReset());

describe('Approved wellness offer snapshots and presentation', () => {
  test('two immutable clinic catalogs produce their own benefits, reviewed goal wording, prices and terms', () => {
    const a = plan();
    const b = plan(configuration('Synthetic clinic B', 12000, 'CAD'));
    expect(a.engineVersion).toBe('dripwell-rules-v2.2');
    expect(a.offers[0]).toMatchObject({ benefits: ['Synthetic clinic A approved benefit'],
      matchedGoals: [' Synthetic Goal '], priceCents: 7500, currency: 'USD' });
    expect(b.offers[0]).toMatchObject({ benefits: ['Synthetic clinic B approved benefit'],
      matchedGoals: [' Synthetic Goal '], priceCents: 12000, currency: 'CAD',
      terms: 'Synthetic clinic B terms. No billing cadence stated.' });
  });

  test('initial v2.1 and recorded-care item contracts do not gain wellness facts', () => {
    const initial = recommendInitial(configuration(), summary, configurationId);
    expect(initial.engineVersion).toBe('dripwell-rules-v2.1');
    const offer = plan().offers[0];
    const recorded = actualCareSchema.parse({ ...care, items: [offer] });
    expect(recorded.items[0]).not.toHaveProperty('benefits');
    expect(recorded.items[0]).not.toHaveProperty('matchedGoals');
    expect(initial.items).toEqual([]);
  });

  test('declined, unconfirmed and unreviewed preferences still yield no offers', () => {
    for (const input of [{ ...summary, wellnessOffersAllowed: false },
      { ...summary, wellnessOffersAllowed: null }, { ...summary, staffReviewed: false }]) {
      expect(recommendWellness(configuration(), input, care, configurationId).offers).toEqual([]);
    }
    expect(recommendWellness(configuration(), { ...summary, wellnessOffersAllowed: null }, care, configurationId)
      .safetyFlags.join(' ')).toContain('unconfirmed');
  });

  test('unavailable, ineligible and unmatched choices remain excluded without inventing missing benefits or terms', () => {
    const config = configuration();
    config.products[0].available = false;
    expect(plan(config).offers).toEqual([]);
    config.products[0].available = true;
    expect(recommendWellness(config, { ...summary, goals: ['different goal'] }, care, configurationId).offers).toEqual([]);
    config.questions = [{ id: 'eligible', text: 'Synthetic eligibility?', type: 'BOOLEAN', why: 'Checks synthetic eligibility for this option.',
      options: [], required: false, safetyRelevant: false, activeWhen: [], priority: 0 }];
    config.products[0].rules.eligibility = [{ questionId: 'eligible', operator: 'EQ', value: true }];
    expect(clinicConfigurationSchema.safeParse(config).success).toBe(true);
    const ineligible = plan(config);
    expect(ineligible.offers).toEqual([]);
    expect(ineligible.safetyFlags).toEqual(['Synthetic clinic A option: confirm eligibility answer eligible.']);
    config.products[0].rules.eligibility = [];
    config.products[0].benefits = [];
    expect(plan(config).offers[0]).toMatchObject({ benefits: [],
      terms: 'Synthetic clinic A terms. No billing cadence stated.',
      matchedGoals: [' Synthetic Goal '], priceCents: 7500, currency: 'USD' });
    config.products[0].terms = '';
    const missingTerms = plan(config);
    expect(missingTerms.offers).toEqual([]);
    expect(missingTerms.safetyFlags).toContain('Membership program needs official terms.');
  });

  test('legacy v2.1 parsing retains old offer shape while v2.2 requires bounded new facts', () => {
    const legacy = legacyPlan();
    expect(legacy.engineVersion).toBe('dripwell-rules-v2.1');
    expect(legacy.offers[0]).not.toHaveProperty('benefits');
    expect(validateWellnessSelection(configuration(), summary, legacy)).toEqual([]);
    const { benefits: _missing, ...offer } = plan().offers[0];
    expect(wellnessPlanSchema.safeParse({ ...plan(), offers: [offer] }).success).toBe(false);
    expect(wellnessPlanSchema.safeParse({ ...plan(), offers: [{ ...plan().offers[0], benefits: Array(101).fill('bad') }] }).success).toBe(false);
  });

  test('approval rejects changed benefits or invented goals against the bound configuration and reviewed summary', () => {
    for (const forged of [{ benefits: ['Unapproved current-catalog change'] },
      { matchedGoals: ['Unreviewed promise'] },
      { benefits: ['Unapproved current-catalog change'], matchedGoals: ['Unreviewed promise'] }]) {
      const changed = plan();
      Object.assign(changed.offers[0], forged);
      expect(validateWellnessSelection(configuration(), summary, changed).join(' ')).toContain('approved benefits and reviewed goals');
    }
  });

  test('real generation actions persist initial v2.1 and wellness v2.2 revision and job identities', async () => {
    const { tx, record } = transport(visit(null));
    record.stage = 'CONSULTATION_STARTED';
    await action('consultation.initial.generate', record);
    await action('consultation.wellness.generate', record);
    expect(tx.consultationRevision.create.mock.calls.map(call => (call[0] as unknown as { data: { promptVersion: string } }).data.promptVersion))
      .toEqual(['dripwell-rules-v2.1', 'dripwell-rules-v2.2']);
    expect(tx.generationJob.create.mock.calls.map(call => (call[0] as unknown as { data: { promptVersion: string } }).data.promptVersion))
      .toEqual(['dripwell-rules-v2.1', 'dripwell-rules-v2.2']);
  });

  test('a tracked legacy edit snapshots bound facts, revokes saved access and requires exact reapproval', async () => {
    const { tx, record } = transport(visit(legacyPlan()));
    await action('consultation.wellness.edit', record, { offerProductIds: ['program'],
      visitSummary: 'Staff reviewed this wording', explanation: 'Staff edited optional explanation',
      reason: 'CLIENT_CHOICE', reasonNote: 'PRIVATE_ADJUSTMENT_NOTE' });
    expect(record.wellnessPlan).toMatchObject({ engineVersion: 'dripwell-rules-v2.2',
      explanation: 'Staff edited optional explanation', offers: [{ benefits: ['Synthetic clinic A approved benefit'] }] });
    expect(record.wellnessRevision).toBe(2);
    expect(record.wellnessApprovedVersion).toBeNull();
    expect(tx.consultationAdjustment.create).toHaveBeenCalledOnce();
    expect(tx.takeaway.updateMany).toHaveBeenCalledOnce();
    expect(tx.shareLink.updateMany).toHaveBeenCalledOnce();
    expect(tx.shareSession.updateMany).toHaveBeenCalledOnce();
    await expect(approvedTakeaway(tenantId, visitId, actor.userId)).rejects.toMatchObject({ code: 'WELLNESS_APPROVAL_REQUIRED' });
    await action('consultation.wellness.approve', record);
    expect(record.wellnessApprovedVersion).toBe(2);
  });

  test('a stale input revision still blocks approving new offer facts', async () => {
    const { record } = transport(); record.summaryRevision = 2;
    await expect(action('consultation.wellness.approve', record)).rejects.toMatchObject({ code: 'WELLNESS_INPUTS_CHANGED' });
  });

  test('a no-offer ordinary visit can complete without membership enrollment', async () => {
    const noOffer = plan(); noOffer.offers = [];
    const { record } = transport(visit(noOffer));
    await action('consultation.outcome.record', record, { decision: 'REJECTED' });
    expect(record.stage).toBe('WELLNESS_RECOMMENDATIONS_REJECTED');
    expect(record.completedAt).toBeInstanceOf(Date);
    expect(record.actualCare.membershipEnrolled).toBe(false);
  });

  test('new approval creates a v2 public whitelist from saved offers rather than a changed catalog', async () => {
    const { record } = transport();
    record.configurationVersion.payload.products[0].benefits = ['Changed after the saved plan'];
    record.configurationVersion.payload.products[0].priceCents = 99999;
    const value = await approvedTakeaway(tenantId, visitId, actor.userId);
    const doc = readTakeaway(value);
    expect(doc.version).toBe(2);
    expect(doc.offers[0]).toMatchObject({ benefits: ['Synthetic clinic A approved benefit'], priceCents: 7500 });
    for (const forbidden of ['evidence', 'productId', 'safetyFlags', 'observations', 'reason'])
      expect(doc.offers[0]).not.toHaveProperty(forbidden);
    expect(JSON.stringify(doc)).not.toContain('PRIVATE_CARE');
  });

  test('an approved legacy plan with no saved takeaway still creates v1 without current-catalog enrichment', async () => {
    const { record } = transport(visit(legacyPlan()));
    record.configurationVersion.payload.products[0].benefits = ['New benefit'];
    const value = await approvedTakeaway(tenantId, visitId, actor.userId);
    const doc = readTakeaway(value);
    expect(doc.version).toBe(1);
    expect(doc.offers[0]).not.toHaveProperty('benefits');
    expect(doc.offers[0]).not.toHaveProperty('matchedGoals');
    expect(doc.offers[0].priceCents).toBe(7500);
  });

  test('an existing v1 artifact returns early with identical raw payload and hash', async () => {
    const current = document();
    const legacy = { ...current, version: 1, offers: current.offers.map(item => ({
      name: item.name, quantity: item.quantity, priceCents: item.priceCents, currency: item.currency,
      rationale: item.rationale, terms: item.terms })) };
    const existing = { ...saved(legacy), revokedAt: null, expiresAt: null };
    const originalRawPayload = existing.payload;
    const originalRawContent = structuredClone(existing.payload);
    const originalHash = existing.contentHash;
    const { tx, record } = transport(visit(legacyPlan()), existing);
    record.configurationVersion.payload = { invalidCurrentCatalog: true } as unknown as ClinicConfiguration;
    expect(await approvedTakeaway(tenantId, visitId, actor.userId)).toBe(existing);
    expect(tx.takeaway.create).not.toHaveBeenCalled();
    const publicDocument = readTakeaway(existing);
    expect(publicDocument).toEqual({ version: 1,
      clinic: { name: 'Synthetic clinic A', contact: 'Ask this clinic', brandColor: '#0d9488' },
      reference: 'Synthetic PDF fixture', visitDate: '2026-10-05T00:00:00.000Z',
      approvedAt: '2026-10-05T00:01:00.000Z', visitSummary: legacy.visitSummary,
      explanation: legacy.explanation, careOutcome: 'NOT_STARTED', careReceived: [],
      warning: 'Synthetic private document only', offers: [{ name: 'Synthetic clinic A option',
        quantity: 1, priceCents: 7500, currency: 'USD', rationale: 'Synthetic clinic A approved fit',
        terms: 'Synthetic clinic A terms. No billing cadence stated.' }] });
    expect(publicDocument.clinic).not.toHaveProperty('currency');
    expect(publicDocument.offers[0]).not.toHaveProperty('benefits');
    expect(publicDocument.offers[0]).not.toHaveProperty('matchedGoals');
    expect(existing.payload).toBe(originalRawPayload);
    expect(existing.payload).toEqual(originalRawContent);
    expect(existing.contentHash).toBe(originalHash);
    expect(existing.contentHash).toBe(createHash('sha256').update(canonical(existing.payload)).digest('hex'));
  });

  test('both document versions verify raw hashes before parsing or stripping unapproved fields', () => {
    const current = document();
    const legacy = { ...current, version: 1, offers: [] };
    for (const payload of [current, legacy]) {
      const value = saved(payload);
      expect(readTakeaway(value).version).toBe(payload.version);
      expect(() => readTakeaway({ ...value, payload: { ...payload, internal: 'changed' } }))
        .toThrow('Document verification failed');
    }
  });

  test('the shared staff and recipient card exposes faithful goals, fit, benefits, total ISO price and exact terms', () => {
    const offer = { ...plan().offers[0], quantity: 2 };
    const html = renderToStaticMarkup(createElement(WellnessOffer, { offer }));
    for (const label of ['Goals you discussed', 'Synthetic Goal', 'Why it fits:',
      'Included by your clinic', 'Synthetic clinic A approved benefit', 'Total official price:',
      '$150.00', 'USD', 'Clinic terms:', 'No billing cadence stated.', 'Optional.']) expect(html).toContain(label);
    expect(html).not.toContain('PRIVATE_');
    expect(html).not.toContain('unmatched goal');
    expect(html).not.toContain('per month');
  });

  test('legacy and missing-field cards omit benefit, goal and terms groups without invented content', () => {
    const item = { ...legacyPlan().offers[0], terms: '' };
    const html = renderToStaticMarkup(createElement(WellnessOffer, { offer: item }));
    for (const hidden of ['Goals you discussed', 'Included by your clinic', 'Clinic terms:']) expect(html).not.toContain(hidden);
    expect(html).toContain('Total official price:');
    expect(html).toContain('USD');
  });

  test('actual synthetic PDFs retain both clinics saved facts for the separate text-extraction gate', async () => {
    const current = document();
    const legacy: TakeawayDocument = { ...current, version: 1, offers: current.offers.map(item => ({
      name: item.name, quantity: item.quantity, priceCents: item.priceCents, currency: item.currency,
      rationale: item.rationale, terms: item.terms })) };
    for (const [name, doc] of [['a', current], ['b', document(configuration('Synthetic clinic B', 12000, 'CAD'))],
      ['legacy', legacy]] as const) {
      const bytes = await takeawayPdf(doc);
      expect(Buffer.from(bytes).subarray(0, 5).toString()).toBe('%PDF-');
      expect((await PDFDocument.load(bytes)).getPageCount()).toBeGreaterThan(0);
      if (process.env.TASK050_PDF_DIR) {
        const directory = process.env.TASK050_PDF_DIR;
        writeFileSync(join(directory, `${name}.pdf`), bytes, { flag: 'wx', mode: 0o600 });
        writeFileSync(join(directory, `${name}-document.json`), JSON.stringify(doc, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
      }
    }
  });
});
