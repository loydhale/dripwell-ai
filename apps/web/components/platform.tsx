'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { ReferralPolicy } from '@dripwell/shared/v2';
import type { PlatformSubscriptionOffer } from '@/lib/commercial';
import { apiRequest, postJson } from './clinic-context';
import { decimalPrice, parsePrice } from './configuration-editor';
import { Badge, ErrorBanner, Icon, Money, friendlyDate } from './ui';
import { SubscriptionTerms } from './subscription-terms';

interface PlatformData {
  clinics: {
    id: string;
    name: string;
    slug: string;
    isActive: boolean;
    createdAt: string;
    staffCount: number;
    consultationCount: number;
    subscriptionStatus: string;
    trial: { endsAt: string | null; limit: number; used: number };
    stages: Record<string, number>;
    careOutcomes: Record<string, number>;
    referralCount: number;
    generationFailures: number;
  }[];
  totals: {
    clinics: number;
    consultations: number;
    subscriptions: Record<string, number>;
    referrals: number;
    convertedReferrals: number;
    generationJobs: number;
    generationFailures: number;
    averageGenerationMilliseconds: number | null;
    knownModelCostUsd: number | null;
    estimatedModelCostCents?: number | null;
    jobsWithMeasuredCost: number;
    creditBalances: {
      currency: string;
      availableCents: number;
      earnedCents: number;
      appliedCents: number;
      reversedCents: number;
      expiredCents: number;
    }[];
    support: Record<string, number>;
    note: string;
  };
  billingFailures: {
    eventId: string;
    eventType: string;
    status: string;
    errorCode: string | null;
    createdAt: string;
  }[];
  policy: ReferralPolicy | null;
  nextPolicyVersion: number | null;
  starterPolicy: ReferralPolicy | null;
  subscriptionOffer: PlatformSubscriptionOffer;
  readiness: { configured: boolean; services: { name: string; connected: boolean }[] };
}

