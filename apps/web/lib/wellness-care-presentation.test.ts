// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import {
  actualCareSchema, clinicConfigurationSchema, emptyConsultationSummary,
  initialRecommendationSchema, wellnessPlanSchema,
} from '@dripwell/shared/v2';
import type { ConsultationView, useClinic } from '../components/clinic-context';

const boundary = vi.hoisted(() => ({ context: null as ReturnType<typeof useClinic> | null }));
vi.mock('../components/clinic-context', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../components/clinic-context')>();
  return {
    ...actual,
    useClinic: () => {
      if (!boundary.context) throw new Error('Missing fictional wellness context.');
      return boundary.context;
    },
  };
});
vi.mock('../components/audio-recorder', () => ({ AudioRecorder: () => null }));
vi.mock('../components/recording-segments', () => ({ RecordingSegments: () => null }));

import { Consultation } from '../components/consultation';

const visitId = '11111111-1111-4111-8111-111111111151';
const locationId = '11111111-1111-4111-8111-111111111152';
const configurationId = '11111111-1111-4111-8111-111111111153';
const providerId = '11111111-1111-4111-8111-111111111154';
const now = '2026-10-14T00:00:00.000Z';
const savedNames = ['Fictional saved drip', 'Fictional saved add-on'];
const futureName = 'Fictional future membership';
const unusedName = 'Fictional unused catalog treatment';
const cases = [
  { name: 'current draft NOT_STARTED', legacy: false, approved: false, outcome: 'NOT_STARTED' },
  { name: 'current exact-approved NOT_STARTED', legacy: false, approved: true, outcome: 'NOT_STARTED' },
  { name: 'legacy exact-approved NOT_STARTED', legacy: true, approved: true, outcome: 'NOT_STARTED' },
  { name: 'STARTED saved multiple items', legacy: false, approved: true, outcome: 'STARTED' },
  // Retained schema-supported display only. PENDING generation/approval is not a valid action.
  { name: 'retained-schema PENDING explicitly unapproved', legacy: false, approved: false, outcome: 'PENDING' },
] as const;
type Case = (typeof cases)[number];
const reads: { path: string; settled: boolean }[] = [];
const unexpectedRequests: string[] = [];
const mutations: string[] = [];
const mounted: { root: Root; container: HTMLElement }[] = [];
let active: ReturnType<typeof fixture> | null = null;

