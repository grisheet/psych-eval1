import { and, desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db';
import * as s from '../db/schema';
import {
  MSE_FIELDS,
  REPORT_FIELDS,
  type Actor,
  type ReportSnapshot,
  type Answers,
} from '../domain/types';
import { AppError, requireRole } from '../domain/authorization';
import { authorizeClinical } from './access';
import { audit } from './assessment-service';
export const reportInput = z
  .object({
    narrative: z.record(z.enum(REPORT_FIELDS), z.string().max(6000)),
    observations: z.record(
      z.enum(MSE_FIELDS),
      z
        .object({
          status: z.enum(['not-assessed', 'unable-to-assess', 'observed']),
          text: z.string().max(2000),
        })
        .strict(),
    ),
  })
  .strict();
export async function readReport(actor: Actor, id: string) {
  const [row] = await db
    .select()
    .from(s.reportVersions)
    .innerJoin(s.reports, eq(s.reports.id, s.reportVersions.reportId))
    .where(eq(s.reportVersions.id, id));
  if (!row) throw new AppError(404, 'Report not found.');
  await authorizeClinical(actor, row.report.participantId);
  if (actor.role === 'participant' && row.report_version.status !== 'finalized')
    throw new AppError(403, 'Draft reports are available only to assigned reviewers.');
  await audit(actor, 'report.read', 'report-version', id);
  return { ...row.report_version, participantId: row.report.participantId };
}
export async function createReport(actor: Actor, participantId: string) {
  requireRole(actor, 'clinician');
  await authorizeClinical(actor, participantId);
  const [participant] = await db.select().from(s.user).where(eq(s.user.id, participantId));
  const [reviewer] = await db
    .select()
    .from(s.clinicianProfile)
    .where(eq(s.clinicianProfile.userId, actor.id));
  const consent = await db
    .select()
    .from(s.consents)
    .where(eq(s.consents.participantId, participantId));
  const records = await db
    .select()
    .from(s.assessmentSessions)
    .innerJoin(s.instrumentVersions, eq(s.instrumentVersions.id, s.assessmentSessions.versionId))
    .where(eq(s.assessmentSessions.participantId, participantId));
  const measures: ReportSnapshot['measures'] = [];
  for (const row of records.filter((r) => r.assessment_session.status !== 'draft')) {
    const raw = await db
      .select()
      .from(s.responses)
      .where(eq(s.responses.sessionId, row.assessment_session.id));
    const [score] = await db
      .select()
      .from(s.scoreResults)
      .where(eq(s.scoreResults.sessionId, row.assessment_session.id));
    measures.push({
      name: row.instrument_version.definition.name,
      version: row.instrument_version.version,
      submittedAt: row.assessment_session.submittedAt?.toISOString() ?? null,
      result: score?.derived ?? null,
      answers: Object.fromEntries(raw.map((r) => [r.itemId, r.answer])) as Answers,
    });
  }
  if (!measures.length)
    throw new AppError(400, 'A submitted assessment is required before drafting a report.');
  const snapshot: ReportSnapshot = {
    participantId,
    participantName: participant.name,
    demo: true,
    createdAt: new Date().toISOString(),
    consent: consent.map((c) => ({
      version: c.version,
      createdAt: c.createdAt.toISOString(),
      scope: c.scope,
    })),
    measures,
    narrative: Object.fromEntries(REPORT_FIELDS.map((f) => [f, ''])),
    observations: Object.fromEntries(
      MSE_FIELDS.map((f) => [f, { status: 'not-assessed' as const, text: '' }]),
    ),
    reviewerName: actor.name,
    credentials: reviewer?.credentials ?? null,
    credentialsVerified: reviewer?.credentialsVerified ?? false,
    reviewed: false,
  };
  return db.transaction(async (tx) => {
    const [report] = await tx
      .insert(s.reports)
      .values({ participantId, authorId: actor.id })
      .returning();
    const [version] = await tx
      .insert(s.reportVersions)
      .values({ reportId: report.id, number: 1, snapshot })
      .returning();
    await tx.insert(s.auditEvents).values({
      actorId: actor.id,
      action: 'report.create',
      resourceType: 'report-version',
      resourceId: version.id,
    });
    return version;
  });
}
export async function saveReport(
  actor: Actor,
  id: string,
  revision: number,
  input: unknown,
  finalize: boolean,
  attested: boolean,
) {
  requireRole(actor, 'clinician');
  const record = await readReport(actor, id);
  if (record.status !== 'draft')
    throw new AppError(409, 'Finalized reports are immutable. Create an amendment.');
  const fields = reportInput.parse(input);
  if (
    finalize &&
    (!attested ||
      !fields.narrative['Interpretation limitations'].trim() ||
      !fields.narrative['Follow-up plan'].trim())
  )
    throw new AppError(
      400,
      'Confirm explicit review, document limitations, and enter a follow-up plan before finalizing.',
    );
  const [reviewer] = await db
    .select()
    .from(s.clinicianProfile)
    .where(eq(s.clinicianProfile.userId, actor.id));
  if (finalize && process.env.NODE_ENV === 'production' && !reviewer?.credentialsVerified)
    throw new AppError(
      403,
      'Verified professional credentials are required for production finalization.',
    );
  const snapshot = {
    ...record.snapshot,
    ...fields,
    reviewed: finalize,
    reviewerName: actor.name,
    credentials: reviewer?.credentials ?? null,
    credentialsVerified: reviewer?.credentialsVerified ?? false,
  };
  return db.transaction(async (tx) => {
    const [changed] = await tx
      .update(s.reportVersions)
      .set({
        snapshot,
        revision: revision + 1,
        updatedAt: new Date(),
        ...(finalize
          ? { status: 'finalized' as const, signedAt: new Date(), signedBy: actor.id }
          : {}),
      })
      .where(
        and(
          eq(s.reportVersions.id, id),
          eq(s.reportVersions.status, 'draft'),
          eq(s.reportVersions.revision, revision),
        ),
      )
      .returning();
    if (!changed) throw new AppError(409, 'The report changed. Reload before saving.');
    await tx.insert(s.auditEvents).values({
      actorId: actor.id,
      action: finalize ? 'report.finalize' : 'report.save',
      resourceType: 'report-version',
      resourceId: id,
    });
    return changed;
  });
}
export async function amendReport(actor: Actor, id: string, reason: string) {
  requireRole(actor, 'clinician');
  const record = await readReport(actor, id);
  if (record.status !== 'finalized')
    throw new AppError(400, 'Only finalized reports can be amended.');
  if (reason.trim().length < 8) throw new AppError(400, 'Describe the reason for this amendment.');
  return db.transaction(async (tx) => {
    await tx.execute(sql`select id from report where id=${record.reportId} for update`);
    const [last] = await tx
      .select()
      .from(s.reportVersions)
      .where(eq(s.reportVersions.reportId, record.reportId))
      .orderBy(desc(s.reportVersions.number));
    if (last.status === 'draft')
      throw new AppError(409, 'An amendment draft already exists. Open it from report history.');
    if (last.id !== id) throw new AppError(409, 'Amend the latest finalized version.');
    const [version] = await tx
      .insert(s.reportVersions)
      .values({
        reportId: record.reportId,
        number: last.number + 1,
        parentVersionId: id,
        amendmentReason: reason,
        snapshot: { ...record.snapshot, reviewed: false },
      })
      .returning();
    await tx.insert(s.auditEvents).values({
      actorId: actor.id,
      action: 'report.amend',
      resourceType: 'report-version',
      resourceId: version.id,
    });
    return version;
  });
}
