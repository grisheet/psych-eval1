CREATE TABLE "auth_account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assessment_assignment" (
	"id" text PRIMARY KEY NOT NULL,
	"participant_id" text NOT NULL,
	"version_id" text NOT NULL,
	"assigned_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assessment_session" (
	"id" text PRIMARY KEY NOT NULL,
	"participant_id" text NOT NULL,
	"version_id" text NOT NULL,
	"consent_id" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"submitted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "assignment" (
	"id" text PRIMARY KEY NOT NULL,
	"participant_id" text NOT NULL,
	"clinician_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_event" (
	"id" text PRIMARY KEY NOT NULL,
	"actor_id" text NOT NULL,
	"action" text NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clinician_note" (
	"id" text PRIMARY KEY NOT NULL,
	"participant_id" text NOT NULL,
	"author_id" text NOT NULL,
	"source" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clinician_profile" (
	"user_id" text PRIMARY KEY NOT NULL,
	"credentials" text,
	"credentials_verified" boolean DEFAULT false NOT NULL,
	"verified_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "consent" (
	"id" text PRIMARY KEY NOT NULL,
	"participant_id" text NOT NULL,
	"version" text NOT NULL,
	"scope" text NOT NULL,
	"optional_research" boolean DEFAULT false NOT NULL,
	"text_snapshot" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"withdrawn_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "deletion_request" (
	"id" text PRIMARY KEY NOT NULL,
	"participant_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"resolution" text,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "export_request" (
	"id" text PRIMARY KEY NOT NULL,
	"participant_id" text NOT NULL,
	"status" text DEFAULT 'completed' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "instrument_version" (
	"id" text PRIMARY KEY NOT NULL,
	"instrument_id" text NOT NULL,
	"version" text NOT NULL,
	"definition" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "instrument" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "participant_profile" (
	"user_id" text PRIMARY KEY NOT NULL,
	"preferred_name" text DEFAULT '' NOT NULL,
	"pronouns" text,
	"language" text DEFAULT 'English' NOT NULL,
	"timezone" text DEFAULT 'America/New_York' NOT NULL,
	"accessibility" text,
	"contact_preference" text DEFAULT 'In-app only' NOT NULL,
	"adult_attested_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_rate_limit" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text,
	"count" integer,
	"last_request" integer,
	CONSTRAINT "auth_rate_limit_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "report_version" (
	"id" text PRIMARY KEY NOT NULL,
	"report_id" text NOT NULL,
	"number" integer NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"snapshot" jsonb NOT NULL,
	"signed_by" text,
	"signed_at" timestamp with time zone,
	"amendment_reason" text,
	"parent_version_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report" (
	"id" text PRIMARY KEY NOT NULL,
	"participant_id" text NOT NULL,
	"author_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "request_bucket" (
	"key" text PRIMARY KEY NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resource_entry" (
	"id" text PRIMARY KEY NOT NULL,
	"region" text NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"source_url" text NOT NULL,
	"last_checked" timestamp with time zone NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "response" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"item_id" text NOT NULL,
	"answer" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review_task" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"reviewed_by" text,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "review_task_session_id_unique" UNIQUE("session_id")
);
--> statement-breakpoint
CREATE TABLE "score_result" (
	"session_id" text PRIMARY KEY NOT NULL,
	"instrument_version" text NOT NULL,
	"algorithm_version" text NOT NULL,
	"derived" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "auth_session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "operational_setting" (
	"id" text PRIMARY KEY DEFAULT 'service' NOT NULL,
	"retention_days" integer DEFAULT 30 NOT NULL,
	"consent_version" text DEFAULT 'demo-1' NOT NULL,
	"confidentiality_text" text DEFAULT 'Synthetic demonstration only. Organization-specific confidentiality terms are not configured.' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_two_factor" (
	"id" text PRIMARY KEY NOT NULL,
	"secret" text NOT NULL,
	"backup_codes" text NOT NULL,
	"user_id" text NOT NULL,
	"verified" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "app_user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"role" text DEFAULT 'participant' NOT NULL,
	"disabled" boolean DEFAULT false NOT NULL,
	"two_factor_enabled" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "app_user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "auth_verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "auth_account" ADD CONSTRAINT "auth_account_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_assignment" ADD CONSTRAINT "assessment_assignment_participant_id_app_user_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_assignment" ADD CONSTRAINT "assessment_assignment_version_id_instrument_version_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."instrument_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_assignment" ADD CONSTRAINT "assessment_assignment_assigned_by_app_user_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_session" ADD CONSTRAINT "assessment_session_participant_id_app_user_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_session" ADD CONSTRAINT "assessment_session_version_id_instrument_version_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."instrument_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_session" ADD CONSTRAINT "assessment_session_consent_id_consent_id_fk" FOREIGN KEY ("consent_id") REFERENCES "public"."consent"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment" ADD CONSTRAINT "assignment_participant_id_app_user_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment" ADD CONSTRAINT "assignment_clinician_id_app_user_id_fk" FOREIGN KEY ("clinician_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_event" ADD CONSTRAINT "audit_event_actor_id_app_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinician_note" ADD CONSTRAINT "clinician_note_participant_id_app_user_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinician_note" ADD CONSTRAINT "clinician_note_author_id_app_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinician_profile" ADD CONSTRAINT "clinician_profile_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent" ADD CONSTRAINT "consent_participant_id_app_user_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deletion_request" ADD CONSTRAINT "deletion_request_participant_id_app_user_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "export_request" ADD CONSTRAINT "export_request_participant_id_app_user_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instrument_version" ADD CONSTRAINT "instrument_version_instrument_id_instrument_id_fk" FOREIGN KEY ("instrument_id") REFERENCES "public"."instrument"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participant_profile" ADD CONSTRAINT "participant_profile_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_version" ADD CONSTRAINT "report_version_report_id_report_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."report"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_version" ADD CONSTRAINT "report_version_signed_by_app_user_id_fk" FOREIGN KEY ("signed_by") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report" ADD CONSTRAINT "report_participant_id_app_user_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report" ADD CONSTRAINT "report_author_id_app_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "response" ADD CONSTRAINT "response_session_id_assessment_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."assessment_session"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_task" ADD CONSTRAINT "review_task_session_id_assessment_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."assessment_session"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_task" ADD CONSTRAINT "review_task_reviewed_by_app_user_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "score_result" ADD CONSTRAINT "score_result_session_id_assessment_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."assessment_session"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_session" ADD CONSTRAINT "auth_session_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_two_factor" ADD CONSTRAINT "auth_two_factor_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "module_assignment_pair" ON "assessment_assignment" USING btree ("participant_id","version_id");--> statement-breakpoint
CREATE INDEX "assessment_owner" ON "assessment_session" USING btree ("participant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "assignment_pair" ON "assignment" USING btree ("participant_id","clinician_id");--> statement-breakpoint
CREATE INDEX "audit_time" ON "audit_event" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "consent_participant" ON "consent" USING btree ("participant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "instrument_version_pair" ON "instrument_version" USING btree ("instrument_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "report_version_number" ON "report_version" USING btree ("report_id","number");--> statement-breakpoint
CREATE UNIQUE INDEX "response_item" ON "response" USING btree ("session_id","item_id");--> statement-breakpoint
CREATE INDEX "session_user" ON "auth_session" USING btree ("user_id");--> statement-breakpoint
CREATE FUNCTION protect_finalized_report() RETURNS trigger AS $$
BEGIN
  IF OLD.status = 'finalized' THEN RAISE EXCEPTION 'Finalized report versions are immutable'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER finalized_report_guard BEFORE UPDATE OR DELETE ON report_version FOR EACH ROW EXECUTE FUNCTION protect_finalized_report();
--> statement-breakpoint
CREATE FUNCTION prevent_history_mutation() RETURNS trigger AS $$
BEGIN RAISE EXCEPTION 'Historical records are append-only'; END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER immutable_instrument_version BEFORE UPDATE OR DELETE ON instrument_version FOR EACH ROW EXECUTE FUNCTION prevent_history_mutation();
--> statement-breakpoint
CREATE TRIGGER append_only_audit BEFORE UPDATE OR DELETE ON audit_event FOR EACH ROW EXECUTE FUNCTION prevent_history_mutation();
--> statement-breakpoint
ALTER TABLE app_user ADD CONSTRAINT valid_role CHECK (role IN ('participant','clinician','admin'));
--> statement-breakpoint
ALTER TABLE assessment_session ADD CONSTRAINT valid_assessment_status CHECK (status IN ('draft','submitted','reviewed'));
--> statement-breakpoint
ALTER TABLE report_version ADD CONSTRAINT valid_report_signature CHECK ((status = 'draft' AND signed_at IS NULL AND signed_by IS NULL) OR (status = 'finalized' AND signed_at IS NOT NULL AND signed_by IS NOT NULL));
