import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { eq, sql } from 'drizzle-orm';
import { hashPassword } from 'better-auth/crypto';
import { db, closeDb } from '../src/db';
import * as s from '../src/db/schema';
import { registry, versionId } from '../src/domain/registry';
import { auth } from '../src/lib/auth';
import {
  startAssessment,
  saveAssessment,
  readAssessment,
  markReviewed,
} from '../src/server/assessment-service';
import {
  acceptConsent,
  withdraw,
  saveProfile,
  exportParticipant,
  bootstrap,
  addNote,
} from '../src/server/workspace-service';
import { createReport, saveReport, amendReport, readReport } from '../src/server/report-service';
import { administer } from '../src/server/admin-service';
import { assertOrigin, limit } from '../src/server/http';
import { GET, POST } from '../src/app/api/workspace/[...path]/route';
import type { Actor } from '../src/domain/types';
const context = vi.hoisted(() => ({ cookie: '' }));
vi.mock('next/headers', () => ({
  headers: async () => new Headers({ cookie: context.cookie, origin: 'http://localhost:3000' }),
}));
const p: Actor = { id: 'p', name: 'Synthetic Alex', role: 'participant' },
  q: Actor = { id: 'q', name: 'Synthetic Jordan', role: 'participant' },
  c: Actor = { id: 'c', name: 'Synthetic Reviewer', role: 'clinician' },
  a: Actor = { id: 'a', name: 'Synthetic Admin', role: 'admin' },
  unassigned: Actor = { id: 'u', name: 'Other Reviewer', role: 'clinician' };
let assessmentId = '',
  reportId = '',
  cookie = '';
