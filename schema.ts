import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  bigint,
  jsonb,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import type { InstrumentDefinition, Answer, DerivedResult, ReportSnapshot } from '../domain/types';
const id = () =>
  text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());
const created = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updated = () => timestamp('updated_at', { withTimezone: true }).notNull().defaultNow();
export const user = pgTable('app_user', {
  id: id(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  role: text('role')
    .$type<'participant' | 'clinician' | 'admin'>()
    .notNull()
    .default('participant'),
  disabled: boolean('disabled').notNull().default(false),
  twoFactorEnabled: boolean('two_factor_enabled').default(false),
  createdAt: created(),
  updatedAt: updated(),
});
export const session = pgTable(
  'auth_session',
  {
    id: id(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    token: text('token').notNull().unique(),
    createdAt: created(),
    updatedAt: updated(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  (t) => [index('session_user').on(t.userId)],
);
export const account = pgTable('auth_account', {
  id: id(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
  scope: text('scope'),
  password: text('password'),
  createdAt: created(),
  updatedAt: updated(),
});
export const verification = pgTable('auth_verification', {
  id: id(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: created(),
  updatedAt: updated(),
});
export const twoFactor = pgTable('auth_two_factor', {
  id: id(),
  secret: text('secret').notNull(),
  backupCodes: text('backup_codes').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  verified: boolean('verified').default(false),
  failedVerificationCount: integer('failed_verification_count').default(0),
  lockedUntil: timestamp('locked_until', { withTimezone: true }),
});
export const rateLimit = pgTable('auth_rate_limit', {
  id: id(),
  key: text('key').unique(),
  count: integer('count'),
  lastRequest: bigint('last_request', { mode: 'number' }),
});
export const participantProfile = pgTable('participant_profile', {
  userId: text('user_id')
    .primaryKey()
    .references(() => user.id),
  preferredName: text('preferred_name').notNull().default(''),
  pronouns: text('pronouns'),
  language: text('language').notNull().default('English'),
  timezone: text('timezone').notNull().default('America/New_York'),
  accessibility: text('accessibility'),
  contactPreference: text('contact_preference').notNull().default('In-app only'),
  adultAttestedAt: timestamp('adult_attested_at', { withTimezone: true }),
  updatedAt: updated(),
});
export const clinicianProfile = pgTable('clinician_profile', {
  userId: text('user_id')
    .primaryKey()
    .references(() => user.id),
  credentials: text('credentials'),
  credentialsVerified: boolean('credentials_verified').notNull().default(false),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),
});
export const assignments = pgTable(
  'assignment',
  {
    id: id(),
    participantId: text('participant_id')
      .notNull()
      .references(() => user.id),
    clinicianId: text('clinician_id')
      .notNull()
      .references(() => user.id),
    createdAt: created(),
  },
  (t) => [uniqueIndex('assignment_pair').on(t.participantId, t.clinicianId)],
);
export const consents = pgTable(
  'consent',
  {
    id: id(),
    participantId: text('participant_id')
      .notNull()
      .references(() => user.id),
    version: text('version').notNull(),
    scope: text('scope').notNull(),
    optionalResearch: boolean('optional_research').notNull().default(false),
    textSnapshot: text('text_snapshot').notNull(),
    createdAt: created(),
    withdrawnAt: timestamp('withdrawn_at', { withTimezone: true }),
  },
  (t) => [index('consent_participant').on(t.participantId)],
);
export const instruments = pgTable('instrument', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  enabled: boolean('enabled').notNull().default(true),
  createdAt: created(),
  updatedAt: updated(),
});
export const instrumentVersions = pgTable(
  'instrument_version',
  {
    id: text('id').primaryKey(),
    instrumentId: text('instrument_id')
      .notNull()
      .references(() => instruments.id),
    version: text('version').notNull(),
    definition: jsonb('definition').$type<InstrumentDefinition>().notNull(),
    createdAt: created(),
  },
  (t) => [uniqueIndex('instrument_version_pair').on(t.instrumentId, t.version)],
);
export const assessmentAssignments = pgTable(
  'assessment_assignment',
  {
    id: id(),
    participantId: text('participant_id')
      .notNull()
      .references(() => user.id),
    versionId: text('version_id')
      .notNull()
      .references(() => instrumentVersions.id),
    assignedBy: text('assigned_by')
      .notNull()
      .references(() => user.id),
    createdAt: created(),
  },
  (t) => [uniqueIndex('module_assignment_pair').on(t.participantId, t.versionId)],
);
export const assessmentSessions = pgTable(
  'assessment_session',
  {
    id: id(),
    participantId: text('participant_id')
      .notNull()
      .references(() => user.id),
    versionId: text('version_id')
      .notNull()
      .references(() => instrumentVersions.id),
    consentId: text('consent_id')
      .notNull()
      .references(() => consents.id),
    status: text('status').$type<'draft' | 'submitted' | 'reviewed'>().notNull().default('draft'),
    revision: integer('revision').notNull().default(0),
    createdAt: created(),
    updatedAt: updated(),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
  },
  (t) => [index('assessment_owner').on(t.participantId)],
);
export const responses = pgTable(
  'response',
  {
    id: id(),
    sessionId: text('session_id')
      .notNull()
      .references(() => assessmentSessions.id),
    itemId: text('item_id').notNull(),
    answer: jsonb('answer').$type<Answer>().notNull(),
    updatedAt: updated(),
  },
  (t) => [uniqueIndex('response_item').on(t.sessionId, t.itemId)],
);
export const scoreResults = pgTable('score_result', {
  sessionId: text('session_id')
    .primaryKey()
    .references(() => assessmentSessions.id),
  instrumentVersion: text('instrument_version').notNull(),
  algorithmVersion: text('algorithm_version').notNull(),
  derived: jsonb('derived').$type<DerivedResult>().notNull(),
  createdAt: created(),
});
export const reviewTasks = pgTable('review_task', {
  id: id(),
  sessionId: text('session_id')
    .notNull()
    .unique()
    .references(() => assessmentSessions.id),
  status: text('status').notNull().default('open'),
  reviewedBy: text('reviewed_by').references(() => user.id),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  createdAt: created(),
});
export const clinicianNotes = pgTable('clinician_note', {
  id: id(),
  participantId: text('participant_id')
    .notNull()
    .references(() => user.id),
  authorId: text('author_id')
    .notNull()
    .references(() => user.id),
  source: text('source').notNull(),
  body: text('body').notNull(),
  createdAt: created(),
});
export const reports = pgTable('report', {
  id: id(),
  participantId: text('participant_id')
    .notNull()
    .references(() => user.id),
  authorId: text('author_id')
    .notNull()
    .references(() => user.id),
  createdAt: created(),
});
export const reportVersions = pgTable(
  'report_version',
  {
    id: id(),
    reportId: text('report_id')
      .notNull()
      .references(() => reports.id),
    number: integer('number').notNull(),
    status: text('status').$type<'draft' | 'finalized'>().notNull().default('draft'),
    revision: integer('revision').notNull().default(0),
    snapshot: jsonb('snapshot').$type<ReportSnapshot>().notNull(),
    signedBy: text('signed_by').references(() => user.id),
    signedAt: timestamp('signed_at', { withTimezone: true }),
    amendmentReason: text('amendment_reason'),
    parentVersionId: text('parent_version_id'),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [uniqueIndex('report_version_number').on(t.reportId, t.number)],
);
export const auditEvents = pgTable(
  'audit_event',
  {
    id: id(),
    actorId: text('actor_id')
      .notNull()
      .references(() => user.id),
    action: text('action').notNull(),
    resourceType: text('resource_type').notNull(),
    resourceId: text('resource_id').notNull(),
    createdAt: created(),
  },
  (t) => [index('audit_time').on(t.createdAt)],
);
export const exportRequests = pgTable('export_request', {
  id: id(),
  participantId: text('participant_id')
    .notNull()
    .references(() => user.id),
  status: text('status').notNull().default('completed'),
  createdAt: created(),
});
export const deletionRequests = pgTable('deletion_request', {
  id: id(),
  participantId: text('participant_id')
    .notNull()
    .references(() => user.id),
  status: text('status')
    .$type<'pending' | 'reviewing' | 'fulfilled' | 'declined'>()
    .notNull()
    .default('pending'),
  resolution: text('resolution'),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  createdAt: created(),
});
export const resources = pgTable('resource_entry', {
  id: id(),
  region: text('region').notNull(),
  name: text('name').notNull(),
  url: text('url').notNull(),
  sourceUrl: text('source_url').notNull(),
  lastChecked: timestamp('last_checked', { withTimezone: true }).notNull(),
  enabled: boolean('enabled').notNull().default(true),
  createdAt: created(),
});
export const settings = pgTable('operational_setting', {
  id: text('id').primaryKey().default('service'),
  retentionDays: integer('retention_days').notNull().default(30),
  consentVersion: text('consent_version').notNull().default('demo-1'),
  confidentialityText: text('confidentiality_text')
    .notNull()
    .default(
      'Synthetic demonstration only. Organization-specific confidentiality terms are not configured.',
    ),
  updatedAt: updated(),
});
export const requestBuckets = pgTable('request_bucket', {
  key: text('key').primaryKey(),
  windowStart: timestamp('window_start', { withTimezone: true }).notNull(),
  count: integer('count').notNull(),
});
