import 'dotenv/config';
import { spawn } from 'node:child_process';
import { Pool } from 'pg';
if (
  process.env.DEMO_MODE !== 'false' ||
  !process.env.DATABASE_URL?.startsWith('postgres') ||
  !process.env.BETTER_AUTH_URL?.startsWith('https://') ||
  process.env.DEPLOYMENT_REVIEW_ACK !== 'true' ||
  !process.env.BETTER_AUTH_SECRET ||
  process.env.BETTER_AUTH_SECRET.length < 32 ||
  /demo|example|change-me/i.test(process.env.BETTER_AUTH_SECRET)
)
  throw new Error(
    'Production refused: configure PostgreSQL, HTTPS, a random secret, DEMO_MODE=false, and complete the deployment checklist.',
  );
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
try {
  const result = await pool.query(
    "select count(*)::int as count from app_user where email like '%@demo.invalid'",
  );
  if (result.rows[0].count > 0)
    throw new Error(
      'Production refuses a database containing synthetic demo accounts. Use a clean database.',
    );
} finally {
  await pool.end();
}
const child = spawn('node', ['node_modules/next/dist/bin/next', 'start'], {
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: 'production' },
});
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => child.kill(signal));
child.on('exit', (code) => process.exit(code ?? 1));
