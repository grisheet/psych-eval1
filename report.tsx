'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api, date } from '@/lib/api';
import type { readReport } from '@/server/report-service';
import { MSE_FIELDS, REPORT_FIELDS, type ReportSnapshot } from '@/domain/types';
import { useWorkspace } from './workspace';
import { PageTitle, Card, Button, Badge, Notice, ErrorMessage } from './ui';
import { AnswerText } from './questionnaire';
type ReportRecord = Awaited<ReturnType<typeof readReport>>;
export function ReportPage({ id }: { id: string }) {
  const [record, setRecord] = useState<ReportRecord | null>(null),
    [error, setError] = useState('');
  useEffect(() => {
    api<ReportRecord>(`report/${id}`)
      .then(setRecord)
      .catch((e) => setError(e.message));
  }, [id]);
  if (!record)
    return (
      <>
        <ErrorMessage message={error} />
        {!error && <p role="status">Loading report…</p>}
      </>
    );
  return <ReportEditor key={id} record={record} setRecord={setRecord} />;
}
function ReportEditor({
  record,
  setRecord,
}: {
  record: ReportRecord;
  setRecord: (r: ReportRecord) => void;
}) {
  const { data } = useWorkspace(),
    router = useRouter();
  const [snapshot, setSnapshot] = useState(record.snapshot),
    [preview, setPreview] = useState(record.status === 'finalized'),
    [attested, setAttested] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false),
    [reason, setReason] = useState(''),
    [dirty, setDirty] = useState(false);
  const editable = data.actor.role === 'clinician' && record.status === 'draft';
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    const click = (e: MouseEvent) => {
      if (
        dirty &&
        (e.target as HTMLElement).closest('a') &&
        !window.confirm('Leave without saving report changes?')
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('beforeunload', warn);
    document.addEventListener('click', click, true);
    return () => {
      window.removeEventListener('beforeunload', warn);
      document.removeEventListener('click', click, true);
    };
  }, [dirty]);
  async function save(finalize = false) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await api<ReportRecord>('action', {
        action: 'report-save',
        id: record.id,
        revision: record.revision,
        fields: { narrative: snapshot.narrative, observations: snapshot.observations },
        finalize,
        attested,
      });
      setRecord({ ...result, participantId: record.participantId });
      setSnapshot(result.snapshot);
      setDirty(false);
      setMessage(finalize ? 'Demo report finalized. This version is immutable.' : 'Draft saved.');
      if (finalize) setPreview(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="print-controls" style={{ display: 'block' }}>
        <PageTitle
          eyebrow="PROFESSIONAL REPORT"
          title={`Assessment review · v${record.number}`}
          description="A point-in-time record of submitted information and explicitly entered review."
        />
        <ErrorMessage message={error} />
        {message && (
          <p className="success" role="status">
            {message}
          </p>
        )}
        <div className="button-row" style={{ marginBottom: 20 }}>
          {editable && (
            <>
              <Button secondary onClick={() => setPreview(!preview)}>
                {preview ? 'Return to editor' : 'Preview report'}
              </Button>
              <Button secondary disabled={busy} onClick={() => void save()}>
                Save draft
              </Button>
            </>
          )}
          <Button
            secondary
            disabled={dirty}
            onClick={() => {
              setPreview(true);
              setTimeout(() => window.print(), 50);
            }}
          >
            Print / Save as PDF
          </Button>
          <Badge tone={record.status === 'finalized' ? 'green' : 'gold'}>
            {record.status.toUpperCase()}
          </Badge>
          {dirty && <span className="save-status">Unsaved changes — save before printing</span>}
        </div>
      </div>
      {preview || !editable ? (
        <ReportPreview record={record} snapshot={snapshot} />
      ) : (
        <>
          <Notice>
            Draft · Not a professional opinion until explicitly reviewed. All source measures are
            demonstration content. Blank observations remain “not assessed.”
          </Notice>
          <Card>
            <h2>Clinician-authored narrative</h2>
            {REPORT_FIELDS.map((f) => (
              <div className="field" key={f}>
                <label htmlFor={`n-${f}`}>
                  {f}
                  {['Follow-up plan', 'Interpretation limitations'].includes(f)
                    ? ' (required to finalize)'
                    : ''}
                </label>
                <textarea
                  id={`n-${f}`}
                  value={snapshot.narrative[f] || ''}
                  maxLength={6000}
                  onChange={(e) => {
                    setDirty(true);
                    setAttested(false);
                    setSnapshot({
                      ...snapshot,
                      narrative: { ...snapshot.narrative, [f]: e.target.value },
                    });
                  }}
                />
              </div>
            ))}
          </Card>
          <Card>
            <h2>Mental status examination</h2>
            <p className="muted">
              Direct clinician observations only. Participant responses never auto-populate this
              template.
            </p>
            {MSE_FIELDS.map((f) => {
              const observation = snapshot.observations[f];
              return (
                <div className="field" key={f}>
                  <label htmlFor={`o-${f}`}>{f}</label>
                  <select
                    id={`o-${f}`}
                    value={observation.status}
                    onChange={(e) => {
                      setDirty(true);
                      setAttested(false);
                      setSnapshot({
                        ...snapshot,
                        observations: {
                          ...snapshot.observations,
                          [f]: {
                            ...observation,
                            status: e.target.value as typeof observation.status,
                            text: e.target.value === 'observed' ? observation.text : '',
                          },
                        },
                      });
                    }}
                  >
                    <option value="not-assessed">Not assessed</option>
                    <option value="unable-to-assess">Unable to assess</option>
                    <option value="observed">Direct observation entered</option>
                  </select>
                  {observation.status === 'observed' && (
                    <textarea
                      aria-label={`${f} observation`}
                      value={observation.text}
                      maxLength={2000}
                      onChange={(e) => {
                        setDirty(true);
                        setAttested(false);
                        setSnapshot({
                          ...snapshot,
                          observations: {
                            ...snapshot.observations,
                            [f]: { ...observation, text: e.target.value },
                          },
                        });
                      }}
                      style={{ marginTop: 10 }}
                    />
                  )}
                </div>
              );
            })}
          </Card>
        </>
      )}
      {editable && (
        <Card className="print-controls" style={{ display: 'block', marginTop: 25 }}>
          <h2>Explicit review & finalization</h2>
          <p className="muted">
            This creates a permanent demo report version. Changes after finalization require an
            amendment. The report will be visible to the participant.
          </p>
          <label className="check-label">
            <input
              type="checkbox"
              checked={attested}
              onChange={(e) => setAttested(e.target.checked)}
            />
            I reviewed the source responses, documented the limitations and follow-up plan, and
            confirm the content of this demo report. I understand it is not clinically validated.
          </label>
          <Button disabled={busy || !attested} onClick={() => void save(true)}>
            Finalize reviewed demo report
          </Button>
        </Card>
      )}
      {!editable && data.actor.role === 'clinician' && (
        <Card className="print-controls" style={{ display: 'block', marginTop: 25 }}>
          <h2>Create an amendment</h2>
          <p className="muted">
            The signed version stays unchanged. A new draft preserves its link to this version.
          </p>
          <div className="field">
            <label htmlFor="amendment">Reason for amendment</label>
            <textarea
              id="amendment"
              maxLength={1500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <Button
            disabled={busy || reason.trim().length < 8}
            onClick={async () => {
              setBusy(true);
              setError('');
              try {
                const r = await api<{ id: string }>('action', {
                  action: 'report-amend',
                  id: record.id,
                  reason,
                });
                router.push(`/workspace/report/${r.id}`);
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Create amendment draft
          </Button>
        </Card>
      )}
    </>
  );
}
export function ReportPreview({
  record,
  snapshot,
}: {
  record: ReportRecord;
  snapshot: ReportSnapshot;
}) {
  return (
    <article className="report">
      {record.status === 'draft' && (
        <div className="draft-watermark" aria-hidden="true">
          DRAFT · DEMO
        </div>
      )}
      <div className="report-label">
        DEMONSTRATION — NOT FOR CLINICAL USE{' '}
        {record.status === 'draft' ? '· DRAFT · NOT FINALIZED' : ''}
      </div>
      <header className="report-header">
        <p className="eyebrow">CLEARFRAME / ASSESSMENT SUPPORT</p>
        <h1>Assessment review</h1>
        <p>{snapshot.participantName}</p>
        <div className="report-metadata">
          <span>Participant ID: {snapshot.participantId}</span>
          <span>
            Version {record.number} · {record.status}
          </span>
          <span>Created {date(record.createdAt)}</span>
        </div>
      </header>
      {record.amendmentReason && (
        <section>
          <h2>Amendment to prior version</h2>
          <p>{record.amendmentReason}</p>
          <p className="fineprint">Parent version: {record.parentVersionId}</p>
        </section>
      )}
      <section>
        <h2>Consent & administration context</h2>
        <p>
          Self-guided adult demonstration; submissions are not monitored. No external AI was used.
          Internal notes are excluded.
        </p>
        {snapshot.consent.map((c, i) => (
          <p key={i} className="fineprint">
            Consent {c.version} · {date(c.createdAt)} · Scope {c.scope}
          </p>
        ))}
      </section>
      {REPORT_FIELDS.map((f) => (
        <section key={f}>
          <h2>{f}</h2>
          <p>{snapshot.narrative[f] || 'Not entered by reviewer.'}</p>
        </section>
      ))}
      <section>
        <h2>Behavioral observations · direct clinician entry</h2>
        {MSE_FIELDS.map((f) => (
          <p key={f}>
            <strong>{f}:</strong>{' '}
            {snapshot.observations[f]?.status === 'observed'
              ? snapshot.observations[f].text || 'Observation text not entered'
              : snapshot.observations[f]?.status === 'unable-to-assess'
                ? 'Unable to assess'
                : 'Not assessed'}
          </p>
        ))}
      </section>
      <section>
        <h2>Measures & original participant reports</h2>
        {snapshot.measures.map((m, i) => (
          <div key={i}>
            <h3>
              {m.name} · v{m.version}
            </h3>
            <p className="fineprint">
              Submitted {date(m.submittedAt)} · Original demo content · Not validated
            </p>
            <p>{m.result?.explanation || 'No derived result available.'}</p>
            {m.result && (
              <p>
                Completeness: {m.result.answered}/{m.result.total} visible prompts contain
                responses. Missing states are preserved. Algorithm: {m.result.algorithmVersion}.
              </p>
            )}
            <dl>
              {Object.entries(m.answers).map(([key, answer]) => (
                <div className="answer-row" key={key}>
                  <dt>{key} · self-reported</dt>
                  <dd>
                    <AnswerText answer={answer} />
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </section>
      <section>
        <h2>Review, provenance & signature</h2>
        <p>
          Reviewer: {snapshot.reviewerName}.{' '}
          {snapshot.credentialsVerified
            ? `Verified credentials: ${snapshot.credentials}`
            : 'Professional credentials are not verified. Demo identity only.'}
        </p>
        <p>
          {record.status === 'finalized'
            ? `Explicitly reviewed and finalized ${date(record.signedAt)}. Signer account: ${record.signedBy}.`
            : 'DRAFT — not signed or finalized. No professional opinion is implied.'}
        </p>
        <p className="fineprint">
          Report ID: {record.reportId} · Version ID: {record.id}. A finalized version is preserved;
          amendments create a new version.
        </p>
      </section>
    </article>
  );
}
