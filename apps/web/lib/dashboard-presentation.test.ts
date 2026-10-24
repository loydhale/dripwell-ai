// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { consultationStages, emptyConsultationSummary } from '@dripwell/shared/v2';
import type { ClinicPayload, ConsultationView, useClinic } from '../components/clinic-context';

const boundary = vi.hoisted(() => ({
  context: null as ReturnType<typeof useClinic> | null,
  push: vi.fn(),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: boundary.push }) }));
vi.mock('../components/clinic-context', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../components/clinic-context')>();
  return {
    ...actual,
    useClinic: () => {
      if (!boundary.context) throw new Error('Missing synthetic dashboard context.');
      return boundary.context;
    },
  };
});

import { postJson } from '../components/clinic-context';
import { emptyConfiguration } from '../components/configuration-editor';
import { Dashboard } from '../components/dashboard';

// Fictional location/visit artifacts only. This is a DOM presentation story, not
// clinical, physical-browser keyboard, device-layout or paid-service evidence.
const locationId = '22222222-2222-4222-8222-222222222201';
const otherLocation = '22222222-2222-4222-8222-222222222202';
const configurationId = '22222222-2222-4222-8222-222222222203';
const now = '2026-10-11T12:00:00.000Z';
const responses: { payload: unknown; status: number }[] = [];
const posts: Record<string, unknown>[] = [];
const mutations: Promise<unknown>[] = [];
const unexpectedRequests: string[] = [];
let container: HTMLDivElement;
let root: Root;
let originalShowModal: PropertyDescriptor | undefined;
let originalClose: PropertyDescriptor | undefined;

