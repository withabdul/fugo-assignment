import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export function createDb(databaseUrl: string, options: { maxConnections?: number } = {}) {
  const client = postgres(databaseUrl, {
    max: options.maxConnections ?? 1,
    // Neon's pooler (PgBouncer) does not support prepared statements.
    prepare: false,
  });
  return drizzle(client, { schema });
}

export type Db = ReturnType<typeof createDb>;
