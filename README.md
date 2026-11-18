# Fugo Brief Hub

An internal tool for Fugo Creative. Clients send a project brief through a public form. Each brief is analyzed by Gemini in the background. The sales team logs in to a dashboard to see a summary, category, and priority for each brief, and moves it through the pipeline.

- **Live:** `https://<your-worker>.workers.dev` _(fill in after deploy)_
- **Admin login:** `<email>` / `<password>` _(fill in after deploy)_

## Stack

| Part | Choice |
| --- | --- |
| Monorepo | Bun workspaces |
| Frontend | React 19, Vite 8, React Router 8, Tailwind CSS 4 |
| Backend | Hono 4 on Cloudflare Workers (and on Bun for local/Docker) |
| Database | PostgreSQL (Neon in production), Drizzle ORM, postgres.js |
| Validation | Zod 4, one shared schema for client and server |
| AI | Google Gemini: `gemini-decision-1` (Decisions API) + `gemini-4-hydrogen` (text) |
| Tests | `bun test` |

## Run locally

Requirements: Bun 1.4+, and Postgres (Docker or any local install).

```bash
bun install

# 1. Database
docker compose up -d db                # or use your own Postgres

# 2. Env
cp apps/api/.env.example apps/api/.env  # then fill GEMINI_API_KEY, SESSION_SECRET, ADMIN_PASSWORD

# 3. Tables
bun run db:migrate

# 4. Two terminals
bun run dev:api   # Hono on http://localhost:8787
bun run dev:web   # Vite on http://localhost:5173 (proxies /api to 8787)
```

Open http://localhost:5173 for the form and http://localhost:5173/admin for the dashboard.

### With Docker only

```bash
cp .env.example .env   # fill GEMINI_API_KEY, ADMIN_PASSWORD, SESSION_SECRET
docker compose up --build
```

The app runs on http://localhost:8787. Migrations run when the container starts.

### Tests

```bash
bun run test
```

27 tests, no network and no database needed. They cover:

- AI output validation: valid output, missing field, extra field, non-JSON, unknown category, HTTP error, blocked prompt, timeout, and the priority rounding rule.
- Form validation: email format, past date, empty fields, and the WIB date boundary.
- Endpoints: submit (201 and background job started), submit with bad input (400 with field errors, nothing saved), admin routes without a session or with a forged cookie (401), login (wrong password, httpOnly cookie, `/me`).

## Environment variables

| Name | Required | Description |
| --- | --- | --- |
| `DATABASE_URL` | yes | Postgres connection string. For Neon, use the pooled URL with `sslmode=require`. |
| `GEMINI_API_KEY` | yes | Google AI Studio key. |
| `ADMIN_EMAIL` | yes | The one admin account. |
| `ADMIN_PASSWORD` | yes | Password for the admin account. |
| `SESSION_SECRET` | yes | Secret that signs the session JWT. Use a long random string. |
| `GEMINI_TEXT_MODEL` | no | Default `gemini-4-hydrogen`. |
| `GEMINI_DECISION_MODEL` | no | Default `gemini-decision-1`. |
| `AI_TIMEOUT_MS` | no | Deadline for the whole analysis (both calls). Default `25000`. |
| `PORT` | no | Bun server only. Default `8787`. |
| `STATIC_DIR` | no | Bun server only. If set, it also serves the built frontend (used in Docker). |

No secret is in the repo. Locally they live in `apps/api/.env` (git-ignored). On Cloudflare they are Worker secrets.

## Deploy (Cloudflare Workers + Neon)

One Worker serves both the API and the React build. `wrangler.jsonc` sends `/api/*` to Hono and everything else to static assets, with SPA fallback to `index.html`.

```bash
# once: create tables on Neon
DATABASE_URL="postgres://...neon.tech/...?sslmode=require" bun run db:migrate

# once: set secrets
cd apps/api
bunx wrangler secret put DATABASE_URL
bunx wrangler secret put GEMINI_API_KEY
bunx wrangler secret put ADMIN_EMAIL
bunx wrangler secret put ADMIN_PASSWORD
bunx wrangler secret put SESSION_SECRET

# every release (from the repo root)
bun run deploy
```

