import 'dotenv/config';
import { createInterface } from 'node:readline/promises';
import { hashPassword } from 'better-auth/crypto';
import { z } from 'zod';
import { db, closeDb } from '../src/db';
import * as s from '../src/db/schema';
// Provisioning is a trusted operator task. Role changes are never accepted at sign-in.
async function main() {
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  const email = z.email().parse(await prompt.question('Email: '));
  const name = z
    .string()
    .min(1)
    .max(100)
    .parse(await prompt.question('Display name: '));
  const role = z.enum(['participant', 'clinician', 'admin']).parse(await prompt.question('Role: '));
  prompt.close();
  const secret = process.env.INITIAL_USER_PASSWORD;
  if (!secret || secret.length < 14)
    throw new Error(
      'Set INITIAL_USER_PASSWORD via a secret manager or hidden shell prompt (14+ characters).',
    );
  if (
    process.env.NODE_ENV === 'production' &&
    (email.endsWith('@demo.invalid') || secret === 'Clearframe-demo-2026!')
  )
    throw new Error('Demo credentials are forbidden in production.');
  const password = await hashPassword(secret);
  await db.transaction(async (tx) => {
    const [u] = await tx.insert(s.user).values({ email, name, role }).returning();
    await tx
      .insert(s.account)
      .values({ userId: u.id, accountId: u.id, providerId: 'credential', password });
    if (role === 'clinician') await tx.insert(s.clinicianProfile).values({ userId: u.id });
    await tx.insert(s.auditEvents).values({
      actorId: u.id,
      action: 'account.provision',
      resourceType: 'user',
      resourceId: u.id,
    });
  });
  console.log(
    'Account provisioned. Verify identity and professional credentials through the reviewed organizational process.',
  );
}
main()
  .catch(() => {
    console.error('Account creation failed. Check inputs and database configuration.');
    process.exitCode = 1;
  })
  .finally(closeDb);
