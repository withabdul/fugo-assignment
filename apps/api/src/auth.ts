import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import { sign, verify } from "hono/jwt";
import type { AppEnv } from "./env";

const COOKIE_NAME = "fugo_session";
const SESSION_TTL_SECONDS = 8 * 60 * 60;

// Compares two strings in constant time, so response timing does not leak how
// many leading characters of the password were right.
async function safeEqual(a: string, b: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [hashA, hashB] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(a)),
    crypto.subtle.digest("SHA-256", encoder.encode(b)),
  ]);
  const viewA = new Uint8Array(hashA);
  const viewB = new Uint8Array(hashB);
  let diff = 0;
  for (let i = 0; i < viewA.length; i++) diff |= viewA[i]! ^ viewB[i]!;
  return diff === 0;
}

export async function checkAdminCredentials(
  env: AppEnv["Bindings"],
  email: string,
  password: string,
): Promise<boolean> {
  const [emailOk, passwordOk] = await Promise.all([
    safeEqual(email, env.ADMIN_EMAIL.trim().toLowerCase()),
    safeEqual(password, env.ADMIN_PASSWORD),
  ]);
  return emailOk && passwordOk;
}

export async function startSession(c: Context<AppEnv>, email: string): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const token = await sign({ sub: email, iat: now, exp: now + SESSION_TTL_SECONDS }, c.env.SESSION_SECRET, "HS256");
  setCookie(c, COOKIE_NAME, token, {
    httpOnly: true,
    secure: new URL(c.req.url).protocol === "https:",
    sameSite: "Lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export function endSession(c: Context<AppEnv>): void {
  deleteCookie(c, COOKIE_NAME, { path: "/" });
}

export async function readSession(c: Context<AppEnv>): Promise<{ email: string } | null> {
  const token = getCookie(c, COOKIE_NAME);
  if (!token) return null;
  try {
    const payload = await verify(token, c.env.SESSION_SECRET, "HS256");
    return typeof payload.sub === "string" ? { email: payload.sub } : null;
  } catch {
    return null;
  }
}

export const requireAdmin = createMiddleware<AppEnv>(async (c, next) => {
  const session = await readSession(c);
  if (!session) return c.json({ error: "Unauthorized" }, 401);
  await next();
});
