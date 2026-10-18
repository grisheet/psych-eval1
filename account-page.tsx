'use client';
import { useState } from 'react';
import Link from 'next/link';
import { authClient } from '@/lib/auth-client';
import { api, date } from '@/lib/api';
import { useWorkspace, type ParticipantData } from './workspace';
import { PageTitle, Card, Notice, Button, ErrorMessage, Badge } from './ui';
export function AccountPage() {
  const { data, refresh } = useWorkspace();
  const [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false),
    [deleting, setDeleting] = useState(false),
    [withdrawing, setWithdrawing] = useState(false),
    [preview, setPreview] = useState<unknown>(null),
    [password, setPassword] = useState(''),
    [setup, setSetup] = useState<{ totpURI: string; backupCodes: string[] } | null>(null),
    [code, setCode] = useState('');
  const participant = data.actor.role === 'participant' ? (data as ParticipantData) : null;
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageTitle
        eyebrow="YOUR ACCOUNT"
        title="Privacy, on your terms."
        description="Review your choices, manage access, and take a copy of your information."
      />
      <ErrorMessage message={error} />
      {message && (
        <p role="status" className="success">
          {message}
        </p>
      )}
      <div className="dashboard-grid">
        <div>
          {participant && (
            <>
              <Card>
                <div className="section-heading">
                  <h2>Consent & preferences</h2>
                  <Badge tone={participant.consent ? 'green' : 'gold'}>
                    {participant.consent ? 'ACTIVE' : 'NOT ACTIVE'}
                  </Badge>
                </div>
                <p className="muted">
                  {participant.consent
                    ? `Version ${participant.consent.version} · accepted ${date(participant.consent.createdAt)}`
                    : 'You have no active consent. New assessment collection and reviewer access are paused.'}
                </p>
                <div className="button-row">
                  <Link href="/workspace/profile" className="button secondary">
                    Edit preferences
                  </Link>
                  <Link href="/workspace/consent" className="button secondary">
                    Review consent
                  </Link>
                </div>
                {participant.consent && (
                  <>
                    <hr className="section-divider" />
                    <p className="muted" style={{ fontSize: '.83rem' }}>
                      Withdrawal stops new assessment collection and assigned reviewer access.
                      Existing records are retained until a separately reviewed deletion process.
                    </p>
                    <label className="check-label">
                      <input
                        type="checkbox"
                        checked={withdrawing}
                        onChange={(e) => setWithdrawing(e.target.checked)}
                      />
                      I want to withdraw consent and pause review access.
                    </label>
                    <Button
                      secondary
                      disabled={busy || !withdrawing}
                      onClick={() =>
                        void run(async () => {
                          await api('action', { action: 'withdraw' });
                          await refresh();
                          setWithdrawing(false);
                          setMessage('Consent withdrawn.');
                        })
                      }
                    >
                      Withdraw consent
                    </Button>
                  </>
                )}
              </Card>
              <Card>
                <h2>Export your information</h2>
                <p className="muted">
                  Preview an export of your profile, consent, raw responses, completeness results,
                  instrument definitions, and finalized reports. Internal reviewer notes are
                  excluded.
                </p>
                <Button
                  secondary
                  disabled={busy}
                  onClick={() => void run(async () => setPreview(await api('export')))}
                >
                  Preview export
                </Button>
                {preview !== null && (
                  <>
                    <details open>
                      <summary>Export preview — JSON</summary>
                      <pre style={{ maxHeight: 350, overflow: 'auto' }}>
                        {JSON.stringify(preview, null, 2)}
                      </pre>
                    </details>
                    <Button
                      onClick={() => {
                        const url = URL.createObjectURL(
                          new Blob([JSON.stringify(preview, null, 2)], {
                            type: 'application/json',
                          }),
                        );
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = 'clearframe-export.json';
                        a.click();
                        URL.revokeObjectURL(url);
                        setMessage('Export downloaded. Store the file privately.');
                      }}
                    >
                      Download reviewed export
                    </Button>
                  </>
                )}
              </Card>
              <Card>
                <h2>Request deletion</h2>
                <p className="muted">
                  This submits a request for operator review. It does not immediately delete your
                  records or backups. No handling time is promised in the demo.
                </p>
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={deleting}
                    onChange={(e) => setDeleting(e.target.checked)}
                  />
                  I want the service operator to review a deletion request.
                </label>
                <Button
                  secondary
                  disabled={busy || !deleting}
                  onClick={() =>
                    void run(async () => {
                      await api('action', { action: 'delete-request', confirmed: true });
                      setDeleting(false);
                      await refresh();
                      setMessage('Deletion request recorded. No data has been deleted.');
                    })
                  }
                >
                  Submit deletion request
                </Button>
                {participant.deletion.map((r) => (
                  <div className="row" key={r.id}>
                    <div>
                      <h3>{r.status}</h3>
                      <p>{date(r.createdAt)}</p>
                      {r.resolution && <p>{r.resolution}</p>}
                    </div>
                  </div>
                ))}
              </Card>
            </>
          )}
          <Card>
            <h2>Account security</h2>
            <p className="muted">
              Two-factor authentication adds a code from your authenticator. It is required for
              privileged accounts in production.
            </p>
            <Badge tone={data.twoFactorEnabled ? 'green' : 'gold'}>
              {data.twoFactorEnabled ? 'TWO-FACTOR ENABLED' : 'TWO-FACTOR NOT ENABLED'}
            </Badge>
            {!data.twoFactorEnabled && !setup && (
              <form
                style={{ marginTop: 22 }}
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(async () => {
                    const result = await authClient.twoFactor.enable({ password });
                    if (result.error)
                      throw new Error(
                        'Could not enable two-factor authentication. Check your password.',
                      );
                    if (result.data.method !== 'totp')
                      throw new Error('TOTP setup is unavailable.');
                    setSetup(result.data);
                    setPassword('');
                  });
                }}
              >
                <div className="field">
                  <label htmlFor="mfa-password">Confirm your password</label>
                  <input
                    id="mfa-password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <Button secondary disabled={busy}>
                  Set up authenticator
                </Button>
              </form>
            )}
            {setup && (
              <>
                <Notice>
                  Store your backup codes somewhere private. They are displayed only during setup.
                </Notice>
                <label>Authenticator setup key</label>
                <p className="code-secret">{new URL(setup.totpURI).searchParams.get('secret')}</p>
                <p className="fineprint">
                  Add this key manually to a TOTP authenticator (6 digits, 30-second interval).
                </p>
                <details>
                  <summary>Backup codes — save privately</summary>
                  <pre>{setup.backupCodes.join('\n')}</pre>
                </details>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void run(async () => {
                      const r = await authClient.twoFactor.verifyTotp({ code });
                      if (r.error) throw new Error('The verification code was not accepted.');
                      setSetup(null);
                      setCode('');
                      await refresh();
                      setMessage('Two-factor authentication enabled.');
                    });
                  }}
                >
                  <div className="field">
                    <label htmlFor="mfa-code">Authenticator code</label>
                    <input
                      id="mfa-code"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      required
                    />
                  </div>
                  <Button disabled={busy}>Verify authenticator</Button>
                </form>
              </>
            )}
            <hr className="section-divider" />
            <Button
              secondary
              onClick={async () => {
                await authClient.signOut();
                window.location.assign('/signin');
              }}
            >
              Sign out
            </Button>
          </Card>
        </div>
        <div>
          <Card>
            <p className="eyebrow">WHO CAN SEE WHAT</p>
            <h2>Access has a purpose.</h2>
            <p className="muted">
              Participants see their own records. Reviewers need an explicit assignment and active
              consent. Administrators manage account and operational metadata.
            </p>
            <p className="muted">
              No advertising, analytics, session replay, research collection, or AI processing is
              enabled.
            </p>
            <Link href="/privacy" className="text-link">
              Read privacy information
            </Link>
          </Card>
        </div>
      </div>
    </>
  );
}
