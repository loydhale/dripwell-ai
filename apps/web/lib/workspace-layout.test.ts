// @vitest-environment jsdom

import { act, createElement, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { emptyConsultationSummary } from '@dripwell/shared/v2';
import type { ClinicPayload, ConsultationView, useClinic } from '../components/clinic-context';

const boundary = vi.hoisted(() => ({ context: null as ReturnType<typeof useClinic> | null }));
vi.mock('next/navigation', () => ({ usePathname: () => '/dashboard' }));
vi.mock('../components/clinic-context', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../components/clinic-context')>();
  return {
    ...actual,
    ClinicProvider: ({ children }: { children: ReactNode }) => children,
    useClinic: () => {
      if (!boundary.context) throw new Error('Missing synthetic workspace context.');
      return boundary.context;
    },
  };
});

import { postJson } from '../components/clinic-context';
import { AppShell } from '../components/app-shell';

// Fictional workspace data. This exercises the real shell/UI, with normal
// context/provider/router/transport leaves replaced, not backend authority.
const locationId = '33333333-3333-4333-8333-333333333301';
const otherLocation = '33333333-3333-4333-8333-333333333302';
const now = '2026-10-11T12:00:00.000Z';
const responses: { path: string; payload: unknown; status: number }[] = [];
const posts: { path: string; body: Record<string, unknown> }[] = [];
const operations: Promise<unknown>[] = [];
const unexpectedRequests: string[] = [];
let container: HTMLDivElement;
let root: Root;

