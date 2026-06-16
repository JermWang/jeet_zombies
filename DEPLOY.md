# Deploying Jeet Zombies (production)

The launch product is **single-player** with full progression, leaderboards,
cosmetics, and daily challenges — all backed by Supabase. Multiplayer ships as a
gated BETA and is **off by default**.

## 1. Deploy the web app to Vercel

1. Import the GitHub repo (`JermWang/jeet_zombies`) into Vercel. Framework
   auto-detects as **Next.js** — no build config needed.
2. Add the environment variables below (Project → Settings → Environment
   Variables), then deploy.

### Required env vars (Vercel)

| Variable | Value | Notes |
|---|---|---|
| `DATABASE_URL` | `postgresql://postgres.ardsdleyjlacatjaluzt:<db-password>@aws-1-us-east-1.pooler.supabase.com:5432/postgres` | Server-authoritative DB access. |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://ardsdleyjlacatjaluzt.supabase.co` | |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `sb_publishable_af2Q2zq1LFqZOJ-UkDxQyw__g7h4y42` | Publishable key. |
| `NEXT_PUBLIC_SUPABASE_PROJECT_REF` | `ardsdleyjlacatjaluzt` | |
| `NEXT_PUBLIC_MP_ENABLED` | `false` | Keep false for launch (MP beta gate). |

Copy exact values from your local `.env.local`. You do **not** need
`SUPABASE_SERVICE_ROLE_KEY` (the API uses `DATABASE_URL`/postgres role).

The client only talks to its own `/api/*` routes (relative URLs), so nothing is
hardcoded to localhost. The API routes run on the Node.js runtime (required by
`pg`) and are already configured.

### Database connection note (scale)

The pool is serverless-aware (`max: 1` per Vercel instance). The connection
string above uses the **session pooler (port 5432)**, which is compatible with
`pg` parameterized queries. If you hit connection limits at high traffic, switch
the host/port to the **transaction pooler (`...pooler.supabase.com:6543`)** — `pg`
works with it because it uses unnamed prepared statements.

## 2. Multiplayer (BETA — later, optional)

Multiplayer needs a **persistent WebSocket host** — it cannot run on Vercel
(serverless has no long-lived sockets). When you're ready:

1. Deploy `server/realtime.ts` to Railway / Fly / Render (`npm run server`).
   Set `APP_URL` there to your Vercel production URL.
2. In Vercel set `NEXT_PUBLIC_WS_URL=wss://<your-realtime-host>` and
   `NEXT_PUBLIC_MP_ENABLED=true`, then redeploy.

Until then the "MULTIPLAYER — SOON™" button stays disabled. The single-player
game is fully functional without it.

## 3. Smoke test after deploy

- Open the site → START GAME → play a wave → die → recap shows XP/coins/rank.
- Open LEADERBOARD / LOCKER / CHALLENGES — they should load from the DB.
- Hard refresh: your username + level persist (localStorage id + DB profile).
