'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { participantDetail } from '@/server/workspace-service';
import { api, date } from '@/lib/api';
import { PageTitle, Card, Button, Badge, Notice, ErrorMessage, Empty, ActionLink } from './ui';
export function ParticipantDetail({ id }: { id: string }) {
  const [record, setRecord] = useState<Awaited<ReturnType<typeof participantDetail>> | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [source, setSource] = useState('Direct clinician observation'),
    [note, setNote] = useState('');
  const router = useRouter();
  async function load() {
    setRecord(await api(`participant/${id}`));
  }
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [id]);
  if (!record)
    return (
      <>
        <ErrorMessage message={error} />
        {!error && <p role="status">Loading assigned participant…</p>}
      </>
    );
  return (
    <>
      <PageTitle
        eyebrow="ASSIGNED PARTICIPANT"
        title={record.profile?.preferredName || record.person.name}
        description="Keep self-report, observed information, and professional interpretation distinct."
        action={
          <Button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError('');
              try {
                const r = await api<{ id: string }>('action', {
                  action: 'report-create',
                  participantId: id,
                });
                router.push(`/workspace/report/${r.id}`);
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Create draft report
          </Button>
        }
      />
      <ErrorMessage message={error} />
      <div className="dashboard-grid">
        <div>
          <Card>
            <h2>Assessment record</h2>
            {record.records.length ? (
              record.records.map((r) => (
                <div className="row" key={r.id}>
                  <div>
                    <h3>{r.name}</h3>
                    <p>
                      {date(r.updatedAt)} · {r.versionId}
                    </p>
                  </div>
                  <Badge tone={r.status === 'submitted' ? 'gold' : 'neutral'}>{r.status}</Badge>
                  <Link href={`/workspace/assessment/${r.id}`} className="button secondary">
                    Review responses
                  </Link>
                </div>
              ))
            ) : (
              <Empty title="No assessments yet">
                The participant can start after completing consent.
              </Empty>
            )}
          </Card>
          <Card>
            <h2>Report history</h2>
            {record.reports.length ? (
              record.reports.map((r) => (
                <div className="row" key={r.id}>
                  <div>
                    <h3>Report version {r.number}</h3>
                    <p>
                      {r.status} · {date(r.signedAt || r.createdAt)}
                    </p>
                    {r.amendmentReason && <p>Amendment: {r.amendmentReason}</p>}
                  </div>
                  <ActionLink secondary href={`/workspace/report/${r.id}`}>
                    Open report
                  </ActionLink>
                </div>
              ))
            ) : (
              <Empty title="No reports created">
                Create a draft after at least one assessment has been submitted.
              </Empty>
            )}
          </Card>
          <Card>
            <h2>Internal clinical notes</h2>
            <Notice>
              These notes are restricted to assigned reviewers and excluded from participant exports
              and reports.
            </Notice>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setError('');
                try {
                  await api('action', { action: 'note', participantId: id, source, text: note });
                  setNote('');
                  await load();
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <div className="field">
                <label htmlFor="note-source">Information source</label>
                <select id="note-source" value={source} onChange={(e) => setSource(e.target.value)}>
                  {[
                    'Participant report',
                    'Direct clinician observation',
                    'Third-party information',
                    'Clinician interpretation',
                  ].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="note">Note</label>
                <textarea
                  id="note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={6000}
                  required
                />
              </div>
              <Button disabled={busy}>Add internal note</Button>
            </form>
            {record.notes.map((n) => (
              <div key={n.id} className="answer-row">
                <Badge>{n.source}</Badge>
                <p style={{ marginTop: 12, whiteSpace: 'pre-wrap' }}>{n.body}</p>
                <small className="muted">
                  {date(n.createdAt)} · Author ID {n.authorId}
                </small>
              </div>
            ))}
          </Card>
        </div>
        <div>
          <Card>
            <h2>Participant preferences</h2>
            {record.profile ? (
              <dl>
                {[
                  ['Language', record.profile.language],
                  ['Time zone', record.profile.timezone],
                  ['Pronouns', record.profile.pronouns],
                  ['Accessibility', record.profile.accessibility],
                  ['Contact', record.profile.contactPreference],
                ].map(([k, v]) => (
                  <div key={k} className="answer-row">
                    <dt>{k}</dt>
                    <dd>{v || 'Not provided'}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p>No preferences entered.</p>
            )}
          </Card>
          <Notice>
            Assessment history is self-reported. Nothing here independently verifies a diagnosis or
            establishes immediate safety.
          </Notice>
        </div>
      </div>
    </>
  );
}
