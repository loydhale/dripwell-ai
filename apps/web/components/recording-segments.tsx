'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { adjustmentReasons } from '@dripwell/shared/v2';
import { apiRequest, postJson, type ConsultationView } from './clinic-context';
import { waitForJob } from './job-client';
import { Badge, ErrorBanner, Icon, Modal } from './ui';

interface Segment {
  id: string;
  sequence: number;
  status: string;
  transcript: string | null;
  originalTranscript: string | null;
  durationSeconds: number | null;
  speakerAttribution: string;
  expiresAt: string;
}

export function RecordingSegments({
  visit,
  onChange,
}: {
  visit: ConsultationView;
  onChange: () => Promise<void>;
}) {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Segment | null>(null);
  const [discarding, setDiscarding] = useState<Segment | null>(null);
  const [text, setText] = useState('');
  const [reason, setReason] = useState('MISSING_INFORMATION');
  const [note, setNote] = useState('');
  const load = useCallback(async () => {
    try {
      setSegments(
        (await apiRequest<{ recordings: Segment[] }>(`/api/recordings?consultationId=${visit.id}`))
          .recordings,
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load saved audio segments.');
    }
  }, [visit.id]);
  useEffect(() => {
    void load();
  }, [load, visit.version]);
  async function retry(segment: Segment) {
    setBusy(true);
    setError('');
    try {
      const job = await postJson<{ jobId: string }>(`/api/recordings/${segment.id}/retry`, {});
      await waitForJob(job.jobId);
      await onChange();
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Saved audio could not be retried.');
    } finally {
      setBusy(false);
    }
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!editing) return;
    setBusy(true);
    setError('');
    try {
      await apiRequest(`/api/recordings/${editing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, reason, expectedVersion: visit.version }),
      });
      setEditing(null);
      await onChange();
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Transcript correction could not be saved.',
      );
    } finally {
      setBusy(false);
    }
  }
  async function discard(event: FormEvent) {
    event.preventDefault();
    if (!discarding) return;
    setBusy(true);
    setError('');
    try {
      await postJson(`/api/recordings/${discarding.id}/discard`, {
        expectedVersion: visit.version,
        reason,
        reasonNote: note,
      });
      setDiscarding(null);
      await onChange();
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Audio could not be discarded.');
    } finally {
      setBusy(false);
    }
  }
  if (!segments.length && !error) return null;
  return (
    <div className="recording-segments">
      {error ? <ErrorBanner message={error} retry={() => void load()} /> : null}
      {segments.map((segment) => (
        <div className="saved-segment" key={segment.id}>
          <div className="saved-segment-heading">
            <strong>Audio segment {segment.sequence + 1}</strong>
            <Badge
              tone={
                segment.status === 'transcribed'
                  ? 'green'
                  : segment.status.includes('fail')
                    ? 'coral'
                    : 'neutral'
              }
            >
              {segment.status.replaceAll('_', ' ')}
            </Badge>
            {segment.durationSeconds != null ? (
              <span className="small muted">{segment.durationSeconds}s</span>
            ) : null}
          </div>
          {segment.transcript ? (
            <>
              <p>{segment.transcript}</p>
              <p className="field-help">
                {segment.speakerAttribution}. Confirm who said each clinically relevant statement.
              </p>
              {segment.originalTranscript !== segment.transcript ? (
                <details>
                  <summary className="text-button">Original transcript</summary>
                  <p className="small muted">{segment.originalTranscript}</p>
                </details>
              ) : null}
              <button
                className="text-button"
                disabled={busy || Boolean(visit.archivedAt)}
                onClick={() => {
                  setEditing(segment);
                  setText(segment.transcript || '');
                }}
              >
                Correct transcript
              </button>
            </>
          ) : null}
          {!['discarded', 'expired', 'deleted'].includes(segment.status) ? (
            <div className="decision-buttons">
              {segment.status !== 'transcribed' ? (
                <button
                  className="button button-small"
                  disabled={busy || Boolean(visit.archivedAt)}
                  onClick={() => void retry(segment)}
                >
                  <Icon name="mic" size={14} />
                  Retry saved audio
                </button>
              ) : null}
              <button
                className="text-button"
                disabled={busy || Boolean(visit.archivedAt)}
                onClick={() => {
                  setDiscarding(segment);
                  setNote('');
                }}
              >
                Discard unresolved audio
              </button>
            </div>
          ) : null}
        </div>
      ))}
      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title="Correct the saved transcript"
      >
        <form className="form-stack" onSubmit={(event) => void save(event)}>
          <p className="small muted">
            The original remains preserved. Your correction is audited and invalidates approvals
            that depended on the previous evidence.
          </p>
          <label>
            Staff-corrected transcript
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              rows={8}
              required
              maxLength={50000}
            />
          </label>
          <label>
            Correction reason
            <select value={reason} onChange={(event) => setReason(event.target.value)}>
              {adjustmentReasons.map((value) => (
                <option value={value} key={value}>
                  {value.toLowerCase().replaceAll('_', ' ')}
                </option>
              ))}
            </select>
          </label>
          {error ? <ErrorBanner message={error} /> : null}
          <div className="modal-actions">
            <button className="button button-primary" disabled={busy}>
              Save audited correction
            </button>
          </div>
        </form>
      </Modal>
      <Modal
        open={Boolean(discarding)}
        onClose={() => setDiscarding(null)}
        title="Discard this unresolved audio"
      >
        <form className="form-stack" onSubmit={(event) => void discard(event)}>
          <div className="notice notice-warm">
            Review the saved transcript and manually document any missing clinically relevant
            information before proceeding. Discarding does not restore old approvals.
          </div>
          <label>
            Reason category
            <select value={reason} onChange={(event) => setReason(event.target.value)}>
              {adjustmentReasons.map((value) => (
                <option value={value} key={value}>
                  {value.toLowerCase().replaceAll('_', ' ')}
                </option>
              ))}
            </select>
          </label>
          <label>
            What was reviewed and why is this audio being discarded?
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              required
              rows={4}
            />
          </label>
          {error ? <ErrorBanner message={error} /> : null}
          <div className="modal-actions">
            <button
              className="button button-ghost"
              type="button"
              onClick={() => setDiscarding(null)}
            >
              Keep audio
            </button>
            <button className="button button-coral" disabled={busy || !note.trim()}>
              Discard with audit record
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
