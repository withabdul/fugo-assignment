import { createApp } from "./app";
import { createDb } from "./db/client";

// Cloudflare Workers entry. Static files from apps/web/dist are served by the
// assets binding (see wrangler.jsonc); only /api/* reaches this code.
//
// The database goes through Hyperdrive, which keeps a warm connection pool
// near Neon. A new client per request is cheap with Hyperdrive and is what
// Cloudflare recommends, because a Worker cannot share sockets across requests.
// Hyperdrive query caching is turned off for this config (see README): the
// dashboard polls and must see new briefs and AI status at once.
const app = createApp({
  getDb: (env) => {
    if (!env.HYPERDRIVE) throw new Error("HYPERDRIVE binding is missing. See wrangler.jsonc.");
    return createDb(env.HYPERDRIVE.connectionString, { maxConnections: 5, prepare: true });
  },
  runInBackground: (c, task) => c.executionCtx.waitUntil(task),
});

export default app;
