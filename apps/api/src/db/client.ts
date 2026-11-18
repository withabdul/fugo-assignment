import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export interface DbOptions {
  maxConnections?: number;
  // Off by default, which is safe behind PgBouncer-style poolers such as
  // Neon's. Hyperdrive supports and caches them, so the Worker turns it on.
  prepare?: boolean;
}

export function createDb(databaseUrl: string, options: DbOptions = {}) {
  const client = postgres(databaseUrl, {
    max: options.maxConnections ?? 1,
    prepare: options.prepare ?? false,
    // The schema has no array columns, so skip the extra round trip that
    // loads array type info on connect.
    fetch_types: false,
  });
  return drizzle(client, { schema });
}

export type Db = ReturnType<typeof createDb>;
