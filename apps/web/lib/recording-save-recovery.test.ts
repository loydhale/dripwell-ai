// @vitest-environment jsdom

import { act, createElement, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { emptyConsultationSummary, type ActualCare } from '@dripwell/shared/v2';
import type { ConsultationView, useClinic } from '../components/clinic-context';

const boundary = vi.hoisted(() => ({ context: null as ReturnType<typeof useClinic> | null }));
vi.mock('../components/clinic-context', async (importOriginal) => ({
  ...await importOriginal<typeof import('../components/clinic-context')>(),
  useClinic: () => {
    if (!boundary.context) throw new Error('Missing synthetic clinic context.');
    return boundary.context;
  },
}));
// Parent, recorder, segment UI, API client and job polling are REAL.
// Only browser media and the HTTP responses are disclosed synthetic leaves.
import { Consultation } from '../components/consultation';
import { emptyConfiguration } from '../components/configuration-editor';

const visitId = '11111111-1111-4111-8111-111111111121';
const locationId = '11111111-1111-4111-8111-111111111122';
const recordingId = '11111111-1111-4111-8111-111111111124';
const jobId = '11111111-1111-4111-8111-111111111125';
const safeFailure = 'Synthetic processing failed. Retry the saved recording.';
const unconfirmed = 'The recording upload could not be confirmed.';
const config = emptyConfiguration('Fictional saved-audio recovery clinic');
const summary = emptyConsultationSummary();
const care: ActualCare = {
  outcome: 'NOT_STARTED', items: [], observations: '', reason: '',
  membershipEnrolled: null, membershipProductId: null, servicePurchased: null,
  confirmedCollectedCents: null, currency: 'USD',
};
const visit: ConsultationView = {
  id: visitId, reference: 'SYNTHETIC-SAVED-AUDIO', version: 1,
  stage: 'CONSULTATION_STARTED', locationId, providerId: 'synthetic-staff',
  isTest: true, configurationVersionId: '11111111-1111-4111-8111-111111111123',
  consentAt: '2026-10-14T00:00:00.000Z', consentDeclined: false,
  summary, transcript: [], initialRecommendation: null, initialRevision: 0,
  clinicalApprovedVersion: null, clinicalApprovedAt: null, actualCare: care,
  careOutcome: 'NOT_STARTED', wellnessPlan: null, wellnessRevision: 0,
  wellnessApprovedVersion: null, wellnessApprovedAt: null, wellnessDecision: null,
  wellnessDecisionRevision: null, archivedAt: null, archiveReason: null,
  createdAt: '2026-10-14T00:00:00.000Z', updatedAt: '2026-10-14T00:00:00.000Z',
};

type RequestRow = { path: string; method: string; body?: BodyInit | null };
const requests: RequestRow[] = [];
const pending = new Set<Promise<Response>>();
const recorders: SyntheticRecorder[] = [];
const unexpected: string[] = [];
const refresh = vi.fn(async () => {});
let root: Root | null = null;
let container: HTMLDivElement | null = null;
let mediaDescriptor: PropertyDescriptor | undefined;
let uploadBody: unknown;
let uploadStatus: number;
let invalidJson: boolean;
let accepted: boolean;
let advanceSavedVersion: boolean;
let jobStatus: 'failed' | 'complete';
let completedJob: NonNullable<ConsultationView['jobs']>[number] | null;
let retryFails: boolean;
let getUserMedia: ReturnType<typeof vi.fn>;
let stopTrack: ReturnType<typeof vi.fn>;

class SyntheticRecorder {
  static isTypeSupported(type: string) { return type === 'audio/webm;codecs=opus'; }
  state = 'inactive';
  mimeType = 'audio/webm;codecs=opus';
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(_stream: MediaStream) { recorders.push(this); }
  start() { this.state = 'recording'; }
  stop() {
    if (this.state === 'inactive') return;
    this.state = 'inactive';
    this.ondataavailable?.({ data: new Blob(['Synthetic callback recovery bytes.'], { type: this.mimeType }) });
    this.onstop?.();
  }
  pause() { this.state = 'paused'; }
  resume() { this.state = 'recording'; }
}

function Harness() {
  const [captureBusy, setCaptureBusy] = useState(false);
  boundary.context = {
    data: null, loading: false, error: '', pageError: '', locationId, captureBusy,
    setCaptureBusy, refresh, loadMore: async () => {}, selectLocation: async () => {},
    mutate: async () => { throw new Error('Unexpected synthetic clinic mutation.'); },
  };
  return createElement(Consultation, { id: visitId });
}
function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
function savedSegments() {
  return accepted ? [{
    id: recordingId, sequence: 0, status: 'uploaded', transcript: null, originalTranscript: null,
    durationSeconds: 1, speakerAttribution: 'Needs staff confirmation',
    expiresAt: '2026-10-15T00:00:00.000Z',
  }] : [];
}
function syntheticFetch(input: RequestInfo | URL, init?: RequestInit) {
  const path = String(input), method = init?.method || 'GET';
  requests.push({ path, method, body: init?.body });
  let result: Response;
  if (method === 'GET' && path === `/api/clinic?id=${visitId}`)
    result = response({ consultation: { ...visit, version: advanceSavedVersion && accepted ? 2 : visit.version, jobs: completedJob ? [completedJob] : [] }, configuration: config });
  else if (method === 'GET' && path === `/api/recordings?consultationId=${visitId}`)
    result = response({ recordings: savedSegments() });
  else if (method === 'POST' && path === '/api/recordings') {
    // Receipt validity is NOT copied here. The selected scenario alone chooses
    // whether this disclosed server leaf reports an accepted saved segment.
    accepted = uploadStatus === 202 && !invalidJson && Boolean(
      uploadBody && typeof uploadBody === 'object' && 'scenarioAccepted' in uploadBody,
    );
    result = invalidJson ? new Response('not-json', { status: 202 }) : response(uploadBody, uploadStatus);
  } else if (method === 'POST' && path === `/api/recordings/${recordingId}/retry`) {
    result = retryFails
      ? response({ error: safeFailure, code: 'SYNTHETIC_PROCESSING_FAILURE' }, 503)
      : response({ recordingId, jobId, status: 'pending' }, 202);
  } else if (method === 'GET' && path === `/api/jobs/${jobId}`) {
    if (jobStatus === 'complete') completedJob = {
      id: jobId, kind: 'TRANSCRIPTION', status: 'COMPLETE', errorCode: null,
      result: { summaryApplied: false, summary: { ...summary, goals: ['Synthetic extracted goal.'] } },
    };
    result = jobStatus === 'failed'
      ? response({ status: 'failed', error: safeFailure })
      : response({ status: 'complete', result: completedJob!.result });
  } else {
    unexpected.push(`${method} ${path}`);
    result = response({ error: 'Unexpected synthetic request.' }, 503);
  }
  const operation = Promise.resolve(result);
  pending.add(operation);
  void operation.then(() => pending.delete(operation));
  return operation;
}
function buttons() { return Array.from(container!.querySelectorAll<HTMLButtonElement>('button')); }
function button(name: string) {
  const found = buttons().find(item => item.textContent?.trim() === name);
  if (!found) throw new Error(`Missing real component button: ${name}`);
  return found;
}
async function click(name: string) { await act(async () => { button(name).click(); }); }
async function settle() {
  // Finite microtask draining for owned immediate synthetic HTTP leaves only.
  for (let count = 0; count < 8; count++)
    await act(async () => { await Promise.all([...pending]); });
}
async function open() {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(async () => { root!.render(createElement(Harness)); });
  await settle();
  expect(button('Start recording').disabled).toBe(false);
}
async function capture() {
  await click('Start recording');
  await settle();
  expect(getUserMedia).toHaveBeenCalledWith({ audio: { echoCancellation: true }, video: false });
  expect(boundary.context!.captureBusy).toBe(true);
  await click('Stop & save');
  await settle();
}
function audioPosts() { return requests.filter(row => row.method === 'POST' && row.path === '/api/recordings'); }
function uploaded(row: RequestRow) {
  expect(row.body).toBeInstanceOf(FormData);
  const body = row.body as FormData, audio = body.get('audio');
  expect(audio).toBeInstanceOf(File);
  const file = audio as File;
  expect(body.get('consultationId')).toBe(visitId);
  expect(body.get('consent')).toBe('true');
  expect(file.size).toBeGreaterThan(0);
  return { id: body.get('segmentId'), sequence: body.get('sequence'),
    duration: body.get('durationMs'), name: file.name, type: file.type, bytes: file.size };
}
function assertSettledSaved() {
  expect(container!.textContent).toContain('The recording upload was accepted.');
  expect(container!.textContent).toContain(safeFailure);
  expect(container!.textContent).not.toContain('Retry 1 unsaved segment');
  expect(container!.textContent).not.toContain('Discard unsaved local audio');
  expect(button('Retry saved audio')).toBeDefined();
  expect(boundary.context!.captureBusy).toBe(false);
  expect(container!.querySelector<HTMLButtonElement>('#tab-care')!.disabled).toBe(false);
  expect(audioPosts()).toHaveLength(1);
}

beforeEach(() => {
  requests.length = 0; recorders.length = 0; unexpected.length = 0; pending.clear();
  refresh.mockClear();
  uploadBody = { recordingId, jobId, status: 'pending', scenarioAccepted: true };
  uploadStatus = 202; invalidJson = false; accepted = false;
  jobStatus = 'failed'; completedJob = null; retryFails = false; advanceSavedVersion = false;
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  stopTrack = vi.fn();
  getUserMedia = vi.fn(async () => ({
    getTracks: () => [{ stop: stopTrack }],
    getAudioTracks: () => [{ addEventListener: vi.fn() }],
  }));
  mediaDescriptor = Object.getOwnPropertyDescriptor(navigator, 'mediaDevices');
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } });
  vi.stubGlobal('MediaRecorder', SyntheticRecorder);
  vi.stubGlobal('fetch', vi.fn(syntheticFetch));
});

