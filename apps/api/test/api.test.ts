import { describe, expect, test } from "bun:test";
import { createApp } from "../src/app";
import type { Db } from "../src/db/client";
import type { Bindings } from "../src/env";
import { futureDate } from "./helpers";

const env: Bindings = {
  DATABASE_URL: "postgres://unused",
  GEMINI_API_KEY: "test-key",
  ADMIN_EMAIL: "admin@fugo.test",
  ADMIN_PASSWORD: "secret-pass",
  SESSION_SECRET: "test-session-secret-at-least-32-chars",
};

// Only the insert chain is used by the public endpoint. Any other DB call
// throws, so a test fails loudly if a route touches the DB unexpectedly.
function fakeDb(insertedRows: unknown[]) {
  return new Proxy(
    {
      insert: () => ({
        values: (values: Record<string, unknown>) => ({
          returning: async () => {
            const row = { id: "00000000-0000-4000-8000-000000000001", ...values };
            insertedRows.push(row);
            return [row];
          },
        }),
      }),
    },
    {
      get(target, prop) {
        if (prop in target) return target[prop as keyof typeof target];
        throw new Error(`Unexpected DB call: ${String(prop)}`);
      },
    },
  ) as unknown as Db;
}

function setup() {
  const inserted: unknown[] = [];
  const background: Promise<unknown>[] = [];
  const app = createApp({
    getDb: () => fakeDb(inserted),
    runInBackground: (_c, task) => {
      background.push(task.catch(() => undefined));
    },
    fetchFn: async () => new Response("{}", { status: 500 }),
  });
  const request = (path: string, init?: RequestInit) => app.request(path, init, env);
  return { request, inserted, background };
}

const json = (body: unknown, headers: Record<string, string> = {}): RequestInit => ({
  method: "POST",
  headers: { "content-type": "application/json", ...headers },
  body: JSON.stringify(body),
});

const validBrief = {
  name: "Sari",
  email: "sari@example.com",
  company: "Kopi Senja",
  need: "Website company profile dengan katalog menu.",
  budget_range: "25m_50m",
  target_date: futureDate(30),
};

describe("POST /api/briefs", () => {
  test("saves the brief and starts AI in the background", async () => {
    const { request, inserted, background } = setup();
    const res = await request("/api/briefs", json(validBrief));

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ id: "00000000-0000-4000-8000-000000000001" });
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({ company: "Kopi Senja", aiStatus: "processing" });
    expect(background).toHaveLength(1);
  });

  test("returns field errors and saves nothing for invalid input", async () => {
    const { request, inserted } = setup();
    const res = await request(
      "/api/briefs",
      json({ ...validBrief, email: "nope", target_date: "2020-01-01", name: "" }),
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as { fields: Record<string, string> };
    expect(Object.keys(body.fields).sort()).toEqual(["email", "name", "target_date"]);
    expect(inserted).toHaveLength(0);
  });
});

describe("admin routes", () => {
  test("reject requests without a session", async () => {
    const { request } = setup();
    expect((await request("/api/admin/briefs")).status).toBe(401);
    expect((await request("/api/admin/briefs/00000000-0000-4000-8000-000000000001")).status).toBe(401);
  });

  test("reject a forged session cookie", async () => {
    const { request } = setup();
    const res = await request("/api/admin/briefs", { headers: { cookie: "fugo_session=not.a.jwt" } });
    expect(res.status).toBe(401);
  });
});

describe("auth", () => {
  test("rejects a wrong password", async () => {
    const { request } = setup();
    const res = await request("/api/auth/login", json({ email: env.ADMIN_EMAIL, password: "wrong" }));
    expect(res.status).toBe(401);
  });

  test("logs in with an httpOnly cookie and /me reads it", async () => {
    const { request } = setup();
    const login = await request("/api/auth/login", json({ email: "ADMIN@fugo.test", password: env.ADMIN_PASSWORD }));
    expect(login.status).toBe(200);

    const setCookie = login.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("HttpOnly");
    const cookie = setCookie.split(";")[0]!;

    const me = await request("/api/auth/me", { headers: { cookie } });
    expect(me.status).toBe(200);
    expect(await me.json()).toEqual({ email: "admin@fugo.test" });
  });
});

test("unknown API path returns JSON 404", async () => {
  const { request } = setup();
  const res = await request("/api/nope");
  expect(res.status).toBe(404);
});
