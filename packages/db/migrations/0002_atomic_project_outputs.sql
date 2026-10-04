ALTER TABLE "conversations" ADD COLUMN "active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
CREATE TEMP TABLE "conversation_merge_map" ON COMMIT DROP AS
  SELECT
    "id" AS "source_id",
    first_value("id") OVER (
      PARTITION BY "organization_id", "project_id"
      ORDER BY "updated_at" DESC, "id" DESC
    ) AS "target_id"
  FROM "conversations"
  WHERE "active" = true;--> statement-breakpoint
UPDATE "conversation_messages"
SET "conversation_id" = "conversation_merge_map"."target_id"
FROM "conversation_merge_map"
WHERE "conversation_messages"."conversation_id" = "conversation_merge_map"."source_id"
  AND "conversation_merge_map"."source_id" <> "conversation_merge_map"."target_id";--> statement-breakpoint
UPDATE "agent_runs"
SET "conversation_id" = "conversation_merge_map"."target_id"
FROM "conversation_merge_map"
WHERE "agent_runs"."conversation_id" = "conversation_merge_map"."source_id"
  AND "conversation_merge_map"."source_id" <> "conversation_merge_map"."target_id";--> statement-breakpoint
UPDATE "readiness_reports"
SET "conversation_id" = "conversation_merge_map"."target_id"
FROM "conversation_merge_map"
WHERE "readiness_reports"."conversation_id" = "conversation_merge_map"."source_id"
  AND "conversation_merge_map"."source_id" <> "conversation_merge_map"."target_id";--> statement-breakpoint
DELETE FROM "conversations"
USING "conversation_merge_map"
WHERE "conversations"."id" = "conversation_merge_map"."source_id"
  AND "conversation_merge_map"."source_id" <> "conversation_merge_map"."target_id";--> statement-breakpoint
DROP TABLE "conversation_merge_map";--> statement-breakpoint
CREATE UNIQUE INDEX "conversations_project_active_uidx" ON "conversations" USING btree ("organization_id","project_id") WHERE "conversations"."active" = true;--> statement-breakpoint
ALTER TABLE "project_tasks" ADD COLUMN "source_report_id" uuid;--> statement-breakpoint
UPDATE "project_tasks"
SET "source_report_id" = "projects"."latest_readiness_report_id"
FROM "projects"
WHERE "project_tasks"."project_id" = "projects"."id"
  AND "project_tasks"."organization_id" = "projects"."organization_id"
  AND "projects"."latest_readiness_report_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "project_tasks" ADD CONSTRAINT "project_tasks_report_scope_fk" FOREIGN KEY ("source_report_id","organization_id","project_id") REFERENCES "public"."readiness_reports"("id","organization_id","project_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_tasks_source_report_idx" ON "project_tasks" USING btree ("organization_id","project_id","source_report_id");
