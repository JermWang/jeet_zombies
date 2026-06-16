import { NextRequest, NextResponse } from "next/server"
import { query, withTransaction } from "@/lib/db"
import { payoutSurvival, REWARDS_LIVE } from "@/lib/solana"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// POST /api/tournament/reward  { playerId, walletAddress, matchId, score }
// Pays $SURVIVAL for a finished, server-validated TOURNAMENT run. Idempotent per
// match (unique on reward_payouts.match_id). Enforces per-run cap, per-wallet
// daily cap, and a global daily emission budget so the 15M reserve is rationed.
// Dry-run unless REWARDS_LIVE + keys configured (nothing moves on-chain).
export async function POST(req: NextRequest) {
  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }) }

  const { playerId, walletAddress, matchId, score } = body || {}
  if (!playerId || !walletAddress || !matchId) {
    return NextResponse.json({ error: "playerId, walletAddress, matchId required" }, { status: 400 })
  }

  const perScore = Number(process.env.REWARD_PER_SCORE || 0)
  const maxPerRun = Number(process.env.MAX_REWARD_PER_RUN || 0)
  const dailyBudget = Number(process.env.DAILY_REWARD_BUDGET || 0)
  const perWalletDay = Number(process.env.MAX_REWARD_PER_WALLET_DAY || 0)

  try {
    // Idempotency: if this match was already paid, return it.
    const existing = await query(
      `select amount, status, tx_sig, dry_run from reward_payouts where match_id = $1`,
      [matchId]
    )
    if (existing.length > 0) {
      return NextResponse.json({ ok: true, alreadyPaid: true, ...existing[0] })
    }

    // Confirm the match exists, is a tournament, and was NOT flagged by anti-cheat.
    const m = await query(
      `select m.game_mode, mp.score, exists(select 1 from risk_flags r where r.match_id = m.id and r.severity = 'high') as flagged
       from matches m join match_players mp on mp.match_id = m.id
       where m.id = $1 and mp.player_id = $2 limit 1`,
      [matchId, playerId]
    )
    if (m.length === 0) return NextResponse.json({ error: "match_not_found" }, { status: 404 })
    if (m[0].game_mode !== "tournament") return NextResponse.json({ error: "not_tournament" }, { status: 400 })
    if (m[0].flagged) return NextResponse.json({ ok: true, amount: 0, reason: "flagged" })

    const validatedScore = Number(m[0].score) || Number(score) || 0
    let amount = perScore > 0 ? Math.round(validatedScore * perScore) : 0
    if (maxPerRun > 0) amount = Math.min(amount, maxPerRun)
    if (amount <= 0) return NextResponse.json({ ok: true, amount: 0, reason: "no_reward" })

    // Budget enforcement (UTC day).
    const todayPaid = await query<{ global: string; wallet: string }>(
      `select
         coalesce(sum(amount),0) as global,
         coalesce(sum(amount) filter (where wallet_address = $1),0) as wallet
       from reward_payouts
       where created_at >= date_trunc('day', now() at time zone 'utc') and status in ('sent','pending')`,
      [walletAddress]
    )
    const globalPaid = Number(todayPaid[0]?.global || 0)
    const walletPaid = Number(todayPaid[0]?.wallet || 0)
    if (dailyBudget > 0 && globalPaid + amount > dailyBudget) {
      return NextResponse.json({ ok: true, amount: 0, reason: "daily_budget_reached" })
    }
    if (perWalletDay > 0 && walletPaid + amount > perWalletDay) {
      amount = Math.max(0, perWalletDay - walletPaid)
      if (amount <= 0) return NextResponse.json({ ok: true, amount: 0, reason: "wallet_daily_cap" })
    }

    // Record pending payout (idempotent), then settle on-chain, then update.
    const inserted = await withTransaction(async (c) => {
      const r = await c.query(
        `insert into reward_payouts (player_id, wallet_address, match_id, amount, status, dry_run)
         values ($1,$2,$3,$4,'pending',$5)
         on conflict (match_id) do nothing
         returning id`,
        [playerId, walletAddress, matchId, amount, !REWARDS_LIVE]
      )
      return r.rows[0]?.id ?? null
    })
    if (!inserted) {
      const again = await query(`select amount, status, tx_sig from reward_payouts where match_id = $1`, [matchId])
      return NextResponse.json({ ok: true, alreadyPaid: true, ...again[0] })
    }

    const pay = await payoutSurvival(walletAddress, amount)
    await query(
      `update reward_payouts set status = $2, tx_sig = $3, sent_at = now() where id = $1`,
      [inserted, pay.ok ? "sent" : "failed", pay.txSig || null]
    )

    return NextResponse.json({ ok: pay.ok, amount, dryRun: pay.dryRun, txSig: pay.txSig, error: pay.error })
  } catch (e: any) {
    console.error("[tournament/reward] error:", e?.message)
    return NextResponse.json({ error: "reward_failed" }, { status: 500 })
  }
}
