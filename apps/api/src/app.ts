import { Hono, type Context } from "hono";
import { secureHeaders } from "hono/secure-headers";
import type { FetchFn } from "./ai/gemini";
import type { Db } from "./db/client";
import type { AppEnv, Bindings } from "./env";
import { adminBriefRoutes } from "./routes/admin-briefs";
import { authRoutes } from "./routes/auth";
import { publicBriefRoutes } from "./routes/public-briefs";

// The runtime-specific parts. worker.ts and server.ts each give their own,
// and tests give fakes.
export interface AppDeps {
  getDb: (env: Bindings) => Db;
  runInBackground: (c: Context<AppEnv>, task: Promise<unknown>) => void;
  fetchFn?: FetchFn;
}

export function createApp(deps: AppDeps) {
  const app = new Hono<AppEnv>().basePath("/api");

  app.use(secureHeaders());
  app.use(async (c, next) => {
    c.set("db", deps.getDb(c.env));
    await next();
  });

  app.get("/health", (c) => c.json({ ok: true }));
  app.route("/briefs", publicBriefRoutes(deps));
  app.route("/auth", authRoutes);
  app.route("/admin/briefs", adminBriefRoutes(deps));

  app.notFound((c) => c.json({ error: "Not found" }, 404));
  app.onError((err, c) => {
    console.error(`${c.req.method} ${c.req.path} failed:`, err);
    return c.json({ error: "Internal server error" }, 500);
  });

  return app;
}
