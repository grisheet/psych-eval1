'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { api, date } from '@/lib/api';
import { useWorkspace, type ParticipantData } from './workspace';
import { PageTitle, Card, Button, ErrorMessage, Notice, Badge, Empty, ActionLink } from './ui';
export function ConsentPage() {
  const { data, refresh } = useWorkspace();
  const router = useRouter();
  const [adult, setAdult] = useState(false),
    [accepted, setAccepted] = useState(false),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  return (
    <>
      <PageTitle
        eyebrow="01 / UNDERSTAND & CONSENT"
        title="Begin with clear expectations."
        description="Please read this before sharing assessment information."
      />
      <div className="form-container">
        <Card>
          <Badge tone="gold">VERSION {data.settings.consentVersion}</Badge>
          <h2 style={{ marginTop: 22 }}>What you need to know</h2>
          <p>{data.settings.consentText}</p>
          <hr className="section-divider" />
          <p className="fineprint">
            Research, analytics, and AI processing are disabled. There are no optional permissions
            to accept.
          </p>
        </Card>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setError('');
            setBusy(true);
            try {
              await api('action', {
                action: 'consent',
                version: data.settings.consentVersion,
                adult,
                accepted,
              });
              await refresh();
              router.push('/workspace/profile');
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <Card>
            <label className="check-label">
              <input
                type="checkbox"
                checked={adult}
                onChange={(e) => setAdult(e.target.checked)}
                required
              />
              I am 18 or older. I understand this demo does not support minors.
            </label>
            <label className="check-label">
              <input
                type="checkbox"
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
                required
              />
              I have read the information above and consent to storage of my synthetic responses and
              access by assigned reviewers.
            </label>
            <ErrorMessage message={error} />
            <Button disabled={busy || !accepted || !adult}>
              {busy ? 'Recording consent…' : 'Agree & continue'}
            </Button>
          </Card>
        </form>
      </div>
    </>
  );
}
type ProfileForm = {
  preferredName: string;
  pronouns: string;
  language: string;
  timezone: string;
  accessibility: string;
  contactPreference: 'In-app only' | 'No optional contact';
  adult: boolean;
};
export function ProfilePage() {
  const { data: raw, refresh } = useWorkspace(),
    data = raw as ParticipantData;
  const router = useRouter();
  const { register, handleSubmit } = useForm<ProfileForm>({
    defaultValues: {
      preferredName: data.profile?.preferredName || '',
      pronouns: data.profile?.pronouns || '',
      language: data.profile?.language || 'English',
      timezone: data.profile?.timezone || 'America/New_York',
      accessibility: data.profile?.accessibility || '',
      contactPreference:
        (data.profile?.contactPreference as ProfileForm['contactPreference']) || 'In-app only',
      adult: true,
    },
  });
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  if (!data.consent)
    return (
      <Notice>
        Consent is required before entering profile information.{' '}
        <Link className="text-link" href="/workspace/consent">
          Review consent
        </Link>
      </Notice>
    );
  return (
    <>
      <PageTitle
        eyebrow="02 / A LITTLE CONTEXT"
        title="Make this space work for you."
        description="We collect only the preferences needed for this demonstration. Date of birth is not requested."
      />
      <form
        className="form-container"
        onSubmit={handleSubmit(async (values) => {
          setBusy(true);
          setError('');
          try {
            await api('action', { action: 'profile', profile: values });
            await refresh();
            router.push('/workspace/library');
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        })}
      >
        <Card>
          <div className="form-grid">
            {[
              ['preferredName', 'Preferred name'],
              ['pronouns', 'Pronouns (optional)'],
              ['language', 'Preferred language'],
              ['timezone', 'Time zone (IANA name)'],
            ].map(([key, label]) => (
              <div className="field" key={key}>
                <label htmlFor={key}>{label}</label>
                <input
                  id={key}
                  maxLength={100}
                  {...register(key as keyof ProfileForm)}
                  required={key !== 'pronouns'}
                />
              </div>
            ))}
          </div>
          <div className="field">
            <label htmlFor="accessibility">Accessibility needs (optional)</label>
            <textarea id="accessibility" maxLength={1500} {...register('accessibility')} />
          </div>
          <div className="field">
            <label htmlFor="contactPreference">Contact preference</label>
            <select id="contactPreference" {...register('contactPreference')}>
              <option>In-app only</option>
              <option>No optional contact</option>
            </select>
            <small>No assessment notifications are sent by this demo.</small>
          </div>
          <ErrorMessage message={error} />
          <Button disabled={busy}>{busy ? 'Saving…' : 'Save & explore assessments'}</Button>
        </Card>
      </form>
    </>
  );
}
export function LibraryPage() {
  const { data: raw, refresh } = useWorkspace(),
    data = raw as ParticipantData;
  const router = useRouter();
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(''),
    [query, setQuery] = useState('');
  return (
    <>
      <PageTitle
        eyebrow="ASSESSMENT LIBRARY"
        title="Choose what matters to you."
        description="Start with your context and goals, then explore optional topics. Every module here is a nonclinical demonstration."
      />
      <Notice>
        Not for clinical use. No validated screening instrument is configured. These prompts
        organize a conversation and do not produce clinical scores.
      </Notice>
      {!data.consent && (
        <div className="card">
          <p>Review and accept consent before starting.</p>
          <ActionLink href="/workspace/consent">Review consent</ActionLink>
        </div>
      )}
      <ErrorMessage message={error} />
      <div className="filter-bar">
        <input
          aria-label="Search assessment library"
          placeholder="Find a topic…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="module-list">
        {data.library
          .filter((m) => m.enabled && m.name.toLowerCase().includes(query.toLowerCase()))
          .map((m) => {
            const draft = data.records.find((r) => r.versionId === m.id && r.status === 'draft');
            return (
              <Card className="module-card" key={m.id}>
                <div className="module-meta">
                  <Badge tone={m.definition.id === 'intake' ? 'green' : 'neutral'}>
                    {m.definition.id === 'intake' ? 'CORE INTAKE' : 'OPTIONAL TOPIC'}
                  </Badge>
                  <span>{m.definition.sections.flatMap((s) => s.items).length} prompts</span>
                </div>
                <h2>{m.name}</h2>
                <p>{m.definition.purpose}</p>
                <div className="module-meta">
                  <span>Version {m.definition.version}</span>
                  <span>
                    {data.assigned.some((a) => a.versionId === m.id)
                      ? 'Assigned by service'
                      : 'At your pace'}
                  </span>
                </div>
                <div className="button-row">
                  <Button
                    secondary
                    disabled={!!busy || !data.consent}
                    onClick={async () => {
                      setBusy(m.id);
                      setError('');
                      try {
                        const r = await api<{ id: string }>('action', {
                          action: 'start',
                          versionId: m.id,
                        });
                        await refresh();
                        router.push(`/workspace/assessment/${r.id}`);
                      } catch (e) {
                        setError((e as Error).message);
                      } finally {
                        setBusy('');
                      }
                    }}
                  >
                    {busy === m.id ? 'Opening…' : draft ? 'Resume draft' : 'Start module'}
                  </Button>
                  <Badge tone="gold">DEMO · UNSCORED</Badge>
                </div>
              </Card>
            );
          })}
      </div>
      {!data.library.some(
        (m) => m.enabled && m.name.toLowerCase().includes(query.toLowerCase()),
      ) && <Empty title="No matching modules">Try another topic.</Empty>}
    </>
  );
}
export function HistoryPage() {
  const { data: raw } = useWorkspace(),
    data = raw as ParticipantData;
  return (
    <>
      <PageTitle
        eyebrow="YOUR RECORD"
        title="Your perspective, over time."
        description="Saved assessments and finalized demo reports. No clinical trends or score comparisons are inferred."
      />
      <Card>
        <h2>Assessments</h2>
        {data.records.length ? (
          data.records.map((r) => (
            <div className="row" key={r.id}>
              <div>
                <h3>{r.name}</h3>
                <p>
                  {date(r.updatedAt)} · {r.versionId}
                </p>
              </div>
              <Badge tone={r.status === 'draft' ? 'gold' : 'green'}>{r.status}</Badge>
              <Link className="button secondary" href={`/workspace/assessment/${r.id}`}>
                {r.status === 'draft' ? 'Resume' : 'View summary'}
              </Link>
            </div>
          ))
        ) : (
          <Empty title="No assessments yet">
            <Link href="/workspace/library" className="text-link">
              Explore the library
            </Link>
          </Empty>
        )}
      </Card>
      <Card>
        <h2>Shared report versions</h2>
        {data.reports.length ? (
          data.reports.map((r) => (
            <div className="row" key={r.id}>
              <div>
                <h3>Assessment review · version {r.number}</h3>
                <p>
                  Finalized {date(r.signedAt)}
                  {r.amendmentReason ? ` · Amendment: ${r.amendmentReason}` : ''}
                </p>
              </div>
              <ActionLink secondary href={`/workspace/report/${r.id}`}>
                Open report
              </ActionLink>
            </div>
          ))
        ) : (
          <Empty title="No finalized reports">
            Reports appear here only after explicit reviewer finalization.
          </Empty>
        )}
      </Card>
    </>
  );
}