function fixture(selected: Case) {
  const items = savedNames.map((name, index) => ({
    productId: index === 0 ? 'saved-drip' : 'saved-addon', name,
    type: index === 0 ? 'DRIP' as const : 'ADD_ON' as const,
    quantity: 1, priceCents: 10000 + index * 1000, currency: 'USD',
    rationale: 'Fictional approved care only.', evidence: [], terms: 'Fictional care terms.',
  }));
  const configuration = clinicConfigurationSchema.parse({
    schemaVersion: 2,
    clinic: { name: 'Fictional wellness clinic', currency: 'USD', contact: 'Fictional contact', brandColor: '#0d9488' },
    questions: [{ id: 'screen', text: 'Fictional screening question?', why: 'Synthetic authority context only.',
      type: 'BOOLEAN', required: true, safetyRelevant: true }],
    products: [
      ...items.map((item) => ({
        id: item.productId, name: item.name, type: item.type, priceCents: item.priceCents,
        currency: 'USD', available: true, clinical: true, compatibleWith: items.map((value) => value.productId),
        terms: item.terms,
        ingredients: [{ name: 'Fictional ingredient', quantity: 'Synthetic only' }],
        rules: { validated: true, validationNote: 'Fictional configuration approval.',
          eligibility: [{ questionId: 'screen', operator: 'EQ', value: false }], exclusions: [],
          rationale: 'Fictional clinical rationale.' },
      })),
      { id: 'unused', name: unusedName, type: 'SERVICE', priceCents: 5000, currency: 'USD',
        available: true, clinical: false,
        rules: { validated: false, eligibility: [], exclusions: [], rationale: 'Synthetic unused option.' } },
      { id: 'future', name: futureName, type: 'MEMBERSHIP', priceCents: 7500, currency: 'USD',
        available: true, clinical: false, goalTags: ['Fictional goal'], benefits: ['Fictional benefit'],
        terms: 'Fictional future terms.',
        rules: { validated: false, eligibility: [], exclusions: [], rationale: 'Fictional future option.' } },
    ],
    recommendationPolicy: { clinicalValidated: true, validatedBy: providerId,
      validationNote: 'Synthetic validation only.', maxAddOns: 1, maxWellnessOffers: 1 },
    reminders: { careOutcomeHours: 24, wellnessDecisionHours: 24 },
    retention: { audioDays: 30, documentDays: 365, shareExpiryHours: 24 },
  });
  const summary = { ...emptyConsultationSummary(), staffReviewed: true,
    goals: ['Fictional goal'], wellnessOffersAllowed: true,
    answers: { screen: { value: false, status: 'CONFIRMED' as const, source: 'STAFF' as const, evidence: 'Synthetic answer.' } } };
  const care = actualCareSchema.parse({ outcome: selected.outcome,
    items: selected.outcome === 'STARTED' ? items : [], observations: 'Fictional observation.',
    reason: 'Fictional care record.', currency: 'USD' });
  const offer = { productId: 'future', name: futureName, type: 'MEMBERSHIP', quantity: 1,
    priceCents: 7500, currency: 'USD', rationale: 'Fictional future option.',
    evidence: [], terms: 'Fictional future terms.' };
  const wellnessPlan = wellnessPlanSchema.parse({
    configurationVersionId: configurationId,
    engineVersion: selected.legacy ? 'dripwell-rules-v2.1' : 'dripwell-rules-v2.2',
    visitSummary: 'Fictional wellness visit.', careReceived: care,
    offers: [selected.legacy ? offer : { ...offer, benefits: ['Fictional benefit'], matchedGoals: ['Fictional goal'] }],
    explanation: 'Fictional future options are separate from care received.', safetyFlags: [],
  });
  const visit: ConsultationView = {
    id: visitId, reference: 'SYNTHETIC-WELLNESS-CARE', version: 6, locationId, providerId,
    stage: 'WELLNESS_RECOMMENDATIONS_PRODUCED', isTest: true, configurationVersionId: configurationId,
    consentAt: null, consentDeclined: true, summary, transcript: [],
    initialRecommendation: selected.outcome === 'STARTED' ? initialRecommendationSchema.parse({
      configurationVersionId: configurationId, engineVersion: 'dripwell-rules-v2.1', items,
      alternatives: [], explanation: 'Fictional approved recommendation.', unresolvedQuestions: [],
      safetyFlags: [], eligibleProductIds: items.map((item) => item.productId), blocked: false,
    }) : null,
    initialRevision: selected.outcome === 'STARTED' ? 2 : 0,
    clinicalApprovedVersion: selected.outcome === 'STARTED' ? 2 : null,
    clinicalApprovedAt: selected.outcome === 'STARTED' ? now : null,
    actualCare: care, careOutcome: care.outcome, wellnessPlan, wellnessRevision: 3,
    wellnessApprovedVersion: selected.approved ? 3 : null,
    wellnessApprovedAt: selected.approved ? now : null,
    wellnessDecision: null, wellnessDecisionRevision: null,
    archivedAt: null, archiveReason: null, createdAt: now, updatedAt: now,
  };
  return { visit, configuration, approved: selected.approved };
}

