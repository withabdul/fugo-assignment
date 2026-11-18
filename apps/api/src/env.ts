import type { Db } from "./db/client";

// Same keys in Cloudflare (wrangler secrets / vars) and in Bun (process.env).
export interface Bindings {
  DATABASE_URL: string;
  GEMINI_API_KEY: string;
  GEMINI_TEXT_MODEL?: string;
  GEMINI_DECISION_MODEL?: string;
  AI_TIMEOUT_MS?: string;
  ADMIN_EMAIL: string;
  ADMIN_PASSWORD: string;
  SESSION_SECRET: string;
}

export interface Variables {
  db: Db;
}

export type AppEnv = { Bindings: Bindings; Variables: Variables };

export interface AiConfig {
  apiKey: string;
  textModel: string;
  decisionModel: string;
  timeoutMs: number;
}

export function aiConfigFrom(env: Bindings): AiConfig {
  const timeoutMs = Number(env.AI_TIMEOUT_MS);
  return {
    apiKey: env.GEMINI_API_KEY,
    textModel: env.GEMINI_TEXT_MODEL || "gemini-4-hydrogen",
    decisionModel: env.GEMINI_DECISION_MODEL || "gemini-decision-1",
    // Covers both Gemini calls together. Stays under the 30 s that Cloudflare
    // gives waitUntil() work after the response is sent.
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 25_000,
  };
}
