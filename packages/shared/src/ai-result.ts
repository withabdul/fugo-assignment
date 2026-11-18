import { z } from "zod";

export const SERVICE_CATEGORIES = [
  "Branding",
  "Website",
  "Mobile App",
  "AI Automation",
  "Social Media",
  "Lainnya",
] as const;
export type ServiceCategory = (typeof SERVICE_CATEGORIES)[number];

export const PRIORITIES = ["High", "Medium", "Low"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const aiResultSchema = z
  .object({
    summary: z.string().trim().min(1).max(600),
    service_category: z.enum(SERVICE_CATEGORIES),
    priority: z.enum(PRIORITIES),
    priority_reason: z.string().trim().min(1).max(400),
    missing_info: z.array(z.string().trim().min(1).max(200)).max(10),
  })
  .strict();

export type AiResult = z.infer<typeof aiResultSchema>;

// Calibrated scores from the Gemini Decisions API, stored next to the result.
// They explain how sure the model was about the two closed-set fields.
export interface AiScores {
  category: {
    confidence: number;
    probabilities: Record<string, number>;
  };
  priority: {
    // Probability-weighted level index: 0 = Low, 1 = Medium, 2 = High.
    expected_score: number;
    confidence: number;
    probabilities: Record<Priority, number>;
  };
}

export const emailDraftSchema = z
  .object({
    subject: z.string().trim().min(1).max(200),
    body: z.string().trim().min(1).max(4000),
  })
  .strict();

export type EmailDraft = z.infer<typeof emailDraftSchema>;
