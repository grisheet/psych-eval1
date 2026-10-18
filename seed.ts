import 'dotenv/config';
import { hashPassword } from 'better-auth/crypto';
import { db, closeDb } from '../src/db';
import * as s from '../src/db/schema';
import { registry, versionId } from '../src/domain/registry';
import { consentText } from '../src/domain/config';
import { summarize } from '../src/domain/assessment';
async function main() {
  if (process.env.NODE_ENV === 'production' || process.env.DEMO_MODE !== 'true')
    throw new Error('Synthetic seed requires local DEMO_MODE=true.');
  const password = await hashPassword('Clearframe-demo-2026!');
  const people = [
    ['demo-participant', 'Alex Morgan', 'alex@demo.invalid', 'participant'],
    ['demo-participant-2', 'Jordan Ellis', 'jordan@demo.invalid', 'participant'],
    ['demo-clinician', 'Taylor · Demo reviewer', 'reviewer@demo.invalid', 'clinician'],
    ['demo-admin', 'Casey · Operations', 'admin@demo.invalid', 'admin'],
  ] as const;
  for (const [id, name, email, role] of people) {
    await db
      .insert(s.user)
      .values({ id, name, email, role, emailVerified: true })
      .onConflictDoNothing();
    await db
      .insert(s.account)
      .values({
        id: `credential-${id}`,
        userId: id,
        accountId: id,
        providerId: 'credential',
        password,
      })
      .onConflictDoNothing();
  }
  await db
    .insert(s.clinicianProfile)
    .values({ userId: 'demo-clinician', credentials: null, credentialsVerified: false })
    .onConflictDoNothing();
  await db
    .insert(s.assignments)
    .values({
      id: 'demo-assignment',
      participantId: 'demo-participant',
      clinicianId: 'demo-clinician',
    })
    .onConflictDoNothing();
  await db.insert(s.settings).values({ id: 'service' }).onConflictDoNothing();
  for (const definition of registry) {
    await db
      .insert(s.instruments)
      .values({ id: definition.id, name: definition.name })
      .onConflictDoNothing();
    await db
      .insert(s.instrumentVersions)
      .values({
        id: versionId(definition),
        instrumentId: definition.id,
        version: definition.version,
        definition,
      })
      .onConflictDoNothing();
  }
  // Alex starts with a blank consent flow. Jordan is an unassigned isolation fixture.
  await db
    .insert(s.participantProfile)
    .values({
      userId: 'demo-participant-2',
      preferredName: 'Jordan (synthetic)',
      adultAttestedAt: new Date(),
    })
    .onConflictDoNothing();
  await db
    .insert(s.consents)
    .values({
      id: 'demo-jordan-consent',
      participantId: 'demo-participant-2',
      version: 'demo-1',
      scope: 'assessment-and-assigned-review',
      textSnapshot: consentText(30, 'Synthetic information only.'),
    })
    .onConflictDoNothing();
  await db
    .insert(s.assessmentSessions)
    .values({
      id: 'demo-private-assessment',
      participantId: 'demo-participant-2',
      versionId: 'intake@1.0.0',
      consentId: 'demo-jordan-consent',
      status: 'submitted',
      submittedAt: new Date(),
    })
    .onConflictDoNothing();
  const answers = {
    concerns: {
      state: 'answered' as const,
      value: 'Synthetic fixture: adjusting to a new class schedule.',
    },
  };
  await db
    .insert(s.responses)
    .values({
      id: 'demo-private-response',
      sessionId: 'demo-private-assessment',
      itemId: 'concerns',
      answer: answers.concerns,
    })
    .onConflictDoNothing();
  await db
    .insert(s.scoreResults)
    .values({
      sessionId: 'demo-private-assessment',
      instrumentVersion: '1.0.0',
      algorithmVersion: 'completeness-1.0.0',
      derived: summarize(registry[0], answers),
    })
    .onConflictDoNothing();
  console.log(
    'Synthetic accounts ready: alex@demo.invalid, reviewer@demo.invalid, admin@demo.invalid. Password: Clearframe-demo-2026!',
  );
}
main()
  .catch(() => {
    console.error('Seeding failed. No real data should be used in this demo.');
    process.exitCode = 1;
  })
  .finally(closeDb);
