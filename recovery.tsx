'use client';
import { useState, useEffect } from 'react';
import { authClient } from '@/lib/auth-client';
import { Button, ErrorMessage, Notice } from './ui';
export function Recovery({ enabled }: { enabled: boolean }) {
  const [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [token, setToken] = useState(''),
    [message, setMessage] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  useEffect(() => setToken(new URLSearchParams(window.location.search).get('token') ?? ''), []);
  if (!enabled)
    return (
      <Notice>
        Email recovery is not configured for this local demo. Use the documented demo credentials.
        For a deployed service, contact your organization’s administrator through an independently
        verified channel.
      </Notice>
    );
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError('');
        try {
          if (token) {
            const r = await authClient.resetPassword({ newPassword: password, token });
            if (r.error) throw new Error('Reset link is invalid or expired. Request a new one.');
            setMessage('Password reset. You can now sign in.');
          } else {
            await authClient.requestPasswordReset({ email, redirectTo: '/recovery' });
            setMessage('If this account is eligible, a reset email will be sent.');
          }
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <ErrorMessage message={error} />
      {message && <p role="status">{message}</p>}
      <div className="field">
        <label htmlFor="recovery-field">
          {token ? 'New password (14+ characters)' : 'Email address'}
        </label>
        <input
          id="recovery-field"
          type={token ? 'password' : 'email'}
          required
          minLength={token ? 14 : undefined}
          value={token ? password : email}
          onChange={(e) => (token ? setPassword(e.target.value) : setEmail(e.target.value))}
          autoComplete={token ? 'new-password' : 'email'}
        />
      </div>
      <Button disabled={busy}>
        {busy ? 'Working…' : token ? 'Reset password' : 'Request reset link'}
      </Button>
    </form>
  );
}