afterEach(async () => {
  try {
    try { await settle(); }
    finally {
      try { if (root) await act(async () => { root!.unmount(); }); }
      finally {
        container?.remove();
        root = null; container = null;
      }
    }
    expect(pending.size).toBe(0);
    expect(recorders.every(item => item.state === 'inactive')).toBe(true);
    expect(unexpected).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  } finally {
    try {
      if (mediaDescriptor) Object.defineProperty(navigator, 'mediaDevices', mediaDescriptor);
      else Reflect.deleteProperty(navigator, 'mediaDevices');
    } finally {
      try { vi.useRealTimers(); }
      finally {
        try { vi.restoreAllMocks(); }
        finally { vi.unstubAllGlobals(); boundary.context = null; }
      }
    }
  }
});

describe('normal recording acceptance and processing recovery', () => {
  test.each([
    { name: 'original upload rejection', body: { error: 'Synthetic initial upload refused.', code: 'SYNTHETIC_UPLOAD_FAILURE' }, status: 503 },
    { name: 'empty receipt', body: {}, status: 202 },
    { name: 'JSON decode fallback', body: {}, status: 202, raw: true },
    { name: 'audioSaved alone', body: { audioSaved: true }, status: 202 },
    { name: 'missing recording ID', body: { jobId, status: 'pending' }, status: 202 },
    { name: 'missing job ID', body: { recordingId, status: 'pending' }, status: 202 },
    { name: 'malformed recording ID', body: { recordingId: 'not-a-uuid', jobId, status: 'pending' }, status: 202 },
    { name: 'malformed job ID', body: { recordingId, jobId: 'not-a-uuid', status: 'pending' }, status: 202 },
    { name: 'unsupported status', body: { recordingId, jobId, status: 'unknown-result' }, status: 202 },
  ])('preserves local recovery for $name', async ({ body, status, raw }) => {
    uploadBody = body; uploadStatus = status; invalidJson = Boolean(raw);
    await open();
    await capture();
    expect(container!.textContent).toContain(status === 503 ? 'Synthetic initial upload refused.' : unconfirmed);
    expect(container!.textContent).not.toContain('The recording upload was accepted.');
    expect(button('Retry 1 unsaved segment')).toBeDefined();
    expect(boundary.context!.captureBusy).toBe(true);
    expect(container!.querySelector<HTMLButtonElement>('#tab-care')!.disabled).toBe(true);
    const first = uploaded(audioPosts()[0]!);
    await click('Retry 1 unsaved segment');
    await settle();
    expect(audioPosts()).toHaveLength(2);
    expect(uploaded(audioPosts()[1]!)).toEqual(first);
    expect(requests.some(row => row.path.startsWith('/api/jobs/') || row.path.endsWith('/retry'))).toBe(false);
    await click('Discard unsaved local audio');
    await settle();
    expect(boundary.context!.captureBusy).toBe(false);
    expect(container!.querySelector<HTMLButtonElement>('#tab-care')!.disabled).toBe(false);
  });

  test('keeps accepted dispatch failure in saved-audio recovery after retry failure', async () => {
    advanceSavedVersion = true;
    uploadBody = { recordingId, jobId, status: 'failed', audioSaved: true,
      errorCode: 'PROCESSING_START_FAILED', scenarioAccepted: true };
    retryFails = true;
    await open(); await capture();
    assertSettledSaved();
    expect(requests.filter(row => row.path.endsWith('/retry')).map(row => row.path))
      .toEqual([`/api/recordings/${recordingId}/retry`]);
    await click('Retry saved audio'); await settle();
    expect(audioPosts()).toHaveLength(1);
    expect(requests.filter(row => row.path.endsWith('/retry'))).toHaveLength(2);
    expect(boundary.context!.captureBusy).toBe(false);
  });

  test('keeps accepted terminal job failure in saved-audio recovery', async () => {
    advanceSavedVersion = true;
    await open(); await capture();
    assertSettledSaved();
    expect(requests.filter(row => row.path === `/api/jobs/${jobId}`)).toHaveLength(1);
    expect(requests.some(row => row.path.endsWith('/retry'))).toBe(false);
    await click('Retry saved audio'); await settle();
    expect(audioPosts()).toHaveLength(1);
    expect(requests.filter(row => row.path.endsWith('/retry')).map(row => row.method)).toEqual(['POST']);
    expect(boundary.context!.captureBusy).toBe(false);
  });

  test('preserves accepted completion and the real proposed-summary UI', async () => {
    jobStatus = 'complete';
    await open(); await capture();
    expect(container!.textContent).toContain('A new extracted summary is available for review.');
    expect(container!.textContent).not.toContain('The recording upload was accepted.');
    expect(container!.textContent).not.toContain('Retry 1 unsaved segment');
    expect(container!.textContent).not.toContain('Processing consultation audio.');
    expect(boundary.context!.captureBusy).toBe(false);
    expect(container!.querySelector<HTMLButtonElement>('#tab-care')!.disabled).toBe(false);
    expect(audioPosts()).toHaveLength(1);
    expect(refresh).toHaveBeenCalledTimes(2);
    expect(requests.filter(row => row.path === `/api/clinic?id=${visitId}`).length).toBeGreaterThan(1);
  });
});
