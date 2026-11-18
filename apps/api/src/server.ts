import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { createApp } from "./app";
import { createDb, type Db } from "./db/client";
import type { Bindings } from "./env";

// Bun entry for local development and Docker. Same app as the Worker, but with
// one shared connection pool and plain promises for background work.
const REQUIRED_ENV = ["DATABASE_URL", "GEMINI_API_KEY", "ADMIN_EMAIL", "ADMIN_PASSWORD", "SESSION_SECRET"];
const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missing.length) {
  console.error(`Missing env: ${missing.join(", ")}. See apps/api/.env.example`);
  process.exit(1);
}

const env = process.env as unknown as Bindings;
let db: Db | undefined;

const api = createApp({
  getDb: () => (db ??= createDb(env.DATABASE_URL, { maxConnections: 10 })),
  runInBackground: (c, task) => {
    task.catch((err) => console.error(`Background task failed (${c.req.path}):`, err));
  },
});

const app = new Hono();
app.route("/", api);

// When STATIC_DIR is set (Docker), also serve the built React app, with
// index.html as the fallback for client-side routes.
const staticDir = process.env.STATIC_DIR;
if (staticDir) {
  app.use("/*", serveStatic({ root: staticDir }));
  app.get("*", serveStatic({ path: `${staticDir}/index.html` }));
}

const port = Number(process.env.PORT ?? 8787);
console.log(`API listening on http://localhost:${port}`);

export default {
  port,
  fetch: (req: Request) => app.fetch(req, env),
};
