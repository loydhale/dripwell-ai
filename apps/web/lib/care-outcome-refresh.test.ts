// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { emptyConsultationSummary, type ActualCare, type ClinicConfiguration } from '@dripwell/shared/v2';
import type { ConsultationView, useClinic } from '../components/clinic-context';

const boundary = vi.hoisted(() => ({
  context: null as ReturnType<typeof useClinic> | null, navigationCase: false,
}));
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
// Original care cases retain null recording leaves. New composition cases use an inert marker,
// which proves parent placement only, not physical recording or transcription.
vi.mock('../components/audio-recorder', () => ({
  AudioRecorder: () => boundary.navigationCase
    ? createElement('div', { 'data-testid': 'inert-recorder' }, 'Synthetic recorder boundary')
    : null,
}));
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
    ].includes(path)) || (method === 'POST' && path === '/api/clinic')
      || (boundary.navigationCase && method === 'GET' && path === `/api/share?consultationId=${visitId}`);
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
  const tab = container.querySelector<HTMLButtonElement>('#tab-care');
  if (!tab) throw new Error('Missing actual care tab.');
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

// These cases render the real Consultation and shared UI. DOM focus and explicit clicks are
// jsdom evidence only; jsdom does not simulate native Enter/Space activation or CSS/device layout.
const namedViews = [
  ['intake', 'Conversation & facts'],
  ['recommendation', 'Review & approve'],
  ['care', 'Actual care'],
  ['wellness', 'Wellness & sharing'],
  ['history', 'Change history'],
] as const;
function viewTab(container: HTMLElement, id: string) {
  const element = container.querySelector<HTMLButtonElement>(`#tab-${id}`);
  if (!element) throw new Error(`Missing named visit tab: ${id}`);
  return element;
}
function assertPanels(container: HTMLElement, selected: string) {
  expect(container.querySelectorAll('[role="tabpanel"]')).toHaveLength(5);
  for (const [id, name] of namedViews) {
    const tab = viewTab(container, id);
    const panel = container.querySelector<HTMLElement>(`#panel-${id}`)!;
    expect(tab.textContent?.trim()).toBe(name);
    expect(tab.getAttribute('aria-controls')).toBe(panel.id);
    expect(panel.getAttribute('aria-labelledby')).toBe(tab.id);
    expect(tab.getAttribute('aria-selected')).toBe(String(id === selected));
    expect(panel.hidden).toBe(id !== selected);
    if (id !== selected) expect(panel.childNodes).toHaveLength(0);
    else expect(panel.children.length).toBeGreaterThan(0);
  }
}
function assertReadOnlyNavigation(expectedReads: number) {
  expect(requests).toHaveLength(expectedReads);
  expect(requests.every((request) => !request.init?.method || request.init.method === 'GET')).toBe(true);
  expect(mutations).toEqual([]);
}
async function key(element: HTMLElement, value: string) {
  const event = new KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true });
  await act(async () => { element.dispatchEvent(event); });
  return event;
}
async function openNavigation(root: Root, container: HTMLElement, saved = visit(1, care())) {
  boundary.navigationCase = true;
  await act(async () => { root.render(createElement(Consultation, { id: visitId })); });
  expect(requests).toHaveLength(2);
  const config = configuration('USD');
  config.questions = [{
    id: 'synthetic-question', text: 'Fictional required question?', why: 'Synthetic question context.',
    type: 'TEXT', options: [], required: true, safetyRelevant: true, activeWhen: [], priority: 1,
  }];
  await respond(0, { consultation: saved, configuration: config });
  await respond(1, { recordings: [] });
  return container.querySelector<HTMLFormElement>('#panel-intake form')!;
}
async function closeNavigation(root: Root, container: HTMLElement) {
  try { await close(root, container); } finally { boundary.navigationCase = false; }
}
function draftRecommendation(saved: ConsultationView) {
  saved.initialRevision = 3;
  saved.clinicalApprovedVersion = 2;
  saved.initialRecommendation = {
    configurationVersionId: configurationId, engineVersion: 'dripwell-rules-v2.1',
    items: [{ productId: membershipId, name: 'Synthetic nonclinical option', type: 'MEMBERSHIP',
      priceCents: 10000, currency: 'USD', quantity: 1, rationale: 'Fictional fixture only',
      evidence: [], terms: 'Synthetic only' }],
    alternatives: [], explanation: 'Synthetic draft, not clinical guidance.',
    unresolvedQuestions: [], safetyFlags: [], eligibleProductIds: [membershipId], blocked: false,
  };
  return saved;
}
function approvedWellness(saved: ConsultationView) {
  saved.wellnessRevision = 4;
  saved.wellnessApprovedVersion = 4;
  saved.wellnessPlan = {
    configurationVersionId: configurationId, engineVersion: 'dripwell-rules-v2.2',
    visitSummary: 'Synthetic approved takeaway.', careReceived: saved.actualCare!, offers: [],
    explanation: 'Fictional wellness fixture only.', safetyFlags: [],
  };
  return saved;
}

