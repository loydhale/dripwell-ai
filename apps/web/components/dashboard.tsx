'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { consultationStages } from '@dripwell/shared/v2';
import { useClinic, locationHref, stageLabels, stageTones } from './clinic-context';
import { Badge, EmptyState, ErrorBanner, Icon, Modal, friendlyDate } from './ui';

export function Dashboard() {
  const { data, mutate, refresh, loadMore, loading, pageError, locationId } = useClinic();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [archiveView, setArchiveView] = useState(false);
  const [dateRange, setDateRange] = useState('30');
  const [open, setOpen] = useState(false);
  const [reference, setReference] = useState('');
  const [location, setLocation] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [startKey, setStartKey] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => {
      const end = new Date();
      void refresh({
        archived: archiveView, search: search.trim(),
        from: new Date(end.getTime() - Number(dateRange) * 86400000).toISOString(),
        to: end.toISOString(),
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [archiveView, dateRange, search, refresh]);
  if (!data) return null;
  const visible = data.consultations.filter(item => Boolean(item.archivedAt) === archiveView);
  const started = data.metrics.careStarted;
  const accepted = data.metrics.wellnessAccepted;
  const missing = data.metrics.overdue;
  const trialExpired = data.trial
    ? data.trial.remaining <= 0 ||
      Boolean(data.trial.endsAt && new Date(data.trial.endsAt).getTime() <= Date.now())
    : false;
  const startsDisabled = data.trial ? !data.trial.canStart : false;
  async function start(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await mutate<{ consultation?: { id: string }; id?: string }>(
        'consultation.start',
        {
          reference: reference.trim() || undefined,
          locationId: location || locationId || data!.locations[0]?.id,
          consent,
          idempotencyKey: startKey,
        },
      );
      const id = result.consultation?.id || result.id;
      if (!id)
        throw new Error(
          'Consultation was saved but its identifier could not be loaded. Refresh your board.',
        );
      router.push(locationHref(`/consultations/${id}`, location || locationId));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to start consultation.');
    } finally {
      setBusy(false);
    }
  }
  function openNew() {
    setStartKey(crypto.randomUUID());
    setOpen(true);
    setError('');
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">YOUR CLINIC, IN FLOW</div>
          <h1>Consultations</h1>
          <p>A clear path from the first conversation to what comes next.</p>
        </div>
        <button
          className="button button-primary"
          onClick={openNew}
          disabled={!data.configuration.active || startsDisabled}
        >
          <Icon name="plus" size={18} />
          New consultation
        </button>
      </div>
      {data.trial?.status === 'TRIAL' ? (
        <div className={`trial-banner ${trialExpired ? 'trial-exhausted' : ''}`}>
          <div>
            <Icon name="spark" size={18} />
            <span>
              <strong>{trialExpired ? 'Trial allowance reached' : 'Your 14-day trial'}</strong> ·{' '}
              {data.trial.used} of {data.trial.limit ?? 10} initial consultations used
              {data.trial.endsAt ? ` · Ends ${friendlyDate(data.trial.endsAt)}` : ''}
            </span>
          </div>
          <Link href={locationHref('/settings', locationId)}>
            {trialExpired ? 'Choose a plan' : 'Account details'}
            <Icon name="arrow" size={15} />
          </Link>
        </div>
      ) : null}
      {startsDisabled && !trialExpired && data.configuration.active ? (
        <div className="notice notice-warm">
          <Icon name="shield" />
          <div>
            <strong>Client visits are not yet enabled for this clinic.</strong>
            <p>
              Complete your clinic’s readiness review before beginning client visits. Owner setup
              tests remain available.
            </p>
          </div>
        </div>
      ) : null}
      {!data.configuration.active ? (
        <div className="notice notice-warm">
          <Icon name="spark" />
          <div>
            <strong>Get your clinic ready for its first conversation.</strong>
            <p>
              Review your catalog, prices, questions and clinic protocols, test recommendations,
              then activate your setup.
            </p>
          </div>
          <Link className="button button-small" href={locationHref('/setup', locationId)}>
            Continue setup
            <Icon name="arrow" size={15} />
          </Link>
        </div>
      ) : null}
      <div className="stats-grid">
        <div className="stat-card">
          <span>New consultations</span>
          <strong>{data.metrics.denominator}</strong>
          <small>Unique visits in selected period</small>
          <Icon name="people" />
        </div>
        <div className="stat-card">
          <span>Care started</span>
          <strong>
            {started}
            <em>/{data.metrics.denominator}</em>
          </strong>
          <small>Staff-recorded actual care</small>
          <Icon name="pulse" />
        </div>
        <div className="stat-card">
          <span>Wellness accepted</span>
          <strong>
            {accepted}
            <em>
              /
              {data.metrics.wellnessAccepted +
                data.metrics.wellnessRejected +
                data.metrics.wellnessTbd}
            </em>
          </strong>
          <small>Of recorded wellness decisions</small>
          <Icon name="check" />
        </div>
        <div className="stat-card stat-warm">
          <span>Follow-through needed</span>
          <strong>{missing}</strong>
          <small>Active visits with overdue outcomes</small>
          <Icon name="clock" />
        </div>
      </div>
      <div className="board-toolbar">
        <div className="segmented">
          <button className={!archiveView ? 'selected' : ''} onClick={() => setArchiveView(false)}>
            Active visits
          </button>
          <button className={archiveView ? 'selected' : ''} onClick={() => setArchiveView(true)}>
            <Icon name="archive" size={14} />
            Archive
          </button>
        </div>
        <div className="board-filters">
          <label className="search-field">
            <Icon name="search" size={17} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search visit or staff"
              aria-label="Search visit or staff"
              maxLength={100}
            />
          </label>
          <select
            aria-label="Reporting date range"
            value={dateRange}
            onChange={(event) => setDateRange(event.target.value)}
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="365">Last year</option>
          </select>
        </div>
      </div>
      <p className="board-help">
        {archiveView
          ? 'Archive includes all retained dates. The date range above only changes reporting totals.'
          : 'Active visits use the selected date range.'}{' '}
        Historical metrics include archived visits. Stages update when recommendations are saved.
        Your team records the client&apos;s wellness decision. Care starts and sales are tracked separately.
      </p>
      <p className="muted" role="status" aria-live="polite">
        {loading ? 'Loading visits…' : `Showing ${visible.length} of ${data.consultationCount} matching visits`}
      </p>
      <div className="kanban" aria-label="Consultation stages" aria-busy={loading}>
        {consultationStages.map((stage, index) => {
          const cards = visible.filter((item) => item.stage === stage);
          return (
            <section className={`kanban-column column-${stageTones[stage]}`} key={stage}>
              <header>
                <span className={`stage-dot dot-${stageTones[stage]}`} />
                <h2>{stageLabels[stage]}</h2>
                <span className="column-count">{cards.length}</span>
              </header>
              <span className="column-trigger">
                {index < 3 ? 'Automatic milestone' : 'Staff-recorded decision'}
              </span>
              <div className="kanban-cards">
                {cards.map((item) => (
                  <Link
                    href={locationHref(`/consultations/${item.id}`, locationId)}
                    className="visit-card"
                    key={item.id}
                  >
                    <div className="visit-card-top">
                      <span className="visit-code">{item.reference}</span>
                      <Icon name="arrow" size={15} />
                    </div>
                    <div className="visit-card-tags">
                      <Badge
                        tone={
                          item.careOutcome === 'STARTED'
                            ? 'green'
                            : item.careOutcome === 'NOT_STARTED'
                              ? 'coral'
                              : 'neutral'
                        }
                      >
                        {item.careOutcome === 'STARTED'
                          ? 'Care started'
                          : item.careOutcome === 'NOT_STARTED'
                            ? 'Care not started'
                            : 'Care pending'}
                      </Badge>
                      {item.archivedAt ? <Badge>Archived</Badge> : null}
                    </div>
                    {item.initialRecommendation &&
                    item.clinicalApprovedVersion !== item.initialRevision ? (
                      <p className="card-action">
                        <Icon name="shield" size={13} />
                        Clinical review needed
                      </p>
                    ) : null}
                    {item.wellnessPlan && item.wellnessApprovedVersion !== item.wellnessRevision ? (
                      <p className="card-action">
                        <Icon name="file" size={13} />
                        Wellness approval needed
                      </p>
                    ) : null}
                    {item.decisionNeedsReview ? (
                      <p className="card-action">
                        <Icon name="clock" size={13} />
                        Decision needs review
                      </p>
                    ) : null}
                    <div className="visit-card-footer">
                      <span className="staff-chip">
                        <span className="small-avatar">
                          {(item.providerName || 'Team').slice(0, 1)}
                        </span>
                        {item.providerName || 'Clinic team'}
                      </span>
                      <span>{friendlyDate(item.createdAt)}</span>
                    </div>
                  </Link>
                ))}
                {!cards.length ? (
                  <div className="column-empty">
                    <span className="empty-line" />
                    <p>
                      {index < 3
                        ? 'Visits appear here as you progress.'
                        : 'Record a decision on an approved plan.'}
                    </p>
                  </div>
                ) : null}
              </div>
            </section>
          );
        })}
      </div>
      {pageError ? <ErrorBanner message={pageError} retry={() => void loadMore()} /> : null}
      {data.consultationPagination.nextCursor ? (
        <button className="button button-ghost" onClick={() => void loadMore()} disabled={loading}>
          {loading ? 'Loading…' : 'Load more visits'}
        </button>
      ) : null}
      {!loading && !visible.length && (archiveView || search.trim()) ? (
        <EmptyState icon={archiveView ? 'archive' : 'search'} title="No matching visits.">
          {search.trim()
            ? 'Try a different visit reference or staff name.'
            : 'Archived visits will appear here, including older retained visits.'}
        </EmptyState>
      ) : null}
      {!loading && !archiveView && !search.trim() && !visible.length && data.configuration.active ? (
        <EmptyState
          icon="people"
          title="A great first visit starts with a conversation."
          action={
            <button className="button button-primary" onClick={openNew} disabled={startsDisabled}>
              <Icon name="plus" size={17} />
              Start your first consultation
            </button>
          }
        >
          Your new consultations will be organized here. Choose consented recording or enter intake
          notes directly.
        </EmptyState>
      ) : null}
      <Modal
        open={open}
        onClose={() => {
          if (!busy) setOpen(false);
        }}
        title="Start a consultation"
      >
        <form onSubmit={start} className="form-stack">
          <p className="muted">
            A new visit uses one initial consultation from your trial. Existing visits can always be
            finished.
          </p>
          {error ? <ErrorBanner message={error} /> : null}
          <label>
            Visit reference <span className="muted">optional</span>
            <input
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              maxLength={100}
              placeholder="Use a neutral identifier"
            />
          </label>
          <label>
            Location
            <select
              value={location || locationId || data.locations[0]?.id || ''}
              onChange={(event) => setLocation(event.target.value)}
            >
              {data.locations.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="checkbox-card">
            <input
              type="checkbox"
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
            />
            <span>
              <strong>The client consents to recording this consultation.</strong>
              <small>
                Confirm consent using your clinic&apos;s process. Leave unchecked to use manual
                intake.
              </small>
            </span>
          </label>
          <div className="modal-actions">
            <button
              className="button button-ghost"
              type="button"
              disabled={busy}
              onClick={() => setOpen(false)}
            >
              Cancel
            </button>
            <button className="button button-primary" disabled={busy}>
              {busy ? 'Starting…' : 'Start consultation'}
              <Icon name="arrow" size={16} />
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
