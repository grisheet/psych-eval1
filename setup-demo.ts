import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
if (process.env.NODE_ENV === 'production')
  throw new Error('Demo setup is restricted to local development.');
mkdirSync('.local', { recursive: true });
if (!existsSync('.env'))
  writeFileSync(
    '.env',
    `BETTER_AUTH_SECRET=${randomBytes(48).toString('base64url')}\nBETTER_AUTH_URL=http://localhost:3000\nDEMO_MODE=true\nNEXT_TELEMETRY_DISABLED=1\n`,
    { mode: 0o600 },
  );
execFileSync('node', ['--import', 'tsx', 'scripts/migrate.ts'], { stdio: 'inherit' });
execFileSync('node', ['--import', 'tsx', 'scripts/seed.ts'], { stdio: 'inherit' });
console.log(
  'Demo ready. Run npm run dev and open http://localhost:3000. Use synthetic information only.',
);