beforeAll(async () => {
  for (const file of readdirSync('drizzle')
    .filter((f) => f.endsWith('.sql'))
    .sort())
    for (const statement of readFileSync(`drizzle/${file}`, 'utf8').split(
      '--> statement-breakpoint',
    ))
      if (statement.trim()) await db.execute(sql.raw(statement));
  const password = await hashPassword('Synthetic-test-password!');
  for (const actor of [p, q, c, a, unassigned]) {
    await db
      .insert(s.user)
      .values({ ...actor, email: `${actor.id}@test.invalid`, emailVerified: true });
    await db
      .insert(s.account)
      .values({ userId: actor.id, accountId: actor.id, providerId: 'credential', password });
  }
  await db.insert(s.settings).values({ id: 'service' });
  await db.insert(s.assignments).values({ participantId: p.id, clinicianId: c.id });
  await db.insert(s.clinicianProfile).values({ userId: c.id });
  for (const def of registry) {
    await db.insert(s.instruments).values({ id: def.id, name: def.name });
    await db
      .insert(s.instrumentVersions)
      .values({ id: versionId(def), instrumentId: def.id, version: def.version, definition: def });
  }
});
afterAll(closeDb);
describe('Database-backed lifecycle and isolation', () => {
  it('requires consent before any assessment or profile collection', async () => {
    await expect(startAssessment(p, 'intake@1.0.0')).rejects.toThrow('eligibility');
    await expect(saveProfile(p, {})).rejects.toThrow('consent');
  });
  it('records explicit consent and the exact terms, without optional permissions', async () => {
    await expect(acceptConsent(p, 'demo-1', false, true)).rejects.toThrow();
    await expect(acceptConsent(p, 'stale', true, true)).rejects.toThrow('changed');
    const consent = await acceptConsent(p, 'demo-1', true, true);
    expect(consent.optionalResearch).toBe(false);
    expect(consent.textSnapshot).toContain('No submissions are monitored');
  });
  it('starts and reuses an existing draft', async () => {
    const first = await startAssessment(p, 'intake@1.0.0');
    assessmentId = first.id;
    expect((await startAssessment(p, 'intake@1.0.0')).id).toBe(first.id);
  });
  it('persists and resumes raw answers, including literal injection-like text', async () => {
    await saveAssessment(
      p,
      assessmentId,
      0,
      {
        concerns: {
          state: 'answered',
          value: "<script>alert(1)</script>'; DROP TABLE app_user; --",
        },
        goals: { state: 'prefer-not' },
      },
      false,
    );
    const r = await readAssessment(p, assessmentId);
    expect(r.answers.goals.state).toBe('prefer-not');
    expect(r.answers.concerns.value).toContain('<script>');
    expect(r.record.revision).toBe(1);
    expect(await db.select().from(s.user)).toHaveLength(5);
  });
  it('rejects identifier manipulation, unassigned reviewers and operational administrators', async () => {
    for (const actor of [q, unassigned, a]) {
      await expect(readAssessment(actor, assessmentId)).rejects.toThrow('access');
      await expect(saveAssessment(actor, assessmentId, 1, {}, false)).rejects.toThrow();
    }
  });
  it('allows the assigned reviewer to inspect original responses', async () =>
    expect((await readAssessment(c, assessmentId)).record.id).toBe(assessmentId));
  it('rejects stale saves without losing the stored response', async () => {
    await expect(saveAssessment(p, assessmentId, 0, {}, false)).rejects.toThrow('another window');
    expect((await readAssessment(p, assessmentId)).answers.concerns).toBeDefined();
  });
  it('preserves the draft version when a new version is registered or a module is disabled', async () => {
    await db.insert(s.instrumentVersions).values({
      id: 'intake@2.0.0',
      instrumentId: 'intake',
      version: '2.0.0',
      definition: { ...registry[0], version: '2.0.0' },
    });
    await administer(a, { action: 'instrument', id: 'intake', enabled: false });
    await expect(startAssessment(p, 'intake@1.0.0')).rejects.toThrow('unavailable');
    expect((await readAssessment(p, assessmentId)).definition.version).toBe('1.0.0');
  });
  it('submits exactly once, stores raw and derived results separately, and rejects later edits', async () => {
    const answers = {
      concerns: { state: 'answered', value: 'Synthetic concern' },
      goals: { state: 'prefer-not' },
    };
    const first = await saveAssessment(p, assessmentId, 1, answers, true);
    const again = await saveAssessment(p, assessmentId, 1, {}, true);
    expect(again.id).toBe(first.id);
    expect(await db.select().from(s.scoreResults)).toHaveLength(1);
    expect(await db.select().from(s.reviewTasks)).toHaveLength(1);
    expect((await readAssessment(p, assessmentId)).answers.concerns.value).toBe(
      'Synthetic concern',
    );
    await expect(saveAssessment(p, assessmentId, 2, {}, false)).rejects.toThrow('read-only');
  });
  it('records explicit human review', async () => {
    await markReviewed(c, assessmentId);
    expect((await readAssessment(c, assessmentId)).record.status).toBe('reviewed');
  });
  it('creates a report with no invented observations and excludes private notes', async () => {
    await addNote(c, p.id, 'Clinician interpretation', 'INTERNAL-SECRET-NOTE');
    const r = await createReport(c, p.id);
    reportId = r.id;
    expect(Object.values(r.snapshot.observations).every((o) => o.status === 'not-assessed')).toBe(
      true,
    );
    expect(JSON.stringify(r.snapshot)).not.toContain('INTERNAL-SECRET-NOTE');
    await expect(readReport(p, r.id)).rejects.toThrow('Draft');
  });
  it('requires attestation, limitations and follow-up before finalization', async () => {
    const r = await readReport(c, reportId);
    await expect(
      saveReport(
        c,
        reportId,
        0,
        { narrative: r.snapshot.narrative, observations: r.snapshot.observations },
        true,
        false,
      ),
    ).rejects.toThrow('explicit review');
    const fields = {
      narrative: {
        ...r.snapshot.narrative,
        'Interpretation limitations': 'Unvalidated synthetic demonstration.',
        'Follow-up plan': 'Discuss the synthetic example in a demo review.',
      },
      observations: r.snapshot.observations,
    };
    const signed = await saveReport(c, reportId, 0, fields, true, true);
    expect(signed.status).toBe('finalized');
    expect((await readReport(p, reportId)).signedBy).toBe(c.id);
  });
  it('protects finalized versions and instrument definitions at the database level', async () => {
    await expect(
      db
        .update(s.reportVersions)
        .set({ snapshot: {} as never })
        .where(eq(s.reportVersions.id, reportId)),
    ).rejects.toThrow();
    await expect(
      db.delete(s.reportVersions).where(eq(s.reportVersions.id, reportId)),
    ).rejects.toThrow();
    await expect(
      db
        .update(s.instrumentVersions)
        .set({ version: 'hacked' })
        .where(eq(s.instrumentVersions.id, 'intake@1.0.0')),
    ).rejects.toThrow();
  });
  it('creates an amendment with a parent version, preserving the signed original', async () => {
    const amended = await amendReport(c, reportId, 'Correct a synthetic example.');
    expect(amended.number).toBe(2);
    expect(amended.parentVersionId).toBe(reportId);
    expect(amended.status).toBe('draft');
    expect((await readReport(c, reportId)).status).toBe('finalized');
    await expect(amendReport(c, reportId, 'Another change')).rejects.toThrow('already exists');
  });
  it('exports only the participant’s records, including finalized reports and excluding internal notes', async () => {
    const exported = await exportParticipant(p);
    expect(exported.assessments.every((r) => r.participantId === p.id)).toBe(true);
    expect(exported.finalizedReports).toHaveLength(1);
    expect(JSON.stringify(exported)).not.toContain('INTERNAL-SECRET-NOTE');
    expect((await exportParticipant(q)).assessments).toHaveLength(0);
    await expect(exportParticipant(a)).rejects.toThrow();
  });
  it('withdrawal stops collection and reviewer access but preserves self-access', async () => {
    await withdraw(p);
    await expect(readAssessment(c, assessmentId)).rejects.toThrow('withdrawn');
    await expect(createReport(c, p.id)).rejects.toThrow('withdrawn');
    await expect(startAssessment(p, 'mood@1.0.0')).rejects.toThrow('consent');
    expect((await readAssessment(p, assessmentId)).record.id).toBe(assessmentId);
  });
  it('admin bootstrap contains no clinical answers, profile, or notes', async () => {
    const admin = await bootstrap(a);
    expect(admin).not.toHaveProperty('records');
    expect(admin).not.toHaveProperty('notes');
    expect(admin).not.toHaveProperty('profile');
    expect(JSON.stringify(admin)).not.toContain('Synthetic concern');
  });
  it('rejects role manipulation and self-disable', async () => {
    await expect(
      administer(a, { action: 'user', id: q.id, disabled: false, role: 'admin' }),
    ).rejects.toThrow();
    await expect(administer(a, { action: 'user', id: a.id, disabled: true })).rejects.toThrow(
      'own',
    );
    await expect(administer(p, { action: 'user', id: q.id, disabled: true })).rejects.toThrow();
  });
  it('requires a new consent version for changed service terms', async () => {
    await expect(
      administer(a, {
        action: 'settings',
        retentionDays: 60,
        consentVersion: 'demo-1',
        confidentialityText: 'Revised synthetic terms.',
      }),
    ).rejects.toThrow('version');
  });
  it('preserves append-only audit history without clinical text', async () => {
    const audit = await db.select().from(s.auditEvents);
    expect(audit.length).toBeGreaterThan(10);
    expect(JSON.stringify(audit)).not.toContain('Synthetic concern');
    expect(JSON.stringify(audit)).not.toContain('INTERNAL-SECRET-NOTE');
    await expect(
      db.delete(s.auditEvents).where(eq(s.auditEvents.id, audit[0].id)),
    ).rejects.toThrow();
  });
});
describe('Authentication and HTTP boundary', () => {
  it('rejects unauthenticated requests and forged sessions', async () => {
    context.cookie = '';
    expect(
      (
        await GET(new Request('http://localhost:3000/api/workspace/bootstrap'), {
          params: Promise.resolve({ path: ['bootstrap'] }),
        })
      ).status,
    ).toBe(401);
    context.cookie = 'better-auth.session_token=forged';
    expect(
      (
        await GET(new Request('http://localhost:3000/api/workspace/export'), {
          params: Promise.resolve({ path: ['export'] }),
        })
      ).status,
    ).toBe(401);
  });
  it('signs in through Better Auth and uses the database role', async () => {
    const response = await auth.api.signInEmail({
      body: { email: 'p@test.invalid', password: 'Synthetic-test-password!' },
      headers: new Headers({ origin: 'http://localhost:3000' }),
      asResponse: true,
    });
    expect(response.status).toBe(200);
    cookie = response.headers
      .getSetCookie()
      .map((c) => c.split(';')[0])
      .join('; ');
    context.cookie = cookie;
    const result = await GET(new Request('http://localhost:3000/api/workspace/bootstrap'), {
      params: Promise.resolve({ path: ['bootstrap'] }),
    });
    expect(result.status).toBe(200);
    expect((await result.json()).actor.role).toBe('participant');
  });
  it('enforces authorization and CSRF through real route handlers', async () => {
    const blocked = await POST(
      new Request('http://localhost:3000/api/workspace/action', {
        method: 'POST',
        headers: { origin: 'https://evil.invalid', 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'withdraw' }),
      }),
    );
    expect(blocked.status).toBe(403);
    const admin = await POST(
      new Request('http://localhost:3000/api/workspace/action', {
        method: 'POST',
        headers: { origin: 'http://localhost:3000', 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'admin',
          operation: { action: 'user', id: q.id, disabled: true },
        }),
      }),
    );
    expect(admin.status).toBe(403);
  });
  it('exports through the authenticated endpoint without private notes', async () => {
    const res = await GET(new Request('http://localhost:3000/api/workspace/export'), {
      params: Promise.resolve({ path: ['export'] }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Disposition')).toContain('attachment');
    expect(await res.text()).not.toContain('INTERNAL-SECRET-NOTE');
  });
  it('rejects expired sessions', async () => {
    await db.delete(s.session).where(eq(s.session.userId, p.id));
    const res = await GET(new Request('http://localhost:3000/api/workspace/export'), {
      params: Promise.resolve({ path: ['export'] }),
    });
    expect(res.status).toBe(401);
  });
  it('rejects absent or foreign Origin', () => {
    expect(() => assertOrigin(new Request('http://localhost:3000'))).toThrow();
    expect(() =>
      assertOrigin(
        new Request('http://localhost:3000', { headers: { origin: 'https://evil.invalid' } }),
      ),
    ).toThrow();
  });
  it('applies persistent per-user rate limits', async () => {
    for (let n = 0; n < 120; n++) await limit('rate-fixture');
    await expect(limit('rate-fixture')).rejects.toThrow('Too many');
  });
});
