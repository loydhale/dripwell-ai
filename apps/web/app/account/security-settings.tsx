'use client';

import { useCallback, useEffect, useState } from 'react';

type Security = { mfaEnabled: boolean; mfaVerified: boolean; currentSessionId: string; sessions: Array<{ id: string; createdAt: string; expiresAt: string }> };
type Enrollment = { secret: string; otpauthUri: string };

export function SecuritySettings() {
  const [security, setSecurity] = useState<Security | null>(null);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [recovery, setRecovery] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const refresh = useCallback(async () => {
    const response = await fetch('/api/auth/security', { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Unable to load account settings.');
    setSecurity(data);
  }, []);
  useEffect(() => { refresh().catch(caught => setError(caught instanceof Error ? caught.message : 'Connection interrupted.')); }, [refresh]);
  async function action(endpoint: string, body: Record<string, unknown>) {
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to update your account.');
      if (data.signInRequired) { window.location.assign('/login'); return; }
      if (body.action === 'begin') setEnrollment(data);
      if (data.recoveryCodes) { setRecovery(data.recoveryCodes); setEnrollment(null); setNotice('Two-factor authentication is enabled. Save your recovery codes now.'); }
      if (body.action === 'password') setNotice('Password updated. Other sessions have been signed out.');
      if (body.action === 'revoke') setNotice('Session signed out.');
      await refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Connection interrupted. Please try again.'); }
    finally { setBusy(false); }
  }
  function formAction(event: React.FormEvent<HTMLFormElement>, endpoint: string, kind: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void action(endpoint, { action: kind, ...Object.fromEntries(form) });
    if (kind === 'password') event.currentTarget.reset();
  }
  return <div className="security-grid">
    {error && <div className="alert error" role="alert">{error}</div>}{notice && <div className="alert success" role="status">{notice}</div>}
    <section className="card"><h2>Two-factor authentication</h2><p className="muted">Required for publishing clinic configuration, clinical permissions, and platform administration.</p>
      {!security ? <p>Loading account security…</p> : security.mfaEnabled ? <><p className="badge success">Enabled</p><p className="muted small">Keep your authenticator and recovery codes private. Disabling signs out every session.</p><form onSubmit={event => formAction(event, '/api/auth/mfa', 'disable')} className="auth-form"><label>Current password<input type="password" name="password" autoComplete="current-password" required /></label><label>Authenticator or recovery code<input name="code" autoComplete="one-time-code" required maxLength={40} /></label><button disabled={busy} className="button secondary">Disable two-factor authentication</button></form></> : enrollment ? <><p>Add this key to your authenticator app:</p><code className="secret-key">{enrollment.secret}</code><p className="small"><a href={enrollment.otpauthUri}>Open in an authenticator app</a></p><p className="muted small">This setup key expires in 10 minutes. It is shown only during this setup.</p><form onSubmit={event => formAction(event, '/api/auth/mfa', 'confirm')} className="auth-form"><label>Six-digit code<input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" required maxLength={6} /></label><button disabled={busy} className="button primary">Confirm authenticator</button></form></> : <form onSubmit={event => formAction(event, '/api/auth/mfa', 'begin')} className="auth-form"><label>Current password<input type="password" name="password" autoComplete="current-password" required /></label><button disabled={busy} className="button primary">Set up two-factor authentication</button></form>}
      {!!recovery.length && <div className="recovery-panel"><h3>Save your recovery codes</h3><p className="muted small">Each code works once. Store these securely before leaving this page.</p><pre>{recovery.join('\n')}</pre><button className="button secondary" onClick={() => setRecovery([])}>I saved these codes</button></div>}
    </section>
    <section className="card"><h2>Change password</h2><form className="auth-form" onSubmit={event => formAction(event, '/api/auth/security', 'password')}><label>Current password<input name="currentPassword" type="password" autoComplete="current-password" required /></label><label>New password<input name="newPassword" type="password" minLength={12} maxLength={72} autoComplete="new-password" required /></label>{security?.mfaEnabled && <label>Authenticator or recovery code<input name="code" autoComplete="one-time-code" required maxLength={40} /></label>}<button className="button primary" disabled={busy}>Update password</button></form></section>
    <section className="card"><h2>Active sessions</h2><p className="muted">Sessions expire after 12 hours. Sign out any session you no longer need.</p>{security?.sessions.map(session => <div key={session.id} className="session-row"><div><strong>{session.id === security.currentSessionId ? 'This session' : 'Another session'}</strong><p className="muted small">Started {new Date(session.createdAt).toLocaleString()}</p></div><button className="button secondary" disabled={busy} onClick={() => void action('/api/auth/security', { action: 'revoke', sessionId: session.id })}>Sign out</button></div>)}</section>
  </div>;
}
