# Verification record

Checked in the authoring environment on **2026-10-17**, using Node **24.19.0** and npm **11.9.0**. These results apply to the delivered source, not a deployed clinical service.

| Check                                                   | Actual result                                                            | Boundary                                                                               |
| ------------------------------------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| `npm run setup:demo`                                    | Passed; migrations and synthetic seed executed, including a repeat setup | Local PGlite, no external PostgreSQL server                                            |
| `npm run db:generate`                                   | Passed; no unrecorded schema changes                                     | Includes generation after the esbuild dependency override                              |
| `npm run typecheck`                                     | Passed                                                                   | Strict TypeScript compile-time checks                                                  |
| `npm test`                                              | **55 passed**, 3 files                                                   | Domain, real embedded database, Better Auth/HTTP handlers, server-rendered report HTML |
| `NEXT_TELEMETRY_DISABLED=1 npm run build`               | Passed; all application routes compiled                                  | Does not prove browser behavior or production infrastructure                           |
| `npm audit --omit=dev --json`                           | **0 known vulnerabilities reported**                                     | Point-in-time registry result, not a security audit                                    |
| Client static-bundle exact-secret check                 | Passed; zero occurrences of the actual local server secret               | Exact configured values only; not a general proof against all leaks                    |
| Production startup with demo configuration              | Correctly refused                                                        | Startup configuration guard, not a real production launch                              |
| Selected text-color contrast calculations               | Low-contrast text colors adjusted                                        | Static color pairs only; no completed rendered accessibility audit                     |
| Playwright end-to-end tests                             | **Not executed here**                                                    | Browser-control infrastructure unavailable; tests are included for local/CI execution  |
| Axe browser accessibility checks                        | **Not executed here**                                                    | Included in Playwright; no WCAG conformance claim                                      |
| PostgreSQL server integration                           | **Not executed here**                                                    | PostgreSQL 17 service configured in GitHub Actions browser job                         |
| SMTP recovery delivery                                  | **Not executed**                                                         | Requires configured SMTP service                                                       |
| TOTP enrollment / backup-code browser flow              | **Not executed**                                                         | Implemented using Better Auth; needs staging verification                              |
| GitHub Actions run                                      | **Not executed on GitHub**                                               | Repository has not been created/pushed by this delivery                                |
| Mobile/tablet visual QA and screen-reader audit         | **Not executed**                                                         | Responsive styles and semantics are implemented but not independently audited          |
| Load, penetration, backup/restore and regulatory review | **Not performed**                                                        | Required before any real clinical use                                                  |

## What the passing tests exercise

- Nonclinical completeness: empty/all-answer examples, zero and maximum boundaries, missing states, invalid inputs, unsupported algorithms, version metadata, conditional visibility, protected/unknown fields, and no invented scores.
- Authorization: participant ownership, cross-user IDs, explicit reviewer assignment, operational admin exclusion, absence/withdrawal of consent, unauthenticated/forged/expired sessions, and export protection.
- Workflow: consent snapshot, start/reuse, persistence/resume, stale revision refusal, version pinning, disabled-new-start behavior, duplicate submission handling, immutable submitted responses, and explicit review.
- Reports: empty observations remain unassessed; finalization needs review, limitations, and follow-up; finalized versions and instrument definitions resist direct database mutation; amendments preserve parents; participant draft access is refused.
- Privacy/security: internal notes excluded from reports/exports; actor roles cannot be injected; SQL-like and script-like content remains data; CSP-independent React output escaping; Origin rejection; per-user rate limits; minimal append-only audit history.
- Rendering: prominent draft/demo labels and escaped participant text in server-rendered report HTML.

## Dependency remediation

The initial audit found a moderate advisory in an older esbuild dependency used by Drizzle tooling. The final manifest pins esbuild 0.28.2 and applies the npm override `esbuild: "$esbuild"`, deduplicating the toolchain to that version. The generation command, unit/integration tests, and build were rerun afterward. The final runtime audit reported zero vulnerabilities. Review future dependency updates normally; do not remove or change this override without rechecking the tooling path.

## How to finish browser verification

On a machine with browser support:

```bash
npm ci
npm run setup:demo
npx playwright install chromium
npm run test:e2e
```

Use a fresh synthetic database for the browser suite. The suite covers consent, profile, save/resume, navigation, submission, reviewer note exclusion, report finalization/amendment, cross-user access, public support, keyboard focus, and axe checks. The CI browser job uses PostgreSQL 17. Screenshots, video, and traces are disabled to avoid routine collection of sensitive form content if the environment is misused.
