# Contributing to Clearframe

Use synthetic data only. A polished contribution is not evidence of clinical validation.

1. Create a branch from `main`.
2. Run `npm ci` and `npm run setup:demo`.
3. Keep definitions, calculations, authorization, persistence, and UI separate.
4. Run `npm run format`, `npm run typecheck`, `npm test`, and `npm run build`.
5. Run `npx playwright install chromium` and `npm run test:e2e` in a browser-capable environment.
6. Open a pull request documenting actual checks and limits.

Do not change an existing instrument version. Add a new version and preserve historical definitions. Do not edit signed report snapshots. Use amendments. Any new established measure needs verified wording, scoring, permission, appropriate population, and clinical sign-off before implementation. Do not paste restricted items into issues.

Do not add patient data, screenshots of real records, credentials, database backups, or private exports to GitHub. Review `.gitignore` and `git diff --cached` before committing. Security issues belong in private reporting, never a public issue with sensitive details.

Recommended branch protection: require CI and browser jobs, require an independent review, dismiss stale approvals, block force pushes, and enable secret scanning. The repository owner must configure these settings on GitHub; files alone do not activate them.
