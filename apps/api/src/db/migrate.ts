import { migrate } from "drizzle-orm/postgres-js/migrator";
import { join } from "node:path";
import { createDb } from "./client";

// Applies SQL files from apps/api/drizzle. Used locally, in Docker on start,
// and once against Neon before deploy. Safe to run again: applied files are skipped.
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const db = createDb(url);
await migrate(db, { migrationsFolder: join(import.meta.dir, "../../drizzle") });
await db.$client.end();
console.log("Migrations applied");
