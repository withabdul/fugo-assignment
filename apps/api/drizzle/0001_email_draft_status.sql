ALTER TABLE "briefs" ADD COLUMN "email_draft_status" "ai_status" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "briefs" ADD COLUMN "email_draft_error" text;--> statement-breakpoint
ALTER TABLE "briefs" ADD COLUMN "email_draft_started_at" timestamp with time zone;