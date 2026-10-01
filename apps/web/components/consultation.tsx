'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import {
  adjustmentReasons,
  type ActualCare,
  type ClinicConfiguration,
  type ConsultationSummary,
  type RecommendationItemSnapshot,
} from '@dripwell/shared/v2';
import {
  ApiRequestError,
  apiRequest,
  postJson,
  locationHref,
  stageLabels,
  stageTones,
  useClinic,
  type ConsultationView,
} from './clinic-context';
import { decimalPrice, parsePrice } from './configuration-editor';
import { AudioRecorder } from './audio-recorder';
import { RecordingSegments } from './recording-segments';
import { waitForJob } from './job-client';
import { Badge, Celebrate, EmptyState, ErrorBanner, Icon, Modal, Money, friendlyDate } from './ui';

const summaryFields = [
  'goals',
  'symptoms',
  'history',
  'medications',
  'allergies',
  'preferences',
  'uncertainties',
] as const;
const summaryLabels = {
  goals: 'Client goals',
  symptoms: 'Reported symptoms',
  history: 'Relevant history',
  medications: 'Medications',
  allergies: 'Allergies',
  preferences: 'Preferences',
  uncertainties: 'Unclear or unconfirmed information',
};
const reasonLabels: Record<string, string> = {
  CLIENT_CHOICE: 'Client preference',
  BUDGET: 'Client budget',
  AVAILABILITY: 'Item availability',
  CONTRAINDICATION: 'Clinical contraindication',
  MISSING_INFORMATION: 'Missing information',
  UNSUITABLE_SUGGESTION: 'Unsuitable suggestion',
  STAFF_JUDGMENT: 'Staff judgment',
  OTHER: 'Other',
};
type Action = (action: string, fields?: Record<string, unknown>) => Promise<void>;

function ReasonFields({
  reason,
  note,
  setReason,
  setNote,
}: {
  reason: string;
  note: string;
  setReason: (value: string) => void;
  setNote: (value: string) => void;
}) {
  return (
    <div className="reason-fields">
      <label>
        Reason for this change
        <select value={reason} onChange={(event) => setReason(event.target.value)}>
          {adjustmentReasons.map((value) => (
            <option key={value} value={value}>
              {reasonLabels[value]}
            </option>
          ))}
        </select>
      </label>
      <label>
        Context for review <span className="muted">optional</span>
        <input
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={4000}
          placeholder="What led to the adjustment?"
        />
      </label>
    </div>
  );
}

