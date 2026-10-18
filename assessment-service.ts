import { and, eq, sql } from 'drizzle-orm';
import { db } from '../db';
import * as s from '../db/schema';
import { AppError, checkRevision, requireRole } from '../domain/authorization';
import { validateAnswers, summarize } from '../domain/assessment';
import { authorizeClinical, requireCollection } from './access';
import type { Actor, Answers } from '../domain/types';
export async function audit(
  actor: Actor,
  action: string,
  resourceType: string,
  resourceId: string,
) {
  await db.insert(s.auditEvents).values({ actorId: actor.id, action, resourceType, resourceId });
}
export async function readAssessment(actor: Actor, id: string) {
  const [record] = await db
    .select()
    .from(s.assessmentSessions)
    .where(eq(s.assessmentSessions.id, id));
  if (!record) throw new AppError(404, 'Assessment not found.');
  await authorizeClinical(actor, record.participantId);
  const [version] = await db
    .select()
    .from(s.instrumentVersions)
    .where(eq(s.instrumentVersions.id, record.versionId));
  const rows = await db.select().from(s.responses).where(eq(s.responses.sessionId, id));
  const [score] = await db.select().from(s.scoreResults).where(eq(s.scoreResults.sessionId, id));
  await audit(actor, 'assessment.read', 'assessment', id);
  return {
    record,
    definition: version.definition,
    answers: Object.fromEntries(rows.map((r) => [r.itemId, r.answer])) as Answers,
    score: score?.derived ?? null,
  };
}
export async function startAssessment(actor: Actor, versionId: string) {
  const consent = await requireCollection(actor);
  const [version] = await db
    .select()
    .from(s.instrumentVersions)
    .innerJoin(s.instruments, eq(s.instruments.id, s.instrumentVersions.instrumentId))
    .where(eq(s.instrumentVersions.id, versionId));
  if (!version || !version.instrument.enabled)
    throw new AppError(
      400,
      'This module is unavailable. Existing drafts keep their original version.',
    );
  return await db.transaction(async (tx) => {
    // Lock the participant to serialize concurrent starts for the same module.
    await tx.execute(sql`select id from app_user where id = ${actor.id} for update`);
    const [existing] = await tx
      .select()
      .from(s.assessmentSessions)
      .where(
        and(
          eq(s.assessmentSessions.participantId, actor.id),
          eq(s.assessmentSessions.versionId, versionId),
          eq(s.assessmentSessions.status, 'draft'),
        ),
      );
    if (existing) return existing;
    const [record] = await tx
      .insert(s.assessmentSessions)
      .values({ participantId: actor.id, versionId, consentId: consent.id })
      .returning();
    await tx.insert(s.auditEvents).values({
      actorId: actor.id,
      action: 'assessment.start',
      resourceType: 'assessment',
      resourceId: record.id,
    });
    return record;
  });
}
export async function saveAssessment(
  actor: Actor,
  id: string,
  revision: number,
  input: unknown,
  submit: boolean,
) {
  await requireCollection(actor);
  const [record] = await db
    .select()
    .from(s.assessmentSessions)
    .where(eq(s.assessmentSessions.id, id));
  if (!record || record.participantId !== actor.id)
    throw new AppError(403, 'You do not have access to this assessment.');
  if (record.status !== 'draft') {
    if (submit) return { id: record.id, revision: record.revision, status: record.status };
    throw new AppError(409, 'Submitted responses are read-only.');
  }
  const [version] = await db
    .select()
    .from(s.instrumentVersions)
    .where(eq(s.instrumentVersions.id, record.versionId));
  let answers: Answers;
  try {
    answers = validateAnswers(version.definition, input, submit);
  } catch (e) {
    throw new AppError(400, e instanceof Error ? e.message : 'Invalid responses.');
  }
  checkRevision(record.revision, revision);
  return db.transaction(async (tx) => {
    const [changed] = await tx
      .update(s.assessmentSessions)
      .set({
        revision: revision + 1,
        updatedAt: new Date(),
        ...(submit ? { status: 'submitted' as const, submittedAt: new Date() } : {}),
      })
      .where(
        and(
          eq(s.assessmentSessions.id, id),
          eq(s.assessmentSessions.revision, revision),
          eq(s.assessmentSessions.status, 'draft'),
        ),
      )
      .returning();
    if (!changed) {
      if (submit) {
        const [already] = await tx
          .select()
          .from(s.assessmentSessions)
          .where(eq(s.assessmentSessions.id, id));
        if (already?.status !== 'draft')
          return { id, revision: already.revision, status: already.status };
      }
      throw new AppError(409, 'This assessment changed. Reload to continue.');
    }
    await tx.delete(s.responses).where(eq(s.responses.sessionId, id));
    if (Object.keys(answers).length)
      await tx
        .insert(s.responses)
        .values(
          Object.entries(answers).map(([itemId, answer]) => ({ sessionId: id, itemId, answer })),
        );
    if (submit) {
      await tx.insert(s.scoreResults).values({
        sessionId: id,
        instrumentVersion: version.version,
        algorithmVersion: version.definition.algorithmVersion,
        derived: summarize(version.definition, answers),
      });
      await tx.insert(s.reviewTasks).values({ sessionId: id });
    }
    await tx.insert(s.auditEvents).values({
      actorId: actor.id,
      action: submit ? 'assessment.submit' : 'assessment.save',
      resourceType: 'assessment',
      resourceId: id,
    });
    return { id, revision: changed.revision, status: changed.status };
  });
}
export async function markReviewed(actor: Actor, id: string) {
  requireRole(actor, 'clinician');
  const { record } = await readAssessment(actor, id);
  if (record.status === 'draft') throw new AppError(409, 'A draft cannot be marked reviewed.');
  await db.transaction(async (tx) => {
    await tx
      .update(s.assessmentSessions)
      .set({ status: 'reviewed', updatedAt: new Date() })
      .where(eq(s.assessmentSessions.id, id));
    await tx
      .update(s.reviewTasks)
      .set({ status: 'reviewed', reviewedBy: actor.id, reviewedAt: new Date() })
      .where(eq(s.reviewTasks.sessionId, id));
    await tx.insert(s.auditEvents).values({
      actorId: actor.id,
      action: 'assessment.review',
      resourceType: 'assessment',
      resourceId: id,
    });
  });
  return { ok: true };
}