function visit(index: number, archived = false): ConsultationView {
  const actualCare: NonNullable<ConsultationView['actualCare']> = {
    outcome: 'NOT_STARTED', items: [], observations: 'Synthetic observation only.',
    reason: 'No clinical treatment in this fixture.', membershipEnrolled: null,
    membershipProductId: null, servicePurchased: null, confirmedCollectedCents: null,
    currency: 'USD',
  };
  return {
    id: `synthetic-visit-${index}`, reference: `SYNTHETIC-${index}`, version: 1,
    stage: consultationStages[index]!, locationId, providerId: 'synthetic-staff',
    providerName: 'Fictional staff', isTest: true, configurationVersionId: configurationId,
    consentAt: null, consentDeclined: true, summary: emptyConsultationSummary(), transcript: [],
    initialRecommendation: index > 0 ? {
      configurationVersionId: configurationId, engineVersion: 'dripwell-rules-v2.1',
      items: [], alternatives: [], explanation: 'Synthetic UI artifact.',
      unresolvedQuestions: [], safetyFlags: [], eligibleProductIds: [], blocked: false,
    } : null,
    initialRevision: index > 0 ? 1 : 0, clinicalApprovedVersion: index > 1 ? 1 : null,
    clinicalApprovedAt: index > 1 ? now : null,
    actualCare: index > 1 ? actualCare : null,
    careOutcome: index > 1 ? 'NOT_STARTED' : 'PENDING',
    wellnessPlan: index > 1 ? {
      configurationVersionId: configurationId, engineVersion: 'dripwell-rules-v2.2',
      visitSummary: 'Synthetic UI visit.', careReceived: actualCare, offers: [],
      explanation: 'Synthetic UI artifact.', safetyFlags: [],
    } : null,
    wellnessRevision: index > 1 ? 1 : 0, wellnessApprovedVersion: index > 2 ? 1 : null,
    wellnessApprovedAt: index > 2 ? now : null,
    wellnessDecision: index === 3 ? 'ACCEPTED' : index === 4 ? 'REJECTED' : index === 5 ? 'TBD' : null,
    wellnessDecisionRevision: index > 2 ? 1 : null,
    decisionNeedsReview: index === 5,
    archivedAt: archived ? now : null, archiveReason: archived ? 'Synthetic archive.' : null,
    createdAt: '2026-10-10T12:00:00.000Z', updatedAt: now,
  };
}
function payload(): ClinicPayload {
  const configuration = {
    id: configurationId, version: 1, revision: 1, status: 'ACTIVE',
    configuration: emptyConfiguration('Fictional dashboard clinic'), createdAt: now,
  };
  return {
    user: { id: 'synthetic-staff', name: 'Fictional staff', email: 'staff@example.invalid', role: 'PROVIDER' },
    clinic: { id: 'synthetic-clinic', name: 'Fictional dashboard clinic' },
    locations: [{ id: otherLocation, name: 'Fictional north' }, { id: locationId, name: 'Fictional south' }],
    configuration: { draft: null, active: configuration, versions: [configuration] },
    consultations: consultationStages.map((_, index) => visit(index)), consultationCount: 6,
    consultationPagination: { nextCursor: null, pageSize: 50 }, notifications: [],
    metrics: {
      from: '2026-09-11T12:00:00.000Z', to: now, denominator: 6, consultations: 6,
      careStarted: 0, careNotStarted: 4, carePending: 2, wellnessAccepted: 1,
      wellnessRejected: 1, wellnessTbd: 1, wellnessUndecided: 3, adjustments: 0,
      overdue: 2, completionMedianHours: null, membershipEnrollments: 1,
      membershipDeclines: 1, membershipNotRecorded: 4, membershipRecorded: 2,
      membershipEnrollmentRate: 0.5,
    },
    improvements: [], trial: null, adjustments: [], staff: [],
  };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
  vi.setSystemTime(new Date(now));
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  responses.length = 0;
  posts.length = 0;
  mutations.length = 0;
  unexpectedRequests.length = 0;
  boundary.push.mockReset();
  boundary.context = {
    data: payload(), loading: false, error: '', pageError: '', locationId, captureBusy: false,
    refresh: vi.fn(async () => {}), loadMore: vi.fn(async () => {}),
    selectLocation: vi.fn(async () => {}), setCaptureBusy: vi.fn(),
    mutate: <T,>(action: string, fields: Record<string, unknown> = {}) => {
      const operation = postJson<T>('/api/clinic', { action, ...fields });
      mutations.push(operation);
      void operation.catch(() => {});
      return operation;
    },
  };
  vi.stubGlobal('fetch', vi.fn(async (path: RequestInfo | URL, init?: RequestInit) => {
    const next = responses.shift();
    if (String(path) !== '/api/clinic' || init?.method !== 'POST' || !next || posts.length >= 3) {
      unexpectedRequests.push(`${init?.method || 'GET'} ${String(path)}`);
      throw new Error('Unexpected synthetic dashboard request.');
    }
    expect(init.credentials).toBe('same-origin');
    expect(init.cache).toBe('no-store');
    posts.push(JSON.parse(String(init.body)) as Record<string, unknown>);
    return new Response(JSON.stringify(next.payload), {
      status: next.status, headers: { 'Content-Type': 'application/json' },
    });
  }));
  // jsdom dialog boundary only. Keep the real Modal, inputs and actions. This
  // does not emulate browser modal focus trapping or native cancel behavior.
  originalShowModal = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal');
  originalClose = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close');
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true, value(this: HTMLDialogElement) { this.open = true; },
  });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true, value(this: HTMLDialogElement) { this.open = false; },
  });
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => { root.unmount(); await Promise.allSettled(mutations); });
  container.remove();
  if (originalShowModal) Object.defineProperty(HTMLDialogElement.prototype, 'showModal', originalShowModal);
  else Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
  if (originalClose) Object.defineProperty(HTMLDialogElement.prototype, 'close', originalClose);
  else Reflect.deleteProperty(HTMLDialogElement.prototype, 'close');
  boundary.context = null;
  vi.useRealTimers();
  vi.unstubAllGlobals();
  expect(unexpectedRequests).toEqual([]);
  expect(responses).toHaveLength(0);
});

