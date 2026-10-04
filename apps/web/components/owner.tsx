'use client';

import Link from 'next/link';
import { useState } from 'react';
import { emptyConsultationSummary } from '@dripwell/shared/v2';
import { isOwner, locationHref, useClinic } from './clinic-context';
import { SyntheticIntake } from './configuration-editor';
import { Badge, EmptyState, ErrorBanner, Icon, Modal, Money, friendlyDate } from './ui';

const classifications = {
  APPROPRIATE_CORRECTION: 'Appropriate staff correction',
  UNSUITABLE_SUGGESTION: 'Unsuitable AI suggestion',
  MISSED_SUITABLE_OPTION: 'Missed suitable option',
  CATALOG_OR_POLICY: 'Catalog, question or policy issue',
};

export function Owner() {
  const { data, mutate, locationId } = useClinic();
  const [selected, setSelected] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [classification, setClassification] = useState('APPROPRIATE_CORRECTION');
  const [notes, setNotes] = useState('');
  const [reviewNotes, setReviewNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [testProposalId, setTestProposalId] = useState<string | null>(null);
  const [summary, setSummary] = useState(emptyConsultationSummary);
  const [approvedTests, setApprovedTests] = useState<string[]>([]);
  if (!data) return null;
  if (!isOwner(data.user.role))
    return (
      <div className="readonly-note">
        The clinic owner manages adjustment review and configuration improvements.
      </div>
    );
  const counts = new Map<string, number>();
  for (const change of data.adjustments)
    counts.set(change.reason, (counts.get(change.reason) || 0) + 1);
  const draft = data.configuration.draft;
  const proposal = data.improvements.find((item) => item.id === testProposalId);
  async function act(action: string, fields: Record<string, unknown>, message: string) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await mutate(action, fields);
      setNotice(message);
      if (action === 'improvement.create') {
        setSelected([]);
        setTitle('');
        setNotes('');
      }
      if (action === 'improvement.activate') setTestProposalId(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Review could not be saved.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">OWNER WORKBENCH</div>
          <h1>Learn from the decisions.</h1>
          <p>
            Review what your team adjusts, understand why, and improve guidance with your approval.
          </p>
        </div>
        <Link className="button" href={locationHref('/setup', locationId)}>
          <Icon name="settings" size={16} />
          Edit clinic draft
        </Link>
      </div>
      <div className="stats-grid">
        <div className="stat-card">
          <span>Actual care starts</span>
          <strong>
            {data.metrics.careStarted}
            <em>/{data.metrics.denominator}</em>
          </strong>
          <small>Of real consultations in period</small>
          <Icon name="pulse" />
        </div>
        <div className="stat-card">
          <span>Recorded wellness decisions</span>
          <strong>
            {data.metrics.wellnessAccepted +
              data.metrics.wellnessRejected +
              data.metrics.wellnessTbd}
          </strong>
          <small>
            {data.metrics.wellnessAccepted} accepted · {data.metrics.wellnessRejected} rejected ·{' '}
            {data.metrics.wellnessTbd} TBD
          </small>
          <Icon name="check" />
        </div>
        <div className="stat-card">
          <span>Tracked adjustments</span>
          <strong>{data.metrics.adjustments}</strong>
          <small>Summary, recommendation and care edits</small>
          <Icon name="file" />
        </div>
        <div className="stat-card stat-warm">
          <span>Overdue outcomes</span>
          <strong>{data.metrics.overdue}</strong>
          <small>Active visits needing follow-through</small>
          <Icon name="clock" />
        </div>
      </div>
      <p className="board-help">
        Reporting period: {friendlyDate(data.metrics.from)} to {friendlyDate(data.metrics.to)}.
        Denominator: {data.metrics.denominator} real consultations. Archived visits remain included.
        Setup tests are excluded.
      </p>
      {error ? <ErrorBanner message={error} /> : null}
      {notice ? (
        <div className="notice notice-subtle" role="status">
          <Icon name="check" size={16} />
          {notice}
        </div>
      ) : null}
      <div className="notice notice-subtle">
        <Icon name="shield" />
        <div>
          <strong>Understand suitability before judging a change.</strong>
          <p>
            Client preference, exclusions, stock and budget matter. Lower spend alone does not mean
            the team under-recommended. Clinical decisions remain independent of sales targets.
          </p>
        </div>
      </div>
      <div className="owner-layout">
        <section className="panel">
          <div className="section-heading">
            <div>
              <h2>Adjustment evidence</h2>
              <p>
                Latest 100 changes from real visits in this location. Choose relevant examples to
                review together.
              </p>
            </div>
            <Badge>{selected.length} selected</Badge>
          </div>
          <div className="metric-breakdown">
            {[...counts].map(([reason, count]) => (
              <span key={reason}>
                {reason.toLowerCase().replaceAll('_', ' ')}
                <strong>{count}</strong>
              </span>
            ))}
          </div>
          {data.adjustments.length ? (
            data.adjustments.map((change) => (
              <div className="review-item" key={change.id}>
                <label>
                  <input
                    type="checkbox"
                    checked={selected.includes(change.id)}
                    onChange={(event) =>
                      setSelected((ids) =>
                        event.target.checked
                          ? [...ids, change.id]
                          : ids.filter((id) => id !== change.id),
                      )
                    }
                  />
                  <div>
                    <strong>{change.consultation?.reference || 'Consultation'}</strong>
                    <Badge>{change.reason.toLowerCase().replaceAll('_', ' ')}</Badge>
                    <p>
                      {change.note ||
                        change.reasonNote ||
                        'Reason recorded without additional context.'}
                    </p>
                    {change.consultation ? (
                      <p>
                        Reported goals:{' '}
                        {change.consultation.summary.goals.join(' · ') || 'Not recorded'}
                        <br />
                        Preferences:{' '}
                        {change.consultation.summary.preferences.join(' · ') || 'Not recorded'}
                        <br />
                        Actual care:{' '}
                        {change.consultation.actualCare?.outcome
                          .toLowerCase()
                          .replaceAll('_', ' ') || 'Pending'}{' '}
                        · Wellness:{' '}
                        {change.consultation.wellnessDecision?.toLowerCase() || 'Undecided'}
                      </p>
                    ) : null}
                    <Link
                      href={locationHref(`/consultations/${change.consultationId}`, locationId)}
                      className="text-button"
                    >
                      Open visit context
                      <Icon name="arrow" size={12} />
                    </Link>
                    <details>
                      <summary className="text-button">
                        Compare original and adjusted values
                      </summary>
                      <div className="audit-comparison">
                        <div>
                          <span>Original</span>
                          <pre>{JSON.stringify(change.before, null, 2)}</pre>
                        </div>
                        <div>
                          <span>Adjusted</span>
                          <pre>{JSON.stringify(change.after, null, 2)}</pre>
                        </div>
                      </div>
                    </details>
                    <span className="small muted">
                      Recorded {friendlyDate(change.createdAt)} by{' '}
                      {change.actorName ||
                        data.staff.find((person) => person.id === (change.userId || change.actorId))
                          ?.name ||
                        'Clinic team'}
                    </span>
                  </div>
                </label>
              </div>
            ))
          ) : (
            <EmptyState icon="chart" title="Your team's decisions will build the evidence.">
              Tracked edits, reasons and visit context will appear here. New active guidance always
              requires owner review and testing.
            </EmptyState>
          )}
        </section>
        <div>
          <form
            className="panel form-stack"
            onSubmit={(event) => {
              event.preventDefault();
              void act(
                'improvement.create',
                { title, classification, evidenceAdjustmentIds: selected, notes },
                'Evidence review saved. Proposed settings remain separate from active clinic guidance.',
              );
            }}
          >
            <div className="section-heading">
              <div>
                <h2>Create a review</h2>
                <p>
                  Classify what the evidence shows. Record appropriate corrections as well as
                  opportunities to improve.
                </p>
              </div>
            </div>
            <label>
              Review title
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                required
                maxLength={300}
                placeholder="What did you learn from these changes?"
              />
            </label>
            <label>
              Classification
              <select
                value={classification}
                onChange={(event) => setClassification(event.target.value)}
              >
                {Object.entries(classifications).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Evidence and proposed improvement
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={4}
                placeholder="Describe the relevant facts, the correction, and any proposed question or rule change."
              />
            </label>
            <button
              className="button button-primary"
              disabled={busy || !selected.length || !title.trim()}
            >
              <Icon name="file" size={16} />
              Save evidence review
            </button>
          </form>
          <section className="panel">
            <div className="section-heading">
              <div>
                <h2>Owner-reviewed improvements</h2>
                <p>
                  Approved proposals must be tested against a saved configuration before
                  publication.
                </p>
              </div>
            </div>
            <label>
              Review note for approval or rejection
              <textarea
                value={reviewNotes}
                onChange={(event) => setReviewNotes(event.target.value)}
                rows={3}
              />
            </label>
            {data.improvements.length ? (
              data.improvements.map((item) => (
                <div className="catalog-card" key={item.id}>
                  <div className="catalog-card-top">
                    <div>
                      <h3>{item.title}</h3>
                      <Badge
                        tone={
                          item.status === 'ACTIVATED'
                            ? 'green'
                            : item.status === 'REJECTED'
                              ? 'coral'
                              : 'neutral'
                        }
                      >
                        {item.status.toLowerCase()}
                      </Badge>
                    </div>
                  </div>
                  <p>
                    {classifications[item.classification as keyof typeof classifications] ||
                      item.classification}
                  </p>
                  <p>{item.reviewNote}</p>
                  {item.status !== 'ACTIVATED' ? (
                    <div className="decision-buttons">
                      <button
                        className="button button-small"
                        disabled={busy}
                        onClick={() =>
                          void act(
                            'improvement.review',
                            { improvementId: item.id, decision: 'APPROVED', notes: reviewNotes },
                            'Improvement review approved. Publication still requires tested draft settings.',
                          )
                        }
                      >
                        Approve review
                      </button>
                      <button
                        className="button button-small"
                        disabled={busy}
                        onClick={() =>
                          void act(
                            'improvement.review',
                            { improvementId: item.id, decision: 'REJECTED', notes: reviewNotes },
                            'Improvement review rejected. Active guidance remains unchanged.',
                          )
                        }
                      >
                        Reject
                      </button>
                      {item.status !== 'REJECTED' ? (
                        <button
                          className="button button-small button-primary"
                          disabled={busy || !draft}
                          onClick={() => {
                            setTestProposalId(item.id);
                            setApprovedTests([]);
                          }}
                        >
                          Test saved draft
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ))
            ) : (
              <p className="small muted">
                No evidence reviews yet. Select adjustment examples to create the first one.
              </p>
            )}
          </section>
        </div>
      </div>
      <Modal
        open={Boolean(testProposalId)}
        onClose={() => setTestProposalId(null)}
        title={proposal?.title || 'Test improvement'}
      >
        {draft ? (
          <>
            <p className="small muted">
              Testing saved draft v{draft.version}, revision {draft.revision}. Edit the draft in
              clinic setup first if the proposal requires different questions, catalog details or
              rules.
            </p>
            <SyntheticIntake
              configuration={draft.configuration}
              summary={summary}
              onChange={setSummary}
            />
            <button
              className="button"
              disabled={busy}
              style={{ marginTop: 18 }}
              onClick={() =>
                void act(
                  'improvement.test',
                  {
                    improvementId: testProposalId,
                    configurationVersionId: draft.id,
                    expectedVersion: draft.revision,
                    summary,
                    notes: reviewNotes,
                  },
                  'Improvement test saved. Review its result before publication.',
                )
              }
            >
              Run improvement test
            </button>
            {draft.tests?.map((test) => (
              <div className="test-result" key={test.id}>
                <Badge tone={test.initial.blocked ? 'amber' : 'green'}>
                  {test.initial.blocked ? 'Clinical approval blocked' : 'Eligible options found'}
                </Badge>
                <p>{test.initial.explanation}</p>
                {test.initial.items.map((item) => (
                  <p key={item.productId}>
                    {item.name} · <Money cents={item.priceCents} currency={item.currency} />
                  </p>
                ))}
                {test.initial.safetyFlags.map((flag, index) => (
                  <p key={index}>{flag}</p>
                ))}
                <label className="inline-check">
                  <input
                    type="checkbox"
                    checked={approvedTests.includes(test.id)}
                    onChange={(event) =>
                      setApprovedTests((ids) =>
                        event.target.checked
                          ? [...ids, test.id]
                          : ids.filter((id) => id !== test.id),
                      )
                    }
                  />
                  I reviewed this test result
                </label>
              </div>
            ))}
            <div className="modal-actions">
              <button
                className="button button-primary"
                disabled={busy || !approvedTests.length || proposal?.status !== 'APPROVED'}
                onClick={() =>
                  void act(
                    'improvement.activate',
                    {
                      improvementId: testProposalId,
                      configurationVersionId: draft.id,
                      expectedVersion: draft.revision,
                      approvedTestIds: approvedTests,
                    },
                    'Tested improvement published as the active clinic configuration.',
                  )
                }
              >
                Publish tested improvement
              </button>
            </div>
            {error ? <ErrorBanner message={error} /> : null}
          </>
        ) : (
          <p className="muted">
            Save a configuration draft in clinic setup before testing this proposal.
          </p>
        )}
      </Modal>
    </>
  );
}
