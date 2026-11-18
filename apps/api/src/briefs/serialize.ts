import type { Brief, BriefListItem } from "@fugo/shared";
import type { BriefRow } from "../db/schema";

export function toBrief(row: BriefRow): Brief {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    company: row.company,
    need: row.need,
    budget_range: row.budgetRange,
    target_date: row.targetDate,
    pipeline_status: row.pipelineStatus,
    ai_status: row.aiStatus,
    ai_result: row.aiResult,
    ai_scores: row.aiScores,
    ai_error: row.aiError,
    ai_attempts: row.aiAttempts,
    ai_model: row.aiModel,
    ai_processed_at: row.aiProcessedAt?.toISOString() ?? null,
    email_draft: row.emailDraft,
    email_draft_status: row.emailDraftStatus,
    email_draft_error: row.emailDraftError,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

export function toBriefListItem(
  row: Pick<
    BriefRow,
    "id" | "company" | "name" | "pipelineStatus" | "aiStatus" | "createdAt" | "priority" | "serviceCategory"
  >,
): BriefListItem {
  return {
    id: row.id,
    company: row.company,
    name: row.name,
    pipeline_status: row.pipelineStatus,
    ai_status: row.aiStatus,
    service_category: row.serviceCategory,
    priority: row.priority,
    created_at: row.createdAt.toISOString(),
  };
}
