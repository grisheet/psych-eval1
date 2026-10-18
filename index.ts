import 'dotenv/config';
import { drizzle as pgDrizzle } from 'drizzle-orm/node-postgres';
import { drizzle as liteDrizzle } from 'drizzle-orm/pglite';
import { PGlite } from '@electric-sql/pglite';
import { Pool } from 'pg';
import * as schema from './schema';
function connect() {
  if (process.env.DATABASE_URL) {
    const client = new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
    return { db: pgDrizzle(client, { schema }), close: () => client.end() };
  }
  const client = new PGlite(process.env.PGLITE_DIR || '.local/database');
  return { db: liteDrizzle(client, { schema }), close: () => client.close() };
}
const globalDb = globalThis as unknown as { clearframeDb?: ReturnType<typeof connect> };
const connection = (globalDb.clearframeDb ??= connect());
export const db = connection.db;
export const closeDb = connection.close;
export type Database = typeof db;