describe('named consultation views', () => {
  test('keeps recorder, required questions and all reviewed facts together under five unnumbered names', async () => {
    const { root, container } = page();
    try {
      const form = await openNavigation(root, container);
      expect(Array.from(container.querySelectorAll('[role="tab"]')).map((tab) => tab.textContent?.trim()))
        .toEqual(namedViews.map(([, name]) => name));
      assertPanels(container, 'intake');
      expect(container.querySelectorAll('[role="tab"][tabindex="0"]')).toHaveLength(1);
      expect(viewTab(container, 'intake').tabIndex).toBe(0);
      expect(container.querySelector('#panel-intake [data-testid="inert-recorder"]')).not.toBeNull();
      expect(form.textContent).toContain('Fictional required question?');
      expect(form.textContent).toContain('Required');
      for (const label of ['Client goals', 'Reported symptoms', 'Relevant history',
        'Medications', 'Allergies', 'Preferences', 'Unclear or unconfirmed information']) {
        expect(control<HTMLTextAreaElement>(form, label, 'textarea')).not.toBeNull();
      }
      expect(container.querySelector('#panel-intake')?.textContent).toContain('01 · LISTEN');
      expect(container.querySelector('#panel-intake')?.textContent).toContain('02 · UNDERSTAND');
      expect(container.querySelector('#panel-intake')?.textContent).toContain('Save reviewed summary');
      assertReadOnlyNavigation(2);
    } finally { await closeNavigation(root, container); }
  });

  test('arrows wrap and Home/End move only focus while facts and the selected child retain their state', async () => {
    const { root, container } = page();
    try {
      const form = await openNavigation(root, container);
      const goals = control<HTMLTextAreaElement>(form, 'Client goals', 'textarea');
      await typeValue(goals, 'Unsaved synthetic fact.');
      await act(async () => { viewTab(container, 'intake').focus(); });
      const moves = [
        ['ArrowLeft', 'history'], ['ArrowRight', 'intake'], ['End', 'history'],
        ['Home', 'intake'], ['ArrowRight', 'recommendation'], ['ArrowRight', 'care'],
      ];
      for (const [pressed, expected] of moves) {
        expect((await key(document.activeElement as HTMLElement, pressed!)).defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(viewTab(container, expected!));
        expect(container.querySelectorAll('[role="tab"][tabindex="0"]')).toHaveLength(1);
        expect(viewTab(container, expected!).tabIndex).toBe(0);
        assertPanels(container, 'intake');
        expect(container.querySelector('#panel-intake form')).toBe(form);
        expect(goals.value).toBe('Unsaved synthetic fact.');
        assertReadOnlyNavigation(2);
      }
      for (const pressed of ['Enter', ' ', 'Tab', 'ArrowDown']) {
        expect((await key(viewTab(container, 'care'), pressed)).defaultPrevented).toBe(false);
        assertPanels(container, 'intake');
      }
      // Explicit activation is a real button click, not a claim about jsdom keyboard defaults.
      await click(container, 'Actual care');
      assertPanels(container, 'care');
      expect(container.querySelector('#panel-care form')).toBe(careForm(container));
      assertReadOnlyNavigation(2);
    } finally { await closeNavigation(root, container); }
  });

  test.each([
    { id: 'intake', name: 'Conversation & facts', heading: 'The consultation' },
    { id: 'recommendation', name: 'Review & approve', heading: "Today's initial recommendation" },
    { id: 'care', name: 'Actual care', heading: 'What actually happened?' },
    { id: 'wellness', name: 'Wellness & sharing', heading: 'A wellness plan worth keeping' },
    { id: 'history', name: 'Change history', heading: 'Every adjustment, in context' },
  ])('explicitly selects $name and mounts only its original composition', async ({ id, name, heading }) => {
    const { root, container } = page();
    try {
      await openNavigation(root, container);
      await click(container, name);
      assertPanels(container, id);
      expect(container.querySelector(`#panel-${id}`)?.textContent).toContain(heading);
      expect(viewTab(container, id).tabIndex).toBe(0);
      if (id === 'recommendation') expect(container.querySelector('#panel-recommendation form')).toBeNull();
      if (id === 'care') expect(container.textContent).not.toContain("Today's initial recommendation");
      if (id === 'wellness') {
        expect(container.textContent).toContain('Share the approved takeaway');
        expect(button(container, 'Download PDF').disabled).toBe(true);
        expect(container.querySelector('.share-form')).toBeNull();
      }
      if (id === 'history') expect(container.textContent).toContain('No adjustments yet');
      assertReadOnlyNavigation(2);
    } finally { await closeNavigation(root, container); }
  });

  test('keeps clinical permission and exact-revision STARTED-care guards separate in their named views', async () => {
    const { root, container } = page();
    try {
      await openNavigation(root, container, draftRecommendation(visit(1, care())));
      await click(container, 'Review & approve');
      expect(button(container, 'Approve exact revision').disabled).toBe(true);
      expect(container.textContent).toContain('An authorized provider must approve this revision');
      expect(container.textContent).toContain('03 · RECOMMEND');
      expect(container.textContent).not.toContain('What actually happened?');
      await click(container, 'Actual care');
      const started = container.querySelector<HTMLInputElement>('input[name="careOutcome"][value="STARTED"]')!;
      await act(async () => { started.click(); });
      expect(started.checked).toBe(true);
      expect(container.textContent).toContain('04 · DOCUMENT');
      expect(container.textContent).toContain('Clinical approval is required before recording care started.');
      expect(button(container, 'Save actual outcome').disabled).toBe(true);
      expect(container.textContent).not.toContain('Approve exact revision');
      assertReadOnlyNavigation(2);
    } finally { await closeNavigation(root, container); }
  });

  test('preserves approved sharing mount reads and remount reads, without navigation sending or mutating', async () => {
    const { root, container } = page();
    try {
      await openNavigation(root, container, approvedWellness(visit(1, care())));
      await act(async () => { viewTab(container, 'wellness').focus(); });
      assertPanels(container, 'intake');
      assertReadOnlyNavigation(2);
      await click(container, 'Wellness & sharing');
      expect(requests[2]!.path).toBe(`/api/share?consultationId=${visitId}`);
      await respond(2, { shares: [] });
      expect(container.textContent).toContain('05 · FOLLOW THROUGH');
      expect(container.textContent).toContain('Synthetic approved takeaway.');
      expect(button(container, 'Download PDF').disabled).toBe(false);
      expect(container.querySelector('.share-form input[type="email"]')).not.toBeNull();
      await click(container, 'Change history');
      assertPanels(container, 'history');
      assertReadOnlyNavigation(3);
      await click(container, 'Wellness & sharing');
      expect(requests[3]!.path).toBe(`/api/share?consultationId=${visitId}`);
      await respond(3, { shares: [] });
      assertPanels(container, 'wellness');
      assertReadOnlyNavigation(4);
    } finally { await closeNavigation(root, container); }
  });

  test('keeps history authors, reasons and original/revised comparison in its real disclosure', async () => {
    const { root, container } = page();
    try {
      const saved = visit(1, care());
      saved.adjustments = [{ id: 'synthetic-adjustment', consultationId: visitId,
        actorName: 'Fictional reviewer', reason: 'STAFF_JUDGMENT', reasonNote: 'Synthetic correction.',
        before: { observations: 'Before synthetic correction' }, after: { observations: 'After synthetic correction' },
        createdAt: '2026-10-10T00:00:00.000Z' }];
      await openNavigation(root, container, saved);
      await click(container, 'Change history');
      expect(container.textContent).toContain('Fictional reviewer');
      expect(container.textContent).toContain('Staff judgment');
      expect(container.textContent).toContain('Synthetic correction.');
      const details = container.querySelector<HTMLDetailsElement>('#panel-history details')!;
      expect(details.firstElementChild?.tagName).toBe('SUMMARY');
      expect(details.firstElementChild?.textContent).toBe('Compare original and revised values');
      expect(Array.from(details.querySelectorAll('pre')).map((item) => item.textContent)).toEqual([
        JSON.stringify(saved.adjustments[0]!.before, null, 2), JSON.stringify(saved.adjustments[0]!.after, null, 2),
      ]);
      expect(details.open).toBe(false);
      await act(async () => { (details.firstElementChild as HTMLElement).click(); });
      expect(details.open).toBe(true);
      assertReadOnlyNavigation(2);
    } finally { await closeNavigation(root, container); }
  });

  test('capture denies synthetic keyboard/click navigation and leaving while the full facts editor stays mounted', async () => {
    const { root, container } = page();
    try {
      const form = await openNavigation(root, container);
      const goals = control<HTMLTextAreaElement>(form, 'Client goals', 'textarea');
      await typeValue(goals, 'Unsaved synthetic capture fact.');
      boundary.context!.captureBusy = true;
      await act(async () => { root.render(createElement(Consultation, { id: visitId })); });
      for (const [id] of namedViews) {
        const tab = viewTab(container, id);
        expect(tab.disabled).toBe(true);
        expect(tab.tabIndex).toBe(-1);
        expect((await key(tab, 'ArrowRight')).defaultPrevented).toBe(true);
        await act(async () => { tab.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); });
        assertPanels(container, 'intake');
      }
      expect(container.querySelectorAll('[role="tab"][tabindex="0"]')).toHaveLength(0);
      expect(container.querySelector('#panel-intake form')).toBe(form);
      expect(container.querySelector('[data-testid="inert-recorder"]')).not.toBeNull();
      expect(goals.disabled).toBe(false);
      expect(goals.value).toBe('Unsaved synthetic capture fact.');
      await typeValue(goals, 'Updated fact while capture is busy.');
      expect(goals.value).toBe('Updated fact while capture is busy.');
      const back = container.querySelector<HTMLAnchorElement>('a.back-link')!;
      expect(back.getAttribute('href')).toBe(`/dashboard?locationId=${locationId}`);
      const leave = new MouseEvent('click', { bubbles: true, cancelable: true });
      await act(async () => { back.dispatchEvent(leave); });
      expect(leave.defaultPrevented).toBe(true);
      expect(container.querySelector('[role="alert"]')?.textContent)
        .toContain('Save or deliberately discard unsaved audio before leaving this consultation.');
      assertPanels(container, 'intake');
      assertReadOnlyNavigation(2);
      boundary.context!.captureBusy = false;
      await act(async () => { root.render(createElement(Consultation, { id: visitId })); });
      expect(viewTab(container, 'intake').disabled).toBe(false);
      expect(viewTab(container, 'intake').tabIndex).toBe(0);
      await click(container, 'Actual care');
      assertPanels(container, 'care');
    } finally { await closeNavigation(root, container); }
  });

  test('retains initial loading, server error, retry and archived visit restrictions', async () => {
    const { root, container } = page();
    try {
      boundary.navigationCase = true;
      await act(async () => { root.render(createElement(Consultation, { id: visitId })); });
      expect(container.querySelector('[role="status"]')?.textContent).toContain('Opening consultation');
      expect(container.querySelector('[role="tablist"]')).toBeNull();
      await respond(0, { error: 'Synthetic load failure.' }, 503);
      await respond(1, { recordings: [] });
      expect(container.querySelector('[role="alert"]')?.textContent).toContain('Synthetic load failure.');
      expect(container.querySelector('[role="tablist"]')).toBeNull();
      await click(container, 'Try again');
      const saved = visit(1, care());
      saved.archivedAt = '2026-10-10T01:00:00.000Z';
      saved.archiveReason = 'Fictional archived fixture.';
      await respondLoad(2, saved);
      expect(container.textContent).toContain('This visit is archived.');
      expect(container.textContent).toContain('Fictional archived fixture.');
      expect(button(container, 'Restore visit')).not.toBeNull();
      await click(container, 'Actual care');
      expect(button(container, 'Save actual outcome').disabled).toBe(true);
      await click(container, 'Review & approve');
      expect(button(container, 'Produce initial recommendations').disabled).toBe(true);
      assertReadOnlyNavigation(4);
    } finally { await closeNavigation(root, container); }
  });
});
