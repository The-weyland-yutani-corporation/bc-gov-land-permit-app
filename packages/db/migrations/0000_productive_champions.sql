CREATE EXTENSION IF NOT EXISTS postgis;--> statement-breakpoint
CREATE TYPE "public"."agent_run_status" AS ENUM('queued', 'running', 'needs_input', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."audit_actor_type" AS ENUM('user', 'service', 'agent', 'system');--> statement-breakpoint
CREATE TYPE "public"."conversation_message_role" AS ENUM('user', 'assistant');--> statement-breakpoint
CREATE TYPE "public"."dependency_relationship" AS ENUM('before', 'confirm_first', 'parallel');--> statement-breakpoint
CREATE TYPE "public"."geometry_kind" AS ENUM('point', 'polygon');--> statement-breakpoint
CREATE TYPE "public"."identity_provider" AS ENUM('entra_external_id', 'local_demo');--> statement-breakpoint
CREATE TYPE "public"."intake_answer_state" AS ENUM('answered', 'unknown', 'deferred');--> statement-breakpoint
CREATE TYPE "public"."intake_question_kind" AS ENUM('short_text', 'long_text', 'boolean', 'single_select', 'multi_select', 'number', 'date');--> statement-breakpoint
CREATE TYPE "public"."location_source" AS ENUM('map', 'coordinates', 'address_approximation');--> statement-breakpoint
CREATE TYPE "public"."membership_role" AS ENUM('applicant', 'organization_admin', 'demo_admin');--> statement-breakpoint
CREATE TYPE "public"."permit_kind" AS ENUM('permit', 'authorization', 'notification', 'review');--> statement-breakpoint
CREATE TYPE "public"."project_status" AS ENUM('draft', 'intake_in_progress', 'ready_for_review', 'assessment_in_progress', 'report_ready', 'archived');--> statement-breakpoint
CREATE TYPE "public"."recommendation_disposition" AS ENUM('likely', 'may_apply', 'not_indicated', 'needs_information');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('completed', 'degraded');--> statement-breakpoint
CREATE TYPE "public"."rule_outcome" AS ENUM('likely', 'may_apply', 'not_indicated');--> statement-breakpoint
CREATE TYPE "public"."project_task_kind" AS ENUM('answer_question', 'contact_authority', 'review_guidance', 'prepare_information', 'other');--> statement-breakpoint
CREATE TYPE "public"."project_task_status" AS ENUM('todo', 'in_progress', 'completed', 'dismissed');--> statement-breakpoint
CREATE TABLE "agent_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"status" "agent_run_status" NOT NULL,
	"agent_version" varchar(64) NOT NULL,
	"idempotency_key" uuid NOT NULL,
	"assistant_message_id" uuid,
	"failure" jsonb,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agent_runs_terminal_completed_ck" CHECK ("agent_runs"."status" NOT IN ('completed', 'failed', 'cancelled') OR "agent_runs"."completed_at" IS NOT NULL),
	CONSTRAINT "agent_runs_failure_ck" CHECK (("agent_runs"."status" = 'failed' AND "agent_runs"."failure" IS NOT NULL) OR ("agent_runs"."status" <> 'failed' AND "agent_runs"."failure" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"project_id" uuid,
	"user_id" uuid,
	"actor_type" "audit_actor_type" NOT NULL,
	"actor_id" varchar(255) NOT NULL,
	"event_type" varchar(120) NOT NULL,
	"target_type" varchar(120) NOT NULL,
	"target_id" varchar(255) NOT NULL,
	"correlation_id" varchar(128) NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversation_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"role" "conversation_message_role" NOT NULL,
	"content" text NOT NULL,
	"citations" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "conversation_messages_user_citations_ck" CHECK ("conversation_messages"."role" <> 'user' OR "conversation_messages"."citations" IS NULL OR "conversation_messages"."citations" = '[]'::jsonb)
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"title" varchar(160),
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "conversations_version_positive" CHECK ("conversations"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "demo_zones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"jurisdiction_id" varchar(80) NOT NULL,
	"release_version" varchar(64) NOT NULL,
	"zone_id" varchar(80) NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text NOT NULL,
	"geometry" geometry(Polygon,4326) NOT NULL,
	"synthetic" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "demo_zones_synthetic_ck" CHECK ("demo_zones"."synthetic"),
	CONSTRAINT "demo_zones_geometry_valid_ck" CHECK (ST_IsValid("demo_zones"."geometry"))
);
--> statement-breakpoint
CREATE TABLE "guidance_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"jurisdiction_id" varchar(80) NOT NULL,
	"release_version" varchar(64) NOT NULL,
	"guidance_version" varchar(64) NOT NULL,
	"source_id" varchar(80) NOT NULL,
	"title" varchar(300) NOT NULL,
	"publisher" varchar(200) NOT NULL,
	"url" text NOT NULL,
	"published_at" date,
	"reviewed_at" date NOT NULL,
	"expires_at" date,
	"license" varchar(200),
	"synthetic" boolean NOT NULL,
	"content_hash" varchar(71) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "guidance_sources_license_ck" CHECK ("guidance_sources"."synthetic" OR "guidance_sources"."license" IS NOT NULL),
	CONSTRAINT "guidance_sources_dates_ck" CHECK ("guidance_sources"."expires_at" IS NULL OR "guidance_sources"."expires_at" >= "guidance_sources"."reviewed_at")
);
--> statement-breakpoint
CREATE TABLE "intake_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"project_intake_id" uuid NOT NULL,
	"question_id" varchar(80) NOT NULL,
	"kind" "intake_question_kind",
	"state" "intake_answer_state" NOT NULL,
	"value" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "intake_answers_state_value_ck" CHECK (("intake_answers"."state" = 'answered' AND "intake_answers"."kind" IS NOT NULL AND "intake_answers"."value" IS NOT NULL) OR ("intake_answers"."state" IN ('unknown', 'deferred') AND "intake_answers"."kind" IS NULL AND "intake_answers"."value" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "intake_question_sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"jurisdiction_id" varchar(80) NOT NULL,
	"release_version" varchar(64) NOT NULL,
	"question_set_id" varchar(80) NOT NULL,
	"version" varchar(64) NOT NULL,
	"title" varchar(160) NOT NULL,
	"description" text,
	"project_type_ids" jsonb NOT NULL,
	"questions" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "membership_role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(80) NOT NULL,
	"name" varchar(160) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "permit_dependencies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"jurisdiction_id" varchar(80) NOT NULL,
	"release_version" varchar(64) NOT NULL,
	"permit_type_key" uuid NOT NULL,
	"depends_on_permit_type_key" uuid NOT NULL,
	"relationship" "dependency_relationship" NOT NULL,
	"explanation" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "permit_dependencies_not_self_ck" CHECK ("permit_dependencies"."permit_type_key" <> "permit_dependencies"."depends_on_permit_type_key")
);
--> statement-breakpoint
CREATE TABLE "permit_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"jurisdiction_id" varchar(80) NOT NULL,
	"release_version" varchar(64) NOT NULL,
	"rule_version" varchar(64) NOT NULL,
	"rule_id" varchar(80) NOT NULL,
	"permit_type_key" uuid NOT NULL,
	"outcome" "rule_outcome" NOT NULL,
	"explanation" text NOT NULL,
	"condition" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "permit_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"jurisdiction_id" varchar(80) NOT NULL,
	"release_version" varchar(64) NOT NULL,
	"permit_type_id" varchar(80) NOT NULL,
	"name" varchar(200) NOT NULL,
	"kind" "permit_kind" NOT NULL,
	"authority_name" varchar(200) NOT NULL,
	"authority_url" text,
	"summary" text NOT NULL,
	"guidance_source_ids" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_intakes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"question_set_id" uuid NOT NULL,
	"completeness" jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_intakes_version_positive" CHECK ("project_intakes"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "project_locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"geometry_kind" geometry_kind NOT NULL,
	"geometry" geometry(Geometry,4326) NOT NULL,
	"source" "location_source" NOT NULL,
	"description" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_locations_geometry_type_ck" CHECK (("project_locations"."geometry_kind" = 'point' AND GeometryType("project_locations"."geometry") = 'POINT') OR ("project_locations"."geometry_kind" = 'polygon' AND GeometryType("project_locations"."geometry") = 'POLYGON')),
	CONSTRAINT "project_locations_geometry_valid_ck" CHECK (ST_IsValid("project_locations"."geometry"))
);
--> statement-breakpoint
CREATE TABLE "project_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"kind" "project_task_kind" NOT NULL,
	"status" "project_task_status" DEFAULT 'todo' NOT NULL,
	"title" varchar(300) NOT NULL,
	"description" text NOT NULL,
	"permit_type_id" varchar(80),
	"source_recommendation_id" varchar(80),
	"due_date" date,
	"completed_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_tasks_version_positive" CHECK ("project_tasks"."version" > 0),
	CONSTRAINT "project_tasks_completed_ck" CHECK (("project_tasks"."status" = 'completed' AND "project_tasks"."completed_at" IS NOT NULL) OR ("project_tasks"."status" <> 'completed' AND "project_tasks"."completed_at" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(160) NOT NULL,
	"description" text,
	"project_type_id" varchar(80) NOT NULL,
	"status" "project_status" DEFAULT 'draft' NOT NULL,
	"jurisdiction_schema_version" varchar(64) NOT NULL,
	"jurisdiction_id" varchar(80) NOT NULL,
	"jurisdiction_release_version" varchar(64) NOT NULL,
	"content_version" varchar(64) NOT NULL,
	"rule_version" varchar(64) NOT NULL,
	"guidance_version" varchar(64) NOT NULL,
	"latest_readiness_report_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "projects_version_positive" CHECK ("projects"."version" > 0),
	CONSTRAINT "projects_archive_state_ck" CHECK (("projects"."status" = 'archived' AND "projects"."archived_at" IS NOT NULL) OR ("projects"."status" <> 'archived' AND "projects"."archived_at" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "readiness_recommendations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"report_id" uuid NOT NULL,
	"recommendation_key" varchar(80) NOT NULL,
	"permit_type_id" varchar(80) NOT NULL,
	"disposition" "recommendation_disposition" NOT NULL,
	"title" varchar(300) NOT NULL,
	"rationale" text NOT NULL,
	"rule_ids" jsonb NOT NULL,
	"citation_ids" jsonb NOT NULL,
	"next_actions" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "readiness_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"project_version" integer NOT NULL,
	"conversation_id" uuid,
	"run_id" uuid,
	"idempotency_key" uuid NOT NULL,
	"status" "report_status" NOT NULL,
	"jurisdiction_schema_version" varchar(64) NOT NULL,
	"jurisdiction_id" varchar(80) NOT NULL,
	"jurisdiction_release_version" varchar(64) NOT NULL,
	"content_version" varchar(64) NOT NULL,
	"rule_version" varchar(64) NOT NULL,
	"guidance_version" varchar(64) NOT NULL,
	"agent_version" varchar(64),
	"summary" text NOT NULL,
	"missing_information" jsonb NOT NULL,
	"dependencies" jsonb NOT NULL,
	"assumptions" jsonb NOT NULL,
	"citations" jsonb NOT NULL,
	"limitations" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "readiness_reports_project_version_positive" CHECK ("readiness_reports"."project_version" > 0)
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject_id" varchar(255) NOT NULL,
	"provider" "identity_provider" NOT NULL,
	"display_name" varchar(160) NOT NULL,
	"email" varchar(320),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_assistant_message_id_conversation_messages_id_fk" FOREIGN KEY ("assistant_message_id") REFERENCES "public"."conversation_messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_conversation_scope_fk" FOREIGN KEY ("conversation_id","organization_id","project_id") REFERENCES "public"."conversations"("id","organization_id","project_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_messages" ADD CONSTRAINT "conversation_messages_conversation_scope_fk" FOREIGN KEY ("conversation_id","organization_id","project_id") REFERENCES "public"."conversations"("id","organization_id","project_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_project_organization_fk" FOREIGN KEY ("project_id","organization_id") REFERENCES "public"."projects"("id","organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intake_answers" ADD CONSTRAINT "intake_answers_intake_scope_fk" FOREIGN KEY ("project_intake_id","organization_id","project_id") REFERENCES "public"."project_intakes"("id","organization_id","project_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permit_dependencies" ADD CONSTRAINT "permit_dependencies_permit_type_key_permit_types_id_fk" FOREIGN KEY ("permit_type_key") REFERENCES "public"."permit_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permit_dependencies" ADD CONSTRAINT "permit_dependencies_depends_on_permit_type_key_permit_types_id_fk" FOREIGN KEY ("depends_on_permit_type_key") REFERENCES "public"."permit_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permit_rules" ADD CONSTRAINT "permit_rules_permit_type_key_permit_types_id_fk" FOREIGN KEY ("permit_type_key") REFERENCES "public"."permit_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_intakes" ADD CONSTRAINT "project_intakes_question_set_id_intake_question_sets_id_fk" FOREIGN KEY ("question_set_id") REFERENCES "public"."intake_question_sets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_intakes" ADD CONSTRAINT "project_intakes_project_organization_fk" FOREIGN KEY ("project_id","organization_id") REFERENCES "public"."projects"("id","organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_locations" ADD CONSTRAINT "project_locations_project_organization_fk" FOREIGN KEY ("project_id","organization_id") REFERENCES "public"."projects"("id","organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_tasks" ADD CONSTRAINT "project_tasks_project_organization_fk" FOREIGN KEY ("project_id","organization_id") REFERENCES "public"."projects"("id","organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "readiness_recommendations" ADD CONSTRAINT "readiness_recommendations_report_scope_fk" FOREIGN KEY ("report_id","organization_id","project_id") REFERENCES "public"."readiness_reports"("id","organization_id","project_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "readiness_reports" ADD CONSTRAINT "readiness_reports_project_organization_fk" FOREIGN KEY ("project_id","organization_id") REFERENCES "public"."projects"("id","organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "agent_runs_idempotency_uidx" ON "agent_runs" USING btree ("organization_id","project_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "agent_runs_project_status_idx" ON "agent_runs" USING btree ("organization_id","project_id","status");--> statement-breakpoint
CREATE INDEX "audit_events_organization_occurred_idx" ON "audit_events" USING btree ("organization_id","occurred_at");--> statement-breakpoint
CREATE INDEX "audit_events_project_occurred_idx" ON "audit_events" USING btree ("organization_id","project_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "audit_events_id_organization_uidx" ON "audit_events" USING btree ("id","organization_id");--> statement-breakpoint
CREATE INDEX "conversation_messages_history_idx" ON "conversation_messages" USING btree ("organization_id","project_id","conversation_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "conversations_id_scope_uidx" ON "conversations" USING btree ("id","organization_id","project_id");--> statement-breakpoint
CREATE INDEX "conversations_project_idx" ON "conversations" USING btree ("organization_id","project_id","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "demo_zones_release_uidx" ON "demo_zones" USING btree ("jurisdiction_id","release_version","zone_id");--> statement-breakpoint
CREATE INDEX "demo_zones_geometry_gix" ON "demo_zones" USING gist ("geometry");--> statement-breakpoint
CREATE UNIQUE INDEX "guidance_sources_release_uidx" ON "guidance_sources" USING btree ("jurisdiction_id","release_version","source_id","guidance_version");--> statement-breakpoint
CREATE UNIQUE INDEX "intake_answers_intake_question_uidx" ON "intake_answers" USING btree ("project_intake_id","question_id");--> statement-breakpoint
CREATE INDEX "intake_answers_project_idx" ON "intake_answers" USING btree ("organization_id","project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "intake_question_sets_release_uidx" ON "intake_question_sets" USING btree ("jurisdiction_id","release_version","question_set_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "memberships_organization_user_uidx" ON "memberships" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE INDEX "memberships_user_idx" ON "memberships" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "organizations_slug_uidx" ON "organizations" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "permit_dependencies_release_uidx" ON "permit_dependencies" USING btree ("jurisdiction_id","release_version","permit_type_key","depends_on_permit_type_key");--> statement-breakpoint
CREATE UNIQUE INDEX "permit_rules_release_uidx" ON "permit_rules" USING btree ("jurisdiction_id","release_version","rule_id");--> statement-breakpoint
CREATE INDEX "permit_rules_permit_idx" ON "permit_rules" USING btree ("permit_type_key");--> statement-breakpoint
CREATE UNIQUE INDEX "permit_types_release_uidx" ON "permit_types" USING btree ("jurisdiction_id","release_version","permit_type_id");--> statement-breakpoint
CREATE UNIQUE INDEX "project_intakes_project_uidx" ON "project_intakes" USING btree ("project_id","organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "project_intakes_id_organization_project_uidx" ON "project_intakes" USING btree ("id","organization_id","project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "project_locations_project_uidx" ON "project_locations" USING btree ("project_id","organization_id");--> statement-breakpoint
CREATE INDEX "project_locations_geometry_gix" ON "project_locations" USING gist ("geometry");--> statement-breakpoint
CREATE INDEX "project_tasks_project_status_idx" ON "project_tasks" USING btree ("organization_id","project_id","status","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "projects_id_organization_uidx" ON "projects" USING btree ("id","organization_id");--> statement-breakpoint
CREATE INDEX "projects_organization_status_idx" ON "projects" USING btree ("organization_id","status","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "readiness_recommendations_report_key_uidx" ON "readiness_recommendations" USING btree ("report_id","recommendation_key");--> statement-breakpoint
CREATE UNIQUE INDEX "readiness_reports_id_organization_project_uidx" ON "readiness_reports" USING btree ("id","organization_id","project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "readiness_reports_idempotency_uidx" ON "readiness_reports" USING btree ("organization_id","project_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "readiness_reports_project_created_idx" ON "readiness_reports" USING btree ("organization_id","project_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "users_provider_subject_uidx" ON "users" USING btree ("provider","subject_id");--> statement-breakpoint
CREATE FUNCTION prevent_audit_event_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	RAISE EXCEPTION 'audit_events are append-only';
END;
$$;--> statement-breakpoint
CREATE TRIGGER audit_events_immutable
BEFORE UPDATE OR DELETE ON "audit_events"
FOR EACH ROW
EXECUTE FUNCTION prevent_audit_event_mutation();