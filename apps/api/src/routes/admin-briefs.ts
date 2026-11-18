import { briefListQuerySchema, pipelineUpdateSchema } from "@fugo/shared";
import { and, desc, eq, type SQL } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { draftReplyEmail } from "../ai/analyze-brief";
import { AiError } from "../ai/gemini";
import type { AppDeps } from "../app";
import { requireAdmin } from "../auth";
import { claimForProcessing, runAnalysis } from "../briefs/process-brief";
import { toBrief, toBriefListItem } from "../briefs/serialize";
import { briefs } from "../db/schema";
import { aiConfigFrom, type AppEnv } from "../env";
import { validate } from "../validation";

const idParamSchema = z.object({ id: z.uuid() });

export function adminBriefRoutes(deps: AppDeps) {
  return new Hono<AppEnv>()
    .use(requireAdmin)
    .get("/", validate("query", briefListQuerySchema), async (c) => {
      const { priority, category } = c.req.valid("query");
      const filters: SQL[] = [];
      if (priority) filters.push(eq(briefs.priority, priority));
      if (category) filters.push(eq(briefs.serviceCategory, category));

      const rows = await c
        .get("db")
        .select({
          id: briefs.id,
          company: briefs.company,
          name: briefs.name,
          pipelineStatus: briefs.pipelineStatus,
          aiStatus: briefs.aiStatus,
          priority: briefs.priority,
          serviceCategory: briefs.serviceCategory,
          createdAt: briefs.createdAt,
        })
        .from(briefs)
        .where(and(...filters))
        .orderBy(desc(briefs.createdAt))
        .limit(200);
      return c.json({ briefs: rows.map(toBriefListItem) });
    })
    .get("/:id", validate("param", idParamSchema), async (c) => {
      const { id } = c.req.valid("param");
      const [row] = await c.get("db").select().from(briefs).where(eq(briefs.id, id));
      if (!row) return c.json({ error: "Brief not found" }, 404);
      return c.json({ brief: toBrief(row) });
    })
    .patch(
      "/:id/pipeline",
      validate("param", idParamSchema),
      validate("json", pipelineUpdateSchema),
      async (c) => {
        const { id } = c.req.valid("param");
        const { pipeline_status } = c.req.valid("json");
        const [row] = await c
          .get("db")
          .update(briefs)
          .set({ pipelineStatus: pipeline_status, updatedAt: new Date() })
          .where(eq(briefs.id, id))
          .returning();
        if (!row) return c.json({ error: "Brief not found" }, 404);
        return c.json({ brief: toBrief(row) });
      },
    )
    // Retry waits for the AI so the admin sees the new result (or the new error)
    // in the same response.
    .post("/:id/process", validate("param", idParamSchema), async (c) => {
      const { id } = c.req.valid("param");
      const db = c.get("db");
      const claim = await claimForProcessing(db, id);
      if (!claim.ok) {
        return claim.reason === "not_found"
          ? c.json({ error: "Brief not found" }, 404)
          : c.json({ error: "Brief ini sedang diproses AI. Coba lagi sebentar." }, 409);
      }
      const saved = await runAnalysis(db, claim.brief, { config: aiConfigFrom(c.env), fetchFn: deps.fetchFn });
      return c.json({ brief: toBrief(saved) });
    })
    .post("/:id/email-draft", validate("param", idParamSchema), async (c) => {
      const { id } = c.req.valid("param");
      const db = c.get("db");
      const [row] = await db.select().from(briefs).where(eq(briefs.id, id));
      if (!row) return c.json({ error: "Brief not found" }, 404);

      try {
        const draft = await draftReplyEmail(row, row.aiResult, {
          config: aiConfigFrom(c.env),
          fetchFn: deps.fetchFn,
        });
        const [saved] = await db
          .update(briefs)
          .set({ emailDraft: draft, updatedAt: new Date() })
          .where(eq(briefs.id, id))
          .returning();
        return c.json({ brief: toBrief(saved ?? row) });
      } catch (err) {
        if (!(err instanceof AiError)) throw err;
        console.error(`Email draft failed for brief ${id}: [${err.kind}] ${err.message}`);
        return c.json({ error: "AI gagal membuat draft email. Coba lagi." }, 502);
      }
    });
}
