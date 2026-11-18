import { loginSchema } from "@fugo/shared";
import { Hono } from "hono";
import { checkAdminCredentials, endSession, readSession, startSession } from "../auth";
import type { AppEnv } from "../env";
import { validate } from "../validation";

export const authRoutes = new Hono<AppEnv>()
  .post("/login", validate("json", loginSchema), async (c) => {
    const { email, password } = c.req.valid("json");
    if (!(await checkAdminCredentials(c.env, email, password))) {
      return c.json({ error: "Email atau password salah" }, 401);
    }
    await startSession(c, email);
    return c.json({ email });
  })
  .post("/logout", (c) => {
    endSession(c);
    return c.body(null, 204);
  })
  .get("/me", async (c) => {
    const session = await readSession(c);
    if (!session) return c.json({ error: "Unauthorized" }, 401);
    return c.json(session);
  });
