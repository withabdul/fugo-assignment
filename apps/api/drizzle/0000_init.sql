CREATE TYPE "public"."ai_status" AS ENUM('pending', 'processing', 'done', 'failed');--> statement-breakpoint
CREATE TYPE "public"."budget_range" AS ENUM('lt_10m', '10m_25m', '25m_50m', '50m_100m', 'gt_100m');--> statement-breakpoint
CREATE TYPE "public"."pipeline_status" AS ENUM('new', 'contacted', 'proposal', 'won', 'lost');--> statement-breakpoint
CREATE TYPE "public"."priority" AS ENUM('High', 'Medium', 'Low');--> statement-breakpoint
CREATE TYPE "public"."service_category" AS ENUM('Branding', 'Website', 'Mobile App', 'AI Automation', 'Social Media', 'Lainnya');--> statement-breakpoint
CREATE TABLE "briefs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"company" text NOT NULL,
	"need" text NOT NULL,
	"budget_range" "budget_range" NOT NULL,
	"target_date" date NOT NULL,
	"pipeline_status" "pipeline_status" DEFAULT 'new' NOT NULL,
	"ai_status" "ai_status" DEFAULT 'pending' NOT NULL,
	"ai_result" jsonb,
	"ai_scores" jsonb,
	"priority" "priority",
	"service_category" "service_category",
	"ai_error" text,
	"ai_attempts" integer DEFAULT 0 NOT NULL,
	"ai_model" text,
	"ai_started_at" timestamp with time zone,
	"ai_processed_at" timestamp with time zone,
	"email_draft" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "briefs_created_at_idx" ON "briefs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "briefs_priority_idx" ON "briefs" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "briefs_service_category_idx" ON "briefs" USING btree ("service_category");