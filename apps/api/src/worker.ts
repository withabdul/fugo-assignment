import { createApp } from "./app";
import { createDb } from "./db/client";

// Cloudflare Workers entry. Static files from apps/web/dist are served by the
// assets binding (see wrangler.jsonc); only /api/* reaches this code.
// A Worker cannot reuse a TCP connection across requests, so each request
// gets its own small client.
const app = createApp({
  getDb: (env) => createDb(env.DATABASE_URL),
  runInBackground: (c, task) => c.executionCtx.waitUntil(task),
});

export default app;
