// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { emptyConsultationSummary, type ActualCare, type ClinicConfiguration } from '@dripwell/shared/v2';
import type { ConsultationView, useClinic } from '../components/clinic-context';

const boundary = vi.hoisted(() => ({ context: null as ReturnType<typeof useClinic> | null }));
vi.mock('../components/clinic-context', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../components/clinic-context')>();
  return {
    ...actual,
    useClinic: () => {
      if (!boundary.context) throw new Error('Missing synthetic clinic context.');
      return boundary.context;
    },
  };
});
// Capture and segment-list leaves are outside this care-form story.
vi.mock('../components/audio-recorder', () => ({ AudioRecorder: () => null }));
vi.mock('../components/recording-segments', () => ({ RecordingSegments: () => null }));

import { postJson } from '../components/clinic-context';
import { emptyConfiguration } from '../components/configuration-editor';
import { Consultation } from '../components/consultation';

const visitId = '11111111-1111-4111-8111-111111111121';
const locationId = '11111111-1111-4111-8111-111111111122';
const configurationId = '11111111-1111-4111-8111-111111111123';
const membershipId = 'fictional-membership';
const conflictMessage = 'This record changed. Refresh it before saving your edits.';
const requests: PendingFetch[] = [];
const mutations: Promise<unknown>[] = [];
const unexpectedRequests: string[] = [];

type PendingFetch = {
  path: string;
  init?: RequestInit;
  promise: Promise<Response>;
  settled: boolean;
  resolve: (payload: unknown, status?: number) => void;
};
type CareRequest = {
  action: string;
  consultationId: string;
  expectedVersion: number;
  actualCare: ActualCare;
};

function configuration(currency: string): ClinicConfiguration {
  const value = emptyConfiguration('Fictional care-form clinic');
  value.clinic.currency = currency;
  // Disclosed synthetic, nonclinical catalog data, not an approved real-clinic offer.
  value.products = [{
    id: membershipId, name: 'Fictional membership', type: 'MEMBERSHIP',
    description: 'Synthetic form fixture', priceCents: 10000, currency,
    available: true, ingredients: [], goalTags: [], compatibleWith: [], benefits: [],
    terms: 'Synthetic terms only', clinical: false, priority: 0,
    rules: { validated: false, validationNote: '', eligibility: [], exclusions: [], rationale: '' },
  }];
  return value;
}
function care(currency = 'USD', commercial: Partial<ActualCare> = {}): ActualCare {
  return {
    outcome: 'NOT_STARTED', items: [], observations: 'Original synthetic observation.',
    reason: 'Fictional visit with no clinical treatment.', membershipEnrolled: null,
    membershipProductId: null, servicePurchased: null, confirmedCollectedCents: null,
    currency, ...commercial,
  };
}
function visit(version: number, actualCare: ActualCare): ConsultationView {
  return {
    id: visitId, reference: 'SYNTHETIC-CARE-REFRESH', version,
    stage: 'CONSULTATION_STARTED', locationId, providerId: 'synthetic-staff',
    isTest: true, configurationVersionId: configurationId, consentAt: null,
    consentDeclined: true, summary: emptyConsultationSummary(), transcript: [],
    initialRecommendation: null, initialRevision: 0, clinicalApprovedVersion: null,
    clinicalApprovedAt: null, actualCare, careOutcome: actualCare.outcome,
    wellnessPlan: null, wellnessRevision: 0, wellnessApprovedVersion: null,
    wellnessApprovedAt: null, wellnessDecision: null, wellnessDecisionRevision: null,
    archivedAt: null, archiveReason: null, createdAt: '2026-10-10T00:00:00.000Z',
    updatedAt: '2026-10-10T00:00:00.000Z',
  };
}

