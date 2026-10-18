import { z } from 'zod';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import * as s from '@/db/schema';
import { AppError, requireRole } from '@/domain/authorization';
import { currentActor, requirePrivilegedMfa } from '@/server/access';
import {
  readAssessment,
  startAssessment,
  saveAssessment,
  markReviewed,
} from '@/server/assessment-service';
import { readReport, createReport, saveReport, amendReport } from '@/server/report-service';
import {
  bootstrap,
  participantDetail,
  exportParticipant,
  saveProfile,
  acceptConsent,
  withdraw,
  addNote,
} from '@/server/workspace-service';
import { administer } from '@/server/admin-service';
import { body, failure, limit } from '@/server/http';
export const dynamic = 'force-dynamic';
const id = z.string().min(1).max(100),
  rev = z.number().int().min(0);
const mutation = z.discriminatedUnion('action', [
  z.object({ action: z.literal('profile'), profile: z.unknown() }).strict(),
  z
    .object({
      action: z.literal('consent'),
      version: id,
      adult: z.boolean(),
      accepted: z.boolean(),
    })
    .strict(),
  z.object({ action: z.literal('withdraw') }).strict(),
  z.object({ action: z.literal('start'), versionId: id }).strict(),
  z
    .object({
      action: z.literal('save'),
      id,
      revision: rev,
      answers: z.unknown(),
      submit: z.boolean(),
    })
    .strict(),
  z.object({ action: z.literal('review'), id }).strict(),
  z
    .object({
      action: z.literal('note'),
      participantId: id,
      source: z.enum([
        'Participant report',
        'Direct clinician observation',
        'Third-party information',
        'Clinician interpretation',
      ]),
      text: z.string().trim().min(1).max(6000),
    })
    .strict(),
  z.object({ action: z.literal('report-create'), participantId: id }).strict(),
  z
    .object({
      action: z.literal('report-save'),
      id,
      revision: rev,
      fields: z.unknown(),
      finalize: z.boolean(),
      attested: z.boolean(),
    })
    .strict(),
  z.object({ action: z.literal('report-amend'), id, reason: z.string().min(8).max(1500) }).strict(),
  z.object({ action: z.literal('admin'), operation: z.unknown() }).strict(),
  z.object({ action: z.literal('delete-request'), confirmed: z.literal(true) }).strict(),
]);
export async function GET(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  try {
    const actor = await currentActor();
    await limit(actor.id);
    const { path } = await params;
    if (path[0] !== 'bootstrap') await requirePrivilegedMfa(actor);
    let result: unknown;
    if (path[0] === 'bootstrap') result = await bootstrap(actor);
    else if (path[0] === 'assessment' && path[1])
      result = await readAssessment(actor, id.parse(path[1]));
    else if (path[0] === 'participant' && path[1])
      result = await participantDetail(actor, id.parse(path[1]));
    else if (path[0] === 'report' && path[1]) result = await readReport(actor, id.parse(path[1]));
    else if (path[0] === 'export') {
      result = await exportParticipant(actor);
      return Response.json(result, {
        headers: {
          'Content-Disposition': 'attachment; filename="clearframe-export.json"',
          'Cache-Control': 'no-store',
        },
      });
    } else throw new AppError(404, 'Page not found.');
    return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  try {
    const input = mutation.parse(await body(request));
    const actor = await currentActor();
    await requirePrivilegedMfa(actor);
    await limit(actor.id);
    let result: unknown;
    switch (input.action) {
      case 'profile':
        result = await saveProfile(actor, input.profile);
        break;
      case 'consent':
        result = await acceptConsent(actor, input.version, input.adult, input.accepted);
        break;
      case 'withdraw':
        result = await withdraw(actor);
        break;
      case 'start':
        result = await startAssessment(actor, input.versionId);
        break;
      case 'save':
        result = await saveAssessment(actor, input.id, input.revision, input.answers, input.submit);
        break;
      case 'review':
        result = await markReviewed(actor, input.id);
        break;
      case 'note':
        result = await addNote(actor, input.participantId, input.source, input.text);
        break;
      case 'report-create':
        result = await createReport(actor, input.participantId);
        break;
      case 'report-save':
        result = await saveReport(
          actor,
          input.id,
          input.revision,
          input.fields,
          input.finalize,
          input.attested,
        );
        break;
      case 'report-amend':
        result = await amendReport(actor, input.id, input.reason);
        break;
      case 'admin':
        result = await administer(actor, input.operation);
        break;
      case 'delete-request':
        requireRole(actor, 'participant');
        result = await db.transaction(async (tx) => {
          const [existing] = await tx
            .select()
            .from(s.deletionRequests)
            .where(
              and(
                eq(s.deletionRequests.participantId, actor.id),
                inArray(s.deletionRequests.status, ['pending', 'reviewing']),
              ),
            );
          if (existing) return existing;
          const [r] = await tx
            .insert(s.deletionRequests)
            .values({ participantId: actor.id })
            .returning();
          await tx.insert(s.auditEvents).values({
            actorId: actor.id,
            action: 'deletion.request',
            resourceType: 'deletion',
            resourceId: r.id,
          });
          return r;
        });
        break;
    }
    return Response.json(result);
  } catch (e) {
    return failure(e);
  }
}
