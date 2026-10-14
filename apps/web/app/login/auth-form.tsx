'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export function AuthForm({ mode, referralCode = '', invitationToken = '' }: { mode: 'login' | 'register' | 'join'; referralCode?: string; invitationToken?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [challenge, setChallenge] = useState<string | null>(null);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError('');
    const form = new FormData(event.currentTarget);
    const body = challenge ? { action: 'challenge', challengeToken: challenge, code: String(form.get('code') ?? '').trim() } : mode === 'login' ? { email: form.get('email'), password: form.get('password') } : mode === 'join' ? { token: invitationToken, firstName: form.get('firstName'), lastName: form.get('lastName'), password: form.get('password') } : { clinicName: form.get('clinicName'), firstName: form.get('firstName'), lastName: form.get('lastName'), email: form.get('email'), password: form.get('password'), ...(form.get('referralCode') ? { referralCode: form.get('referralCode') } : {}) };
    try {
      const endpoint = challenge ? '/api/auth/mfa' : mode === 'join' ? '/api/auth/accept-invite' : `/api/auth/${mode}`;
      const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Please try again.');
      if (data.mfaRequired) { setChallenge(data.challengeToken); return; }
      const destination = typeof data.redirect === 'string' && /^\/(dashboard|setup|account|platform)(\?|$|\/)/.test(data.redirect) ? data.redirect : '/dashboard';
      router.replace(destination); router.refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Connection interrupted. Please try again.'); }
    finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="auth-form">
    <h1>{challenge ? 'One more step' : mode === 'login' ? 'Welcome back.' : mode === 'join' ? 'Join your care team.' : 'Make room for better care.'}</h1>
    <p className="muted">{challenge ? 'Enter the code from your authenticator or an unused recovery code.' : mode === 'login' ? 'Your clinic workspace is ready when you are.' : mode === 'join' ? 'Create your secure account to accept this invitation.' : 'Your 14-day trial includes 10 initial consultations.'}</p>
    {error && <div role="alert" className="alert error">{error}</div>}
    {challenge ? <label>Authenticator or recovery code<input name="code" required autoComplete="one-time-code" autoFocus maxLength={40} /></label> : <>
      {mode === 'register' && <label>Clinic name<input name="clinicName" required minLength={2} maxLength={100} autoComplete="organization" /></label>}
      {mode !== 'login' && <div className="form-grid"><label>First name<input name="firstName" required maxLength={60} autoComplete="given-name" /></label><label>Last name<input name="lastName" required maxLength={60} autoComplete="family-name" /></label></div>}
      {mode !== 'join' && <label>Email<input name="email" type="email" required autoComplete="email" maxLength={254} /></label>}
      <label>Password<input name="password" type="password" required minLength={mode === 'login' ? 1 : 12} maxLength={72} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />{mode !== 'login' && <span className="muted small">Use at least 12 characters.</span>}</label>
      {mode === 'register' && <label>Referral code <span className="muted">(optional)</span><input name="referralCode" defaultValue={referralCode} maxLength={40} autoComplete="off" /></label>}
    </>}
    <button className="button primary full-width" disabled={busy} type="submit">{busy ? 'Working…' : challenge ? 'Verify and sign in' : mode === 'login' ? 'Sign in' : mode === 'join' ? 'Accept invitation' : 'Create clinic workspace'}</button>
    {challenge && <button className="button secondary" type="button" onClick={() => { setChallenge(null); setError(''); }}>Back to sign in</button>}
    <p className="muted small">{mode === 'login' ? <>New to DripWell? <Link href="/register">Start your trial</Link></> : <>Already have an account? <Link href="/login">Sign in</Link></>}</p>
  </form>;
}
