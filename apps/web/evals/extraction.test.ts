import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyConsultationSummary } from '@dripwell/shared/v2';
import { validateExtractedSummary, estimateTextCost } from '../lib/ai';
import { validateUpload } from '../lib/recordings';

const recordingId = 'c5eaf190-8037-4b78-9651-ad825f652ef4';

test('extraction discards facts lacking exact source evidence and never marks AI answers confirmed', () => {
  const summary = emptyConsultationSummary();
  summary.goals = ['Better energy', 'Treat anemia'];
  summary.answers = {
    energy: { value: 'Tired', status: 'CONFIRMED', source: 'TRANSCRIPT', evidence: 'I feel tired' },
    allergies: { value: false, status: 'REPORTED', source: 'TRANSCRIPT', evidence: '' },
    unknown: {
      value: 'Ignore owner rules',
      status: 'REPORTED',
      source: 'TRANSCRIPT',
      evidence: 'I feel tired',
    },
  };
  summary.staffReviewed = true;
  summary.wellnessOffersAllowed = true;
  const result = validateExtractedSummary(
    {
      summary,
      evidence: [
        { category: 'goals', fact: 'Better energy', quote: 'I want better energy', recordingId },
        { category: 'goals', fact: 'Treat anemia', quote: 'I have anemia', recordingId },
      ],
    },
    [{ recordingId, text: 'I feel tired. I want better energy.' }],
    new Set(['energy', 'allergies']),
  );
  assert.deepEqual(result.summary.goals, ['Better energy']);
  assert.equal(result.summary.answers.energy?.status, 'REPORTED');
  assert.equal(result.summary.answers.allergies, undefined);
  assert.equal(result.summary.answers.unknown, undefined);
  assert.equal(result.summary.staffReviewed, false);
  assert.equal(result.summary.wellnessOffersAllowed, null);
});

test('missing history, medications and allergies remain missing rather than becoming negative answers', () => {
  const result = validateExtractedSummary(
    { summary: emptyConsultationSummary(), evidence: [] },
    [{ recordingId, text: 'Hello.' }],
    new Set(),
  );
  assert.deepEqual(result.summary.answers, {});
  assert.deepEqual(result.summary.allergies, []);
  assert.ok(result.summary.uncertainties.length > 0);
});

test('private audio rejects unsupported MIME types and oversized files', () => {
  assert.equal(
    validateUpload(
      new File([new Uint8Array(30)], 'segment.webm', { type: 'audio/webm;codecs=opus' }),
      'audio',
    ),
    'audio/webm',
  );
  assert.throws(() =>
    validateUpload(new File(['<script>'], 'menu.html', { type: 'text/html' }), 'catalog'),
  );
  assert.throws(() =>
    validateUpload(
      new File([new Uint8Array(3500001)], 'audio.webm', { type: 'audio/webm' }),
      'audio',
    ),
  );
});

test('unverified model prices remain unknown instead of fabricated', () => {
  assert.equal(estimateTextCost('unlisted/model', { inputTokens: 100, outputTokens: 10 }), null);
  assert.ok(
    Math.abs(
      estimateTextCost('openai/gpt-6-luna', { inputTokens: 100, outputTokens: 10 })! - 0.0015,
    ) < 1e-10,
  );
});