beforeEach(() => {
  requests.length = 0;
  mutations.length = 0;
  unexpectedRequests.length = 0;
  boundary.context = {
    data: null, loading: false, error: '', pageError: '', locationId, captureBusy: false,
    refresh: vi.fn(async () => {}), loadMore: vi.fn(async () => {}),
    selectLocation: vi.fn(async () => {}), setCaptureBusy: vi.fn(),
    mutate: <T,>(action: string, fields: Record<string, unknown> = {}) => {
      const operation = (async () => {
        const result = await postJson<T>('/api/clinic', { action, ...fields });
        await boundary.context!.refresh();
        return result;
      })();
      mutations.push(operation);
      return operation;
    },
  };
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('fetch', vi.fn((path: string, init?: RequestInit) => {
    const method = init?.method || 'GET';
    const allowed = (method === 'GET' && [
      `/api/clinic?id=${visitId}`, `/api/recordings?consultationId=${visitId}`,
    ].includes(path)) || (method === 'POST' && path === '/api/clinic');
    if (!allowed || requests.length >= 16) {
      unexpectedRequests.push(`${method} ${path}`);
      throw new Error('Unexpected or excessive synthetic care-form request.');
    }
    let complete!: (response: Response) => void;
    const promise = new Promise<Response>((resolve) => { complete = resolve; });
    const pending: PendingFetch = {
      path, init, promise, settled: false,
      resolve(payload, status = 200) {
        if (pending.settled) throw new Error('Synthetic fetch was already completed.');
        pending.settled = true;
        complete(new Response(JSON.stringify(payload), {
          status, headers: { 'Content-Type': 'application/json' },
        }));
      },
    };
    requests.push(pending);
    return promise;
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  boundary.context = null;
  expect(unexpectedRequests).toEqual([]);
  expect(requests.every((request) => request.settled)).toBe(true);
});

function button(container: HTMLElement, name: string) {
  const found = Array.from(container.querySelectorAll<HTMLButtonElement>('button'))
    .find((item) => item.getAttribute('aria-label') === name || item.textContent?.trim() === name);
  if (!found) throw new Error(`Missing visible button: ${name}`);
  return found;
}
async function click(container: HTMLElement, name: string) {
  await act(async () => { button(container, name).click(); });
}
function careForm(container: HTMLElement) {
  const form = button(container, 'Save actual outcome').closest('form');
  if (!form) throw new Error('Missing actual care form.');
  return form;
}
function control<T extends HTMLElement>(form: HTMLFormElement, name: string, selector: string) {
  const label = Array.from(form.querySelectorAll('label'))
    .find((item) => Array.from(item.childNodes)
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent || '').join('').trim() === name);
  const found = label?.querySelector<T>(selector);
  if (!found) throw new Error(`Missing actual care control: ${name}`);
  return found;
}
function commercialControls(form: HTMLFormElement, currency: string) {
  return {
    enrollment: control<HTMLSelectElement>(form, 'Membership enrollment', 'select'),
    membership: control<HTMLSelectElement>(form, 'Membership', 'select'),
    service: control<HTMLSelectElement>(form, 'Service purchased', 'select'),
    paid: control<HTMLInputElement>(form, `Known payment collected (${currency})`, 'input'),
  };
}
async function typeValue(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  await act(async () => {
    const prototype = element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setValue = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
    if (!setValue) throw new Error('Missing DOM value setter.');
    setValue.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
async function selectValue(element: HTMLSelectElement, value: string) {
  await act(async () => {
    element.value = value;
    element.dispatchEvent(new Event('change', { bubbles: true }));
  });
}
async function respond(index: number, payload: unknown, status = 200) {
  await act(async () => {
    requests[index]!.resolve(payload, status);
    await requests[index]!.promise;
  });
}
async function respondLoad(index: number, saved: ConsultationView) {
  expect(requests[index]!.path).toBe(`/api/clinic?id=${visitId}`);
  expect(requests[index + 1]!.path).toBe(`/api/recordings?consultationId=${visitId}`);
  await respond(index, { consultation: saved, configuration: configuration(saved.actualCare!.currency) });
  await respond(index + 1, { recordings: [] });
}
function posted(index: number): CareRequest {
  const request = requests[index]!;
  expect(request.path).toBe('/api/clinic');
  expect(request.init).toMatchObject({ method: 'POST', credentials: 'same-origin', cache: 'no-store' });
  if (typeof request.init?.body !== 'string') throw new Error('Missing care JSON request.');
  const payload = JSON.parse(request.init.body) as CareRequest;
  expect(payload).toMatchObject({ action: 'consultation.care.record', consultationId: visitId });
  return payload;
}
function page() {
  const container = document.createElement('div');
  document.body.append(container);
  return { container, root: createRoot(container) };
}
async function openCare(root: Root, container: HTMLElement, saved: ConsultationView) {
  await act(async () => { root.render(createElement(Consultation, { id: visitId })); });
  expect(requests).toHaveLength(2);
  await respondLoad(0, saved);
  const tab = container.querySelector<HTMLButtonElement>('#tab-recommendation');
  if (!tab) throw new Error('Missing actual Recommendation & care tab.');
  await act(async () => { tab.click(); });
  return careForm(container);
}
async function conflictReload(container: HTMLElement, previousVersion: number, saved: ConsultationView) {
  const form = careForm(container);
  await typeValue(control<HTMLTextAreaElement>(form, 'Visit observations', 'textarea'),
    'Synthetic observation submitted before the conflict.');
  const index = requests.length;
  await click(container, 'Save actual outcome');
  expect(posted(index).expectedVersion).toBe(previousVersion);
  await respond(index, { error: conflictMessage, code: 'VERSION_CONFLICT' }, 409);
  expect(container.querySelector('[role="alert"]')?.textContent).toContain(conflictMessage);
  await click(container, 'Try again');
  await respondLoad(index + 1, saved);
  expect(container.querySelector('[role="alert"]')).toBeNull();
  expect(careForm(container)).toBe(form);
  return form;
}
async function saveObservation(container: HTMLElement, expectedVersion: number, expectedCare: ActualCare) {
  const observation = 'Synthetic observation corrected after successful reload.';
  await typeValue(control<HTMLTextAreaElement>(careForm(container), 'Visit observations', 'textarea'), observation);
  const index = requests.length;
  await click(container, 'Save actual outcome');
  const payload = posted(index);
  expect(payload.expectedVersion).toBe(expectedVersion);
  expect(payload.actualCare).toEqual({ ...expectedCare, observations: observation });
  await respond(index, { id: visitId });
  await respondLoad(index + 1, visit(expectedVersion + 1, { ...expectedCare, observations: observation }));
  expect(requests.every((request) => request.settled)).toBe(true);
}
async function close(root: Root, container: HTMLElement) {
  try {
    await act(async () => {
      for (const request of requests) {
        if (!request.settled) request.resolve({ error: 'Synthetic test cleanup.' }, 503);
      }
      await Promise.all(requests.map((request) => request.promise));
      await Promise.allSettled(mutations);
    });
  } finally {
    await act(async () => { root.unmount(); });
    container.remove();
  }
}

describe('saved care commercial form refresh', () => {
  test.each([
    { currency: 'USD', amount: 12345, displayed: '123.45' },
    { currency: 'KWD', amount: 12345, displayed: '12.345' },
  ])('reloads a conflict into current recorded commercial values and saves minor units in $currency', async ({ currency, amount, displayed }) => {
    const { container, root } = page();
    try {
      const original = care(currency);
      const form = await openCare(root, container, visit(1, original));
      expect(form.querySelector('.commercial-fields')).toBeNull();
      const current = care(currency, {
        membershipEnrolled: true, membershipProductId: membershipId,
        servicePurchased: true, confirmedCollectedCents: amount,
      });
      await conflictReload(container, 1, visit(2, current));
      await click(container, 'Add optional membership, service or payment outcome');
      const controls = commercialControls(form, currency);
      expect(controls.enrollment.value).toBe('true');
      expect(controls.membership.value).toBe(membershipId);
      expect(controls.service.value).toBe('true');
      expect(controls.paid.value).toBe(displayed);
      await saveObservation(container, 2, current);
    } finally {
      await close(root, container);
    }
  });

  test.each([
    { state: 'explicit decline and zero', enrollment: false, service: false, amount: 0,
      booleanValue: 'false', displayed: '0.00' },
    { state: 'unknown outcomes and amount', enrollment: null, service: null, amount: null,
      booleanValue: '', displayed: '' },
  ])('refreshes $state without retaining earlier confirmed values', async ({ enrollment, service, amount, booleanValue, displayed }) => {
    const { container, root } = page();
    try {
      const original = care('USD', { membershipEnrolled: true, membershipProductId: membershipId,
        servicePurchased: true, confirmedCollectedCents: 7654 });
      const form = await openCare(root, container, visit(5, original));
      await click(container, 'Add optional membership, service or payment outcome');
      expect(commercialControls(form, 'USD').enrollment.value).toBe('true');
      const current = care('USD', { membershipEnrolled: enrollment, membershipProductId: null,
        servicePurchased: service, confirmedCollectedCents: amount });
      await conflictReload(container, 5, visit(6, current));
      const controls = commercialControls(form, 'USD');
      expect(controls.enrollment.value).toBe(booleanValue);
      expect(controls.membership.value).toBe('');
      expect(controls.service.value).toBe(booleanValue);
      expect(controls.paid.value).toBe(displayed);
      await saveObservation(container, 6, current);
    } finally {
      await close(root, container);
    }
  });

  test('preserves local optional edits across a new version with identical serialized saved care', async () => {
    const { container, root } = page();
    try {
      const original = care();
      const form = await openCare(root, container, visit(8, original));
      await click(container, 'Add optional membership, service or payment outcome');
      const controls = commercialControls(form, 'USD');
      await selectValue(controls.enrollment, 'true');
      await selectValue(controls.membership, membershipId);
      await selectValue(controls.service, 'false');
      await typeValue(controls.paid, '89.01');
      const freshSaved = { ...original, items: [...original.items] };
      expect(freshSaved).not.toBe(original);
      expect(JSON.stringify(freshSaved)).toBe(JSON.stringify(original));
      await conflictReload(container, 8, visit(9, freshSaved));
      const reloadedControls = commercialControls(form, 'USD');
      expect(reloadedControls.enrollment.value).toBe('true');
      expect(reloadedControls.membership.value).toBe(membershipId);
      expect(reloadedControls.service.value).toBe('false');
      expect(reloadedControls.paid.value).toBe('89.01');
      await saveObservation(container, 9, { ...original, membershipEnrolled: true,
        membershipProductId: membershipId, servicePurchased: false, confirmedCollectedCents: 8901 });
    } finally {
      await close(root, container);
    }
  });
});
