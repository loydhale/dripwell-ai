'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import type { ReferralPolicy } from '@dripwell/shared/v2';
import { apiRequest, isOwner, postJson, useClinic, type StaffView } from './clinic-context';
import { Badge, ErrorBanner, Icon, Modal, Money, friendlyDate } from './ui';

interface ReferralData {
  code: string;
  url: string;
  notice: string;
  trial: {
    endsAt: string | null;
    activatedAt: string | null;
    limit: number;
    used: number;
    remaining: number;
  };
  subscription: { status: string; currentPeriodEnd: string | null; stripeCustomerLinked: boolean };
  referrals: {
    id: string;
    clinicName: string;
    status: string;
    createdAt: string;
    convertedAt: string | null;
  }[];
  credits: { id: string; amountCents: number; currency: string; kind: string; createdAt: string }[];
  balances: { currency: string; availableCents: number }[];
  policy: ReferralPolicy | null;
}

function InstallApp() {
  const [prompt, setPrompt] = useState<(Event & { prompt: () => Promise<void> }) | null>(null);
  const [installed, setInstalled] = useState(false);
  useEffect(() => {
    setInstalled(window.matchMedia('(display-mode: standalone)').matches);
    function beforeInstall(event: Event) {
      event.preventDefault();
      setPrompt(event as Event & { prompt: () => Promise<void> });
    }
    function done() {
      setInstalled(true);
      setPrompt(null);
    }
    window.addEventListener('beforeinstallprompt', beforeInstall);
    window.addEventListener('appinstalled', done);
    return () => {
      window.removeEventListener('beforeinstallprompt', beforeInstall);
      window.removeEventListener('appinstalled', done);
    };
  }, []);
  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <h2>Keep DripWell close.</h2>
          <p>Install the PWA for quick access from your clinic&apos;s tablet or computer.</p>
        </div>
        <Icon name="grid" />
      </div>
      {installed ? (
        <Badge tone="green">App installed</Badge>
      ) : prompt ? (
        <button
          className="button button-primary"
          onClick={() => void prompt.prompt().then(() => setPrompt(null))}
        >
          <Icon name="download" size={17} />
          Install DripWell
        </button>
      ) : (
        <p className="small muted">
          On iPhone or iPad, open Safari&apos;s Share menu and choose “Add to Home Screen.” On
          supported desktop browsers, use the install icon in the address bar or browser menu.
        </p>
      )}
      <p className="field-help">
        An internet connection is required for private client records. Only the public app assets
        are cached.
      </p>
    </section>
  );
}

