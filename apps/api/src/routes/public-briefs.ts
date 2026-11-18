import { briefInputSchema } from "@fugo/shared";
import { Hono } from "hono";
import { runAnalysis } from "../briefs/process-brief";
import { briefs } from "../db/schema";
import { aiConfigFrom, type AppEnv } from "../env";
import type { AppDeps } from "../app";
import { validate } from "../validation";

export function publicBriefRoutes(deps: AppDeps) {
  return new Hono<AppEnv>().post("/", validate("json", briefInputSchema), async (c) => {
    const input = c.req.valid("json");
    const db = c.get("db");
    const now = new Date();

    // Saved as "processing" right away, so the client gets a fast response and
    // the AI runs after it. If the AI fails, the brief is still here.
    const [created] = await db
      .insert(briefs)
      .values({
        name: input.name,
        email: input.email,
        company: input.company,
        need: input.need,
        budgetRange: input.budget_range,
        targetDate: input.target_date,
        aiStatus: "processing",
        aiAttempts: 1,
        aiStartedAt: now,
      })
      .returning();
    if (!created) throw new Error("Insert returned no row");

    deps.runInBackground(c, runAnalysis(db, created, { config: aiConfigFrom(c.env), fetchFn: deps.fetchFn }));

    return c.json({ id: created.id }, 201);
  });
}