function visit(id: string, archived = false, isTest = false): ConsultationView {
  return {
    id, reference: id, stage: 'CONSULTATION_STARTED', version: 1, locationId,
    providerId: 'synthetic-staff', isTest, configurationVersionId: 'synthetic-configuration',
    consentDeclined: true, summary: emptyConsultationSummary(), transcript: [],
    initialRecommendation: null, initialRevision: 0, clinicalApprovedVersion: null,
    clinicalApprovedAt: null, actualCare: null, careOutcome: 'PENDING', wellnessPlan: null,
    wellnessRevision: 0, wellnessApprovedVersion: null, wellnessApprovedAt: null,
    wellnessDecision: null, wellnessDecisionRevision: null,
    archivedAt: archived ? now : null, archiveReason: archived ? 'Synthetic archive.' : null,
    createdAt: '2026-10-10T12:00:00.000Z', updatedAt: now,
  };
}
function payload(): ClinicPayload {
  return {
    user: { id: 'synthetic-staff', name: 'Fictional Staff', email: 'staff@example.invalid', role: 'PROVIDER' },
    clinic: { id: 'synthetic-clinic', name: 'Fictional clinic' },
    locations: [{ id: locationId, name: 'Fictional south' }, { id: otherLocation, name: 'Fictional north' }],
    configuration: { draft: null, active: null, versions: [] },
    consultations: [visit('synthetic-live'), visit('synthetic-archive', true), visit('synthetic-test', false, true)],
    consultationCount: 3, consultationPagination: { nextCursor: null, pageSize: 50 },
    notifications: [
      { id: 'unread-care', type: 'CARE_OUTCOME', consultationId: 'synthetic-live',
        title: 'Review synthetic care', message: 'Fictional visit needs a staff outcome.',
        isRead: false, readAt: null, createdAt: '2026-10-10T12:00:00.000Z' },
      { id: 'read-boolean', type: 'CARE_OUTCOME', isRead: true, readAt: null, createdAt: now },
      { id: 'read-date', type: 'WELLNESS_DECISION', isRead: false, readAt: now, createdAt: now },
      { id: 'unread-wellness', type: 'WELLNESS_DECISION', createdAt: now },
    ],
    metrics: { from: now, to: now, denominator: 0, consultations: 0, careStarted: 0,
      careNotStarted: 0, carePending: 0, wellnessAccepted: 0, wellnessRejected: 0,
      wellnessTbd: 0, wellnessUndecided: 0, adjustments: 0, overdue: 0,
      completionMedianHours: null, membershipEnrollments: 0, membershipDeclines: 0,
      membershipNotRecorded: 0, membershipRecorded: 0, membershipEnrollmentRate: null },
    improvements: [], trial: null, adjustments: [], staff: [],
  };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(now));
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  responses.length = 0;
  posts.length = 0;
  operations.length = 0;
  unexpectedRequests.length = 0;
  boundary.context = {
    data: payload(), loading: false, error: '', pageError: '', locationId, captureBusy: false,
    refresh: vi.fn(async () => {}), loadMore: vi.fn(async () => {}),
    selectLocation: vi.fn(async () => {}), setCaptureBusy: vi.fn(),
    mutate: <T,>(action: string, fields: Record<string, unknown> = {}) => {
      const operation = (async () => {
        const result = await postJson<T>('/api/clinic', { action, ...fields });
        await boundary.context!.refresh();
        return result;
      })();
      operations.push(operation);
      void operation.catch(() => {});
      return operation;
    },
  };
  vi.stubGlobal('fetch', vi.fn(async (path: RequestInfo | URL, init?: RequestInit) => {
    const next = responses.shift();
    if (!next || String(path) !== next.path || init?.method !== 'POST' || posts.length >= 3) {
      unexpectedRequests.push(`${init?.method || 'GET'} ${String(path)}`);
      throw new Error('Unexpected synthetic workspace request.');
    }
    expect(init.credentials).toBe('same-origin');
    expect(init.cache).toBe('no-store');
    posts.push({ path: String(path), body: JSON.parse(String(init.body)) as Record<string, unknown> });
    return new Response(JSON.stringify(next.payload), {
      status: next.status, headers: { 'Content-Type': 'application/json' },
    });
  }));
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => { root.unmount(); await Promise.allSettled(operations); });
  container.remove();
  boundary.context = null;
  vi.useRealTimers();
  vi.unstubAllGlobals();
  expect(responses).toHaveLength(0);
  expect(unexpectedRequests).toEqual([]);
});
async function render() {
  await act(async () => {
    root.render(createElement(AppShell, null, createElement('p', { 'data-testid': 'work' }, 'Synthetic visit work')));
  });
}
function button(name: string) {
  const found = Array.from(container.querySelectorAll<HTMLButtonElement>('button'))
    .find((item) => item.getAttribute('aria-label') === name || item.textContent?.trim() === name);
  if (!found) throw new Error(`Missing workspace control: ${name}`);
  return found;
}
async function click(name: string) {
  await act(async () => { button(name).click(); });
}
function pane(controller: HTMLButtonElement) {
  const target = document.getElementById(controller.getAttribute('aria-controls') || '');
  if (!target || !container.contains(target)) throw new Error('Missing unique controlled workspace pane.');
  return target;
}
function navLinks() {
  return Array.from(container.querySelectorAll<HTMLAnchorElement>('nav[aria-label="Clinic workspace navigation"] a'));
}
function work() { return container.querySelector('[data-testid="work"]'); }