export function Platform() {
  const [data, setData] = useState<PlatformData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [version, setVersion] = useState(1);
  const [attribution, setAttribution] = useState(30);
  const [refundReverses, setRefundReverses] = useState(true);
  const [expiry, setExpiry] = useState('');
  const [search, setSearch] = useState('');
  const load = useCallback(async () => {
    try {
      const result = await apiRequest<PlatformData>('/api/platform');
      setData(result);
      setError('');
      setEnabled(Boolean(result.policy));
      setVersion(result.nextPolicyVersion ?? result.policy?.version ?? 1);
      const fields = result.policy ?? result.starterPolicy;
      if (fields) {
        setAmount(decimalPrice(fields.creditCents, fields.currency));
        setCurrency(fields.currency);
        setAttribution(fields.attributionDays);
        setRefundReverses(fields.refundReversesCredit);
        setExpiry(fields.expiryDays == null ? '' : String(fields.expiryDays));
      } else {
        setAmount('');
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Platform overview could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  function loadStarterTerms() {
    if (!data?.starterPolicy) return;
    const policy = data.starterPolicy;
    setEnabled(true);
    setVersion(policy.version);
    setAmount(decimalPrice(policy.creditCents, policy.currency));
    setCurrency(policy.currency);
    setAttribution(policy.attributionDays);
    setRefundReverses(policy.refundReversesCredit);
    setExpiry(policy.expiryDays == null ? '' : String(policy.expiryDays));
    setNotice('Starter terms loaded for review. Publish to activate this new policy version.');
  }
  async function publish(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const cents = enabled ? parsePrice(amount, currency) : null;
      if (enabled && (!cents || cents <= 0))
        throw new Error('Enter the approved positive account-credit amount.');
      await apiRequest('/api/platform', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          referralPolicy: enabled
            ? {
                version,
                creditCents: cents,
                currency,
                attributionDays: attribution,
                qualification: 'FIRST_PAID_PLATFORM_SUBSCRIPTION',
                refundReversesCredit: refundReverses,
                expiryDays: expiry === '' ? null : Number(expiry),
              }
            : null,
        }),
      });
      setNotice(
        enabled
          ? 'Referral policy published with its new version. Future credits use these recorded terms.'
          : 'Monetary referral rewards disabled. Attribution and existing ledger history are preserved.',
      );
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Policy could not be saved.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="workspace">
      <aside className="sidebar platform-sidebar">
        <Link className="wordmark" href="/platform">
          <span className="brand-symbol">
            <Icon name="pulse" size={22} />
          </span>
          dripwell<span className="wordmark-period">.</span>
        </Link>
        <div className="clinic-switch">
          <span className="clinic-avatar">
            <Icon name="shield" size={17} />
          </span>
          <div>
            <strong>Platform operations</strong>
            <span>System administrator</span>
          </div>
        </div>
        <div className="nav-label">PLATFORM</div>
        <nav>
          <Link className="nav-link active" href="/platform">
            <Icon name="chart" />
            Overview
          </Link>
          <Link className="nav-link" href="/account">
            <Icon name="shield" />
            Account & security
          </Link>
        </nav>
        <div className="sidebar-bottom">
          <div className="calm-card">
            <Icon name="shield" />
            <strong>Operational visibility.</strong>
            <p>
              Clinic-level metrics and service health. Routine dashboards contain no raw client
              records.
            </p>
          </div>
          <button
            className="nav-link"
            style={{ border: 0, width: '100%', background: 'transparent' }}
            onClick={() =>
              void postJson('/api/auth/logout', {})
                .then(() => window.location.assign('/'))
                .catch((cause) =>
                  setError(cause instanceof Error ? cause.message : 'Sign out failed.'),
                )
            }
          >
            <Icon name="exit" />
            Sign out
          </button>
        </div>
      </aside>
      <div className="main-workspace">
        <header className="topbar">
          <div className="topbar-location">
            <span className="location-dot" />
            DripWell operations
          </div>
          <div className="private-label">
            <Icon name="shield" size={14} />
            Restricted platform access
          </div>
        </header>
        <main className="page-content">
          <div className="page-heading">
            <div>
              <div className="eyebrow">PLATFORM OPERATIONS</div>
              <h1>The bigger picture.</h1>
              <p>Clinics, trial usage, referrals and reliability in one place.</p>
            </div>
            <button className="button" onClick={() => void load()}>
              <Icon name="chart" size={16} />
              Refresh overview
            </button>
          </div>
          {error ? <ErrorBanner message={error} retry={() => void load()} /> : null}
          {notice ? (
            <div className="notice notice-subtle" role="status">
              {notice}
            </div>
          ) : null}
          {loading ? (
            <div className="loading-state" role="status">
              <div className="loading-ring" />
              Loading platform metrics…
            </div>
          ) : data ? (
            <>
              <div className="stats-grid">
                <div className="stat-card">
                  <span>Clinics</span>
                  <strong>{data.totals.clinics}</strong>
                  <small>{data.totals.subscriptions.ACTIVE || 0} active subscriptions</small>
                  <Icon name="people" />
                </div>
                <div className="stat-card">
                  <span>Initial consultations</span>
                  <strong>{data.totals.consultations}</strong>
                  <small>Real visits including archives</small>
                  <Icon name="pulse" />
                </div>
                <div className="stat-card">
                  <span>Referral conversions</span>
                  <strong>
                    {data.totals.convertedReferrals}
                    <em>/{data.totals.referrals}</em>
                  </strong>
                  <small>Of referred clinic signups</small>
                  <Icon name="share" />
                </div>
                <div className="stat-card stat-warm">
                  <span>Generation failures</span>
                  <strong>
                    {data.totals.generationFailures}
                    <em>/{data.totals.generationJobs}</em>
                  </strong>
                  <small>All persisted generation jobs</small>
                  <Icon name="clock" />
                </div>
              </div>
              <section className="panel">
                <div className="section-heading">
                  <div>
                    <h2>Clinic accounts</h2>
                    <p>
                      Trial limits, real consultation counts and operational outcomes. Client
                      content stays private.
                    </p>
                  </div>
                  <label className="search-field">
                    <Icon name="search" size={16} />
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Find a clinic"
                      aria-label="Find a clinic"
                    />
                  </label>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Clinic</th>
                        <th>Subscription</th>
                        <th>Trial used</th>
                        <th>Trial ends</th>
                        <th>Visits</th>
                        <th>Care started</th>
                        <th>Staff</th>
                        <th>Referrals</th>
                        <th>Failures</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.clinics
                        .filter((clinic) =>
                          `${clinic.name} ${clinic.slug}`
                            .toLowerCase()
                            .includes(search.toLowerCase()),
                        )
                        .map((clinic) => (
                          <tr key={clinic.id}>
                            <td>
                              <strong>{clinic.name}</strong>
                              <br />
                              <span className="small muted">
                                {clinic.slug}
                                {!clinic.isActive ? ' · Inactive' : ''}
                              </span>
                            </td>
                            <td>
                              <Badge
                                tone={
                                  clinic.subscriptionStatus === 'ACTIVE'
                                    ? 'green'
                                    : clinic.subscriptionStatus === 'TRIAL'
                                      ? 'teal'
                                      : 'neutral'
                                }
                              >
                                {clinic.subscriptionStatus.toLowerCase().replaceAll('_', ' ')}
                              </Badge>
                            </td>
                            <td>
                              {clinic.trial.used}/{clinic.trial.limit}
                            </td>
                            <td>{friendlyDate(clinic.trial.endsAt)}</td>
                            <td>{clinic.consultationCount}</td>
                            <td>
                              {clinic.careOutcomes.STARTED || 0}/{clinic.consultationCount}
                            </td>
                            <td>{clinic.staffCount}</td>
                            <td>{clinic.referralCount}</td>
                            <td>{clinic.generationFailures}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
                <p className="field-help">{data.totals.note}</p>
              </section>
              <div className="settings-grid">
                <div>
                  <section className="panel">
                    <div className="section-heading">
                      <div>
                        <h2>Service configuration</h2>
                        <p>
                          Configuration checks show whether required keys are present. Live provider
                          checks are verified separately.
                        </p>
                      </div>
                    </div>
                    <div className="readiness-grid">
                      {data.readiness.services.map((service) => (
                        <Badge key={service.name} tone={service.connected ? 'green' : 'amber'}>
                          {service.name.replace(/([A-Z])/g, ' $1').toLowerCase()} ·{' '}
                          {service.connected ? 'configured' : 'needs configuration'}
                        </Badge>
                      ))}
                    </div>
                    <h3 className="form-heading">Platform subscription</h3>
                    <SubscriptionTerms offer={data.subscriptionOffer} />
                    <h3 className="form-heading">Generation performance and cost</h3>
                    <div className="metric-breakdown">
                      <span>
                        Average completed duration{' '}
                        <strong>
                          {data.totals.averageGenerationMilliseconds == null
                            ? 'Not measured'
                            : `${(data.totals.averageGenerationMilliseconds / 1000).toFixed(1)}s`}
                        </strong>
                      </span>
                      <span>
                        Provider-reported model cost{' '}
                        <strong>
                          {data.totals.knownModelCostUsd == null
                            ? 'Not reported'
                            : `$${data.totals.knownModelCostUsd.toFixed(4)}`}
                        </strong>
                      </span>
                      <span>
                        Jobs with measured cost{' '}
                        <strong>
                          {data.totals.jobsWithMeasuredCost}/{data.totals.generationJobs}
                        </strong>
                      </span>
                      {data.totals.estimatedModelCostCents != null ? (
                        <span>
                          Catalog-estimated model cost{' '}
                          <Money cents={data.totals.estimatedModelCostCents} />
                        </span>
                      ) : null}
                    </div>
                    <p className="field-help">
                      Unreported cost remains unknown. Catalog estimates are separate from billed
                      usage.
                    </p>
                    <h3 className="form-heading">Support activity</h3>
                    <div className="metric-breakdown">
                      {Object.entries(data.totals.support).map(([status, count]) => (
                        <span key={status}>
                          {status.toLowerCase()}
                          <strong>{count}</strong>
                        </span>
                      ))}
                      {!Object.keys(data.totals.support).length ? (
                        <span>No support records</span>
                      ) : null}
                    </div>
                  </section>
                  <section className="panel">
                    <div className="section-heading">
                      <div>
                        <h2>Account credit liability</h2>
                        <p>
                          Ledger entries preserve earned, applied, reversed and expired amounts by
                          currency.
                        </p>
                      </div>
                    </div>
                    {data.totals.creditBalances.length ? (
                      data.totals.creditBalances.map((balance) => (
                        <div className="catalog-card" key={balance.currency}>
                          <h3>{balance.currency} available credit</h3>
                          <Money cents={balance.availableCents} currency={balance.currency} />
                          <div className="metric-breakdown">
                            <span>
                              Earned{' '}
                              <Money cents={balance.earnedCents} currency={balance.currency} />
                            </span>
                            <span>
                              Applied{' '}
                              <Money cents={balance.appliedCents} currency={balance.currency} />
                            </span>
                            <span>
                              Reversed{' '}
                              <Money cents={balance.reversedCents} currency={balance.currency} />
                            </span>
                            <span>
                              Expired{' '}
                              <Money cents={balance.expiredCents} currency={balance.currency} />
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="small muted">No account-credit entries yet.</p>
                    )}
                  </section>
                  {data.billingFailures.length ? (
                    <section className="panel">
                      <h2>Billing events needing attention</h2>
                      <div className="table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>Event</th>
                              <th>Status</th>
                              <th>Failure</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.billingFailures.map((event) => (
                              <tr key={event.eventId}>
                                <td>
                                  {event.eventType}
                                  <br />
                                  <small>{event.eventId}</small>
                                </td>
                                <td>{event.status}</td>
                                <td>{event.errorCode || 'Pending processing'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  ) : null}
                </div>
                <form className="panel form-stack" onSubmit={(event) => void publish(event)}>
                  <div className="section-heading">
                    <div>
                      <h2>Referral account-credit policy</h2>
                      <p>
                        Define approved commercial terms before promising monetary rewards.
                        Publication requires platform MFA.
                      </p>
                    </div>
                  </div>
                  {!data.policy ? (
                    <div className="notice notice-warm">
                      Referral attribution is active. Credit value and terms have not been
                      published; no monetary reward is promised.
                    </div>
                  ) : (
                    <Badge tone="teal">Current policy v{data.policy.version}</Badge>
                  )}
                  <button
                    className="button"
                    type="button"
                    disabled={busy || !data.starterPolicy}
                    onClick={loadStarterTerms}
                  >
                    Load starter referral terms
                  </button>
                  <p className="field-help">
                    Starter terms are editable and remain inactive until published. Credit applies
                    to future DripWell invoices and has no cash payout. Existing referrals keep
                    their recorded policy versions.
                  </p>
                  {data.nextPolicyVersion === null ? (
                    <div className="notice notice-warm">The policy version limit has been reached. Contact platform support before publishing new rewards.</div>
                  ) : null}
                  <label className="inline-check">
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={(event) => setEnabled(event.target.checked)}
                    />
                    Enable monetary referral account credits
                  </label>
                  {enabled ? (
                    <>
                      <div className="form-grid">
                        <label>
                          New policy version
                          <input
                            type="number"
                            min={1}
                            value={version}
                            onChange={(event) => setVersion(Number(event.target.value))}
                            required
                          />
                        </label>
                        <label>
                          Credit amount
                          <input
                            inputMode="decimal"
                            value={amount}
                            onChange={(event) => setAmount(event.target.value)}
                            required
                            placeholder="Approved amount"
                          />
                        </label>
                        <label>
                          Currency
                          <input
                            maxLength={3}
                            pattern="[A-Z]{3}"
                            value={currency}
                            onChange={(event) => setCurrency(event.target.value.toUpperCase())}
                            required
                          />
                        </label>
                        <label>
                          Attribution window (days)
                          <input
                            type="number"
                            min={1}
                            max={365}
                            value={attribution}
                            onChange={(event) => setAttribution(Number(event.target.value))}
                            required
                          />
                        </label>
                        <label>
                          Credit expiry (days, optional)
                          <input
                            type="number"
                            min={1}
                            max={3650}
                            value={expiry}
                            onChange={(event) => setExpiry(event.target.value)}
                            placeholder="Blank means no expiry"
                          />
                        </label>
                      </div>
                      <label className="inline-check">
                        <input
                          type="checkbox"
                          checked={refundReverses}
                          onChange={(event) => setRefundReverses(event.target.checked)}
                        />
                        Reverse earned credit if the qualifying subscription payment is refunded
                      </label>
                      <p className="field-help">
                        Qualification: the referred clinic&apos;s first successfully paid platform
                        subscription. Credit is awarded once per eligible referral; billing replay
                        cannot award it again.
                      </p>
                    </>
                  ) : null}
                  <button className="button button-primary" disabled={busy || (enabled && data.nextPolicyVersion === null)}>
                    {busy
                      ? 'Publishing…'
                      : enabled
                        ? 'Publish referral policy'
                        : 'Keep monetary rewards disabled'}
                  </button>
                </form>
              </div>
            </>
          ) : null}
        </main>
        <footer className="workspace-footer">
          DripWell <span>Platform operations</span>
        </footer>
      </div>
    </div>
  );
}
