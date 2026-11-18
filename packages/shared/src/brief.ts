import { z } from "zod";
import { todayInJakarta } from "./dates";
import {
  PRIORITIES,
  SERVICE_CATEGORIES,
  type AiResult,
  type AiScores,
  type EmailDraft,
} from "./ai-result";

export const BUDGET_RANGES = [
  "lt_10m",
  "10m_25m",
  "25m_50m",
  "50m_100m",
  "gt_100m",
] as const;
export type BudgetRange = (typeof BUDGET_RANGES)[number];

export const BUDGET_LABELS: Record<BudgetRange, string> = {
  lt_10m: "< Rp 10 juta",
  "10m_25m": "Rp 10–25 juta",
  "25m_50m": "Rp 25–50 juta",
  "50m_100m": "Rp 50–100 juta",
  gt_100m: "> Rp 100 juta",
};

export const PIPELINE_STATUSES = ["new", "contacted", "proposal", "won", "lost"] as const;
export type PipelineStatus = (typeof PIPELINE_STATUSES)[number];

export const PIPELINE_LABELS: Record<PipelineStatus, string> = {
  new: "New",
  contacted: "Contacted",
  proposal: "Proposal",
  won: "Won",
  lost: "Lost",
};

export const AI_STATUSES = ["pending", "processing", "done", "failed"] as const;
export type AiStatus = (typeof AI_STATUSES)[number];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const briefInputSchema = z.object({
  name: z.string().trim().min(1, "Nama wajib diisi").max(120),
  email: z.string().trim().toLowerCase().max(200).pipe(z.email("Format email tidak valid")),
  company: z.string().trim().min(1, "Nama perusahaan wajib diisi").max(160),
  need: z
    .string()
    .trim()
    .min(10, "Jelaskan kebutuhan minimal 10 karakter")
    .max(5000, "Maksimal 5000 karakter"),
  budget_range: z.enum(BUDGET_RANGES, "Pilih rentang budget"),
  target_date: z
    .string()
    .regex(ISO_DATE, "Tanggal wajib diisi")
    .refine((value) => !Number.isNaN(Date.parse(value)), "Tanggal tidak valid")
    .refine((value) => value >= todayInJakarta(), "Tanggal tidak boleh di masa lalu"),
});
export type BriefInput = z.infer<typeof briefInputSchema>;

export const pipelineUpdateSchema = z.object({
  pipeline_status: z.enum(PIPELINE_STATUSES),
});

export const briefListQuerySchema = z.object({
  priority: z.enum(PRIORITIES).optional(),
  category: z.enum(SERVICE_CATEGORIES).optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  password: z.string().min(1),
});

// Shape the API returns for one brief. Dates are ISO strings over the wire.
export interface Brief {
  id: string;
  name: string;
  email: string;
  company: string;
  need: string;
  budget_range: BudgetRange;
  target_date: string;
  pipeline_status: PipelineStatus;
  ai_status: AiStatus;
  ai_result: AiResult | null;
  ai_scores: AiScores | null;
  ai_error: string | null;
  ai_attempts: number;
  ai_model: string | null;
  ai_processed_at: string | null;
  email_draft: EmailDraft | null;
  email_draft_status: AiStatus;
  email_draft_error: string | null;
  created_at: string;
  updated_at: string;
}

export type BriefListItem = Pick<
  Brief,
  "id" | "company" | "name" | "pipeline_status" | "ai_status" | "created_at"
> & {
  service_category: AiResult["service_category"] | null;
  priority: AiResult["priority"] | null;
};