## Architecture

```
packages/shared   Zod schemas and types used by both apps (form input, AI result, enums)
apps/api          Hono app
  src/app.ts            createApp(deps): routes, DB per request, error handler
  src/worker.ts         Cloudflare entry: DB client per request, waitUntil for background work
  src/server.ts         Bun entry: one connection pool, plain promise for background work
  src/routes/           public-briefs, auth, admin-briefs
  src/ai/               gemini.ts (HTTP + response checks), prompts.ts, analyze-brief.ts
  src/briefs/           process-brief.ts (claim + run + save), serialize.ts
  src/db/               schema.ts, client.ts, migrate.ts
  drizzle/              SQL migrations
apps/web          React SPA: public form (/), login (/admin/login), list (/admin), detail (/admin/briefs/:id)
```

`createApp` takes the runtime-specific parts (`getDb`, `runInBackground`, `fetchFn`) as arguments. This keeps one app for Workers, Bun, and tests. The tests pass a fake DB and a fake `fetch`.

### Flow of one brief

1. `POST /api/briefs` validates the body with the shared Zod schema and inserts the brief with `ai_status = processing`. It answers `201` at once.
2. The AI job runs after the response (`waitUntil` on Workers). The form never waits for the LLM.
3. **Step 1, Decisions API** (`gemini-decision-1`): two closed-set questions in one request.
   - `service_category`: single choice from the six categories.
   - `priority`: a rubric with ordered levels Low < Medium < High. The API returns a probability-weighted score, and we round it to the nearest level. A brief split between Low and High becomes Medium, which keeps the order.
4. **Step 2, text model** (`gemini-4-hydrogen`, JSON mode with `responseJsonSchema`): writes `summary`, `priority_reason`, and `missing_info`. It receives the category and priority from step 1 as fixed facts, so the reason always matches the priority.
5. The two parts are merged and validated with `aiResultSchema` (strict Zod). The calibrated probabilities are saved in `ai_scores` and shown in the dashboard.
6. Any failure (HTTP error, timeout, blocked prompt, non-JSON, schema error) is caught. The brief is saved with `ai_status = failed` and a readable `ai_error`. An admin can press **Proses ulang AI**.

