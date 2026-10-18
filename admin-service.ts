import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db';
import * as s from '../db/schema';
import { AppError, requireRole } from '../domain/authorization';
import type { Actor } from '../domain/types';
const id = z.string().min(1).max(100);
const https = z
  .string()
  .url()
  .refine((v) => v.startsWith('https://'), 'Use a verified HTTPS source.');
export const adminAction = z.discriminatedUnion('action', [
  z.object({ action: z.literal('user'), id, disabled: z.boolean() }).strict(),
  z
    .object({
      action: z.literal('assignment'),
      participantId: id,
      clinicianId: id,
      remove: z.boolean(),
    })
    .strict(),
  z.object({ action: z.literal('instrument'), id, enabled: z.boolean() }).strict(),
  z.object({ action: z.literal('module'), participantId: id, versionId: id }).strict(),
  z
    .object({
      action: z.literal('settings'),
      retentionDays: z.number().int().min(1).max(3650),
      consentVersion: z.string().min(1).max(60),
      confidentialityText: z.string().min(10).max(4000),
    })
    .strict(),
  z
    .object({
      action: z.literal('resource'),
      region: z.string().min(2).max(80),
      name: z.string().min(2).max(120),
      url: https,
      sourceUrl: https,
      lastChecked: z.string().date(),
    })
    .strict(),
  z.object({ action: z.literal('resource-disable'), id }).strict(),
  z
    .object({
      action: z.literal('deletion-review'),
      id,
      status: z.enum(['reviewing', 'declined']),
      resolution: z.string().min(10).max(1500),
    })
    .strict(),
]);
export async function administer(actor: Actor, input: unknown) {
  requireRole(actor, 'admin');
  const a = adminAction.parse(input);
  return db.transaction(async (tx) => {
    let resourceId: string = actor.id;
    if (a.action === 'user') {
      if (a.id === actor.id)
        throw new AppError(400, 'You cannot disable your own administrative account.');
      const rows = await tx
        .update(s.user)
        .set({ disabled: a.disabled, updatedAt: new Date() })
        .where(eq(s.user.id, a.id))
        .returning();
      if (!rows.length) throw new AppError(404, 'Account not found.');
      if (a.disabled) await tx.delete(s.session).where(eq(s.session.userId, a.id));
      resourceId = a.id;
    }
    if (a.action === 'assignment' || a.action === 'module') {
      const [p] = await tx.select().from(s.user).where(eq(s.user.id, a.participantId));
      if (p?.role !== 'participant') throw new AppError(400, 'Select a participant account.');
      if (a.action === 'assignment') {
        const [c] = await tx.select().from(s.user).where(eq(s.user.id, a.clinicianId));
        if (c?.role !== 'clinician') throw new AppError(400, 'Select a reviewer account.');
        if (a.remove)
          await tx
            .delete(s.assignments)
            .where(
              and(
                eq(s.assignments.participantId, a.participantId),
                eq(s.assignments.clinicianId, a.clinicianId),
              ),
            );
        else
          await tx
            .insert(s.assignments)
            .values({ participantId: a.participantId, clinicianId: a.clinicianId })
            .onConflictDoNothing();
      } else {
        const [v] = await tx
          .select()
          .from(s.instrumentVersions)
          .where(eq(s.instrumentVersions.id, a.versionId));
        if (!v) throw new AppError(400, 'Unknown instrument version.');
        await tx
          .insert(s.assessmentAssignments)
          .values({ participantId: a.participantId, versionId: a.versionId, assignedBy: actor.id })
          .onConflictDoNothing();
      }
      resourceId = a.participantId;
    }
    if (a.action === 'instrument') {
      await tx
        .update(s.instruments)
        .set({ enabled: a.enabled, updatedAt: new Date() })
        .where(eq(s.instruments.id, a.id));
      resourceId = a.id;
    }
    if (a.action === 'settings') {
      const [old] = await tx.select().from(s.settings).where(eq(s.settings.id, 'service'));
      if (
        (old.confidentialityText !== a.confidentialityText ||
          old.retentionDays !== a.retentionDays) &&
        old.consentVersion === a.consentVersion
      )
        throw new AppError(400, 'Change the consent version when its terms change.');
      await tx
        .update(s.settings)
        .set({
          retentionDays: a.retentionDays,
          consentVersion: a.consentVersion,
          confidentialityText: a.confidentialityText,
          updatedAt: new Date(),
        })
        .where(eq(s.settings.id, 'service'));
      resourceId = 'service';
    }
    if (a.action === 'resource') {
      if (a.lastChecked > new Date().toISOString().slice(0, 10))
        throw new AppError(400, 'Verification date cannot be in the future.');
      const [r] = await tx
        .insert(s.resources)
        .values({
          region: a.region,
          name: a.name,
          url: a.url,
          sourceUrl: a.sourceUrl,
          lastChecked: new Date(a.lastChecked),
        })
        .returning();
      resourceId = r.id;
    }
    if (a.action === 'resource-disable') {
      await tx.update(s.resources).set({ enabled: false }).where(eq(s.resources.id, a.id));
      resourceId = a.id;
    }
    if (a.action === 'deletion-review') {
      await tx
        .update(s.deletionRequests)
        .set({
          status: a.status,
          resolution: a.resolution,
          resolvedAt: a.status === 'declined' ? new Date() : null,
        })
        .where(eq(s.deletionRequests.id, a.id));
      resourceId = a.id;
    }
    await tx.insert(s.auditEvents).values({
      actorId: actor.id,
      action: `admin.${a.action}`,
      resourceType: 'operation',
      resourceId,
    });
    return { ok: true };
  });
}
