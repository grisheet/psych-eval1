import 'dotenv/config';
import { db, closeDb } from '../src/db';
import * as s from '../src/db/schema';
import { registry, versionId } from '../src/domain/registry';
async function main() {
  await db.insert(s.settings).values({ id: 'service' }).onConflictDoNothing();
  for (const definition of registry) {
    await db
      .insert(s.instruments)
      .values({
        id: definition.id,
        name: definition.name,
        enabled: process.env.NODE_ENV !== 'production',
      })
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
  console.log(
    'Demo registry initialized without sample identities. Existing definitions were preserved.',
  );
}
main()
  .catch(() => {
    console.error('Registry initialization failed.');
    process.exitCode = 1;
  })
  .finally(closeDb);
