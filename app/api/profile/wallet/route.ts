import { NextRequest, NextResponse } from "next/server"
import { query, withTransaction } from "@/lib/db"
import { levelProgress } from "@/lib/matchResult"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// POST /api/profile/wallet  { walletAddress, playerId, username }
// Links a connected Solana wallet to a player profile so progress follows the
// wallet across devices:
//  - if a profile already owns this wallet -> return THAT profile (canonical id)
//  - otherwise -> attach the wallet to the caller's current (anon) profile
// Returns the canonical playerId the client should use from now on.
export async function POST(req: NextRequest) {
  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }) }

  const walletAddress = typeof body?.walletAddress === "string" ? body.walletAddress.trim() : ""
  const playerId = typeof body?.playerId === "string" ? body.playerId : ""
  const username = (typeof body?.username === "string" && body.username.trim() ? body.username.trim() : "anon").slice(0, 24)
  if (!walletAddress || !playerId) {
    return NextResponse.json({ error: "walletAddress and playerId required" }, { status: 400 })
  }

  try {
    const result = await withTransaction(async (c) => {
      // 1. Does a profile already own this wallet? -> that's the canonical identity.
      const existing = (
        await c.query(
          `select player_id, username, level, total_xp, coins, best_score, best_wave, total_kills, total_matches
           from player_profiles where wallet_address = $1 limit 1`,
          [walletAddress]
        )
      ).rows[0]

      if (existing) {
        await c.query(`update player_profiles set last_seen_at = now() where player_id = $1`, [existing.player_id])
        return { playerId: existing.player_id, linked: true, profile: existing }
      }

      // 2. Otherwise claim the wallet for the caller's current profile (create if new).
      const claimed = (
        await c.query(
          `insert into player_profiles (player_id, username, wallet_address)
           values ($1, $2, $3)
           on conflict (player_id) do update set wallet_address = excluded.wallet_address, last_seen_at = now()
           returning player_id, username, level, total_xp, coins, best_score, best_wave, total_kills, total_matches`,
          [playerId, username, walletAddress]
        )
      ).rows[0]
      return { playerId: claimed.player_id, linked: false, claimed: true, profile: claimed }
    })

    const p = result.profile
    const lp = levelProgress(Number(p.total_xp || 0))
    return NextResponse.json({ ...result, profile: { ...p, ...lp } })
  } catch (e: any) {
    console.error("[profile/wallet] error:", e?.message)
    return NextResponse.json({ error: "link failed" }, { status: 500 })
  }
}
