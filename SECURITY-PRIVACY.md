# Security and privacy: implemented controls and residual risks

This document describes code and configuration, not certification. Do not collect real health information with this release. Independent security, clinical, accessibility, legal, and operational review remains necessary.

## Implemented controls

- Better Auth 1.7.10: hashed passwords, opaque database sessions, cookie-based authentication, password reset token handling, TOTP and backup-code support. Public sign-up is disabled; roles are server-defined.
- Eight-hour sessions with refresh, cookie cache disabled, secure cookies on configured HTTPS origins, database-backed authentication rate limits. Account disablement deletes active sessions; protected requests also check the database’s disabled flag.
- Server-side ownership checks, explicit reviewer assignments, active consent checks, and operational/clinical separation. Account IDs supplied by a caller never establish access.
- Production privileged workspaces require MFA enrollment; authentication uses Better Auth’s TOTP flow. Enrollment, lost-device recovery, old-session revocation, and privileged step-up policies need independent operational testing before deployment.
- Mutation endpoints require the exact configured Origin, JSON content type, bounded request size, strict Zod validation, and authenticated identity. Unknown keys cannot set roles or override ownership.
- Parameterized Drizzle queries and React output escaping. No participant HTML rendering, SQL-string interpolation, or AI prompt execution.
- Per-user persistent request limits; authentication endpoints have their own limits. In-memory form state only; no assessment localStorage/sessionStorage. Do not add session replay.
- Revision-based updates; transactional submissions and report finalization; immutable instrument versions and finalized report snapshots; append-only audit events.
- Minimal audits contain identifiers and event names, never answers or notes. Participant JSON exports and reports omit internal notes.
- No-store application responses, nosniff, frame denial, referrer restrictions, restrictive Permissions-Policy, and baseline CSP. No external fonts, tracking pixels, or analytics. Next build telemetry can be disabled with `NEXT_TELEMETRY_DISABLED=1`.
- Production start refuses demo mode, non-PostgreSQL storage, non-HTTPS origin, short/example secrets, missing deployment acknowledgment, and a database with seeded demo accounts. Runtime protected requests also reject demo identities in production.

## Residual risks and required configuration

1. **CSP:** Inline scripts/styles remain allowed for framework hydration and dynamic presentation. Development also permits eval. A reviewed nonce-based CSP, integration testing, and strict production proxy headers are still needed. This baseline is not a complete XSS defense.
2. **TLS and encryption:** TLS termination, HSTS, database TLS verification, database/volume encryption, backup encryption, secret-manager/KMS integration, and key rotation are infrastructure responsibilities. PGlite demo files are not encrypted by this app.
3. **Database privilege:** Application code does not replace PostgreSQL least privilege. Use separate migration/runtime roles; prohibit table-owner privileges, trigger modification, and direct record access for ordinary operators. Review backup/restore privileges. This release does not implement PostgreSQL row-level security.
4. **Authorization races:** Revision checks protect content edits. Assignment/consent checks happen per request; simultaneous revocation and in-flight reads/writes have not been proven serializable. Review stronger transactional locking and revocation semantics before high-assurance use.
5. **Session controls:** Idle timeout, device/session inventory, managed identity integration, forced MFA enrollment policy, reauthentication for signing/export, trusted-proxy/IP policy, and account recovery have not received an independent security audit.
6. **Rate limits:** Application and auth limits are tested. Distributed edge throttling, credential-stuffing protection, load limits, request timeouts, and denial-of-service resilience remain deployment tasks. Rate-limit bucket expiry/maintenance is not automated.
7. **Audit:** In-database triggers protect application-level history. A database owner can bypass them. External immutable audit storage, monitoring, alerting, log access controls, denial-event policy, and SIEM integration are not implemented.
8. **Privacy operations:** Request tracking is implemented; actual erasure is deliberately not automated. Administrators cannot falsely mark requests as fulfilled in the UI. Legal retention, audit retention, report immutability, litigation holds, and backup expiry need a written policy and operator procedure.
9. **Scope:** Single organization only. There is no tenant key or verified multi-tenant isolation. Do not repurpose accounts as separate organizations.
10. **Reports:** Application-level finalization is not proof of identity, professional qualification, legally binding signature, or clinical approval. Demo reviewer credentials are not invented. Production credential verification requires a trusted external process.
11. **Accessibility:** Semantic HTML, labels, keyboard controls, visible focus, status announcements, responsive layouts, and reduced-motion rules are implemented. Automated browser checks are provided but were not executed locally. Manual screen-reader, zoom, contrast, print, and keyboard audits remain.

## Data export and deletion procedure

The participant previews their export in memory before downloading it. Exports contain sensitive information if operators misuse the demo with real data; no downloaded file is automatically encrypted. Participants are told to store it privately.

Deletion requests contain the participant ID, lifecycle state, timestamps, and participant-visible operator explanation. The administrator may mark a request under review or decline it with an explanation. Fulfillment requires an authorized, reviewed runbook that:

- verifies the requester and applicable legal obligations;
- identifies profile, responses, scores, reports, notes, account/session data, audit IDs, exports, and backup copies;
- resolves retention holds and immutable-history requirements explicitly;
- uses a separately privileged maintenance process with a reviewed change record;
- removes or de-identifies approved records and expires backups according to policy;
- records evidence of completion and verifies restoration will not reintroduce erased data.

No fictional automatic purge or backup erasure is claimed. The configured retention value is a target, not an implemented scheduler.

## Hosting and incident readiness

Use an appropriate hosting agreement and assess jurisdiction-dependent obligations with qualified counsel. No HIPAA, GDPR, medical-device, or other regulatory compliance is claimed. Prepare a breach-response owner, access review cadence, emergency contacts for the organization, recovery objectives, tested restore procedures, and incident communication process. Do not send health information to GitHub issues or workflow artifacts.
