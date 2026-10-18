import 'dotenv/config';
import { migrate as pgMigrate } from 'drizzle-orm/node-postgres/migrator';
import { migrate as liteMigrate } from 'drizzle-orm/pglite/migrator';
import { drizzle as pgDrizzle } from 'drizzle-orm/node-postgres';
import { drizzle as liteDrizzle } from 'drizzle-orm/pglite';
import { Pool } from 'pg';
import { PGlite } from '@electric-sql/pglite';
import { mkdirSync } from 'node:fs';
async function main() {
  if (process.env.DATABASE_URL) {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    try {
      await pgMigrate(pgDrizzle(pool), { migrationsFolder: 'drizzle' });
    } finally {
      await pool.end();
    }
  } else {
    if (process.env.NODE_ENV === 'production')
      throw new Error('PostgreSQL required in production.');
    mkdirSync('.local', { recursive: true });
    const client = new PGlite(process.env.PGLITE_DIR || '.local/database');
    try {
      await liteMigrate(liteDrizzle(client), { migrationsFolder: 'drizzle' });
    } finally {
      await client.close();
    }
  }
  console.log('Migrations applied.');
}
main().catch(() => {
  console.error('Migration failed. Check database access and migration state.');
  process.exitCode = 1;
});
