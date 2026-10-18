import { and, desc, eq, isNull, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db';
import * as s from '../db/schema';
import { AppError, requireRole } from '../domain/authorization';
import { consentText } from '../domain/config';
import type { Actor } from '../domain/types';
import { activeConsent, authorizeClinical } from './access';
import { audit } from './assessment-service';
export async function serviceSettings() {
  const [settings] = await db.select().from(s.settings).where(eq(s.settings.id, 'service'));
  if (!settings) throw new AppError(503, 'Run database setup before opening the workspace.');
  return {
    ...settings,
    consentText: consentText(settings.retentionDays, settings.confidentialityText),
  };
}
export async function participantDetail(actor: Actor, participantId: string) {
  await authorizeClinical(actor, participantId);
  const [profile] = await db
    .select()
    .from(s.participantProfile)
    .where(eq(s.participantProfile.userId, participantId));
  const [person] = await db
    .select({ id: s.user.id, name: s.user.name })
    .from(s.user)
    .where(eq(s.user.id, participantId));
  const records = await db
    .select({
      id: s.assessmentSessions.id,
      status: s.assessmentSessions.status,
      revision: s.assessmentSessions.revision,
      versionId: s.assessmentSessions.versionId,
      submittedAt: s.assessmentSessions.submittedAt,
      updatedAt: s.assessmentSessions.updatedAt,
      name: s.instruments.name,
    })
    .from(s.assessmentSessions)
    .innerJoin(s.instrumentVersions, eq(s.instrumentVersions.id, s.assessmentSessions.versionId))
    .innerJoin(s.instruments, eq(s.instruments.id, s.instrumentVersions.instrumentId))
    .where(eq(s.assessmentSessions.participantId, participantId))
    .orderBy(desc(s.assessmentSessions.updatedAt));
  const versions = await db
    .select({
      id: s.reportVersions.id,
      number: s.reportVersions.number,
      status: s.reportVersions.status,
      createdAt: s.reportVersions.createdAt,
      signedAt: s.reportVersions.signedAt,
      amendmentReason: s.reportVersions.amendmentReason,
    })
    .from(s.reportVersions)
    .innerJoin(s.reports, eq(s.reports.id, s.reportVersions.reportId))
    .where(
      and(
        eq(s.reports.participantId, participantId),
        actor.role === 'participant' ? eq(s.reportVersions.status, 'finalized') : undefined,
      ),
    )
    .orderBy(desc(s.reportVersions.createdAt));
  const notes =
    actor.role === 'clinician'
      ? await db
          .select()
          .from(s.clinicianNotes)
          .where(eq(s.clinicianNotes.participantId, participantId))
          .orderBy(desc(s.clinicianNotes.createdAt))
      : [];
  await audit(actor, 'participant.read', 'participant', participantId);
  return { person, profile: profile ?? null, records, reports: versions, notes };
}
export async function bootstrap(actor: Actor) {
  const config = await serviceSettings();
  const [account] = await db
    .select({ twoFactorEnabled: s.user.twoFactorEnabled })
    .from(s.user)
    .where(eq(s.user.id, actor.id));
  const mfaRequired =
    process.env.NODE_ENV === 'production' &&
    actor.role !== 'participant' &&
    !account.twoFactorEnabled;
  const common = {
    actor,
    mfaRequired,
    demo: process.env.DEMO_MODE !== 'false',
    twoFactorEnabled: account.twoFactorEnabled,
    settings: config,
  };
  if (mfaRequired) return common;
  if (actor.role === 'participant') {
    const detail = await participantDetail(actor, actor.id);
    const consent = await activeConsent(actor.id);
    const library = await db
      .select({
        id: s.instrumentVersions.id,
        name: s.instruments.name,
        definition: s.instrumentVersions.definition,
        enabled: s.instruments.enabled,
      })
      .from(s.instrumentVersions)
      .innerJoin(s.instruments, eq(s.instruments.id, s.instrumentVersions.instrumentId));
    const assigned = await db
      .select()
      .from(s.assessmentAssignments)
      .where(eq(s.assessmentAssignments.participantId, actor.id));
    const reviewers = await db
      .select({ name: s.user.name })
      .from(s.assignments)
      .innerJoin(s.user, eq(s.user.id, s.assignments.clinicianId))
      .where(eq(s.assignments.participantId, actor.id));
    const deletion = await db
      .select()
      .from(s.deletionRequests)
      .where(eq(s.deletionRequests.participantId, actor.id))
      .orderBy(desc(s.deletionRequests.createdAt));
    return {
      ...common,
      ...detail,
      consent: consent ?? null,
      library,
      assigned,
      reviewers,
      deletion,
    };
  }
  if (actor.role === 'clinician') {
    const assigned = await db
      .select({ id: s.user.id, name: s.user.name })
      .from(s.assignments)
      .innerJoin(s.user, eq(s.user.id, s.assignments.participantId))
      .where(eq(s.assignments.clinicianId, actor.id));
    const participants = [];
    for (const p of assigned) {
      const consent = await activeConsent(p.id);
      if (consent) {
        const records = await db
          .select({
            id: s.assessmentSessions.id,
            status: s.assessmentSessions.status,
            updatedAt: s.assessmentSessions.updatedAt,
          })
          .from(s.assessmentSessions)
          .where(eq(s.assessmentSessions.participantId, p.id));
        participants.push({ ...p, records, consent: true });
      } else participants.push({ ...p, records: [], consent: false });
    }
    await audit(actor, 'workspace.read', 'assignment-list', actor.id);
    return { ...common, participants };
  }
  const users = await db
    .select({
      id: s.user.id,
      name: s.user.name,
      email: s.user.email,
      role: s.user.role,
      disabled: s.user.disabled,
    })
    .from(s.user)
    .orderBy(s.user.name);
  return {
    ...common,
    users,
    assignments: await db.select().from(s.assignments),
    instruments: await db.select().from(s.instruments),
    versions: await db
      .select({ id: s.instrumentVersions.id, definition: s.instrumentVersions.definition })
      .from(s.instrumentVersions),
    resources: await db.select().from(s.resources),
    deletion: await db
      .select()
      .from(s.deletionRequests)
      .orderBy(desc(s.deletionRequests.createdAt)),
    audits: await db.select().from(s.auditEvents).orderBy(desc(s.auditEvents.createdAt)).limit(100),
  };
}
export async function exportParticipant(actor: Actor) {
  requireRole(actor, 'participant');
  const detail = await participantDetail(actor, actor.id);
  const records = await db
    .select()
    .from(s.assessmentSessions)
    .where(eq(s.assessmentSessions.participantId, actor.id));
  const ids = records.map((r) => r.id);
  const raw = ids.length
    ? await db.select().from(s.responses).where(inArray(s.responses.sessionId, ids))
    : [];
  const derived = ids.length
    ? await db.select().from(s.scoreResults).where(inArray(s.scoreResults.sessionId, ids))
    : [];
  const versionIds = [...new Set(records.map((r) => r.versionId))];
  const definitions = versionIds.length
    ? await db
        .select()
        .from(s.instrumentVersions)
        .where(inArray(s.instrumentVersions.id, versionIds))
    : [];
  const finalized = await db
    .select({ version: s.reportVersions })
    .from(s.reportVersions)
    .innerJoin(s.reports, eq(s.reports.id, s.reportVersions.reportId))
    .where(and(eq(s.reports.participantId, actor.id), eq(s.reportVersions.status, 'finalized')));
  await db.transaction(async (tx) => {
    const [r] = await tx.insert(s.exportRequests).values({ participantId: actor.id }).returning();
    await tx.insert(s.auditEvents).values({
      actorId: actor.id,
      action: 'data.export',
      resourceType: 'export',
      resourceId: r.id,
    });
  });
  return {
    format: 'clearframe-export-1',
    createdAt: new Date().toISOString(),
    demo: true,
    profile: detail.profile,
    consents: await db.select().from(s.consents).where(eq(s.consents.participantId, actor.id)),
    assessments: records,
    responses: raw,
    derived,
    instrumentVersions: definitions,
    finalizedReports: finalized.map((r) => r.version),
    limitations: 'Synthetic demonstration. Internal reviewer notes are excluded.',
  };
}
export const profileInput = z
  .object({
    preferredName: z.string().trim().min(1).max(100),
    pronouns: z.string().max(100),
    language: z.string().min(1).max(80),
    timezone: z
      .string()
      .max(100)
      .refine((v) => {
        try {
          new Intl.DateTimeFormat('en', { timeZone: v });
          return true;
        } catch {
          return false;
        }
      }, 'Use an IANA time zone, e.g. America/New_York.'),
    accessibility: z.string().max(1500),
    contactPreference: z.enum(['In-app only', 'No optional contact']),
    adult: z.literal(true),
  })
  .strict();
export async function saveProfile(actor: Actor, input: unknown) {
  requireRole(actor, 'participant');
  if (!(await activeConsent(actor.id)))
    throw new AppError(403, 'Accept consent before entering profile information.');
  const { adult, ...profile } = profileInput.parse(input);
  void adult;
  await db.transaction(async (tx) => {
    await tx
      .insert(s.participantProfile)
      .values({ userId: actor.id, ...profile, adultAttestedAt: new Date() })
      .onConflictDoUpdate({
        target: s.participantProfile.userId,
        set: { ...profile, adultAttestedAt: new Date(), updatedAt: new Date() },
      });
    await tx.insert(s.auditEvents).values({
      actorId: actor.id,
      action: 'profile.update',
      resourceType: 'participant',
      resourceId: actor.id,
    });
  });
  return { ok: true };
}
export async function acceptConsent(
  actor: Actor,
  version: string,
  adult: boolean,
  accepted: boolean,
) {
  requireRole(actor, 'participant');
  if (!adult || !accepted)
    throw new AppError(400, 'Adult eligibility and explicit consent are required.');
  const config = await serviceSettings();
  if (config.consentVersion !== version)
    throw new AppError(409, 'Consent information changed. Reload and review the current version.');
  return db.transaction(async (tx) => {
    await tx
      .update(s.consents)
      .set({ withdrawnAt: new Date() })
      .where(and(eq(s.consents.participantId, actor.id), isNull(s.consents.withdrawnAt)));
    const [c] = await tx
      .insert(s.consents)
      .values({
        participantId: actor.id,
        version,
        scope: 'assessment-and-assigned-review',
        textSnapshot: config.consentText,
        optionalResearch: false,
      })
      .returning();
    await tx
      .insert(s.participantProfile)
      .values({ userId: actor.id, adultAttestedAt: new Date() })
      .onConflictDoUpdate({
        target: s.participantProfile.userId,
        set: { adultAttestedAt: new Date() },
      });
    await tx.insert(s.auditEvents).values({
      actorId: actor.id,
      action: 'consent.accept',
      resourceType: 'consent',
      resourceId: c.id,
    });
    return c;
  });
}
export async function withdraw(actor: Actor) {
  requireRole(actor, 'participant');
  await db.transaction(async (tx) => {
    await tx
      .update(s.consents)
      .set({ withdrawnAt: new Date() })
      .where(and(eq(s.consents.participantId, actor.id), isNull(s.consents.withdrawnAt)));
    await tx.insert(s.auditEvents).values({
      actorId: actor.id,
      action: 'consent.withdraw',
      resourceType: 'participant',
      resourceId: actor.id,
    });
  });
  return { ok: true };
}
export async function addNote(actor: Actor, participantId: string, source: string, body: string) {
  requireRole(actor, 'clinician');
  await authorizeClinical(actor, participantId);
  return db.transaction(async (tx) => {
    const [n] = await tx
      .insert(s.clinicianNotes)
      .values({ participantId, authorId: actor.id, source, body })
      .returning();
    await tx
      .insert(s.auditEvents)
      .values({ actorId: actor.id, action: 'note.create', resourceType: 'note', resourceId: n.id });
    return { id: n.id };
  });
}
