// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { ClinicPayload, useClinic } from '../components/clinic-context';

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

import { Setup } from '../components/setup';

const locationId = '11111111-1111-4111-8111-111111111112';
const oldConversationId = '11111111-1111-4111-8111-111111111113';
const newConversationId = '11111111-1111-4111-8111-111111111114';
const message = 'Organize the official catalog I supplied, without inventing prices or protocols.';
const failure = 'This saved setup conversation could not complete the message.';
const oldProposal = {
  clinicName: 'Synthetic setup clinic', currency: 'USD', products: [], questions: [],
  protocolNotes: [], missingQuestions: ['An old catalog detail still needs confirmation.'],
};
const oldLoad = {
  conversation: {
    id: oldConversationId,
    messages: [{ id: 'saved-message', role: 'assistant', text: 'Earlier saved conversation.' }],
    draft: oldProposal,
  },
  readiness: { ready: true },
};
type PendingFetch = {
  path: string;
  init?: RequestInit;
  promise: Promise<Response>;
  settled: boolean;
  resolve: (payload: unknown, status?: number) => void;
};
const requests: PendingFetch[] = [];
let matchMediaDescriptor: PropertyDescriptor | undefined;
let scrollDescriptor: PropertyDescriptor | undefined;

beforeEach(() => {
  const data: ClinicPayload = {
    user: { id: 'synthetic-owner', name: 'Synthetic Owner', email: 'owner@example.invalid', role: 'SUPER_USER' },
    clinic: { id: 'synthetic-clinic', name: 'Synthetic setup clinic' },
    locations: [{ id: locationId, name: 'Synthetic location' }],
    configuration: { draft: null, active: null, versions: [] },
    consultations: [], consultationCount: 0,
    consultationPagination: { nextCursor: null, pageSize: 20 }, notifications: [],
    metrics: {
      from: '2026-10-01T00:00:00.000Z', to: '2026-10-02T00:00:00.000Z', denominator: 0,
      consultations: 0, careStarted: 0, careNotStarted: 0, carePending: 0,
      wellnessAccepted: 0, wellnessRejected: 0, wellnessTbd: 0, wellnessUndecided: 0,
      adjustments: 0, overdue: 0, completionMedianHours: null,
      membershipEnrollments: 0, membershipDeclines: 0, membershipNotRecorded: 0,
      membershipRecorded: 0, membershipEnrollmentRate: null,
    },
    improvements: [], trial: null, adjustments: [], staff: [],
  };
  boundary.context = {
    data, loading: false, error: '', pageError: '', locationId, captureBusy: false,
    refresh: vi.fn(async () => {}), loadMore: vi.fn(async () => {}),
    selectLocation: vi.fn(async () => {}), setCaptureBusy: vi.fn(), mutate: vi.fn(),
  };
  requests.length = 0;
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('fetch', vi.fn((path: string, init?: RequestInit) => {
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
  matchMediaDescriptor = Object.getOwnPropertyDescriptor(window, 'matchMedia');
  scrollDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollTo');
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: () => ({ matches: true }) });
  Object.defineProperty(HTMLElement.prototype, 'scrollTo', { configurable: true, value: vi.fn() });
});

afterEach(() => {
  if (matchMediaDescriptor) Object.defineProperty(window, 'matchMedia', matchMediaDescriptor);
  else Reflect.deleteProperty(window, 'matchMedia');
  if (scrollDescriptor) Object.defineProperty(HTMLElement.prototype, 'scrollTo', scrollDescriptor);
  else Reflect.deleteProperty(HTMLElement.prototype, 'scrollTo');
  vi.unstubAllGlobals();
  boundary.context = null;
});

function button(container: HTMLElement, name: string) {
  const found = Array.from(container.querySelectorAll<HTMLButtonElement>('button'))
    .find((item) => item.getAttribute('aria-label') === name || item.textContent?.trim() === name);
  if (!found) throw new Error(`Missing visible button: ${name}`);
  return found;
}
function input(container: HTMLElement) {
  const found = container.querySelector<HTMLTextAreaElement>('[aria-label="Message the setup assistant"]');
  if (!found) throw new Error('Missing actual setup input.');
  return found;
}
async function typeMessage(container: HTMLElement) {
  await act(async () => {
    const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
    if (!setValue) throw new Error('Missing DOM textarea setter.');
    setValue.call(input(container), message);
    input(container).dispatchEvent(new Event('input', { bubbles: true }));
  });
}
async function click(container: HTMLElement, name: string) {
  await act(async () => { button(container, name).click(); });
}
async function respond(index: number, payload: unknown, status = 200) {
  await act(async () => {
    requests[index]!.resolve(payload, status);
    await requests[index]!.promise;
  });
}
function posted(index: number) {
  const request = requests[index]!;
  expect(request.path).toBe('/api/setup');
  expect(request.init).toMatchObject({ method: 'POST', credentials: 'same-origin', cache: 'no-store' });
  if (typeof request.init?.body !== 'string') throw new Error('Missing JSON setup request.');
  return JSON.parse(request.init.body) as Record<string, unknown>;
}
function page() {
  const container = document.createElement('div');
  document.body.append(container);
  return { container, root: createRoot(container) };
}
async function close(root: Root, container: HTMLElement) {
  try {
    await act(async () => {
      for (const request of requests) {
        if (!request.settled) request.resolve({ error: 'Synthetic test cleanup.' }, 503);
      }
      await Promise.all(requests.map((request) => request.promise));
    });
  } finally {
    await act(async () => { root.unmount(); });
    container.remove();
  }
}

describe('owner setup fresh-conversation interactions', () => {
  test('restarts a failed loaded conversation explicitly with preserved input and a fresh request identity', async () => {
    const { container, root } = page();
    try {
      await act(async () => { root.render(createElement(Setup)); });
      expect(requests).toHaveLength(1);
      expect(requests[0]!.path).toBe(`/api/setup?locationId=${locationId}`);
      await respond(0, oldLoad);
      expect(container.textContent).toContain('Earlier saved conversation.');
      expect(container.textContent).toContain(oldProposal.missingQuestions[0]);
      expect(container.textContent).toContain('An assistant proposal is ready for review.');
      await typeMessage(container);
      await click(container, 'Send setup message');
      const first = posted(1);
      expect(first).toMatchObject({ message, locationId, conversationId: oldConversationId });
      await respond(1, { error: failure, code: 'AI_PROCESSING_FAILED' }, 503);
      expect(input(container).value).toBe(message);
      await click(container, 'Start a new setup conversation');
      expect(requests).toHaveLength(2);
      expect(input(container).value).toBe(message);
      expect(container.textContent).not.toContain('Earlier saved conversation.');
      expect(container.textContent).not.toContain(oldProposal.missingQuestions[0]);
      expect(container.textContent).not.toContain('An assistant proposal is ready for review.');
      expect(container.textContent).not.toContain(failure);
      expect(boundary.context!.mutate).not.toHaveBeenCalled();
      await click(container, 'Send setup message');
      const fresh = posted(2);
      expect(fresh).toMatchObject({ message, locationId, idempotencyKey: expect.any(String) });
      expect(fresh).not.toHaveProperty('conversationId');
      expect(fresh.idempotencyKey).not.toBe(first.idempotencyKey);
      await respond(2, { conversationId: newConversationId, assistantMessage: 'Fresh conversation response.' });
      expect(input(container).value).toBe('');
      expect(container.textContent).toContain('Fresh conversation response.');
      expect(container.querySelectorAll('.chat-message.user')).toHaveLength(1);
    } finally {
      await close(root, container);
    }
  });

  test('keeps restart unavailable during capture and an in-flight retry without clearing its original identity', async () => {
    const { container, root } = page();
    try {
      await act(async () => { root.render(createElement(Setup)); });
      await respond(0, oldLoad);
      await typeMessage(container);
      await click(container, 'Send setup message');
      const first = posted(1);
      await respond(1, { error: failure }, 503);
      boundary.context!.captureBusy = true;
      await act(async () => { root.render(createElement(Setup)); });
      expect(button(container, 'Start a new setup conversation').disabled).toBe(true);
      await click(container, 'Start a new setup conversation');
      expect(requests).toHaveLength(2);
      expect(input(container).value).toBe(message);
      expect(container.textContent).toContain('Earlier saved conversation.');
      boundary.context!.captureBusy = false;
      await act(async () => { root.render(createElement(Setup)); });
      await click(container, 'Send setup message');
      expect(posted(2)).toEqual(first);
      expect(button(container, 'Start a new setup conversation').disabled).toBe(true);
      await click(container, 'Start a new setup conversation');
      expect(requests).toHaveLength(3);
      expect(container.textContent).toContain('Earlier saved conversation.');
      await respond(2, { error: failure }, 503);
      expect(button(container, 'Start a new setup conversation').disabled).toBe(false);
      await click(container, 'Start a new setup conversation');
      await click(container, 'Send setup message');
      expect(posted(3)).not.toHaveProperty('conversationId');
      expect(posted(3).idempotencyKey).not.toBe(first.idempotencyKey);
      await respond(3, { conversationId: newConversationId, assistantMessage: 'Fresh response after safe restart.' });
    } finally {
      await close(root, container);
    }
  });

  test.each(['success', 'failure'])('ignores a late initial GET %s after explicit restart', async (outcome) => {
    const { container, root } = page();
    try {
      await act(async () => { root.render(createElement(Setup)); });
      await typeMessage(container);
      await click(container, 'Send setup message');
      const first = posted(1);
      await respond(1, { error: failure }, 503);
      await click(container, 'Start a new setup conversation');
      expect(requests).toHaveLength(2);
      await click(container, 'Send setup message');
      const fresh = posted(2);
      expect(fresh).not.toHaveProperty('conversationId');
      expect(fresh.idempotencyKey).not.toBe(first.idempotencyKey);
      const currentFailure = 'The new conversation has its own processing error.';
      await respond(2, { error: currentFailure }, 503);
      await respond(0, outcome === 'success' ? oldLoad : { error: 'Obsolete initial GET error.' },
        outcome === 'success' ? 200 : 503);
      expect(container.textContent).toContain(currentFailure);
      expect(container.textContent).not.toContain('Obsolete initial GET error.');
      expect(container.textContent).not.toContain('Earlier saved conversation.');
      expect(container.textContent).not.toContain(oldProposal.missingQuestions[0]);
      expect(container.textContent).not.toContain('An assistant proposal is ready for review.');
      expect(input(container).value).toBe(message);
      await click(container, 'Send setup message');
      expect(posted(3)).toEqual(fresh);
      await respond(3, { conversationId: newConversationId, assistantMessage: 'Current conversation completed.' });
      expect(boundary.context!.mutate).not.toHaveBeenCalled();
    } finally {
      await close(root, container);
    }
  });
});
