# Deployment checklist

**Do not deploy this release for real health information.** The checklist describes what must be assessed and configured; it does not establish production readiness. GitHub Pages cannot host this authenticated server application.

## Repository and build

- [ ] Create a private GitHub repository initially; inspect source before deciding whether to publish the code.
- [ ] Enable required CI and browser checks, review protection, secret scanning, dependency updates, and private vulnerability reporting.
- [ ] Use Node 24 LTS and the committed npm lockfile. Run `npm ci`, `npm run typecheck`, `npm test`, `npm run build`, and dependency review.
- [ ] Run Playwright on both desktop and mobile-sized browsers and execute independent accessibility/security reviews.
- [ ] Keep `.env`, `.local`, dependencies, build output, database dumps, and health information out of Git.

## Database and identity

- [ ] Provision a clean PostgreSQL 17 database with appropriate encrypted storage, TLS, restricted network access, and least-privilege runtime credentials.
- [ ] Apply `npm run db:migrate` from a controlled migration job. Use a separate migration owner.
- [ ] Run `NODE_ENV=production npm run db:init` to register demonstration definitions/settings **without sample accounts**; instruments default to disabled in production.
- [ ] Provision users using `npm run user:create`, not the demo seed. Verify identity and credentials through an approved external process.
- [ ] Configure a randomly generated `BETTER_AUTH_SECRET`, exact HTTPS `BETTER_AUTH_URL`, and `DEMO_MODE=false`.
- [ ] Privileged users must enroll TOTP before receiving workspace records. Review session revocation, backup-code custody, password policies, and lost-device recovery.
- [ ] Configure and test SMTP over TLS if password recovery is offered; no token logging. Without SMTP, recovery remains explicitly unavailable.

Example operator provisioning (Bash; password is read without echo):

```bash
read -rsp 'Initial password: ' INITIAL_USER_PASSWORD
export INITIAL_USER_PASSWORD
NODE_ENV=production npm run user:create
unset INITIAL_USER_PASSWORD
```

The prompt collects email, display name, and role. Professional credentials remain unverified until a separate trusted verification process updates the clinician profile; that process is not provided by a self-service UI.

## Service governance

- [ ] Complete `docs/CLINICAL-REVIEW.md`, legal review, instrument-rights review, and privacy/security review.
- [ ] Replace demo-only consent terms with reviewed organization-specific language and a new version; implement and verify suitable non-demo workflows before real use.
- [ ] Define retention, erasure, backups, audit retention, and restoration handling. The current UI records requests but does not perform erasure.
- [ ] Configure and independently verify regional support resources. Do not imply monitoring or outreach without an actual staffed protocol.
- [ ] Verify every participant/reviewer assignment and operational-access policy.
- [ ] Use only original demo modules until legitimate instruments and independent scoring validation are added.

## Hosting and runtime

- [ ] Choose a Node-capable host with appropriate contractual terms; deploy the Next.js server and PostgreSQL, not a static export.
- [ ] Configure TLS, HSTS, strict proxy headers, secret management, encryption, dependency scanning, external audit retention, backups, restore drills, incident ownership, and request/edge limits.
- [ ] Replace/review baseline CSP and investigate all dependency findings.
- [ ] Set `DEPLOYMENT_REVIEW_ACK=true` only after the applicable reviews. This flag is an acknowledgment, never a compliance certificate.
- [ ] Run `npm start` only with a clean, non-demo database. Startup rejects seeded demo accounts and insecure configuration.
- [ ] Validate real PostgreSQL behavior, SMTP delivery, MFA, session expiry, PDF printing, accessibility, and operational recovery in staging.
- [ ] Perform a rollback and restore drill and verify no deleted data returns from backups.

No deployment was performed as part of this source delivery. The included GitHub workflow has not run on GitHub until the repository is created and pushed.
