import { and, eq, isNull, desc } from 'drizzle-orm';
import { headers } from 'next/headers';
import { db } from '../db';
import { user, assignments, consents, participantProfile, settings } from '../db/schema';
import { auth } from '../lib/auth';
import { AppError, canReadClinical, requireRole } from '../domain/authorization';
import { validateRuntime } from '../domain/config';
import type { Actor } from '../domain/types';
export async function currentActor(): Promise<Actor> {
  validateRuntime(process.env);
  const identity = await auth.api.getSession({ headers: await headers() });
  if (!identity) throw new AppError(401, 'Your session has expired. Sign in again to continue.');
  const [u] = await db.select().from(user).where(eq(user.id, identity.user.id));
  if (!u || u.disabled) throw new AppError(403, 'This account is unavailable.');
  if (process.env.NODE_ENV === 'production' && u.email.endsWith('@demo.invalid'))
    throw new AppError(403, 'Demo identities cannot be used in production.');
  return { id: u.id, name: u.name, role: u.role };
}
export async function activeConsent(participantId: string) {
  const [c] = await db
    .select()
    .from(consents)
    .where(and(eq(consents.participantId, participantId), isNull(consents.withdrawnAt)))
    .orderBy(desc(consents.createdAt));
  return c;
}
export async function authorizeClinical(actor: Actor, participantId: string) {
  const assigned =
    actor.role === 'clinician'
      ? !!(
          await db
            .select({ id: assignments.id })
            .from(assignments)
            .where(
              and(
                eq(assignments.clinicianId, actor.id),
                eq(assignments.participantId, participantId),
              ),
            )
            .limit(1)
        )[0]
      : false;
  if (!canReadClinical(actor, participantId, assigned))
    throw new AppError(403, 'You do not have access to this record.');
  if (actor.role === 'clinician' && !(await activeConsent(participantId)))
    throw new AppError(403, 'Participant consent is absent or withdrawn.');
}
export async function requireCollection(actor: Actor) {
  requireRole(actor, 'participant');
  const [profile] = await db
    .select()
    .from(participantProfile)
    .where(eq(participantProfile.userId, actor.id));
  if (!profile?.adultAttestedAt)
    throw new AppError(403, 'Complete the adult eligibility step first.');
  const consent = await activeConsent(actor.id);
  if (!consent)
    throw new AppError(403, 'Active consent is required before collecting assessment information.');
  const [config] = await db.select().from(settings).where(eq(settings.id, 'service'));
  if (config.consentVersion !== consent.version)
    throw new AppError(
      403,
      'Consent terms changed. Review and accept the current consent version before continuing.',
    );
  return consent;
}
export async function requirePrivilegedMfa(actor: Actor) {
  if (process.env.NODE_ENV !== 'production' || actor.role === 'participant') return;
  const [u] = await db.select().from(user).where(eq(user.id, actor.id));
  if (!u?.twoFactorEnabled)
    throw new AppError(
      403,
      'Set up two-factor authentication in Account before using this workspace.',
    );
}
