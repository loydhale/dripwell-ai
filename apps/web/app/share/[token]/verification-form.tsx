'use client';
import { useState, type FormEvent } from 'react';

export function VerificationForm({ token }: { token: string }) {
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function requestCode() {
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch(`/api/share/${encodeURIComponent(token)}/code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
        cache: 'no-store',
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'The code could not be sent.');
      setSent(true);
      setMessage('Check the intended recipient’s email for a six-digit access code.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The code could not be sent.');
    } finally {
      setBusy(false);
    }
  }
  async function verify(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch(`/api/share/${encodeURIComponent(token)}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
        cache: 'no-store',
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'The code could not be verified.');
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The code could not be verified.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <p>
        This document is private. Verify access with a code sent to the recipient your clinic
        selected.
      </p>
      <button type="button" className="button primary" onClick={requestCode} disabled={busy}>
        {busy ? 'Please wait…' : sent ? 'Send a new code' : 'Send access code'}
      </button>
      {sent && (
        <form onSubmit={verify} style={{ marginTop: 24 }}>
          <label htmlFor="access-code">Six-digit code</label>
          <input
            id="access-code"
            autoComplete="one-time-code"
            inputMode="numeric"
            pattern="[0-9]{6}"
            minLength={6}
            maxLength={6}
            required
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
            style={{ display: 'block', margin: '8px 0 16px', width: '100%' }}
          />
          <button className="button primary" disabled={busy || code.length !== 6} type="submit">
            {busy ? 'Verifying…' : 'Open my document'}
          </button>
        </form>
      )}
      {message && (
        <p role="status" aria-live="polite" style={{ marginTop: 20 }}>
          {message}
        </p>
      )}
      <p style={{ fontSize: 13, marginTop: 24 }}>
        Only the selected recipient should use this code. Contact your clinic if you need a
        different recipient or a fresh share link.
      </p>
    </div>
  );
}
