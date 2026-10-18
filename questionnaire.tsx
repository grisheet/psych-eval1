'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, date } from '@/lib/api';
import { isVisible, visibleItems } from '@/domain/assessment';
import type { Item, Answer, Answers } from '@/domain/types';
import type { readAssessment } from '@/server/assessment-service';
import { useWorkspace } from './workspace';
import { PageTitle, Card, Badge, Button, Notice, ErrorMessage, ActionLink } from './ui';
type RecordData = Awaited<ReturnType<typeof readAssessment>>;
const states: Record<string, string> = {
  unanswered: 'Not answered',
  'prefer-not': 'Prefer not to answer',
  'not-applicable': 'Not applicable',
  unknown: 'Unknown',
};
export function AnswerText({ answer }: { answer: Answer | undefined }) {
  return answer?.state === 'answered' ? (
    <span>
      {Array.isArray(answer.value)
        ? answer.value.join(', ') || 'No selections'
        : String(answer.value) || 'Not answered'}
    </span>
  ) : (
    <span className="answer-state">{states[answer?.state ?? 'unanswered']}</span>
  );
}
function Question({
  item,
  answer,
  onChange,
}: {
  item: Item;
  answer: Answer | undefined;
  onChange: (answer: Answer) => void;
}) {
  const state = answer?.state ?? 'unanswered',
    value = answer?.state === 'answered' ? answer.value : '';
  const set = (value: string | number | string[]) => onChange({ state: 'answered', value });
  return (
    <fieldset className="question">
      <legend>
        {item.label} {!item.required && <span className="optional">· Optional</span>}
      </legend>
      {item.help && <p className="question-help">{item.help}</p>}
      {item.sensitive && (
        <p className="question-help">
          Share only what you want considered. You may skip this question.
        </p>
      )}
      {['single', 'likert'].includes(item.type) &&
        item.options?.map((option) => (
          <label className="choice" key={option}>
            <input
              type="radio"
              name={item.id}
              value={option}
              checked={value === option}
              onChange={() => set(option)}
            />
            {option}
          </label>
        ))}
      {item.type === 'multiple' &&
        item.options?.map((option) => (
          <label className="choice" key={option}>
            <input
              type="checkbox"
              name={item.id}
              checked={Array.isArray(value) && value.includes(option)}
              onChange={(e) =>
                set(
                  e.target.checked
                    ? [...(Array.isArray(value) ? value : []), option]
                    : (Array.isArray(value) ? value : []).filter((v) => v !== option),
                )
              }
            />
            {option}
          </label>
        ))}
      {['short', 'long'].includes(item.type) &&
        (item.type === 'long' ? (
          <textarea
            aria-label={item.label}
            value={String(value)}
            maxLength={4000}
            onChange={(e) => set(e.target.value)}
          />
        ) : (
          <input
            aria-label={item.label}
            value={String(value)}
            maxLength={200}
            onChange={(e) => set(e.target.value)}
          />
        ))}
      {item.type === 'number' && (
        <input
          aria-label={item.label}
          type="number"
          inputMode="numeric"
          min={item.min}
          max={item.max}
          step={1}
          value={String(value)}
          onChange={(e) =>
            e.target.value === '' ? onChange({ state: 'unanswered' }) : set(Number(e.target.value))
          }
        />
      )}
      {item.type === 'date' && (
        <input
          aria-label={item.label}
          type="date"
          max={new Date().toISOString().slice(0, 10)}
          value={String(value)}
          onChange={(e) =>
            e.target.value ? set(e.target.value) : onChange({ state: 'unanswered' })
          }
        />
      )}
      <select
        className="response-state"
        aria-label={`Response choice for ${item.label}`}
        value={state === 'answered' ? 'answered' : state}
        onChange={(e) => {
          if (e.target.value !== 'answered')
            onChange({
              state: e.target.value as 'unanswered' | 'prefer-not' | 'not-applicable' | 'unknown',
            });
        }}
      >
        {state === 'answered' && <option value="answered">Response provided</option>}
        {Object.entries(states).map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </fieldset>
  );
}
export function AssessmentPage({ id }: { id: string }) {
  const [record, setRecord] = useState<RecordData | null>(null),
    [error, setError] = useState('');
  useEffect(() => {
    api<RecordData>(`assessment/${id}`)
      .then(setRecord)
      .catch((e) => setError(e.message));
  }, [id]);
  if (!record)
    return (
      <>
        <ErrorMessage message={error} />
        {error ? (
          <Link className="text-link" href="/workspace">
            Return to workspace
          </Link>
        ) : (
          <p className="loading" role="status">
            Loading assessment…
          </p>
        )}
      </>
    );
  return <Assessment record={record} setRecord={setRecord} />;
}
function Assessment({
  record,
  setRecord,
}: {
  record: RecordData;
  setRecord: (r: RecordData) => void;
}) {
  const { data, refresh } = useWorkspace(),
    router = useRouter();
  const [answers, setAnswers] = useState<Answers>(record.answers),
    [section, setSection] = useState(0),
    [review, setReview] = useState(false),
    [dirty, setDirty] = useState(false),
    [saving, setSaving] = useState(false),
    [error, setError] = useState(''),
    [status, setStatus] = useState('Saved on server'),
    [confirmed, setConfirmed] = useState(false);
  const revision = useRef(record.record.revision),
    current = useRef(answers),
    inFlight = useRef(false),
    heading = useRef<HTMLHeadingElement>(null);
  const editable = data.actor.role === 'participant' && record.record.status === 'draft';
  const definition = record.definition,
    sections = definition.sections;
  current.current = answers;
  const persist = useCallback(
    async (submit = false) => {
      if (inFlight.current) return false;
      inFlight.current = true;
      setSaving(true);
      setError('');
      const snapshot = current.current;
      setStatus(submit ? 'Submitting…' : 'Saving to server…');
      try {
        const result = await api<{
          id: string;
          revision: number;
          status: 'draft' | 'submitted' | 'reviewed';
        }>('action', {
          action: 'save',
          id: record.record.id,
          revision: revision.current,
          answers: snapshot,
          submit,
        });
        revision.current = result.revision;
        setDirty(JSON.stringify(current.current) !== JSON.stringify(snapshot));
        setStatus(submit ? 'Submitted' : 'Saved on server');
        if (submit) {
          setDirty(false);
          const fresh = await api<RecordData>(`assessment/${record.record.id}`);
          setRecord(fresh);
          await refresh();
        }
        return true;
      } catch (e) {
        setError((e as Error).message);
        setStatus('Not saved — keep this window open');
        return false;
      } finally {
        inFlight.current = false;
        setSaving(false);
      }
    },
    [record.record.id, refresh, setRecord],
  );
  useEffect(() => {
    if (!editable || !dirty || saving || error) return;
    const timer = setTimeout(() => void persist(), 1100);
    return () => clearTimeout(timer);
  }, [dirty, answers, saving, editable, persist, error]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    const click = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest('a');
      if (
        dirty &&
        target?.href &&
        target.target !== '_blank' &&
        !window.confirm('Some changes have not been saved. Leave this page?')
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
  useEffect(() => {
    heading.current?.focus();
  }, [section, review]);
  const update = (key: string, value: Answer) => {
    setError('');
    setDirty(true);
    setStatus('Changes waiting to save');
    setAnswers((old) => {
      const next = { ...old, [key]: value };
      for (const item of sections.flatMap((s) => s.items)) {
        if (item.when && !isVisible(item, next)) delete next[item.id];
      }
      return next;
    });
  };
  if (!editable)
    return (
      <>
        <PageTitle
          eyebrow={
            record.record.status === 'draft' ? 'DRAFT RESPONSE REVIEW' : 'STRUCTURED SELF-REPORT'
          }
          title={definition.name}
          description={`Version ${definition.version} · ${record.record.status === 'draft' ? 'Draft is not yet submitted' : `Completed ${date(record.record.submittedAt)}`}`}
        />
        <Notice>
          <strong>DEMONSTRATION — NOT FOR CLINICAL USE.</strong> These responses are not a
          diagnosis.{' '}
          {record.score?.explanation || 'This draft has not been submitted or summarized.'}
        </Notice>
        <div className="button-row" style={{ marginBottom: 24 }}>
          <Badge tone="green">{record.record.status}</Badge>
          {data.actor.role === 'clinician' && record.record.status === 'submitted' && (
            <Button
              onClick={async () => {
                try {
                  await api('action', { action: 'review', id: record.record.id });
                  setRecord({ ...record, record: { ...record.record, status: 'reviewed' } });
                  await refresh();
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              Mark responses reviewed
            </Button>
          )}
          <ActionLink
            secondary
            href={
              data.actor.role === 'clinician'
                ? `/workspace/participant/${record.record.participantId}`
                : '/workspace/history'
            }
          >
            Back to record
          </ActionLink>
        </div>
        <ErrorMessage message={error} />
        {record.score && (
          <Card>
            <h2>Response completeness</h2>
            <p>
              {record.score.answered} of {record.score.total} visible prompts contain responses.
              This is a completion count, not a clinical score.
            </p>
            <p className="muted">
              No clinical score calculated. A qualified professional can discuss these concerns with
              you; this summary cannot determine what care you need.
            </p>
          </Card>
        )}
        {sections.map((s) => (
          <Card key={s.title}>
            <h2>{s.title}</h2>
            <dl>
              {s.items
                .filter(
                  (i) =>
                    isVisible(i, record.answers) && !i.clinicianOnly && i.type !== 'calculated',
                )
                .map((i) => (
                  <div className="answer-row" key={i.id}>
                    <dt>{i.label}</dt>
                    <dd>
                      <AnswerText answer={record.answers[i.id]} />
                    </dd>
                  </div>
                ))}
            </dl>
          </Card>
        ))}
        {data.actor.role === 'clinician' && (
          <Card>
            <h2>Provenance & calculation detail</h2>
            <dl>
              {Object.entries(definition)
                .filter(([k]) => !['sections'].includes(k))
                .map(([k, v]) => (
                  <div className="answer-row" key={k}>
                    <dt>{k}</dt>
                    <dd>{v === null ? 'Not reviewed' : String(v)}</dd>
                  </div>
                ))}
            </dl>
            {record.score && <pre>{JSON.stringify(record.score, null, 2)}</pre>}
          </Card>
        )}
      </>
    );
  return (
    <>
      <PageTitle
        eyebrow="YOUR PERSPECTIVE"
        title={definition.name}
        description="Take your time. You can leave any optional question unanswered."
      />
      <div className="assessment-layout">
        <aside className="section-nav" aria-label="Questionnaire sections">
          {sections.map((s, i) => (
            <button
              key={s.title}
              className={!review && section === i ? 'active' : ''}
              onClick={() => {
                setSection(i);
                setReview(false);
              }}
            >
              <span>{String(i + 1).padStart(2, '0')}</span>
              {s.title}
            </button>
          ))}
          <button className={review ? 'active' : ''} onClick={() => setReview(true)}>
            <span>✓</span>Review & submit
          </button>
          <small>
            DEMO · {definition.version}
            <br />
            <br />
            No clinical score
          </small>
        </aside>
        <div>
          <Card>
            <div className="section-heading">
              <Badge tone="gold">
                {review
                  ? 'REVIEW BEFORE SUBMITTING'
                  : `SECTION ${section + 1} OF ${sections.length}`}
              </Badge>
              <span className="save-status" role="status" aria-live="polite">
                {status}
              </span>
            </div>
            <div
              className="progress"
              role="progressbar"
              aria-label="Questionnaire navigation progress"
              aria-valuemin={0}
              aria-valuemax={sections.length + 1}
              aria-valuenow={review ? sections.length + 1 : section + 1}
            >
              <span
                style={{
                  width: `${((review ? sections.length + 1 : section + 1) / (sections.length + 1)) * 100}%`,
                }}
              />
            </div>
            <ErrorMessage message={error} />
            {error && (
              <p className="fineprint">
                If your session expired,{' '}
                <a href="/signin" target="_blank" rel="noreferrer" className="text-link">
                  sign in in a new tab
                </a>
                , then retry saving here.
              </p>
            )}
            <h2 ref={heading} tabIndex={-1} style={{ marginTop: 30 }}>
              {review ? 'One more look.' : sections[section].title}
            </h2>
            {review ? (
              <>
                <p className="muted">
                  Review what you’re sharing. Submitted responses become read-only. Missing answers
                  remain missing.
                </p>
                <dl>
                  {visibleItems(definition, answers).map((i) => (
                    <div className="answer-row" key={i.id}>
                      <dt>{i.label}</dt>
                      <dd>
                        <AnswerText answer={answers[i.id]} />
                      </dd>
                    </div>
                  ))}
                </dl>
                <label className="check-label" style={{ marginTop: 25 }}>
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(e) => setConfirmed(e.target.checked)}
                  />
                  I have reviewed these synthetic responses and want to submit them for assigned
                  reviewer access. I understand no one is monitoring this demo.
                </label>
              </>
            ) : (
              <>
                <p className="muted" style={{ fontSize: '.85rem', marginBottom: 30 }}>
                  {sections[section].introduction}
                </p>
                {sections[section].items
                  .filter(
                    (i) => isVisible(i, answers) && !i.clinicianOnly && i.type !== 'calculated',
                  )
                  .map((i) => (
                    <Question
                      key={i.id}
                      item={i}
                      answer={answers[i.id]}
                      onChange={(a) => update(i.id, a)}
                    />
                  ))}
              </>
            )}
            <div className="form-actions">
              <Button
                secondary
                disabled={saving || (!review && section === 0)}
                onClick={() => (review ? setReview(false) : setSection((s) => s - 1))}
              >
                Back
              </Button>
              <Button secondary disabled={saving} onClick={() => void persist()}>
                Save now
              </Button>
              {review ? (
                <Button
                  className="right"
                  disabled={saving || !confirmed}
                  onClick={() => void persist(true)}
                >
                  {saving ? 'Submitting…' : 'Submit responses'}
                </Button>
              ) : (
                <Button
                  className="right"
                  disabled={saving}
                  onClick={async () => {
                    if (!dirty || (await persist())) {
                      if (section === sections.length - 1) setReview(true);
                      else setSection((s) => s + 1);
                    }
                  }}
                >
                  Next
                </Button>
              )}
            </div>
          </Card>
          <div className="button-row">
            <Button
              secondary
              disabled={saving}
              onClick={async () => {
                if (!dirty || (await persist())) {
                  await refresh();
                  router.push('/workspace');
                }
              }}
            >
              Save & pause
            </Button>
            <Link href="/urgent-help" className="text-link" target="_blank">
              Get urgent help
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