async function render() {
  await act(async () => { root.render(createElement(Dashboard)); });
}
function button(name: string) {
  const found = Array.from(container.querySelectorAll<HTMLButtonElement>('button'))
    .find((item) => item.textContent?.trim() === name || item.getAttribute('aria-label') === name);
  if (!found) throw new Error(`Missing dashboard button: ${name}`);
  return found;
}
async function click(name: string) {
  await act(async () => { button(name).click(); });
}
function reporting() {
  const disclosure = container.querySelector<HTMLDetailsElement>('details.dashboard-reporting');
  if (!disclosure) throw new Error('Missing consultation reporting disclosure.');
  return disclosure;
}
function precedes(first: Element, second: Element) {
  expect(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
}
async function debounce() {
  await act(async () => { await vi.advanceTimersByTimeAsync(300); });
}
async function typeValue(input: HTMLInputElement, value: string) {
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    if (!setter) throw new Error('Missing DOM input value setter.');
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
async function selectValue(select: HTMLSelectElement, value: string) {
  await act(async () => {
    select.value = value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
}
function input(selector: string) {
  const element = container.querySelector<HTMLInputElement>(selector);
  if (!element) throw new Error(`Missing dashboard input: ${selector}`);
  return element;
}

describe('work-first consultation dashboard', () => {
  test('puts start, filters and all six resumable stages before named native reporting', async () => {
    await render();
    const details = reporting();
    const board = container.querySelector('.kanban')!;
    const summary = details.firstElementChild as HTMLElement;
    expect(summary.tagName).toBe('SUMMARY');
    expect(summary.textContent?.trim()).toBe('Consultation reporting');
    expect(summary.querySelector('h2')?.textContent).toBe('Consultation reporting');
    expect(details.open).toBe(false);
    precedes(button('New consultation'), board);
    precedes(input('[aria-label="Search visit or staff"]'), board);
    precedes(board, details);
    expect(Array.from(board.querySelectorAll('h2')).map((heading) => heading.textContent))
      .toEqual(['Consultation started', 'Initial recommendations', 'Wellness plan produced',
        'Wellness accepted', 'Wellness rejected', 'Decision pending']);
    expect(Array.from(board.querySelectorAll('.column-trigger')).map((trigger) => trigger.textContent))
      .toEqual(['Automatic milestone', 'Automatic milestone', 'Automatic milestone',
        'Staff-recorded decision', 'Staff-recorded decision', 'Staff-recorded decision']);
    const links = Array.from(board.querySelectorAll<HTMLAnchorElement>('a.visit-card'));
    expect(links).toHaveLength(6);
    links.forEach((link, index) => {
      expect(link.getAttribute('href')).toBe(`/consultations/synthetic-visit-${index}?locationId=${locationId}`);
      precedes(link, summary);
    });
    expect(links[1]!.textContent).toContain('Clinical review needed');
    expect(links[2]!.textContent).toContain('Wellness approval needed');
    expect(links[5]!.textContent).toContain('Decision needs review');
    expect(links[0]!.textContent).toContain('Care pending');
    expect(links[3]!.textContent).toContain('Care not started');
    summary.focus();
    expect(document.activeElement).toBe(summary);
    // jsdom click activation and open-state observation, not Enter/Space/Tab,
    // screen-reader output or rendered/physical-device layout verification.
    await act(async () => { summary.click(); });
    expect(details.open).toBe(true);
    expect(details.querySelector('[aria-label="Client membership outcomes"]')).not.toBeNull();
    expect(Array.from(details.querySelectorAll('.stat-card > strong')).map((value) => value.textContent))
      .toEqual(['6', '0/6', '1/3', '2', '1/6', '1', '4', '50%']);
    expect(details.textContent).toContain('1 enrolled of 2 recorded outcomes; 4 not recorded.');
    expect(details.textContent).toContain('Archived visits are included; setup tests are excluded.');
    await act(async () => { summary.click(); });
    expect(details.open).toBe(false);
    expect(posts).toHaveLength(0);
  });

  test('keeps debounced search, archive/date filters and location-correlated links ahead of unchanged totals', async () => {
    boundary.context!.data!.consultations.push({ ...visit(0, true), id: 'synthetic-archive', reference: 'SYNTHETIC-ARCHIVE' });
    boundary.context!.data!.consultationCount = 7;
    await render();
    await debounce();
    const refresh = vi.mocked(boundary.context!.refresh);
    expect(refresh).toHaveBeenLastCalledWith({ archived: false, search: '',
      from: '2026-09-11T12:00:00.300Z', to: '2026-10-11T12:00:00.300Z' });
    refresh.mockClear();
    await typeValue(input('[aria-label="Search visit or staff"]'), '  SYNTHETIC-ARCHIVE  ');
    await act(async () => { await vi.advanceTimersByTimeAsync(299); });
    expect(refresh).not.toHaveBeenCalled();
    const range = container.querySelector<HTMLSelectElement>('[aria-label="Reporting date range"]')!;
    await selectValue(range, '7');
    await click('Archive');
    await debounce();
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenLastCalledWith({ archived: true, search: 'SYNTHETIC-ARCHIVE',
      from: '2026-10-04T12:00:00.899Z', to: '2026-10-11T12:00:00.899Z' });
    const links = container.querySelectorAll<HTMLAnchorElement>('a.visit-card');
    expect(links).toHaveLength(1);
    expect(links[0]!.getAttribute('href')).toBe(`/consultations/synthetic-archive?locationId=${locationId}`);
    expect(links[0]!.textContent).toContain('Archived');
    expect(container.textContent).toContain('Archive includes all retained dates.');
    expect(reporting().querySelector('.stat-card > strong')?.textContent).toBe('6');
    await click('Active visits');
    expect(container.querySelectorAll('a.visit-card')).toHaveLength(6);
  });

  test('keeps loading, pagination error/retry and load-more controls before reporting', async () => {
    boundary.context!.loading = true;
    boundary.context!.data!.consultationPagination.nextCursor = 'synthetic-next';
    await render();
    expect(container.querySelector('[role="status"]')?.textContent).toBe('Loading visits…');
    expect(container.querySelector('.kanban')?.getAttribute('aria-busy')).toBe('true');
    expect(button('Loading…').disabled).toBe(true);
    precedes(button('Loading…'), reporting());
    boundary.context!.loading = false;
    boundary.context!.pageError = 'Synthetic next-page failure.';
    await render();
    const alert = container.querySelector('[role="alert"]')!;
    expect(alert.textContent).toContain('Synthetic next-page failure.');
    precedes(alert, reporting());
    await click('Try again');
    await click('Load more visits');
    expect(boundary.context!.loadMore).toHaveBeenCalledTimes(2);
    expect(container.querySelector('[role="status"]')?.textContent).toContain('Showing 6 of 6 matching visits');
  });

  test('places both first-visit and filtered-empty states before reporting', async () => {
    boundary.context!.data!.consultations = [];
    boundary.context!.data!.consultationCount = 0;
    await render();
    const first = button('Start your first consultation');
    expect(first.disabled).toBe(false);
    precedes(first, reporting());
    await typeValue(input('[aria-label="Search visit or staff"]'), 'absent');
    expect(container.textContent).toContain('No matching visits.');
    expect(container.textContent).toContain('Try a different visit reference or staff name.');
    expect(container.textContent).not.toContain('Start your first consultation');
    precedes(container.querySelector('.empty-state')!, reporting());
    await typeValue(input('[aria-label="Search visit or staff"]'), '');
    await click('Archive');
    expect(container.textContent).toContain('Archived visits will appear here, including older retained visits.');
  });

  test.each(['setup', 'readiness'] as const)('preserves the %s start guard while keeping existing visits resumable', async (guard) => {
    if (guard === 'setup') boundary.context!.data!.configuration.active = null;
    else boundary.context!.data!.trial = {
      used: 1, remaining: 9, limit: 10, endsAt: '2026-10-20T12:00:00.000Z',
      status: 'TRIAL', daysRemaining: 9, canStart: false,
    };
    await render();
    expect(button('New consultation').disabled).toBe(true);
    expect(container.querySelectorAll('a.visit-card')).toHaveLength(6);
    if (guard === 'setup') {
      const setup = Array.from(container.querySelectorAll<HTMLAnchorElement>('a'))
        .find((link) => link.textContent?.includes('Continue setup'))!;
      expect(setup.getAttribute('href')).toBe(`/setup?locationId=${locationId}`);
      precedes(setup, reporting());
    } else expect(container.textContent).toContain('Client visits are not yet enabled for this clinic.');
    expect(posts).toHaveLength(0);
  });

  test('retains the real consent/location start form, saved idempotency key and retry navigation', async () => {
    responses.push({ payload: { error: 'Synthetic start conflict.' }, status: 409 },
      { payload: { consultation: { id: 'synthetic-saved' } }, status: 200 });
    await render();
    await click('New consultation');
    const dialog = container.querySelector<HTMLDialogElement>('dialog')!;
    expect(dialog.open).toBe(true);
    const form = dialog.querySelector('form')!;
    expect(form.querySelector<HTMLInputElement>('input[type="checkbox"]')?.checked).toBe(false);
    expect(form.textContent).toContain('The client consents to recording this consultation.');
    const location = form.querySelector<HTMLSelectElement>('select')!;
    expect(location.value).toBe(locationId);
    await selectValue(location, otherLocation);
    await typeValue(input('input[placeholder="Use a neutral identifier"]'), '  SYNTHETIC-NEW  ');
    await click('Start consultation');
    expect(posts[0]).toMatchObject({ action: 'consultation.start', reference: 'SYNTHETIC-NEW',
      locationId: otherLocation, consent: false });
    expect(posts[0]!.idempotencyKey).toEqual(expect.stringMatching(/^[0-9a-f-]{36}$/));
    expect(dialog.querySelector('[role="alert"]')?.textContent).toContain('Synthetic start conflict.');
    expect(boundary.push).not.toHaveBeenCalled();
    await click('Start consultation');
    expect(posts[1]).toEqual(posts[0]);
    expect(boundary.push).toHaveBeenCalledTimes(1);
    expect(boundary.push).toHaveBeenLastCalledWith(`/consultations/synthetic-saved?locationId=${otherLocation}`);
    await click('Cancel');
    expect(dialog.open).toBe(false);
  });
});
