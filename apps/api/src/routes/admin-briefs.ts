import { briefListQuerySchema, pipelineUpdateSchema } from "@fugo/shared";
import { and, desc, eq, type SQL } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import type { AppDeps } from "../app";
import { requireAdmin } from "../auth";
import { claimEmailDraft, runEmailDraft } from "../briefs/email-draft";
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
    // Answers 202 at once and writes the draft in the background. The page
    // polls email_draft_status, so leaving and coming back keeps the loader.
    .post("/:id/email-draft", validate("param", idParamSchema), async (c) => {
      const { id } = c.req.valid("param");
      const db = c.get("db");
      const claim = await claimEmailDraft(db, id);
      if (!claim.ok) {
        return claim.reason === "not_found"
          ? c.json({ error: "Brief not found" }, 404)
          : c.json({ error: "Draft email untuk brief ini sedang dibuat." }, 409);
      }
      deps.runInBackground(
        c,
        runEmailDraft(db, claim.brief, { config: aiConfigFrom(c.env), fetchFn: deps.fetchFn }),
      );
      return c.json({ brief: toBrief(claim.brief) }, 202);
    });
}