function Intake({
  visit,
  configuration,
  action,
  busy,
  onRecorded,
  onReload,
  proposedSummary,
}: {
  visit: ConsultationView;
  configuration: ClinicConfiguration;
  action: Action;
  busy: boolean;
  onRecorded: (
    audio: File,
    segmentId: string,
    sequence: number,
    durationMs: number,
  ) => Promise<void>;
  onReload: () => Promise<void>;
  proposedSummary: ConsultationSummary | null;
}) {
  const [summary, setSummary] = useState(visit.summary);
  const summaryBaseline = useRef(JSON.stringify(visit.summary));
  const [summaryChanged, setSummaryChanged] = useState(false);
  const [reason, setReason] = useState('STAFF_JUDGMENT');
  const [note, setNote] = useState('');
  const [showTranscript, setShowTranscript] = useState(false);
  useEffect(() => {
    const incoming = JSON.stringify(visit.summary);
    if (incoming === summaryBaseline.current) return;
    const local = JSON.stringify(summary);
    if (local === summaryBaseline.current || local === incoming) {
      setSummary(visit.summary);
      setSummaryChanged(false);
    } else setSummaryChanged(true);
    summaryBaseline.current = incoming;
  }, [visit.summary]);
  const questionStates = visit.questionStates || [];
  const missing = questionStates.filter(
    (question) => question.required && question.status !== 'ANSWERED',
  );
  const questions = configuration.questions
    .filter(
      (question) =>
        !questionStates.length || questionStates.some((state) => state.questionId === question.id),
    )
    .sort((a, b) => b.priority - a.priority);
  function setAnswer(questionId: string, value: string | number | boolean | string[] | null) {
    setSummary((current) => ({
      ...current,
      answers: {
        ...current.answers,
        [questionId]: {
          value,
          status: 'CONFIRMED',
          source: 'STAFF',
          evidence: 'Entered and confirmed by staff',
        },
      },
      staffReviewed: false,
    }));
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    await action('consultation.summary.update', { summary, reason, reasonNote: note });
  }
  return (
    <>
      <section className="panel">
        <div className="section-heading">
          <div>
            <span className="step-label">01 · LISTEN</span>
            <h2>The consultation</h2>
          </div>
          <Badge tone={visit.consentAt ? 'green' : 'neutral'}>
            {visit.consentAt ? 'Recording consent recorded' : 'Manual intake'}
          </Badge>
        </div>
        {!visit.consentAt ? (
          <div className="notice notice-subtle">
            <span>Capture audio only after the client has given recording consent.</span>
            <button
              className="button button-small"
              disabled={busy || Boolean(visit.archivedAt)}
              onClick={() => void action('consultation.consent', { consent: true })}
            >
              Confirm consent
            </button>
          </div>
        ) : null}
        <AudioRecorder
          consented={Boolean(visit.consentAt) && !visit.archivedAt}
          onSegment={onRecorded}
        />
        {visit.transcript.length ? (
          <div className="transcript">
            <button className="text-button" onClick={() => setShowTranscript(!showTranscript)}>
              <Icon name="file" size={16} />
              {showTranscript ? 'Hide' : 'View'} saved transcript · {visit.transcript.length}{' '}
              segment{visit.transcript.length === 1 ? '' : 's'}
            </button>
            {showTranscript ? (
              <div className="transcript-body">
                {[...visit.transcript]
                  .sort((a, b) => a.sequence - b.sequence)
                  .map((segment) => (
                    <p key={segment.id}>
                      <span>Segment {segment.sequence + 1}</span>
                      {segment.text}
                    </p>
                  ))}
              </div>
            ) : null}
          </div>
        ) : null}
        <RecordingSegments visit={visit} onChange={onReload} />
      </section>
      <form onSubmit={(event) => void save(event)}>
        <section className="panel">
          <div className="section-heading">
            <div>
              <span className="step-label">02 · UNDERSTAND</span>
              <h2>Questions that guide good care</h2>
              <p>
                Confirm the client&apos;s answers. An unanswered question is never treated as a
                “no.”
              </p>
            </div>
            <Badge tone={missing.length ? 'amber' : 'green'}>
              {missing.length
                ? `${missing.length} required to confirm`
                : 'Required answers confirmed'}
            </Badge>
          </div>
          {questions.length ? (
            <div className="question-list">
              {questions.map((question) => {
                const answer = summary.answers[question.id];
                const state = questionStates.find((item) => item.questionId === question.id);
                const status =
                  answer?.status === 'CONFIRMED' && answer.value != null && answer.value !== ''
                    ? 'ANSWERED'
                    : state?.status || 'MISSING';
                return (
                  <div className="question-row" key={question.id}>
                    <div className="question-copy">
                      <div>
                        <strong>{question.text}</strong>
                        {question.required ? <span className="required-tag">Required</span> : null}
                      </div>
                      <p>{question.why}</p>
                      {answer?.source === 'TRANSCRIPT' && answer.evidence ? (
                        <small className="evidence">Heard: “{answer.evidence}”</small>
                      ) : null}
                    </div>
                    <div className="question-answer">
                      <Badge
                        tone={
                          status === 'ANSWERED'
                            ? 'green'
                            : status === 'NEEDS_CONFIRMATION'
                              ? 'amber'
                              : 'neutral'
                        }
                      >
                        {status === 'ANSWERED'
                          ? 'Confirmed'
                          : status === 'NEEDS_CONFIRMATION'
                            ? 'Confirm answer'
                            : 'Needs an answer'}
                      </Badge>
                      {question.type === 'BOOLEAN' ? (
                        <select
                          aria-label={question.text}
                          value={answer?.value == null ? '' : String(answer.value)}
                          onChange={(event) =>
                            setAnswer(
                              question.id,
                              event.target.value === '' ? null : event.target.value === 'true',
                            )
                          }
                        >
                          <option value="">Not answered</option>
                          <option value="true">Yes</option>
                          <option value="false">No</option>
                        </select>
                      ) : question.type === 'CHOICE' ? (
                        <select
                          aria-label={question.text}
                          value={typeof answer?.value === 'string' ? answer.value : ''}
                          onChange={(event) => setAnswer(question.id, event.target.value || null)}
                        >
                          <option value="">Choose an answer</option>
                          {question.options.map((option) => (
                            <option key={option}>{option}</option>
                          ))}
                        </select>
                      ) : question.type === 'MULTI_CHOICE' ? (
                        <div className="checkbox-options">
                          {question.options.map((option) => (
                            <label key={option}>
                              <input
                                type="checkbox"
                                checked={
                                  Array.isArray(answer?.value) && answer.value.includes(option)
                                }
                                onChange={(event) => {
                                  const current = Array.isArray(answer?.value) ? answer.value : [];
                                  setAnswer(
                                    question.id,
                                    event.target.checked
                                      ? [...current, option]
                                      : current.filter((value) => value !== option),
                                  );
                                }}
                              />
                              {option}
                            </label>
                          ))}
                        </div>
                      ) : (
                        <input
                          aria-label={question.text}
                          type={question.type === 'NUMBER' ? 'number' : 'text'}
                          value={
                            typeof answer?.value === 'string' || typeof answer?.value === 'number'
                              ? answer.value
                              : ''
                          }
                          placeholder="Enter the client's answer"
                          onChange={(event) =>
                            setAnswer(
                              question.id,
                              event.target.value === ''
                                ? null
                                : question.type === 'NUMBER'
                                  ? Number(event.target.value)
                                  : event.target.value,
                            )
                          }
                        />
                      )}
                      {answer && answer.status !== 'CONFIRMED' ? (
                        <button
                          type="button"
                          className="text-button"
                          onClick={() =>
                            setSummary((current) => ({
                              ...current,
                              answers: {
                                ...current.answers,
                                [question.id]: { ...answer, status: 'CONFIRMED', source: 'STAFF' },
                              },
                              staffReviewed: false,
                            }))
                          }
                        >
                          Confirm this answer
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState title="No questions configured">
              The owner needs to add clinic-specific questions before clinical recommendations can
              be approved.
            </EmptyState>
          )}
        </section>
        <section className="panel">
          <div className="section-heading">
            <div>
              <h2>Reviewed visit summary</h2>
              <p>
                Keep reported facts distinct from uncertainties. Edit any transcription errors
                before saving.
              </p>
            </div>
            <Badge tone={visit.summary.staffReviewed ? 'green' : 'amber'}>
              {visit.summary.staffReviewed ? 'Staff reviewed' : 'Review needed'}
            </Badge>
          </div>
          {proposedSummary ? (
            <div className="notice notice-warm">
              <div>
                <strong>A new extracted summary is available for review.</strong>
                <p>
                  Your saved staff edits were preserved because the visit changed while audio was
                  processing.
                </p>
              </div>
              <button
                type="button"
                className="button button-small"
                onClick={() => setSummary({ ...proposedSummary, staffReviewed: false })}
              >
                Review proposed facts
              </button>
            </div>
          ) : null}
          {summaryChanged ? (
            <div className="notice notice-warm">
              <div>
                <strong>The saved summary changed while you were editing.</strong>
                <p>
                  Your local edits are preserved. Review the new facts before saving this summary.
                </p>
              </div>
              <button
                type="button"
                className="button button-small"
                onClick={() => {
                  setSummary(visit.summary);
                  setSummaryChanged(false);
                }}
              >
                Load saved summary
              </button>
            </div>
          ) : null}
          <div className="form-grid summary-grid">
            {summaryFields.map((field) => (
              <label className={field === 'uncertainties' ? 'span-two' : ''} key={field}>
                {summaryLabels[field]}
                <textarea
                  rows={field === 'history' ? 3 : 2}
                  value={summary[field].join('\n')}
                  onChange={(event) =>
                    setSummary((current) => ({
                      ...current,
                      [field]: event.target.value.split('\n').filter((line) => line.trim()),
                      staffReviewed: false,
                    }))
                  }
                  placeholder="One statement per line. Leave unknown information blank."
                />
              </label>
            ))}
          </div>
          <label>
            Would the client like relevant wellness offers?
            <select
              value={
                summary.wellnessOffersAllowed == null ? '' : String(summary.wellnessOffersAllowed)
              }
              onChange={(event) =>
                setSummary((current) => ({
                  ...current,
                  wellnessOffersAllowed:
                    event.target.value === '' ? null : event.target.value === 'true',
                }))
              }
            >
              <option value="">Not discussed yet</option>
              <option value="true">Yes, open to relevant offers</option>
              <option value="false">No, do not include offers</option>
            </select>
          </label>
          <ReasonFields reason={reason} note={note} setReason={setReason} setNote={setNote} />
          <label className="checkbox-card">
            <input
              type="checkbox"
              checked={summary.staffReviewed}
              onChange={(event) =>
                setSummary((current) => ({ ...current, staffReviewed: event.target.checked }))
              }
            />
            <span>
              <strong>I reviewed these facts and confirmed the required answers.</strong>
              <small>Saving changed facts invalidates prior clinical approval.</small>
            </span>
          </label>
          <div className="panel-actions">
            <button className="button button-primary" disabled={busy || Boolean(visit.archivedAt)}>
              {busy ? 'Saving…' : 'Save reviewed summary'}
              <Icon name="check" size={16} />
            </button>
          </div>
        </section>
      </form>
    </>
  );
}

function InitialReview({
  visit,
  configuration,
  busy,
  canApprove,
  action,
}: {
  visit: ConsultationView;
  configuration: ClinicConfiguration;
  busy: boolean;
  canApprove: boolean;
  action: Action;
}) {
  const recommendation = visit.initialRecommendation;
  const [editing, setEditing] = useState(false);
  const [productIds, setProductIds] = useState<string[]>([]);
  const [explanation, setExplanation] = useState('');
  const [reason, setReason] = useState('STAFF_JUDGMENT');
  const [note, setNote] = useState('');
  useEffect(() => {
    setProductIds(recommendation?.items.map((item) => item.productId) || []);
    setExplanation(recommendation?.explanation || '');
    setEditing(false);
  }, [JSON.stringify(recommendation)]);
  const approved = recommendation && visit.clinicalApprovedVersion === visit.initialRevision;
  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <span className="step-label">03 · RECOMMEND</span>
          <h2>Today&apos;s initial recommendation</h2>
          <p>
            Eligible options follow the visit&apos;s pinned clinic protocols and official prices.
          </p>
        </div>
        {recommendation ? (
          <Badge tone={approved ? 'green' : 'amber'}>
            {approved
              ? `Approved · revision ${visit.initialRevision}`
              : `Draft · revision ${visit.initialRevision}`}
          </Badge>
        ) : null}
      </div>
      {!recommendation ? (
        <EmptyState
          icon="spark"
          title="Ready to consider the right options?"
          action={
            <button
              className="button button-primary"
              disabled={busy || !visit.summary.staffReviewed || Boolean(visit.archivedAt)}
              onClick={() => void action('consultation.initial.generate')}
            >
              <Icon name="spark" size={17} />
              Produce initial recommendations
            </button>
          }
        >
          Save a reviewed summary first. Missing safety information remains visible and blocks
          clinical approval.
        </EmptyState>
      ) : (
        <>
          {recommendation.safetyFlags.length ? (
            <div className="notice notice-warm">
              <Icon name="shield" />
              <div>
                <strong>Clinical checks</strong>
                {recommendation.safetyFlags.map((flag, index) => (
                  <p key={index}>{flag}</p>
                ))}
              </div>
            </div>
          ) : null}
          {recommendation.unresolvedQuestions.length ? (
            <div className="notice notice-subtle">
              <div>
                <strong>Still needs confirmation</strong>
                {recommendation.unresolvedQuestions.map((question) => (
                  <p key={question.questionId}>
                    {question.text} · {question.why}
                  </p>
                ))}
              </div>
            </div>
          ) : null}
          {editing ? (
            <div className="form-stack">
              <fieldset>
                <legend>Choose eligible clinic items</legend>
                <div className="product-options">
                  {configuration.products
                    .filter((product) => recommendation.eligibleProductIds.includes(product.id))
                    .map((product) => (
                      <label key={product.id} className="product-option">
                        <input
                          type="checkbox"
                          checked={productIds.includes(product.id)}
                          onChange={(event) =>
                            setProductIds((values) =>
                              event.target.checked
                                ? [...values, product.id]
                                : values.filter((id) => id !== product.id),
                            )
                          }
                        />
                        <span>
                          <strong>{product.name}</strong>
                          <small>{product.description}</small>
                        </span>
                        <Money cents={product.priceCents} currency={product.currency} />
                      </label>
                    ))}
                </div>
              </fieldset>
              <label>
                Explanation to share with the client
                <textarea
                  value={explanation}
                  rows={5}
                  onChange={(event) => setExplanation(event.target.value)}
                />
              </label>
              <ReasonFields reason={reason} note={note} setReason={setReason} setNote={setNote} />
              <div className="panel-actions">
                <button
                  className="button button-ghost"
                  disabled={busy}
                  onClick={() => setEditing(false)}
                >
                  Cancel
                </button>
                <button
                  className="button button-primary"
                  disabled={busy}
                  onClick={() =>
                    void action('consultation.initial.edit', {
                      productIds,
                      explanation,
                      reason,
                      reasonNote: note,
                    })
                  }
                >
                  Save tracked adjustment
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="recommendation-items">
                {recommendation.items.map((item) => (
                  <div className="recommendation-item" key={item.productId}>
                    <span className="item-icon">
                      <Icon name="pulse" size={21} />
                    </span>
                    <div>
                      <strong>{item.name}</strong>
                      <p>{item.rationale}</p>
                      {item.evidence.length ? (
                        <small className="evidence">Based on: {item.evidence.join(' · ')}</small>
                      ) : null}
                    </div>
                    <Money cents={item.priceCents * item.quantity} currency={item.currency} />
                  </div>
                ))}
              </div>
              {!recommendation.items.length ? (
                <p className="muted">
                  No clinical option met the approved requirements. Complete missing information or
                  document an appropriate referral.
                </p>
              ) : null}
              <blockquote className="client-explanation">{recommendation.explanation}</blockquote>
              <div className="panel-actions">
                <button
                  className="button"
                  disabled={busy || Boolean(visit.archivedAt)}
                  onClick={() => setEditing(true)}
                >
                  Adjust recommendation
                </button>
                <button
                  className="button button-ghost"
                  disabled={busy || !visit.summary.staffReviewed || Boolean(visit.archivedAt)}
                  onClick={() => void action('consultation.initial.generate')}
                >
                  Regenerate from reviewed facts
                </button>
                {approved ? (
                  <span className="approval-label">
                    <Icon name="shield" size={17} />
                    Approved {friendlyDate(visit.clinicalApprovedAt)}
                  </span>
                ) : (
                  <button
                    className="button button-primary"
                    disabled={
                      busy || !canApprove || recommendation.blocked || Boolean(visit.archivedAt)
                    }
                    onClick={() => void action('consultation.initial.approve')}
                  >
                    <Icon name="shield" size={16} />
                    Approve exact revision
                  </button>
                )}
              </div>
              {!canApprove && !approved ? (
                <p className="small muted">
                  An authorized provider must approve this revision before treatment guidance is
                  shared.
                </p>
              ) : null}
            </>
          )}
        </>
      )}
    </section>
  );
}

function CareOutcome({
  visit,
  configuration,
  busy,
  action,
}: {
  visit: ConsultationView;
  configuration: ClinicConfiguration;
  busy: boolean;
  action: Action;
}) {
  const [outcome, setOutcome] = useState(visit.actualCare?.outcome || 'PENDING');
  const [ids, setIds] = useState(visit.actualCare?.items.map((item) => item.productId) || []);
  const [observations, setObservations] = useState(visit.actualCare?.observations || '');
  const [reason, setReason] = useState(visit.actualCare?.reason || '');
  const [membership, setMembership] = useState(visit.actualCare?.membershipProductId || '');
  const [membershipEnrolled, setMembershipEnrolled] = useState(
    visit.actualCare?.membershipEnrolled == null ? '' : String(visit.actualCare.membershipEnrolled),
  );
  const [servicePurchased, setServicePurchased] = useState(
    visit.actualCare?.servicePurchased == null ? '' : String(visit.actualCare.servicePurchased),
  );
  const [paid, setPaid] = useState(
    visit.actualCare?.confirmedCollectedCents == null
      ? ''
      : decimalPrice(visit.actualCare.confirmedCollectedCents, visit.actualCare.currency),
  );
  const [commercial, setCommercial] = useState(false);
  const [inputError, setInputError] = useState('');
  useEffect(() => {
    setOutcome(visit.actualCare?.outcome || 'PENDING');
    setIds(visit.actualCare?.items.map((item) => item.productId) || []);
    setObservations(visit.actualCare?.observations || '');
    setReason(visit.actualCare?.reason || '');
  }, [JSON.stringify(visit.actualCare)]);
  const approved =
    visit.initialRecommendation && visit.clinicalApprovedVersion === visit.initialRevision;
  async function save(event: FormEvent) {
    event.preventDefault();
    setInputError('');
    let collected: number | null;
    try {
      collected = paid === '' ? null : parsePrice(paid, configuration.clinic.currency);
    } catch (cause) {
      setInputError(cause instanceof Error ? cause.message : 'Enter a valid payment amount.');
      return;
    }
    const items: RecommendationItemSnapshot[] = ids.map((id) => {
      const approvedItem = visit.initialRecommendation?.items.find((item) => item.productId === id);
      const product = configuration.products.find((item) => item.id === id)!;
      return (
        approvedItem || {
          productId: product.id,
          name: product.name,
          type: product.type,
          priceCents: product.priceCents ?? 0,
          currency: product.currency,
          quantity: 1,
          rationale: 'Staff-recorded actual care',
          evidence: [],
          terms: product.terms,
        }
      );
    });
    await action('consultation.care.record', {
      actualCare: {
        outcome,
        items: outcome === 'STARTED' ? items : [],
        observations,
        reason,
        membershipEnrolled: membershipEnrolled === '' ? null : membershipEnrolled === 'true',
        membershipProductId: membership || null,
        servicePurchased: servicePurchased === '' ? null : servicePurchased === 'true',
        confirmedCollectedCents: collected,
        currency: configuration.clinic.currency,
      },
      reason: 'STAFF_JUDGMENT',
      reasonNote: reason,
    });
  }
  return (
    <form onSubmit={(event) => void save(event)} className="panel">
      {inputError ? <ErrorBanner message={inputError} /> : null}
      <div className="section-heading">
        <div>
          <span className="step-label">04 · DOCUMENT</span>
          <h2>What actually happened?</h2>
          <p>Record care received separately from recommendations and the wellness decision.</p>
        </div>
        <Badge tone={visit.careOutcome === 'STARTED' ? 'green' : 'neutral'}>
          {visit.careOutcome === 'STARTED'
            ? 'Care started'
            : visit.careOutcome === 'NOT_STARTED'
              ? 'Care not started'
              : 'Outcome pending'}
        </Badge>
      </div>
      <div className="outcome-options">
        {[
          { value: 'STARTED', label: 'Care started', icon: 'check' },
          { value: 'NOT_STARTED', label: 'Care not started', icon: 'close' },
          { value: 'PENDING', label: 'Still pending', icon: 'clock' },
        ].map((option) => (
          <label
            className={`outcome-option ${outcome === option.value ? 'selected' : ''}`}
            key={option.value}
          >
            <input
              type="radio"
              name="careOutcome"
              value={option.value}
              checked={outcome === option.value}
              onChange={() => setOutcome(option.value as ActualCare['outcome'])}
            />
            <Icon name={option.icon} size={20} />
            {option.label}
          </label>
        ))}
      </div>
      {outcome === 'STARTED' ? (
        <fieldset>
          <legend>Items actually administered</legend>
          <p className="small muted">
            Only items in the approved clinical recommendation may be recorded. Adjust and approve
            first if care changes.
          </p>
          <div className="product-options">
            {visit.initialRecommendation?.items.map((item) => (
              <label className="product-option" key={item.productId}>
                <input
                  type="checkbox"
                  checked={ids.includes(item.productId)}
                  onChange={(event) =>
                    setIds((values) =>
                      event.target.checked
                        ? [...values, item.productId]
                        : values.filter((id) => id !== item.productId),
                    )
                  }
                />
                <strong>{item.name}</strong>
                <Money cents={item.priceCents} currency={item.currency} />
              </label>
            ))}
          </div>
          {!approved ? (
            <p className="error-text">
              Clinical approval is required before recording care started.
            </p>
          ) : null}
        </fieldset>
      ) : null}
      <div className="form-grid">
        <label>
          Visit observations
          <textarea
            value={observations}
            onChange={(event) => setObservations(event.target.value)}
            rows={3}
            placeholder="Document what was provided and relevant observations."
          />
        </label>
        <label>
          {outcome === 'NOT_STARTED' ? 'Reason care did not start' : 'Context or correction reason'}
          <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} />
        </label>
      </div>
      <button className="text-button" type="button" onClick={() => setCommercial(!commercial)}>
        {commercial ? 'Hide' : 'Add'} optional membership, service or payment outcome
        <Icon name="arrow" size={14} />
      </button>
      {commercial ? (
        <div className="form-grid commercial-fields">
          <label>
            Membership enrollment
            <select
              value={membershipEnrolled}
              onChange={(event) => setMembershipEnrolled(event.target.value)}
            >
              <option value="">Not recorded</option>
              <option value="true">Confirmed enrolled</option>
              <option value="false">Did not enroll</option>
            </select>
          </label>
          <label>
            Membership
            <select value={membership} onChange={(event) => setMembership(event.target.value)}>
              <option value="">None recorded</option>
              {configuration.products
                .filter((product) => product.type === 'MEMBERSHIP')
                .map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Service purchased
            <select
              value={servicePurchased}
              onChange={(event) => setServicePurchased(event.target.value)}
            >
              <option value="">Not recorded</option>
              <option value="true">Confirmed purchased</option>
              <option value="false">Did not purchase</option>
            </select>
          </label>
          <label>
            Known payment collected ({configuration.clinic.currency})
            <input
              type="text"
              inputMode="decimal"
              value={paid}
              onChange={(event) => setPaid(event.target.value)}
              placeholder="Leave unknown amounts blank"
            />
          </label>
          <p className="small muted span-two">
            These are separate recorded facts. Accepting a plan never automatically records
            enrollment or payment.
          </p>
        </div>
      ) : null}
      <div className="panel-actions">
        <button
          className="button button-primary"
          disabled={
            busy ||
            Boolean(visit.archivedAt) ||
            (outcome === 'STARTED' && (!approved || !ids.length))
          }
        >
          {busy ? 'Saving…' : 'Save actual outcome'}
        </button>
      </div>
    </form>
  );
}

function Wellness({
  visit,
  configuration,
  busy,
  action,
}: {
  visit: ConsultationView;
  configuration: ClinicConfiguration;
  busy: boolean;
  action: Action;
}) {
  const plan = visit.wellnessPlan;
  const [editing, setEditing] = useState(false);
  const [offerIds, setOfferIds] = useState<string[]>([]);
  const [visitSummary, setVisitSummary] = useState('');
  const [explanation, setExplanation] = useState('');
  const [reason, setReason] = useState('STAFF_JUDGMENT');
  const [note, setNote] = useState('');
  const [decisionNote, setDecisionNote] = useState('');
  useEffect(() => {
    setOfferIds(plan?.offers.map((item) => item.productId) || []);
    setVisitSummary(plan?.visitSummary || '');
    setExplanation(plan?.explanation || '');
    setEditing(false);
  }, [JSON.stringify(plan)]);
  const approved = plan && visit.wellnessApprovedVersion === visit.wellnessRevision;
  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <span className="step-label">05 · FOLLOW THROUGH</span>
          <h2>A wellness plan worth keeping</h2>
          <p>
            A clear visit summary and relevant next steps, using your clinic&apos;s official offers.
          </p>
        </div>
        {plan ? (
          <Badge tone={approved ? 'green' : 'amber'}>
            {approved ? 'Staff approved' : 'Approval needed'}
          </Badge>
        ) : null}
      </div>
      {!plan ? (
        <EmptyState
          icon="file"
          title="Give the client a thoughtful takeaway."
          action={
            <button
              className="button button-primary"
              disabled={
                busy ||
                visit.careOutcome === 'PENDING' ||
                !visit.actualCare ||
                Boolean(visit.archivedAt)
              }
              onClick={() => void action('consultation.wellness.generate')}
            >
              <Icon name="spark" size={17} />
              Produce wellness recommendations
            </button>
          }
        >
          Record the actual care outcome before producing the visit takeaway.
        </EmptyState>
      ) : editing ? (
        <div className="form-stack">
          <label>
            Client-friendly visit summary
            <textarea
              value={visitSummary}
              onChange={(event) => setVisitSummary(event.target.value)}
              rows={4}
            />
          </label>
          <fieldset>
            <legend>Relevant wellness offers</legend>
            <div className="product-options">
              {configuration.products
                .filter(
                  (product) =>
                    ['SERVICE', 'MEMBERSHIP'].includes(product.type) &&
                    product.available &&
                    product.priceCents != null,
                )
                .map((product) => (
                  <label className="product-option" key={product.id}>
                    <input
                      type="checkbox"
                      checked={offerIds.includes(product.id)}
                      onChange={(event) =>
                        setOfferIds((values) =>
                          event.target.checked
                            ? [...values, product.id]
                            : values.filter((id) => id !== product.id),
                        )
                      }
                    />
                    <span>
                      <strong>{product.name}</strong>
                      <small>{product.terms}</small>
                    </span>
                    <Money cents={product.priceCents} currency={product.currency} />
                  </label>
                ))}
            </div>
          </fieldset>
          <label>
            Recommendations and why they fit
            <textarea
              value={explanation}
              onChange={(event) => setExplanation(event.target.value)}
              rows={4}
            />
          </label>
          <ReasonFields reason={reason} note={note} setReason={setReason} setNote={setNote} />
          <div className="panel-actions">
            <button
              className="button button-ghost"
              onClick={() => setEditing(false)}
              disabled={busy}
            >
              Cancel
            </button>
            <button
              className="button button-primary"
              disabled={busy}
              onClick={() =>
                void action('consultation.wellness.edit', {
                  offerProductIds: offerIds,
                  visitSummary,
                  explanation,
                  reason,
                  reasonNote: note,
                })
              }
            >
              Save tracked adjustment
            </button>
          </div>
        </div>
      ) : (
        <>
          <div
            className="takeaway-preview"
            style={{ '--clinic-brand': configuration.clinic.brandColor } as React.CSSProperties}
          >
            <div className="takeaway-brand">
              <Icon name="pulse" size={25} />
              {configuration.clinic.name}
              <span>YOUR WELLNESS TAKEAWAY</span>
            </div>
            <h3>Your visit, and what&apos;s next.</h3>
            <p>{plan.visitSummary}</p>
            <div className="takeaway-care">
              <span>Care received today</span>
              <strong>
                {plan.careReceived.items.map((item) => item.name).join(' + ') ||
                  'Recorded treatment'}
              </strong>
            </div>
            {plan.offers.length ? (
              <div className="takeaway-offers">
                {plan.offers.map((item) => (
                  <div key={item.productId}>
                    <div>
                      <strong>{item.name}</strong>
                      <Money cents={item.priceCents * item.quantity} currency={item.currency} />
                    </div>
                    <p>{item.rationale}</p>
                    {item.terms ? <small>{item.terms}</small> : null}
                  </div>
                ))}
              </div>
            ) : null}
            <p>{plan.explanation}</p>
            {plan.safetyFlags.map((flag, index) => (
              <p className="small" key={index}>
                {flag}
              </p>
            ))}
            <footer>{configuration.clinic.contact}</footer>
          </div>
          <div className="panel-actions">
            <button
              className="button"
              disabled={busy || Boolean(visit.archivedAt)}
              onClick={() => setEditing(true)}
            >
              Edit wellness plan
            </button>
            <button
              className="button button-ghost"
              disabled={busy || Boolean(visit.archivedAt) || visit.careOutcome === 'PENDING'}
              onClick={() => void action('consultation.wellness.generate')}
            >
              Regenerate from reviewed visit
            </button>
            {!approved ? (
              <button
                className="button button-primary"
                disabled={busy || Boolean(visit.archivedAt)}
                onClick={() => void action('consultation.wellness.approve')}
              >
                <Icon name="check" size={16} />
                Approve exact revision
              </button>
            ) : (
              <span className="approval-label">
                <Icon name="check" size={16} />
                Revision {visit.wellnessRevision} approved
              </span>
            )}
          </div>
          {approved ? (
            <div className="wellness-decision">
              {visit.decisionNeedsReview ? (
                <div className="notice notice-warm">
                  The plan changed after the client’s prior decision. Review the current revision
                  with the client and explicitly record their decision again.
                </div>
              ) : null}
              <div className="section-heading">
                <div>
                  <h3>How did the client respond?</h3>
                  <p>This decision is independent of care started or a sale.</p>
                </div>
                {visit.wellnessDecision ? (
                  <Badge
                    tone={
                      visit.wellnessDecision === 'ACCEPTED'
                        ? 'green'
                        : visit.wellnessDecision === 'REJECTED'
                          ? 'coral'
                          : 'amber'
                    }
                  >
                    {visit.wellnessDecision === 'TBD'
                      ? 'Pending decision'
                      : visit.wellnessDecision.toLowerCase()}
                  </Badge>
                ) : null}
              </div>
              <label>
                Decision context <span className="muted">optional</span>
                <input
                  value={decisionNote}
                  onChange={(event) => setDecisionNote(event.target.value)}
                  placeholder="Add context, especially when correcting a previous decision."
                />
              </label>
              <div className="decision-buttons">
                <button
                  className="button button-success"
                  disabled={busy || Boolean(visit.archivedAt)}
                  onClick={() =>
                    void action('consultation.outcome.record', {
                      decision: 'ACCEPTED',
                      reasonNote: decisionNote,
                    })
                  }
                >
                  <Icon name="check" size={17} />
                  Accepted
                </button>
                <button
                  className="button"
                  disabled={busy || Boolean(visit.archivedAt)}
                  onClick={() =>
                    void action('consultation.outcome.record', {
                      decision: 'REJECTED',
                      reasonNote: decisionNote,
                    })
                  }
                >
                  <Icon name="close" size={17} />
                  Rejected
                </button>
                <button
                  className="button"
                  disabled={busy || Boolean(visit.archivedAt)}
                  onClick={() =>
                    void action('consultation.outcome.record', {
                      decision: 'TBD',
                      reasonNote: decisionNote,
                    })
                  }
                >
                  <Icon name="clock" size={17} />
                  TBD
                </button>
              </div>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

function TakeawaySharing({
  visit,
  configuration,
}: {
  visit: ConsultationView;
  configuration: ClinicConfiguration;
}) {
  const [email, setEmail] = useState('');
  const [hours, setHours] = useState(configuration.retention.shareExpiryHours);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [url, setUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [shares, setShares] = useState<
    { id: string; recipientEmail: string; expiresAt: string; revokedAt: string | null }[]
  >([]);
  const approved = visit.wellnessPlan && visit.wellnessApprovedVersion === visit.wellnessRevision;
  const loadShares = useCallback(async () => {
    try {
      setShares(
        (await apiRequest<{ shares: typeof shares }>(`/api/share?consultationId=${visit.id}`))
          .shares,
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load shares.');
    }
  }, [visit.id]);
  useEffect(() => {
    if (approved) void loadShares();
  }, [approved, loadShares]);
  async function create(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await postJson<{ url: string }>('/api/share', {
        consultationId: visit.id,
        recipientEmail: email,
        expiresHours: Number(hours),
      });
      setUrl(result.url);
      await loadShares();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to create recipient link.');
    } finally {
      setBusy(false);
    }
  }
  async function download() {
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/takeaway/${visit.id}`, {
        cache: 'no-store',
        credentials: 'same-origin',
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || error.error || 'Document download failed.');
      }
      const objectUrl = URL.createObjectURL(await response.blob());
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = `wellness-takeaway-${visit.reference}.pdf`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Download failed.');
    } finally {
      setBusy(false);
    }
  }
  async function revoke(id: string) {
    setBusy(true);
    try {
      await apiRequest(`/api/share/${id}`, { method: 'DELETE' });
      await loadShares();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to revoke share.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <h2>Share the approved takeaway</h2>
          <p>Recipient verification, expiry and revocation protect the shared document.</p>
        </div>
        <button className="button" disabled={!approved || busy} onClick={() => void download()}>
          <Icon name="download" size={17} />
          Download PDF
        </button>
      </div>
      <div className="privacy-notice">
        <Icon name="shield" size={16} />
        <p>
          Contains private health information. Share only with the intended recipient using your
          clinic&apos;s HIPAA-compliant process. Downloaded copies cannot be remotely revoked.
        </p>
      </div>
      {error ? <ErrorBanner message={error} /> : null}
      {approved ? (
        <>
          <form className="share-form" onSubmit={(event) => void create(event)}>
            <label>
              Intended recipient&apos;s email
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>
            <label>
              Link expires in
              <select value={hours} onChange={(event) => setHours(Number(event.target.value))}>
                {[24, 48, 72, 168, configuration.retention.shareExpiryHours]
                  .filter((value, index, values) => values.indexOf(value) === index)
                  .sort((a, b) => a - b)
                  .map((value) => (
                    <option value={value} key={value}>
                      {value} hours
                    </option>
                  ))}
              </select>
            </label>
            <button className="button button-primary" disabled={busy}>
              <Icon name="share" size={16} />
              Create secure link
            </button>
          </form>
          {url ? (
            <div className="copy-box">
              <input value={url} readOnly aria-label="Secure recipient link" />
              <button
                className="button button-small"
                onClick={() =>
                  void navigator.clipboard
                    .writeText(url)
                    .then(() => setCopied(true))
                    .catch(() =>
                      setError('Copy was unavailable. Select and copy the link manually.'),
                    )
                }
              >
                {copied ? 'Copied' : 'Copy link'}
              </button>
            </div>
          ) : null}
          {shares.length ? (
            <div className="share-list">
              {shares.map((share) => (
                <div key={share.id}>
                  <div>
                    <strong>{share.recipientEmail}</strong>
                    <span className="small muted">
                      {share.revokedAt ? 'Revoked' : `Expires ${friendlyDate(share.expiresAt)}`}
                    </span>
                  </div>
                  {!share.revokedAt ? (
                    <button
                      className="text-button"
                      disabled={busy}
                      onClick={() => void revoke(share.id)}
                    >
                      Revoke
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
        </>
      ) : (
        <p className="muted">
          Approve the current wellness revision to enable recipient links and PDF downloads.
        </p>
      )}
    </section>
  );
}

export function Consultation({ id }: { id: string }) {
  const { data, mutate, refresh, locationId, captureBusy } = useClinic();
  const [visit, setVisit] = useState<ConsultationView | null>(null);
  const [configuration, setConfiguration] = useState<ClinicConfiguration | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('intake');
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveReason, setArchiveReason] = useState('');
  const [celebrate, setCelebrate] = useState(false);
  const [proposedSummary, setProposedSummary] = useState<ConsultationSummary | null>(null);
  const [jobs, setJobs] = useState<{ id: string; status: string; error?: string }[]>([]);
  const nextSequence = useRef(0);
  const segmentSequences = useRef(new Map<string, number>());
  const load = useCallback(async () => {
    try {
      const [result, audio] = await Promise.all([
        apiRequest<{
          consultation: ConsultationView;
          configuration: ClinicConfiguration | { configuration: ClinicConfiguration };
        }>(`/api/clinic?id=${id}`),
        apiRequest<{ recordings: { sequence: number }[] }>(`/api/recordings?consultationId=${id}`),
      ]);
      setVisit(result.consultation);
      const proposalJob = result.consultation.jobs?.find(
        (job) =>
          job.status === 'COMPLETE' && job.result?.summaryApplied === false && job.result?.summary,
      );
      setProposedSummary((proposalJob?.result?.summary as ConsultationSummary) || null);
      nextSequence.current = Math.max(
        nextSequence.current,
        ...result.consultation.transcript.map((item) => item.sequence + 1),
        ...audio.recordings.map((item) => item.sequence + 1),
      );
      setConfiguration(
        'configuration' in result.configuration
          ? result.configuration.configuration
          : result.configuration,
      );
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load visit.');
    } finally {
      setLoading(false);
    }
  }, [id]);
  useEffect(() => {
    void load();
  }, [load]);
  const action: Action = async (actionName, fields = {}) => {
    if (!visit) return;
    setBusy(true);
    setError('');
    try {
      await mutate(actionName, {
        consultationId: visit.id,
        expectedVersion: visit.version,
        ...fields,
      });
      if (
        actionName === 'consultation.care.record' &&
        (fields.actualCare as ActualCare)?.outcome === 'STARTED' &&
        visit.careOutcome !== 'STARTED'
      )
        setCelebrate(true);
      if (actionName === 'consultation.outcome.record' && !visit.wellnessDecision)
        setCelebrate(true);
      await load();
      setArchiveOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to save visit.');
    } finally {
      setBusy(false);
    }
  };
  async function recorded(audio: File, segmentId: string, sequence: number, durationMs: number) {
    let savedSequence = segmentSequences.current.get(segmentId);
    if (savedSequence === undefined) {
      savedSequence = nextSequence.current++;
      segmentSequences.current.set(segmentId, savedSequence);
    }
    const form = new FormData();
    form.set('consultationId', id);
    form.set('segmentId', segmentId);
    form.set('sequence', String(savedSequence));
    form.set('audio', audio);
    form.set('consent', 'true');
    form.set('durationMs', String(durationMs));
    let result: { recordingId: string; jobId: string; status: string };
    try {
      result = await apiRequest<typeof result>('/api/recordings', { method: 'POST', body: form });
    } catch (cause) {
      if (cause instanceof ApiRequestError && cause.code === 'RECORDING_SEQUENCE_CONFLICT') {
        segmentSequences.current.delete(segmentId);
        await load();
      }
      throw cause;
    }
    setJobs((items) => [...items, { id: result.jobId, status: 'processing' }]);
    await load();
    await refresh();
    try {
      if (result.status === 'failed')
        await postJson(`/api/recordings/${result.recordingId}/retry`, {});
      const processed = await waitForJob(result.jobId);
      if (processed.summary && processed.summaryApplied === false)
        setProposedSummary(processed.summary as ConsultationSummary);
      setJobs((items) =>
        items.map((item) => (item.id === result.jobId ? { ...item, status: 'complete' } : item)),
      );
      await load();
      await refresh();
    } catch (cause) {
      setJobs((items) =>
        items.map((item) =>
          item.id === result.jobId
            ? {
                ...item,
                status: 'failed',
                error: cause instanceof Error ? cause.message : 'Failed',
              }
            : item,
        ),
      );
      throw cause;
    }
  }
  if (loading)
    return (
      <div className="loading-state" role="status">
        <div className="loading-ring" />
        Opening consultation…
      </div>
    );
  if (!visit || !configuration)
    return <ErrorBanner message={error || 'Consultation unavailable.'} retry={() => void load()} />;
  return (
    <>
      <Celebrate active={celebrate} onEnd={() => setCelebrate(false)} />
      <Link
        href={locationHref('/dashboard', locationId)}
        onClick={(event) => {
          if (captureBusy) {
            event.preventDefault();
            setError(
              'Save or deliberately discard unsaved audio before leaving this consultation.',
            );
          }
        }}
        className="back-link"
      >
        <Icon name="back" size={16} />
        All consultations
      </Link>
      <div className="page-heading consultation-heading">
        <div>
          <div className="eyebrow">CLIENT VISIT · {friendlyDate(visit.createdAt)}</div>
          <h1>{visit.reference}</h1>
          <div className="visit-heading-meta">
            <Badge tone={stageTones[visit.stage]}>{stageLabels[visit.stage]}</Badge>
            <span>{visit.providerName || 'Clinic team'}</span>
            <span>
              Configuration v
              {data?.configuration.versions.find(
                (version) => version.id === visit.configurationVersionId,
              )?.version || 'pinned'}
            </span>
          </div>
        </div>
        <button
          className="button"
          disabled={busy}
          onClick={() =>
            visit.archivedAt ? void action('consultation.restore') : setArchiveOpen(true)
          }
        >
          <Icon name="archive" size={17} />
          {visit.archivedAt ? 'Restore visit' : 'Archive'}
        </button>
      </div>
      {visit.archivedAt ? (
        <div className="notice notice-warm">
          <Icon name="archive" />
          <div>
            <strong>This visit is archived.</strong>
            <p>
              {visit.archiveReason} · History and outcomes are preserved. Restore to resume work and
              reminders.
            </p>
          </div>
        </div>
      ) : null}
      {error ? <ErrorBanner message={error} retry={() => void load()} /> : null}
      {jobs.some((job) => job.status === 'processing') ? (
        <div className="notice notice-subtle">
          <div className="loading-ring small-ring" />
          <span>Processing consultation audio. Saved segments will appear in the transcript.</span>
        </div>
      ) : null}
      <div className="visit-tabs" role="tablist" aria-label="Visit sections">
        {[
          { id: 'intake', label: 'Conversation & intake', number: '01' },
          { id: 'recommendation', label: 'Recommendation & care', number: '02' },
          { id: 'wellness', label: 'Wellness & takeaway', number: '03' },
          { id: 'history', label: 'Change history', number: '04' },
        ].map((item) => (
          <button
            id={`tab-${item.id}`}
            className={tab === item.id ? 'selected' : ''}
            role="tab"
            aria-selected={tab === item.id}
            aria-controls={`panel-${item.id}`}
            key={item.id}
            disabled={captureBusy}
            onClick={() => setTab(item.id)}
          >
            <span>{item.number}</span>
            {item.label}
          </button>
        ))}
      </div>
      <div
        className="visit-section"
        role="tabpanel"
        id={`panel-${tab}`}
        aria-labelledby={`tab-${tab}`}
      >
        {tab === 'intake' ? (
          <Intake
            visit={visit}
            configuration={configuration}
            action={action}
            busy={busy}
            onRecorded={recorded}
            onReload={async () => {
              await load();
              await refresh();
            }}
            proposedSummary={proposedSummary}
          />
        ) : tab === 'recommendation' ? (
          <>
            <InitialReview
              visit={visit}
              configuration={configuration}
              action={action}
              busy={busy}
              canApprove={Boolean(data?.user.canApproveClinical)}
            />
            <CareOutcome visit={visit} configuration={configuration} action={action} busy={busy} />
          </>
        ) : tab === 'wellness' ? (
          <>
            <Wellness visit={visit} configuration={configuration} action={action} busy={busy} />
            <TakeawaySharing visit={visit} configuration={configuration} />
          </>
        ) : (
          <section className="panel">
            <div className="section-heading">
              <div>
                <h2>Every adjustment, in context</h2>
                <p>
                  Original and revised values stay separate. Edits invalidate the previous approval.
                </p>
              </div>
              <Badge>{visit.adjustments?.length || 0} changes</Badge>
            </div>
            {visit.adjustments?.length ? (
              <div className="audit-list">
                {visit.adjustments.map((change) => (
                  <div key={change.id}>
                    <div>
                      <strong>
                        {change.actorName ||
                          data?.staff.find(
                            (person) => person.id === (change.userId || change.actorId),
                          )?.name ||
                          'Clinic team'}
                      </strong>
                      <Badge>{reasonLabels[change.reason] || change.reason}</Badge>
                      <span className="small muted">{friendlyDate(change.createdAt)}</span>
                    </div>
                    <p>
                      {change.reasonNote ||
                        change.note ||
                        'Reason recorded without an additional note.'}
                    </p>
                    <details>
                      <summary>Compare original and revised values</summary>
                      <div className="audit-comparison">
                        <div>
                          <span>Before</span>
                          <pre>{JSON.stringify(change.before, null, 2)}</pre>
                        </div>
                        <div>
                          <span>After</span>
                          <pre>{JSON.stringify(change.after, null, 2)}</pre>
                        </div>
                      </div>
                    </details>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState icon="file" title="No adjustments yet">
                Staff edits and correction reasons will be preserved here as the visit progresses.
              </EmptyState>
            )}
          </section>
        )}
      </div>
      <Modal
        open={archiveOpen}
        onClose={() => setArchiveOpen(false)}
        title="Archive this consultation"
      >
        <div className="form-stack">
          <p className="muted">
            Archiving preserves the visit&apos;s stage, recommendations, outcomes and audit history.
            Active reminders are suppressed until it is restored.
          </p>
          <label>
            Reason for archiving
            <textarea
              value={archiveReason}
              onChange={(event) => setArchiveReason(event.target.value)}
              rows={3}
              required
            />
          </label>
          <div className="modal-actions">
            <button className="button button-ghost" onClick={() => setArchiveOpen(false)}>
              Cancel
            </button>
            <button
              className="button button-primary"
              disabled={busy || !archiveReason.trim()}
              onClick={() => void action('consultation.archive', { reasonNote: archiveReason })}
            >
              Archive visit
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
