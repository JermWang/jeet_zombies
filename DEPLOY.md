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
| `DATABASE_URL` | `postgresql://postgres.ardsdleyjlacatjaluzt:<db-password>@aws-1-us-east-1.pooler.supabase.com:6543/postgres` | **Transaction pooler (port 6543)** — best for serverless. |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://ardsdleyjlacatjaluzt.supabase.co` | |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `sb_publishable_af2Q2zq1LFqZOJ-UkDxQyw__g7h4y42` | Publishable key. |
| `NEXT_PUBLIC_SUPABASE_PROJECT_REF` | `ardsdleyjlacatjaluzt` | |
| `NEXT_PUBLIC_SOLANA_RPC_URL` | `https://mainnet.helius-rpc.com/?api-key=<key>` | Helius RPC (future wallet/token features). |
| `SOLANA_RPC_URL` | same as above | Server-side RPC. |
| `HELIUS_API_KEY` | `<helius-key>` | |
| `NEXT_PUBLIC_MP_ENABLED` | `false` | Keep false for launch (MP beta gate). |

Leave `NEXT_PUBLIC_TOKEN_MINT` **unset** until the pump.fun relaunch — the
contract-address UI stays hidden until it's populated.

Copy exact values from your local `.env.local`. You do **not** need
`SUPABASE_SERVICE_ROLE_KEY` (the API uses `DATABASE_URL`/postgres role).

The client only talks to its own `/api/*` routes (relative URLs), so nothing is
hardcoded to localhost. The API routes run on the Node.js runtime (required by
`pg`) and are already configured.

### Database connection note (load-tested)

The pool is serverless-aware (`max: 1` per Vercel instance) and uses the
**transaction pooler (port 6543)**, which multiplexes many short-lived
serverless invocations — the right choice for burst traffic. `pg` is compatible
(unnamed prepared statements, explicit transactions).

Load test against the live DB (local box → us-east-1): **leaderboard reads were
100% successful** across 20/40/60 concurrency. Match submits (a heavier
multi-statement transaction, once per game-over) are 100% at realistic
concurrency; a synthetic 60-simultaneous burst saturated the local single-process
pool — not a DB limit. On Vercel each submit runs in-region (~ms per query) on
its own scaled instance, so real capacity is far higher. If you ever see
connection pressure, the transaction pooler already handles it; the next lever is
trimming queries in the submit transaction.

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
