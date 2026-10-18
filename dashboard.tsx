'use client';
import Link from 'next/link';
import { Leaf, ArrowRight } from 'lucide-react';
import { useState } from 'react';
import {
  useWorkspace,
  type ParticipantData,
  type ClinicianData,
  type AdminData,
} from './workspace';
import { PageTitle, Card, Badge, ActionLink, Empty, Notice } from './ui';
import { date } from '@/lib/api';
export function Dashboard() {
  const { data } = useWorkspace();
  return data.actor.role === 'participant' ? (
    <ParticipantDashboard data={data as ParticipantData} />
  ) : data.actor.role === 'clinician' ? (
    <ReviewerDashboard data={data as ClinicianData} />
  ) : (
    <AdminDashboard data={data as AdminData} />
  );
}
function ParticipantDashboard({ data }: { data: ParticipantData }) {
  const submitted = data.records.filter((r) => r.status !== 'draft'),
    drafts = data.records.filter((r) => r.status === 'draft');
  return (
    <>
      <PageTitle
        eyebrow="YOUR ASSESSMENT JOURNEY"
        title={`Welcome, ${data.profile?.preferredName || data.actor.name.split(' ')[0]}.`}
        description="Make room for your perspective. There’s no need to finish everything today."
      />
      <div className="dashboard-grid">
        <div>
          <Card className="welcome-card">
            <Leaf size={110} strokeWidth={0.8} className="welcome-icon" />
            <Badge tone="green">YOUR NEXT STEP</Badge>
            <h2 style={{ marginTop: 20 }}>
              {!data.consent
                ? 'Start with a clear understanding.'
                : drafts.length
                  ? 'Pick up where you left off.'
                  : 'Build a picture of what matters.'}
            </h2>
            <p className="muted">
              {!data.consent
                ? 'Before you begin, understand how your information is used and who can review it.'
                : 'Your experiences, concerns, and strengths belong in the same conversation. Share at your own pace.'}
            </p>
            <ActionLink
              href={
                !data.consent
                  ? '/workspace/consent'
                  : drafts.length
                    ? `/workspace/assessment/${drafts[0].id}`
                    : '/workspace/library'
              }
            >
              {!data.consent
                ? 'Review consent'
                : drafts.length
                  ? 'Resume assessment'
                  : 'Explore assessments'}
            </ActionLink>
          </Card>
          <div className="stat-row">
            <div className="stat">
              <span>IN PROGRESS</span>
              <strong>{drafts.length.toString().padStart(2, '0')}</strong>
              <small>Saved for later</small>
            </div>
            <div className="stat">
              <span>SUBMITTED</span>
              <strong>{submitted.length.toString().padStart(2, '0')}</strong>
              <small>Ready for a conversation</small>
            </div>
            <div className="stat">
              <span>SHARED REPORTS</span>
              <strong>{data.reports.length.toString().padStart(2, '0')}</strong>
              <small>Finalized demo versions</small>
            </div>
          </div>
          <Card>
            <div className="section-heading">
              <h2>Your recent activity</h2>
              <Link href="/workspace/history">
                View history <ArrowRight size={13} style={{ display: 'inline' }} />
              </Link>
            </div>
            {data.records.length ? (
              data.records.slice(0, 3).map((r) => (
                <div key={r.id} className="row">
                  <div>
                    <h3>{r.name}</h3>
                    <p>{date(r.updatedAt)}</p>
                  </div>
                  <Badge tone={r.status === 'draft' ? 'gold' : 'green'}>{r.status}</Badge>
                  <Link href={`/workspace/assessment/${r.id}`} className="button secondary">
                    {r.status === 'draft' ? 'Resume' : 'View summary'}
                  </Link>
                </div>
              ))
            ) : (
              <Empty title="A fresh starting point">
                Your saved and submitted assessments will appear here.
              </Empty>
            )}
          </Card>
        </div>
        <div>
          <Card>
            <p className="eyebrow">HOW IT WORKS</p>
            <h2>A thoughtful process.</h2>
            {[
              ['Understand & consent', 'Know what is collected and who may see it.'],
              ['Share your context', 'Answer optional questions. Pause when you need to.'],
              ['Review & submit', 'Take one more look before sharing your responses.'],
              ['Human review', 'Assigned reviewers add their own observations and interpretation.'],
            ].map(([t, p], i) => (
              <div className="journey-step" key={t}>
                <span className="step-number">{i + 1}</span>
                <div>
                  <h3>{t}</h3>
                  <p>{p}</p>
                </div>
              </div>
            ))}
          </Card>
          <Card>
            <Badge>YOUR INFORMATION</Badge>
            <h3 style={{ marginTop: 18 }}>You decide what to share.</h3>
            <p className="muted" style={{ fontSize: '.8rem' }}>
              Skip optional questions, review your consent, and request an export or deletion.
            </p>
            <Link href="/workspace/account" className="text-link">
              Manage privacy choices
            </Link>
            <hr className="section-divider" />
            <p className="fineprint">
              Assigned reviewer: {data.reviewers.map((r) => r.name).join(', ') || 'None assigned'}.
              No review time is promised in this demo.
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}
export function ReviewerDashboard({ data }: { data: ClinicianData }) {
  const [search, setSearch] = useState(''),
    [filter, setFilter] = useState('all');
  const people = data.participants.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) &&
      (filter === 'all' ||
        (filter === 'submitted' ? p.records.some((r) => r.status === 'submitted') : !p.consent)),
  );
  return (
    <>
      <PageTitle
        eyebrow="PROFESSIONAL REVIEW"
        title="Context before conclusions."
        description="Review only participants assigned to you. Automated completeness information is not a clinical interpretation."
      />
      <div className="stat-row">
        <div className="stat">
          <span>ASSIGNED PARTICIPANTS</span>
          <strong>{data.participants.length}</strong>
        </div>
        <div className="stat">
          <span>AWAITING REVIEW</span>
          <strong>
            {
              data.participants.flatMap((p) => p.records).filter((r) => r.status === 'submitted')
                .length
            }
          </strong>
        </div>
        <div className="stat">
          <span>DRAFT ASSESSMENTS</span>
          <strong>
            {data.participants.flatMap((p) => p.records).filter((r) => r.status === 'draft').length}
          </strong>
        </div>
      </div>
      <Notice>
        Demo reviewer identity. No professional credentials are asserted. Original prompts are not
        for clinical use.
      </Notice>
      <Card>
        <div className="section-heading">
          <h2>Assigned participants</h2>
          <Badge>EXPLICIT ACCESS</Badge>
        </div>
        <div className="filter-bar">
          <input
            aria-label="Search assigned participants"
            placeholder="Search by display name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            aria-label="Filter participants"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">All participants</option>
            <option value="submitted">Awaiting review</option>
            <option value="consent">Consent unavailable</option>
          </select>
        </div>
        {people.length ? (
          people.map((p) => (
            <div className="row" key={p.id}>
              <div>
                <h3>{p.name}</h3>
                <p>
                  {p.consent
                    ? `${p.records.length} assessments · ${p.records.filter((r) => r.status === 'submitted').length} awaiting review`
                    : 'Consent absent or withdrawn. Records are inaccessible.'}
                </p>
              </div>
              {p.consent ? (
                <ActionLink secondary href={`/workspace/participant/${p.id}`}>
                  Open record
                </ActionLink>
              ) : (
                <Badge>ACCESS PAUSED</Badge>
              )}
            </div>
          ))
        ) : (
          <Empty title="No matching participants">
            Assignments are managed by an operational administrator.
          </Empty>
        )}
      </Card>
    </>
  );
}
function AdminDashboard({ data }: { data: AdminData }) {
  return (
    <>
      <PageTitle
        eyebrow="SERVICE OPERATIONS"
        title="Keep the process clear."
        description="Manage access and configuration. This role does not grant clinical-record access."
        action={<ActionLink href="/workspace/admin">Manage service</ActionLink>}
      />
      <div className="stat-row">
        <div className="stat">
          <span>ACCOUNTS</span>
          <strong>{data.users.length}</strong>
        </div>
        <div className="stat">
          <span>REVIEWER ASSIGNMENTS</span>
          <strong>{data.assignments.length}</strong>
        </div>
        <div className="stat">
          <span>PRIVACY REQUESTS</span>
          <strong>{data.deletion.filter((d) => d.status === 'pending').length}</strong>
        </div>
      </div>
      <Card>
        <h2>Operational boundaries</h2>
        <p className="muted">
          Administrators can disable accounts, manage assignments, configure consent and retention
          targets, maintain the resource directory, and inspect minimal audit metadata. Participant
          answers and clinician narratives are not available in this workspace.
        </p>
        <Notice>
          Retention is a configured target, not an automated purge. Deletion requests require a
          documented operator process and backup handling.
        </Notice>
      </Card>
    </>
  );
}