beforeEach(() => {
  reads.length = 0;
  unexpectedRequests.length = 0;
  mutations.length = 0;
  active = null;
  boundary.context = {
    data: null, loading: false, error: '', pageError: '', locationId, captureBusy: false,
    refresh: vi.fn(async () => {}), loadMore: vi.fn(async () => {}),
    selectLocation: vi.fn(async () => {}), setCaptureBusy: vi.fn(),
    mutate: async (action: string) => {
      mutations.push(action);
      throw new Error('Unexpected mutation in wellness presentation.');
    },
  };
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('fetch', vi.fn((path: string, init?: RequestInit) => {
    const method = init?.method || 'GET';
    const sharePath = `/api/share?consultationId=${visitId}`;
    const allowed = active && method === 'GET' && reads.length < 3 && !reads.some((read) => read.path === path)
      && [`/api/clinic?id=${visitId}`, `/api/recordings?consultationId=${visitId}`,
        ...(active.approved ? [sharePath] : [])].includes(path);
    if (!allowed) {
      unexpectedRequests.push(`${method} ${String(path)}`);
      throw new Error('Unexpected or excessive fictional wellness request.');
    }
    expect(init).toMatchObject({ credentials: 'same-origin', cache: 'no-store' });
    const read = { path, settled: false };
    reads.push(read);
    const payload = path === `/api/clinic?id=${visitId}`
      ? { consultation: active!.visit, configuration: active!.configuration }
      : path === sharePath ? { shares: [] } : { recordings: [] };
    return Promise.resolve(new Response(JSON.stringify(payload), {
      headers: { 'Content-Type': 'application/json' },
    })).finally(() => { read.settled = true; });
  }));
});

afterEach(async () => {
  try {
    await act(async () => { for (const entry of mounted) entry.root.unmount(); });
    expect(reads.every((read) => read.settled)).toBe(true);
    expect(unexpectedRequests).toEqual([]);
    expect(mutations).toEqual([]);
  } finally {
    for (const entry of mounted) entry.container.remove();
    mounted.length = 0;
    active = null;
    boundary.context = null;
    vi.unstubAllGlobals();
  }
});

describe('Saved care in the real wellness preview', () => {
  test.each(cases)('$name', async (selected) => {
    active = fixture(selected);
    const container = document.createElement('div');
    const root = createRoot(container);
    mounted.push({ root, container });
    document.body.append(container);
    await act(async () => { root.render(createElement(Consultation, { id: visitId })); });
    expect(reads.map((read) => read.path)).toEqual([
      `/api/clinic?id=${visitId}`, `/api/recordings?consultationId=${visitId}`,
    ]);
    const tab = container.querySelector<HTMLButtonElement>('#tab-wellness');
    if (!tab) throw new Error('Missing ordinary Wellness & sharing tab.');
    await act(async () => { tab.click(); });
    const panel = container.querySelector<HTMLElement>('#panel-wellness');
    const careRegion = panel?.querySelector<HTMLElement>('.takeaway-care');
    if (!panel || !careRegion) throw new Error('Missing real wellness care section.');
    expect(panel.hidden).toBe(false);
    const expected = selected.outcome === 'STARTED' ? savedNames.join(' + ')
      : selected.outcome === 'NOT_STARTED' ? 'Care was not started at this visit.'
        : 'Your clinic is confirming the care outcome.';
    expect(careRegion.querySelector('strong')?.textContent).toBe(expected);
    for (const absent of [futureName, unusedName, 'Recorded treatment']) {
      expect(careRegion.textContent).not.toContain(absent);
    }
    if (selected.outcome !== 'STARTED') {
      for (const name of savedNames) expect(careRegion.textContent).not.toContain(name);
    }
    expect(panel.querySelector('.takeaway-offers')?.textContent).toContain(futureName);
    expect(panel.textContent).toContain(selected.approved ? 'Staff approved' : 'Approval needed');
    const download = Array.from(panel.querySelectorAll<HTMLButtonElement>('button'))
      .find((button) => button.textContent?.trim() === 'Download PDF');
    expect(download?.disabled).toBe(!selected.approved);
    expect(Boolean(panel.querySelector('.share-form'))).toBe(selected.approved);
    expect(reads.map((read) => read.path)).toEqual([
      `/api/clinic?id=${visitId}`, `/api/recordings?consultationId=${visitId}`,
      ...(selected.approved ? [`/api/share?consultationId=${visitId}`] : []),
    ]);
    expect(mutations).toEqual([]);
  });
});
