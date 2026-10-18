'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { authClient } from '@/lib/auth-client';
import { Brand, Button, ErrorMessage } from './ui';
export function SignIn({ demo }: { demo: boolean }) {
  const { register, handleSubmit, setValue } = useForm<{ email: string; password: string }>();
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [twoFactor, setTwoFactor] = useState(false),
    [code, setCode] = useState(''),
    [backup, setBackup] = useState(false);
  async function submit(values: { email: string; password: string }) {
    setBusy(true);
    setError('');
    try {
      const result = await authClient.signIn.email(values);
      if (result.error) throw new Error('Sign-in failed. Check your credentials and try again.');
      if ('twoFactorRedirect' in (result.data ?? {})) {
        setTwoFactor(true);
        return;
      }
      window.location.assign('/workspace');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-layout">
      <aside className="auth-story">
        <Brand />
        <div>
          <p className="eyebrow">ASSESSMENT, IN CONTEXT</p>
          <h1>
            A little clarity.
            <br />
            At your own pace.
          </h1>
          <p className="muted">
            Your perspective is the starting point.
            <br />
            Professional judgment remains with people.
          </p>
        </div>
        <p className="fineprint">Not a diagnostic system or emergency service.</p>
      </aside>
      <main className="auth-form">
        <p className="eyebrow">WELCOME TO CLEARFRAME</p>
        <h1>{twoFactor ? 'One more step.' : 'A space to begin.'}</h1>
        <p className="muted">
          {twoFactor
            ? 'Enter the code from your authenticator.'
            : 'Sign in to your secure workspace.'}
        </p>
        <ErrorMessage message={error} />
        {twoFactor ? (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              const result = backup
                ? await authClient.twoFactor.verifyBackupCode({ code })
                : await authClient.twoFactor.verifyTotp({ code });
              setBusy(false);
              if (result.error) setError('The verification code was not accepted.');
              else window.location.assign('/workspace');
            }}
          >
            <div className="field">
              <label htmlFor="totp">{backup ? 'Backup code' : 'Authenticator code'}</label>
              <input
                id="totp"
                inputMode={backup ? 'text' : 'numeric'}
                autoComplete="one-time-code"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </div>
            <Button disabled={busy}>Verify & continue</Button>
            <button
              className="text-link"
              type="button"
              style={{ marginTop: 16 }}
              onClick={() => {
                setBackup(!backup);
                setCode('');
              }}
            >
              {backup ? 'Use authenticator code' : 'Use a backup code'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleSubmit(submit)}>
            <div className="field">
              <label htmlFor="email">Email address</label>
              <input
                id="email"
                type="email"
                autoComplete="username"
                required
                {...register('email', { required: true })}
              />
            </div>
            <div className="field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                {...register('password', { required: true })}
              />
            </div>
            <Button disabled={busy}>{busy ? 'Signing in…' : 'Sign in to workspace'}</Button>
          </form>
        )}
        <Link className="text-link" href="/recovery">
          Forgot your password?
        </Link>
        {demo && !twoFactor && (
          <div className="auth-demo" style={{ marginTop: 28 }}>
            <strong>Synthetic demo accounts</strong>
            <p style={{ margin: '8px 0' }}>
              Choose a role, then sign in. Enter synthetic information only.
            </p>
            <div className="button-row">
              {[
                ['Participant', 'alex'],
                ['Reviewer', 'reviewer'],
                ['Operations', 'admin'],
              ].map(([label, email]) => (
                <Button
                  secondary
                  key={email}
                  onClick={() => {
                    setValue('email', `${email}@demo.invalid`);
                    setValue('password', 'Clearframe-demo-2026!');
                  }}
                >
                  {label}
                </Button>
              ))}
            </div>
            <p className="code-secret" style={{ margin: '10px 0 0' }}>
              Password: Clearframe-demo-2026!
            </p>
          </div>
        )}
        <p className="fineprint" style={{ marginTop: 25 }}>
          Need help now?{' '}
          <Link href="/urgent-help" className="text-link">
            Get urgent help
          </Link>
        </p>
      </main>
    </div>
  );
}