describe('selected clinic workspace shell', () => {
  test.each(['SUPER_USER', 'super_user', 'OWNER', 'PROVIDER'])('preserves %s navigation and current location without changing authority', async (role) => {
    boundary.context!.data!.user.role = role;
    await render();
    const owner = role !== 'PROVIDER';
    const paths = owner ? ['/dashboard', '/setup', '/owner', '/settings'] : ['/dashboard', '/settings'];
    expect(navLinks().map((link) => link.getAttribute('href')))
      .toEqual(paths.map((path) => `${path}?locationId=${locationId}`));
    expect(navLinks()[0]!.querySelector('.nav-count')?.textContent).toBe('1');
    expect(navLinks()[0]!.classList.contains('active')).toBe(true);
    expect(container.querySelector('.wordmark')?.getAttribute('href')).toBe(`/dashboard?locationId=${locationId}`);
    expect(container.querySelector('.clinic-switch')?.textContent).toContain('Fictional clinic');
    expect(container.querySelector('.profile')?.textContent).toContain('Fictional Staff');
    expect(container.querySelector('.profile')?.textContent).toContain(owner ? 'Clinic owner' : 'Clinic team');
    expect(container.querySelector('main[aria-label="Clinic workspace"]')?.contains(work())).toBe(true);
    expect(container.querySelectorAll('aside[aria-label="Visit reminders"]')).toHaveLength(1);
    expect(container.textContent).toContain('Private workspace');
    expect(container.querySelector('footer')?.textContent).toContain('Thoughtful consultations. Better follow-through.');
    expect(posts).toHaveLength(0);
  });

  test('uses named unique controllers, mutually exclusive narrow-panel state and native focusable buttons', async () => {
    await render();
    const menu = button('Open menu');
    const reminders = button('Reminders, 2 unread');
    const navigation = pane(menu);
    const rail = pane(reminders);
    expect(navigation).not.toBe(rail);
    expect(menu.getAttribute('aria-expanded')).toBe('false');
    expect(reminders.getAttribute('aria-expanded')).toBe('false');
    expect(rail.getAttribute('aria-hidden')).toBeNull();
    expect(rail.querySelectorAll('.notification-row')).toHaveLength(4);
    // DOM state/focus only. CSS responsive visibility, physical Tab/keys and
    // screen-reader/device/rendered screenshot fidelity are not proven here.
    menu.focus();
    expect(document.activeElement).toBe(menu);
    await click('Open menu');
    expect(button('Close menu').getAttribute('aria-expanded')).toBe('true');
    expect(navigation.classList.contains('sidebar-open')).toBe(true);
    await click('Reminders, 2 unread');
    expect(button('Open menu').getAttribute('aria-expanded')).toBe('false');
    expect(navigation.classList.contains('sidebar-open')).toBe(false);
    expect(reminders.getAttribute('aria-expanded')).toBe('true');
    expect(rail.classList.contains('reminders-open')).toBe(true);
    await click('Open menu');
    expect(reminders.getAttribute('aria-expanded')).toBe('false');
    expect(rail.classList.contains('reminders-open')).toBe(false);
    await click('Reminders, 2 unread');
    await click('Close reminders');
    expect(reminders.getAttribute('aria-expanded')).toBe('false');
    expect(rail.classList.contains('reminders-open')).toBe(false);
    expect(posts).toHaveLength(0);
  });

  test('preserves actual reminder facts/read forms and updates only through explicit read with refresh or visible failure', async () => {
    await render();
    const rail = container.querySelector('aside[aria-label="Visit reminders"]')!;
    const rows = rail.querySelectorAll('.notification-row');
    expect(rows).toHaveLength(4);
    expect(rows[0]!.textContent).toContain('Review synthetic care');
    expect(rows[0]!.textContent).toContain('Fictional visit needs a staff outcome.');
    expect(rows[0]!.textContent).toContain('Oct 10');
    expect(rows[0]!.querySelector('a')?.getAttribute('href')).toBe(`/consultations/synthetic-live?locationId=${locationId}`);
    expect(rows[1]!.classList.contains('read')).toBe(true);
    expect(rows[2]!.classList.contains('read')).toBe(true);
    expect(rows[1]!.querySelector('button')).toBeNull();
    expect(rows[2]!.querySelector('button')).toBeNull();
    expect(rows[3]!.textContent).toContain('Record wellness decision');
    expect(rows[3]!.textContent).toContain('An outstanding visit needs an update.');
    expect(rail.querySelectorAll('button[aria-label="Mark reminder read"]')).toHaveLength(2);
    await click('Reminders, 2 unread');
    expect(posts).toHaveLength(0);
    responses.push({ path: '/api/clinic', payload: { ok: true }, status: 200 });
    await act(async () => { rows[0]!.querySelector<HTMLButtonElement>('button')!.click(); });
    expect(posts).toEqual([{ path: '/api/clinic', body: { action: 'notification.read', notificationId: 'unread-care' } }]);
    expect(boundary.context!.refresh).toHaveBeenCalledTimes(1);
    // Supply the normal refreshed context result; do not simulate backend policy.
    boundary.context!.data!.notifications[0]!.readAt = now;
    await render();
    expect(button('Reminders, 1 unread')).toBeTruthy();
    expect(rail.querySelectorAll('button[aria-label="Mark reminder read"]')).toHaveLength(1);
    responses.push({ path: '/api/clinic', payload: { error: 'Synthetic reminder update failure.' }, status: 409 });
    await click('Mark reminder read');
    expect(posts[1]).toEqual({ path: '/api/clinic', body: { action: 'notification.read', notificationId: 'unread-wellness' } });
    expect(boundary.context!.refresh).toHaveBeenCalledTimes(1);
    expect(container.querySelector('main [role="alert"]')?.textContent).toContain('Synthetic reminder update failure.');
    expect(rail.querySelectorAll('button[aria-label="Mark reminder read"]')).toHaveLength(1);
  });

  test.each(['loading', 'initial-error', 'cached-error'])('keeps %s truthful, suppresses work and preserves explicit retry', async (state) => {
    if (state !== 'cached-error') boundary.context!.data = null;
    boundary.context!.loading = state === 'loading';
    boundary.context!.error = state === 'loading' ? '' : 'Synthetic workspace unavailable.';
    await render();
    expect(work()).toBeNull();
    if (state === 'loading') {
      expect(container.querySelector('main [role="status"]')?.textContent).toContain('Opening your workspace…');
      expect(button('Reminders, loading')).toBeTruthy();
    } else {
      expect(container.querySelector('main [role="alert"]')?.textContent).toContain('Synthetic workspace unavailable.');
      await click('Try again');
      expect(boundary.context!.refresh).toHaveBeenCalledTimes(1);
    }
    if (!boundary.context!.data) {
      expect(container.textContent).not.toContain("You're up to date.");
      expect(container.querySelector('aside[aria-label="Visit reminders"] [role="status"]')?.textContent)
        .toBe(state === 'loading' ? 'Loading reminders…' : 'Reminders are unavailable until your workspace reloads.');
    }
    boundary.context!.data = payload();
    boundary.context!.data.notifications = [];
    boundary.context!.loading = false;
    boundary.context!.error = '';
    await render();
    expect(work()?.textContent).toBe('Synthetic visit work');
    expect(container.textContent).toContain("You're up to date.");
  });

  test('preserves location selection and unsaved-capture navigation/sign-out denial', async () => {
    await render();
    const select = container.querySelector<HTMLSelectElement>('select[aria-label="Clinic location"]')!;
    expect(select.value).toBe(locationId);
    await act(async () => {
      select.value = otherLocation;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(boundary.context!.selectLocation).toHaveBeenCalledTimes(1);
    expect(boundary.context!.selectLocation).toHaveBeenLastCalledWith(otherLocation);
    boundary.context!.locationId = otherLocation;
    boundary.context!.captureBusy = true;
    await render();
    expect(select.disabled).toBe(true);
    expect(navLinks()[0]!.getAttribute('href')).toBe(`/dashboard?locationId=${otherLocation}`);
    await click('Open menu');
    const guarded = [container.querySelector<HTMLAnchorElement>('.wordmark')!, navLinks()[1]!,
      container.querySelector<HTMLAnchorElement>('.notification-row a')!];
    for (const link of guarded) {
      const event = new MouseEvent('click', { bubbles: true, cancelable: true });
      await act(async () => { link.dispatchEvent(event); });
      expect(event.defaultPrevented).toBe(true);
    }
    expect(button('Open menu').getAttribute('aria-expanded')).toBe('false');
    expect(container.querySelector('main [role="alert"]')?.textContent)
      .toContain('Stop recording and finish or retry unsaved audio before leaving this page.');
    await click('Sign out');
    expect(container.querySelector('main [role="alert"]')?.textContent)
      .toContain('Save or deliberately discard unsaved recording segments before signing out.');
    expect(posts).toHaveLength(0);
  });

  test('retains the normal logout API failure and keeps the work visible', async () => {
    responses.push({ path: '/api/auth/logout', payload: { error: 'Synthetic logout failure.' }, status: 503 });
    await render();
    await click('Sign out');
    expect(posts).toEqual([{ path: '/api/auth/logout', body: {} }]);
    expect(container.querySelector('main [role="alert"]')?.textContent).toContain('Synthetic logout failure.');
    expect(work()).not.toBeNull();
  });
});
