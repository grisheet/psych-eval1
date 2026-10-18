'use client';
import { useState } from 'react';
import { api, date } from '@/lib/api';
import { useWorkspace, type AdminData } from './workspace';
import { PageTitle, Card, Button, ErrorMessage, Notice, Badge, Empty } from './ui';
export function AdminPage() {
  const { data: raw, refresh } = useWorkspace(),
    data = raw as AdminData;
  const [tab, setTab] = useState('Accounts'),
    [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false),
    [search, setSearch] = useState('');
  const participants = data.users.filter((u) => u.role === 'participant'),
    reviewers = data.users.filter((u) => u.role === 'clinician');
  async function act(operation: unknown) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await api('action', { action: 'admin', operation });
      await refresh();
      setMessage('Change saved and recorded in audit history.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const name = (id: string) => data.users.find((u) => u.id === id)?.name || id;
  return (
    <>
      <PageTitle
        eyebrow="SERVICE ADMINISTRATION"
        title="Operations with boundaries."
        description="Manage service metadata and access. Clinical responses remain outside this role."
      />
      <div className="tabs" role="group" aria-label="Administration sections">
        {[
          'Accounts',
          'Assignments',
          'Instruments',
          'Resources',
          'Settings',
          'Privacy requests',
          'Audit',
        ].map((t) => (
          <button
            key={t}
            className={tab === t ? 'active' : ''}
            aria-pressed={tab === t}
            onClick={() => {
              setTab(t);
              setError('');
              setMessage('');
            }}
          >
            {t}
          </button>
        ))}
      </div>
      <ErrorMessage message={error} />
      {message && (
        <p className="success" role="status">
          {message}
        </p>
      )}
      {tab === 'Accounts' && (
        <Card>
          <h2>Account directory</h2>
          <p className="muted">
            Account provisioning and role selection use the trusted operator command documented in
            the README. Disabled accounts lose their sessions immediately.
          </p>
          <div className="filter-bar">
            <input
              aria-label="Search accounts"
              placeholder="Search name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Access</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {data.users
                  .filter((u) =>
                    `${u.name} ${u.email}`.toLowerCase().includes(search.toLowerCase()),
                  )
                  .map((u) => (
                    <tr key={u.id}>
                      <td>{u.name}</td>
                      <td>{u.email}</td>
                      <td>
                        <Badge>{u.role}</Badge>
                      </td>
                      <td>{u.disabled ? 'Disabled' : 'Active'}</td>
                      <td>
                        <Button
                          secondary
                          disabled={busy || u.id === data.actor.id}
                          onClick={() =>
                            void act({ action: 'user', id: u.id, disabled: !u.disabled })
                          }
                        >
                          {u.disabled ? 'Enable' : 'Disable'}
                        </Button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      {tab === 'Assignments' && (
        <>
          <Card>
            <h2>Assign a reviewer</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                void act({
                  action: 'assignment',
                  participantId: f.get('participant'),
                  clinicianId: f.get('reviewer'),
                  remove: false,
                });
              }}
            >
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="assign-participant">Participant</label>
                  <select id="assign-participant" name="participant" required>
                    {participants.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="assign-reviewer">Reviewer</label>
                  <select id="assign-reviewer" name="reviewer" required>
                    {reviewers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <Button disabled={busy || !participants.length || !reviewers.length}>
                Add assignment
              </Button>
            </form>
            {data.assignments.map((a) => (
              <div className="row" key={a.id}>
                <div>
                  <h3>{name(a.participantId)}</h3>
                  <p>Assigned to {name(a.clinicianId)}</p>
                </div>
                <Button
                  secondary
                  disabled={busy}
                  onClick={() =>
                    void act({
                      action: 'assignment',
                      participantId: a.participantId,
                      clinicianId: a.clinicianId,
                      remove: true,
                    })
                  }
                >
                  Remove access
                </Button>
              </div>
            ))}
          </Card>
          <Card>
            <h2>Recommend an assessment module</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                void act({
                  action: 'module',
                  participantId: f.get('participant'),
                  versionId: f.get('version'),
                });
              }}
            >
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="module-participant">Participant</label>
                  <select name="participant" id="module-participant">
                    {participants.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="module-version">Module version</label>
                  <select name="version" id="module-version">
                    {data.versions.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.definition.name} · {v.definition.version}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <Button disabled={busy}>Assign optional module</Button>
            </form>
          </Card>
        </>
      )}
      {tab === 'Instruments' && (
        <Card>
          <h2>Instrument registry</h2>
          <Notice>
            Only original demo content is included. Enabling a module does not establish clinical
            validation. Version definitions are immutable.
          </Notice>
          {data.instruments.map((i) => (
            <details key={i.id}>
              <summary>
                {i.name} · {i.enabled ? 'Available' : 'Disabled'}
              </summary>
              <div>
                <Button
                  secondary
                  disabled={busy}
                  onClick={() => void act({ action: 'instrument', id: i.id, enabled: !i.enabled })}
                >
                  {i.enabled ? 'Disable new starts' : 'Enable new starts'}
                </Button>
                {data.versions
                  .filter((v) => v.definition.id === i.id)
                  .map((v) => (
                    <div key={v.id}>
                      <h3 style={{ marginTop: 22 }}>Version {v.definition.version}</h3>
                      <dl>
                        {Object.entries(v.definition)
                          .filter(([k]) => k !== 'sections')
                          .map(([k, value]) => (
                            <div className="answer-row" key={k}>
                              <dt>{k}</dt>
                              <dd>{value === null ? 'Not reviewed' : String(value)}</dd>
                            </div>
                          ))}
                      </dl>
                      <details>
                        <summary>Original item definitions</summary>
                        <pre>{JSON.stringify(v.definition.sections, null, 2)}</pre>
                      </details>
                    </div>
                  ))}
              </div>
            </details>
          ))}
        </Card>
      )}
      {tab === 'Resources' && (
        <Card>
          <h2>Verified resource directory</h2>
          <Notice>
            Add only independently verified official resources. This directory does not initiate
            outreach. No contact numbers are seeded. Reverify listings every 180 days.
          </Notice>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void act({
                action: 'resource',
                region: f.get('region'),
                name: f.get('name'),
                url: f.get('url'),
                sourceUrl: f.get('sourceUrl'),
                lastChecked: f.get('lastChecked'),
              });
            }}
          >
            <div className="form-grid">
              {[
                ['region', 'Region', 'text'],
                ['name', 'Resource name', 'text'],
                ['url', 'Official resource URL', 'url'],
                ['sourceUrl', 'Verification source URL', 'url'],
                ['lastChecked', 'Date independently verified', 'date'],
              ].map(([key, label, type]) => (
                <div className="field" key={key}>
                  <label htmlFor={`resource-${key}`}>{label}</label>
                  <input
                    id={`resource-${key}`}
                    name={key}
                    type={type}
                    max={type === 'date' ? new Date().toISOString().slice(0, 10) : undefined}
                    required
                  />
                </div>
              ))}
            </div>
            <Button disabled={busy}>Save verified resource</Button>
          </form>
          {data.resources.length ? (
            data.resources.map((r) => (
              <div className="row" key={r.id}>
                <div>
                  <h3>
                    {r.name} · {r.region}
                  </h3>
                  <p>
                    Checked {date(r.lastChecked)} · {r.enabled ? 'Enabled' : 'Disabled'}
                  </p>
                </div>
                <Button
                  secondary
                  disabled={busy || !r.enabled}
                  onClick={() => void act({ action: 'resource-disable', id: r.id })}
                >
                  Disable listing
                </Button>
              </div>
            ))
          ) : (
            <Empty title="No resources configured">
              The public support page shows the local-emergency-services fallback.
            </Empty>
          )}
        </Card>
      )}
      {tab === 'Settings' && (
        <Card>
          <h2>Consent & retention settings</h2>
          <Notice>
            These settings require clinical and legal review before real use. Retention is a target
            only; there is no automatic deletion job. Monitoring and AI remain disabled.
          </Notice>
          <form
            key={data.settings.updatedAt.toString()}
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void act({
                action: 'settings',
                retentionDays: Number(f.get('retentionDays')),
                consentVersion: f.get('consentVersion'),
                confidentialityText: f.get('confidentialityText'),
              });
            }}
          >
            <div className="form-grid">
              <div className="field">
                <label htmlFor="retention">Retention target (days)</label>
                <input
                  id="retention"
                  name="retentionDays"
                  type="number"
                  min={1}
                  max={3650}
                  required
                  defaultValue={data.settings.retentionDays}
                />
              </div>
              <div className="field">
                <label htmlFor="consent-version">Consent version</label>
                <input
                  id="consent-version"
                  name="consentVersion"
                  maxLength={60}
                  required
                  defaultValue={data.settings.consentVersion}
                />
              </div>
            </div>
            <div className="field">
              <label htmlFor="terms">Organization-specific confidentiality text</label>
              <textarea
                id="terms"
                name="confidentialityText"
                required
                minLength={10}
                maxLength={4000}
                defaultValue={data.settings.confidentialityText}
              />
              <small>
                Change the version whenever terms or retention change. Historical consent text is
                preserved.
              </small>
            </div>
            <Button disabled={busy}>Save operational settings</Button>
          </form>
        </Card>
      )}
      {tab === 'Privacy requests' && (
        <Card>
          <h2>Deletion-request review</h2>
          <p className="muted">
            A request is not proof of erasure. Fulfillment requires the documented operator process,
            legal review, and backup expiry. This interface cannot label an unperformed deletion
            “fulfilled.”
          </p>
          {data.deletion.length ? (
            data.deletion.map((r) => (
              <form
                className="card"
                key={r.id}
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  void act({
                    action: 'deletion-review',
                    id: r.id,
                    status: f.get('status'),
                    resolution: f.get('resolution'),
                  });
                }}
              >
                <h3>{name(r.participantId)}</h3>
                <p className="fineprint">
                  {date(r.createdAt)} · {r.status}
                </p>
                <div className="field">
                  <label htmlFor={`status-${r.id}`}>Review state</label>
                  <select id={`status-${r.id}`} name="status">
                    <option value="reviewing">Under review</option>
                    <option value="declined">Declined with explanation</option>
                  </select>
                </div>
                <div className="field">
                  <label htmlFor={`resolution-${r.id}`}>Participant-visible explanation</label>
                  <textarea
                    id={`resolution-${r.id}`}
                    name="resolution"
                    required
                    minLength={10}
                    maxLength={1500}
                    defaultValue={r.resolution ?? ''}
                  />
                </div>
                <Button secondary disabled={busy}>
                  Record review
                </Button>
              </form>
            ))
          ) : (
            <Empty title="No deletion requests">Requests will appear here when submitted.</Empty>
          )}
        </Card>
      )}
      {tab === 'Audit' && (
        <Card>
          <h2>Audit history</h2>
          <p className="muted">
            Latest 100 events. Append-only metadata; questionnaire responses and note contents are
            never recorded here.
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Actor</th>
                  <th>Action</th>
                  <th>Resource</th>
                </tr>
              </thead>
              <tbody>
                {data.audits.map((a) => (
                  <tr key={a.id}>
                    <td>{date(a.createdAt)}</td>
                    <td>{name(a.actorId)}</td>
                    <td>{a.action}</td>
                    <td>
                      <code>
                        {a.resourceType}: {a.resourceId}
                      </code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}
