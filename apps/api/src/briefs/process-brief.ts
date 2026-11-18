import { and, eq, lt, ne, or, sql } from "drizzle-orm";
import { analyzeBrief, type AiDeps } from "../ai/analyze-brief";
import { AiError } from "../ai/gemini";
import type { Db } from "../db/client";
import { briefs, type BriefRow } from "../db/schema";

// A run that has been "processing" this long is treated as dead (for example the
// Worker was stopped), so a retry is allowed again.
export const STALE_PROCESSING_MS = 2 * 60_000;

export type ClaimResult = { ok: true; brief: BriefRow } | { ok: false; reason: "not_found" | "busy" };

// Moves the brief to "processing" in one UPDATE. The WHERE clause makes this a
// lock: two retries at the same time cannot both start a run.
export async function claimForProcessing(db: Db, briefId: string): Promise<ClaimResult> {
  const now = new Date();
  const [claimed] = await db
    .update(briefs)
    .set({
      aiStatus: "processing",
      aiAttempts: sql`${briefs.aiAttempts} + 1`,
      aiError: null,
      aiStartedAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(briefs.id, briefId),
        or(
          ne(briefs.aiStatus, "processing"),
          lt(briefs.aiStartedAt, new Date(now.getTime() - STALE_PROCESSING_MS)),
        ),
      ),
    )
    .returning();
  if (claimed) return { ok: true, brief: claimed };

  const [exists] = await db.select({ id: briefs.id }).from(briefs).where(eq(briefs.id, briefId));
  return { ok: false, reason: exists ? "busy" : "not_found" };
}

// Runs the AI for a claimed brief and stores the outcome. It never throws:
// any failure is saved as ai_status = "failed" with the reason, so the brief
// stays in the database and an admin can retry it.
export async function runAnalysis(db: Db, brief: BriefRow, deps: AiDeps): Promise<BriefRow> {
  let update: Partial<typeof briefs.$inferInsert>;
  try {
    const analysis = await analyzeBrief(brief, deps);
    update = {
      aiStatus: "done",
      aiResult: analysis.result,
      aiScores: analysis.scores,
      priority: analysis.result.priority,
      serviceCategory: analysis.result.service_category,
      aiModel: analysis.model,
      aiError: null,
      aiProcessedAt: new Date(),
    };
  } catch (err) {
    const message = err instanceof AiError ? `[${err.kind}] ${err.message}` : `[unexpected] ${String(err)}`;
    console.error(`AI processing failed for brief ${brief.id}: ${message}`);
    update = { aiStatus: "failed", aiError: message.slice(0, 1000), aiProcessedAt: new Date() };
  }

  const [saved] = await db
    .update(briefs)
    .set({ ...update, updatedAt: new Date() })
    .where(eq(briefs.id, brief.id))
    .returning();
  return saved ?? brief;
}