export function Settings() {
  const { data, mutate } = useClinic();
  const [referrals, setReferrals] = useState<ReferralData | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [email, setEmail] = useState('');
  const [authority, setAuthority] = useState(false);
  const [authorityNote, setAuthorityNote] = useState('');
  const [inviteUrl, setInviteUrl] = useState('');
  const [member, setMember] = useState<StaffView | null>(null);
  const [memberActive, setMemberActive] = useState(true);
  const [memberAuthority, setMemberAuthority] = useState(false);
  const [memberNote, setMemberNote] = useState('');
  const [locationName, setLocationName] = useState('');
  useEffect(() => {
    if (data && isOwner(data.user.role))
      void apiRequest<ReferralData>('/api/referrals')
        .then(setReferrals)
        .catch((cause) =>
          setError(cause instanceof Error ? cause.message : 'Account details unavailable.'),
        );
  }, [data?.user.id]);
  if (!data) return null;
  const owner = isOwner(data.user.role);
  async function billing(path: string) {
    setBusy(true);
    setError('');
    try {
      const result = await postJson<{ url: string }>(path, {});
      window.location.assign(result.url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Billing could not be opened.');
    } finally {
      setBusy(false);
    }
  }
  async function invite(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await mutate<{ result: { inviteUrl: string } }>('member.invite', {
        email,
        canApproveClinical: authority,
        clinicalAuthorizationNote: authorityNote,
      });
      setInviteUrl(new URL(result.result.inviteUrl, window.location.origin).href);
      setNotice(
        'Invitation created. Share this private invitation with the intended staff member.',
      );
      setEmail('');
      setAuthorityNote('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Invitation could not be created.');
    } finally {
      setBusy(false);
    }
  }
  async function saveMember(event: FormEvent) {
    event.preventDefault();
    if (!member) return;
    setBusy(true);
    setError('');
    try {
      await mutate('member.update', {
        userId: member.id,
        isActive: memberActive,
        canApproveClinical: memberAuthority,
        clinicalAuthorizationNote: memberNote,
      });
      setMember(null);
      setNotice('Staff access updated. Changes are audited and affected sessions are revoked.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Staff permissions could not be saved.');
    } finally {
      setBusy(false);
    }
  }
  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setNotice('Link copied.');
    } catch {
      setError('Select and copy the link manually. Clipboard access is unavailable.');
    }
  }
  async function shareReferral() {
    if (!referrals) return;
    try {
      if (navigator.share)
        await navigator.share({
          title: 'Try DripWell',
          text: 'A consultation workspace for IV clinics. Your trial includes 14 days and 10 initial consultations.',
          url: referrals.url,
        });
      else await copy(referrals.url);
    } catch (cause) {
      if (!(cause instanceof DOMException && cause.name === 'AbortError'))
        setError('The link could not be shared. Copy it below.');
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">YOUR WORKSPACE</div>
          <h1>Settings</h1>
          <p>A trusted team, a clear account, and a workspace that works for your clinic.</p>
        </div>
        <Link href="/account" className="button">
          <Icon name="shield" size={17} />
          Account & security
        </Link>
      </div>
      {error ? <ErrorBanner message={error} /> : null}
      {notice ? (
        <div className="notice notice-subtle" role="status">
          {notice}
        </div>
      ) : null}
      <div className="settings-grid">
        <div>
          <section className="panel">
            <div className="section-heading">
              <div>
                <h2>Your clinic team</h2>
                <p>Clinical approval is granted separately from workspace access.</p>
              </div>
              <Badge>{data.staff.filter((person) => person.isActive).length} active</Badge>
            </div>
            {data.staff.map((person) => (
              <div className="team-row" key={person.id}>
                <span className="person-avatar">
                  {person.name
                    .split(' ')
                    .map((part) => part[0])
                    .slice(0, 2)
                    .join('')}
                </span>
                <div>
                  <strong>{person.name}</strong>
                  <p>{person.email}</p>
                </div>
                <Badge tone={person.canApproveClinical ? 'teal' : 'neutral'}>
                  {isOwner(person.role)
                    ? 'Owner'
                    : person.canApproveClinical
                      ? 'Authorized provider'
                      : 'Staff'}
                </Badge>
                {!person.isActive ? <Badge tone="coral">Inactive</Badge> : null}
                {owner ? (
                  <button
                    className="text-button"
                    onClick={() => {
                      setMember(person);
                      setMemberActive(person.isActive);
                      setMemberAuthority(Boolean(person.canApproveClinical));
                      setMemberNote('');
                    }}
                  >
                    Manage
                  </button>
                ) : null}
              </div>
            ))}
            {owner ? (
              <form
                onSubmit={(event) => void invite(event)}
                className="form-stack"
                style={{ marginTop: 23 }}
              >
                <h3>Invite a staff member</h3>
                <label>
                  Staff email
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                  />
                </label>
                <label className="inline-check">
                  <input
                    type="checkbox"
                    checked={authority}
                    onChange={(event) => setAuthority(event.target.checked)}
                  />
                  Grant authorized clinical approval access
                </label>
                {authority ? (
                  <label>
                    Clinical authorization record
                    <textarea
                      rows={2}
                      value={authorityNote}
                      onChange={(event) => setAuthorityNote(event.target.value)}
                      required
                      placeholder="Record licensure, role and the clinic's authorization."
                    />
                  </label>
                ) : null}
                <button className="button" disabled={busy}>
                  <Icon name="plus" size={16} />
                  Create invitation
                </button>
                {inviteUrl ? (
                  <div className="copy-box">
                    <input value={inviteUrl} readOnly aria-label="Private staff invitation link" />
                    <button
                      className="button button-small"
                      type="button"
                      onClick={() => void copy(inviteUrl)}
                    >
                      Copy
                    </button>
                  </div>
                ) : null}
              </form>
            ) : null}
          </section>
          {owner ? (
            <section className="panel">
              <div className="section-heading">
                <div>
                  <h2>Clinic locations</h2>
                  <p>
                    Each location has its own approved catalog, configuration and consultation
                    board.
                  </p>
                </div>
              </div>
              {data.locations.map((location) => (
                <div className="team-row" key={location.id}>
                  <Icon name="pulse" />
                  <div>
                    <strong>{location.name}</strong>
                  </div>
                </div>
              ))}
              <form
                className="share-form"
                style={{ gridTemplateColumns: '1fr auto', marginTop: 20 }}
                onSubmit={(event) => {
                  event.preventDefault();
                  setBusy(true);
                  setError('');
                  void mutate('location.create', { name: locationName })
                    .then(() => {
                      setLocationName('');
                      setNotice(
                        'Location created. Select it in the top bar to configure its catalog.',
                      );
                    })
                    .catch((cause) =>
                      setError(
                        cause instanceof Error ? cause.message : 'Location could not be created.',
                      ),
                    )
                    .finally(() => setBusy(false));
                }}
              >
                <label>
                  New location name
                  <input
                    value={locationName}
                    onChange={(event) => setLocationName(event.target.value)}
                    required
                  />
                </label>
                <button className="button" disabled={busy}>
                  Add location
                </button>
              </form>
            </section>
          ) : null}
          <InstallApp />
        </div>
        <div>
          {owner ? (
            <>
              <section className="panel">
                <div className="section-heading">
                  <div>
                    <h2>Platform subscription</h2>
                    <p>
                      Your DripWell subscription is separate from the services and memberships you
                      offer clients.
                    </p>
                  </div>
                  <Icon name="card" />
                </div>
                <div className="subscription-summary">
                  <div>
                    <strong>
                      {referrals?.subscription.status === 'ACTIVE'
                        ? 'Active subscription'
                        : referrals?.subscription.status === 'TRIAL'
                          ? '14-day clinic trial'
                          : referrals?.subscription.status.toLowerCase().replaceAll('_', ' ') ||
                            'Loading account…'}
                    </strong>
                    <span>
                      {referrals?.subscription.status === 'TRIAL'
                        ? `${referrals.trial.used} of ${referrals.trial.limit} initial consultations used`
                        : referrals?.subscription.currentPeriodEnd
                          ? `Current period ends ${friendlyDate(referrals.subscription.currentPeriodEnd)}`
                          : 'No automatic paid enrollment'}
                    </span>
                  </div>
                  {referrals?.subscription.status === 'TRIAL' ? (
                    <Badge tone="teal">{referrals.trial.remaining} remaining</Badge>
                  ) : null}
                </div>
                {referrals?.trial.endsAt && referrals.subscription.status === 'TRIAL' ? (
                  <p className="small muted">
                    Trial ends {friendlyDate(referrals.trial.endsAt)} or when 10 initial
                    consultations are used. Existing visits can be finished. Tests, retries and
                    reopened visits do not use additional consultations.
                  </p>
                ) : null}
                <div className="decision-buttons">
                  <button
                    className="button button-primary"
                    disabled={busy || !referrals}
                    onClick={() => void billing('/api/billing/checkout')}
                  >
                    Choose subscription
                  </button>
                  {referrals?.subscription.stripeCustomerLinked ? (
                    <button
                      className="button"
                      disabled={busy}
                      onClick={() => void billing('/api/billing/portal')}
                    >
                      Manage billing
                    </button>
                  ) : null}
                </div>
                <p className="field-help">
                  Owner MFA is required to manage billing. Subscription prices and terms are shown
                  in the secure checkout before purchase.
                </p>
              </section>
              <section className="panel">
                <div className="section-heading">
                  <div>
                    <h2>Good care travels.</h2>
                    <p>Invite another IV spa owner to try DripWell.</p>
                  </div>
                  <Icon name="share" />
                </div>
                {referrals ? (
                  <>
                    <div className="referral-url">
                      <input value={referrals.url} readOnly aria-label="Clinic referral link" />
                      <button
                        className="button button-small"
                        onClick={() => void copy(referrals.url)}
                      >
                        Copy
                      </button>
                    </div>
                    <button
                      className="button"
                      style={{ marginTop: 13 }}
                      onClick={() => void shareReferral()}
                    >
                      <Icon name="share" size={16} />
                      Share your clinic referral
                    </button>
                    <p className="field-help">
                      The referred owner gets a 14-day trial with 10 initial consultations. The link
                      contains no client information.
                    </p>
                    <div className="notice notice-subtle">
                      <div>
                        {referrals.notice}
                        {referrals.policy ? (
                          <p>
                            Qualifying first paid platform subscription earns{' '}
                            <Money
                              cents={referrals.policy.creditCents}
                              currency={referrals.policy.currency}
                            />{' '}
                            in account credit. Attribution window:{' '}
                            {referrals.policy.attributionDays} days.
                            {referrals.policy.refundReversesCredit
                              ? ' Refunded conversions reverse the credit.'
                              : ''}
                            {referrals.policy.expiryDays
                              ? ` Credit expires after ${referrals.policy.expiryDays} days.`
                              : ''}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    {referrals.balances.length ? (
                      <div className="metric-breakdown">
                        {referrals.balances.map((balance) => (
                          <span key={balance.currency}>
                            Available account credit{' '}
                            <Money cents={balance.availableCents} currency={balance.currency} />
                          </span>
                        ))}
                      </div>
                    ) : null}
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Referred clinic</th>
                            <th>Status</th>
                            <th>Joined</th>
                          </tr>
                        </thead>
                        <tbody>
                          {referrals.referrals.map((referral) => (
                            <tr key={referral.id}>
                              <td>
                                <strong>{referral.clinicName}</strong>
                              </td>
                              <td>
                                <Badge tone={referral.convertedAt ? 'green' : 'neutral'}>
                                  {referral.status.toLowerCase().replaceAll('_', ' ')}
                                </Badge>
                              </td>
                              <td>{friendlyDate(referral.createdAt)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {!referrals.referrals.length ? (
                        <p className="small muted" style={{ marginTop: 15 }}>
                          Referred clinic signups and conversions will appear here.
                        </p>
                      ) : null}
                    </div>
                    {referrals.credits.length ? (
                      <details style={{ marginTop: 17 }}>
                        <summary className="text-button">Account credit history</summary>
                        <div className="table-wrap">
                          <table>
                            <thead>
                              <tr>
                                <th>Entry</th>
                                <th>Amount</th>
                                <th>Date</th>
                              </tr>
                            </thead>
                            <tbody>
                              {referrals.credits.map((credit) => (
                                <tr key={credit.id}>
                                  <td>{credit.kind.toLowerCase()}</td>
                                  <td>
                                    <Money cents={credit.amountCents} currency={credit.currency} />
                                  </td>
                                  <td>{friendlyDate(credit.createdAt)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </details>
                    ) : null}
                  </>
                ) : (
                  <p className="muted">Loading referral account…</p>
                )}
              </section>
            </>
          ) : (
            <section className="panel">
              <h2>Clinic account</h2>
              <p className="muted">
                The clinic owner manages subscriptions, referral credits and staff permissions. You
                can manage your own account security.
              </p>
              <Link className="button" href="/account">
                Account & security
              </Link>
            </section>
          )}
        </div>
      </div>
      <Modal
        open={Boolean(member)}
        onClose={() => setMember(null)}
        title={`Manage ${member?.name || 'staff member'}`}
      >
        <form className="form-stack" onSubmit={(event) => void saveMember(event)}>
          <label className="inline-check">
            <input
              type="checkbox"
              checked={memberActive}
              onChange={(event) => setMemberActive(event.target.checked)}
              disabled={member?.id === data.user.id}
            />
            Workspace access active
          </label>
          <label className="checkbox-card">
            <input
              type="checkbox"
              checked={memberAuthority}
              onChange={(event) => setMemberAuthority(event.target.checked)}
            />
            <span>
              <strong>Authorized clinical approval</strong>
              <small>
                Only appropriately authorized providers may approve treatment recommendations. Owner
                status alone does not grant clinical authority.
              </small>
            </span>
          </label>
          <label>
            Clinical authorization or access-change note
            <textarea
              value={memberNote}
              rows={3}
              required={memberAuthority && !member?.canApproveClinical}
              onChange={(event) => setMemberNote(event.target.value)}
            />
          </label>
          {error ? <ErrorBanner message={error} /> : null}
          <div className="modal-actions">
            <button className="button button-ghost" type="button" onClick={() => setMember(null)}>
              Cancel
            </button>
            <button className="button button-primary" disabled={busy}>
              Save staff access
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