### API

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/api/briefs` | public | Submit a brief |
| POST | `/api/auth/login` | public | Log in, sets httpOnly cookie |
| POST | `/api/auth/logout` | public | Clear cookie |
| GET | `/api/auth/me` | session | Current admin |
| GET | `/api/admin/briefs?priority=&category=` | session | List, newest first |
| GET | `/api/admin/briefs/:id` | session | Detail |
| PATCH | `/api/admin/briefs/:id/pipeline` | session | Change pipeline status |
| POST | `/api/admin/briefs/:id/process` | session | Run AI again (waits for the result) |
| POST | `/api/admin/briefs/:id/email-draft` | session | AI draft of a reply email |

Validation errors always have the same shape: `400 { "error": "Validation failed", "fields": { "email": "..." } }`.

### Database

One table, `briefs`:

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | PK |
| `name`, `email`, `company`, `need` | text | From the form, never changed |
| `budget_range` | enum | `lt_10m`, `10m_25m`, `25m_50m`, `50m_100m`, `gt_100m` |
| `target_date` | date | Must be today or later (WIB) |
| `pipeline_status` | enum | `new` → `contacted` → `proposal` → `won` / `lost` |
| `ai_status` | enum | `pending`, `processing`, `done`, `failed` |
| `ai_result` | jsonb | Full validated AI result |
| `ai_scores` | jsonb | Probabilities and confidence from the Decisions API |
| `priority`, `service_category` | enum | Copies from `ai_result`, indexed for filters |
| `ai_error`, `ai_attempts`, `ai_model`, `ai_started_at`, `ai_processed_at` | | AI run tracking |
| `email_draft` | jsonb | `{ subject, body }` |
| `created_at`, `updated_at` | timestamptz | `created_at` is indexed for sorting |

## Technical decisions and trade-offs

- **Two Gemini models instead of one.** The Decisions API gives calibrated probabilities for closed-set questions, and output tokens are free. But it cannot write text. So it decides category and priority, and the text model only writes the text. Cost: two calls per brief, so two places to fail. Both share one 25 s deadline, and any failure gives `failed` + retry.
- **Plain `fetch` instead of the `@google/genai` SDK.** The SDK's support on Workers is not documented, and the Decisions API is new. Two small typed functions with Zod checks on the response are easy to read and easy to mock in tests.
- **Copies of `priority` and `service_category` as columns.** Filtering on real enum columns with indexes is simpler and faster than filtering on JSON paths. They are written in the same UPDATE as `ai_result`, so they cannot drift.
- **`waitUntil` instead of a queue.** This is enough for the volume of an internal tool and needs no extra service. The downside: if the Worker stops in the middle, the brief stays `processing`. The claim query treats a run older than 2 minutes as dead, so the admin can retry it. There is no automatic retry.
- **Retry claims the row with one conditional UPDATE.** Two clicks at the same time cannot start two runs. The second gets `409`.
- **One admin from env, session as a signed JWT in an httpOnly, SameSite=Lax cookie (8 h).** No users table. The password check is constant-time. Trade-off: a session cannot be revoked before it expires, except by rotating `SESSION_SECRET`.
- **The brief text is untrusted input to the LLM.** The prompts put it inside `<brief>` tags and tell the model to treat it as data. The output is still validated, so the worst case of prompt injection is wrong text in a summary, not a broken record.
- **Today is computed in Asia/Jakarta.** A client submitting at 01:00 WIB is not blocked by the server's UTC date.
- **One DB connection per request on Workers.** Workers cannot keep a TCP pool across requests. Cloudflare Hyperdrive would remove the connection setup time. I did not add it to keep the setup small.
- **Not done:** rate limiting or a CAPTCHA on the public form, pagination (the list returns the newest 200), audit history of pipeline changes.

## AI usage log

**Tools:** Claude Code (Claude Opus 5.5) in the terminal.

**What it did:** proposed the architecture, wrote most of the code (API, AI layer, React pages, tests, Docker), looked up current library and API docs (Context7, web search for Gemini models and the Decisions API), and drafted this README. I chose the stack, the database, the AI provider, and the deploy target, reviewed the code, and ran the deploy.

**Where I corrected or rejected the AI output:**

1. **Model choice: I pushed for the Decisions API.** Claude first planned a single text model call for the whole schema. I asked about the Gemini Decisions API. Claude pointed out that it cannot produce `summary`, `priority_reason`, or `missing_info`, and first offered "Hydrogen only" as the recommended option. I did not accept that, because the Decisions API gives calibrated scores for exactly the two fields the dashboard filters on. We settled on the two-step design described above.
2. **Email validation bug in AI-written code.** Claude wrote `z.email().trim().toLowerCase()`. A test with `"Sari@Example.com "` failed: Zod checks the email format before `trim()` runs, so a trailing space was rejected. Fixed with `z.string().trim().toLowerCase().pipe(z.email())`.
3. **A wrong test assumption.** Claude wrote a test that expected the text model's extra `service_category`/`priority` keys to be rejected. The code actually overwrites them with the Decisions API values, which is the behavior we want. The test was rewritten to check that, and a separate test now checks that an unknown key (for example `budget_estimate`) is rejected by the strict schema.
4. **Deploy target.** Claude recommended Railway. I chose Cloudflare, so the design changed to one Worker with static assets, `waitUntil` for background work, and a per-request DB client.

_(Add your own entries here from your review.)_
