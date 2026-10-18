import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    include: ['tests/**/*.test.ts'],
    fileParallelism: false,
    pool: 'threads',
    maxWorkers: 1,
    testTimeout: 30000,
    hookTimeout: 60000,
    env: {
      BETTER_AUTH_SECRET: 'test-only-secret-9a7b22d6f819ce88d9220f3a76430e64',
      BETTER_AUTH_URL: 'http://localhost:3000',
      DEMO_MODE: 'true',
      PGLITE_DIR: 'memory://',
      DATABASE_URL: '',
    },
  },
});
