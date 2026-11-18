import { and, eq, lt, ne, or } from "drizzle-orm";
import { draftReplyEmail, type AiDeps } from "../ai/analyze-brief";
import { AiError } from "../ai/gemini";
import type { Db } from "../db/client";
import { briefs, type BriefRow } from "../db/schema";
import { STALE_PROCESSING_MS, type ClaimResult } from "./process-brief";

// Same lock as the analysis: one conditional UPDATE, so two clicks (or two
// admins) cannot start two drafts for one brief.
export async function claimEmailDraft(db: Db, briefId: string): Promise<ClaimResult> {
  const now = new Date();
  const [claimed] = await db
    .update(briefs)
    .set({ emailDraftStatus: "processing", emailDraftError: null, emailDraftStartedAt: now, updatedAt: now })
    .where(
      and(
        eq(briefs.id, briefId),
        or(
          ne(briefs.emailDraftStatus, "processing"),
          lt(briefs.emailDraftStartedAt, new Date(now.getTime() - STALE_PROCESSING_MS)),
        ),
      ),
    )
    .returning();
  if (claimed) return { ok: true, brief: claimed };

  const [exists] = await db.select({ id: briefs.id }).from(briefs).where(eq(briefs.id, briefId));
  return { ok: false, reason: exists ? "busy" : "not_found" };
}

// Never throws on AI errors: the failure is saved so the page can show it.
// The previous draft is kept when a new one fails.
export async function runEmailDraft(db: Db, brief: BriefRow, deps: AiDeps): Promise<void> {
  let update: Partial<typeof briefs.$inferInsert>;
  try {
    const draft = await draftReplyEmail(brief, brief.aiResult, deps);
    update = { emailDraft: draft, emailDraftStatus: "done", emailDraftError: null };
  } catch (err) {
    const message = err instanceof AiError ? `[${err.kind}] ${err.message}` : `[unexpected] ${String(err)}`;
    console.error(`Email draft failed for brief ${brief.id}: ${message}`);
    update = { emailDraftStatus: "failed", emailDraftError: message.slice(0, 1000) };
  }
  await db
    .update(briefs)
    .set({ ...update, updatedAt: new Date() })
    .where(eq(briefs.id, brief.id));
}
