import {
  AI_STATUSES,
  BUDGET_RANGES,
  PIPELINE_STATUSES,
  PRIORITIES,
  SERVICE_CATEGORIES,
  type AiResult,
  type AiScores,
  type EmailDraft,
} from "@fugo/shared";
import {
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const budgetRangeEnum = pgEnum("budget_range", BUDGET_RANGES);
export const pipelineStatusEnum = pgEnum("pipeline_status", PIPELINE_STATUSES);
export const aiStatusEnum = pgEnum("ai_status", AI_STATUSES);
export const priorityEnum = pgEnum("priority", PRIORITIES);
export const serviceCategoryEnum = pgEnum("service_category", SERVICE_CATEGORIES);

export const briefs = pgTable(
  "briefs",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Data from the public form, never changed after submit.
    name: text("name").notNull(),
    email: text("email").notNull(),
    company: text("company").notNull(),
    need: text("need").notNull(),
    budgetRange: budgetRangeEnum("budget_range").notNull(),
    targetDate: date("target_date", { mode: "string" }).notNull(),

    pipelineStatus: pipelineStatusEnum("pipeline_status").notNull().default("new"),

    // AI processing state. ai_result holds the full validated JSON.
    // priority and service_category are copies of two fields from it, as real
    // columns, so the dashboard can filter and index them.
    aiStatus: aiStatusEnum("ai_status").notNull().default("pending"),
    aiResult: jsonb("ai_result").$type<AiResult>(),
    aiScores: jsonb("ai_scores").$type<AiScores>(),
    priority: priorityEnum("priority"),
    serviceCategory: serviceCategoryEnum("service_category"),
    aiError: text("ai_error"),
    aiAttempts: integer("ai_attempts").notNull().default(0),
    aiModel: text("ai_model"),
    aiStartedAt: timestamp("ai_started_at", { withTimezone: true }),
    aiProcessedAt: timestamp("ai_processed_at", { withTimezone: true }),

    // Draft runs in the background like the analysis, so its state lives here,
    // not in the browser: leaving the page does not lose the "generating" state.
    // "pending" means no draft was asked for yet.
    emailDraft: jsonb("email_draft").$type<EmailDraft>(),
    emailDraftStatus: aiStatusEnum("email_draft_status").notNull().default("pending"),
    emailDraftError: text("email_draft_error"),
    emailDraftStartedAt: timestamp("email_draft_started_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("briefs_created_at_idx").on(table.createdAt),
    index("briefs_priority_idx").on(table.priority),
    index("briefs_service_category_idx").on(table.serviceCategory),
  ],
);

export type BriefRow = typeof briefs.$inferSelect;
