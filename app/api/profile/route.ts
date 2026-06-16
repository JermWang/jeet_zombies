import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"
import { levelProgress } from "@/lib/matchResult"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// GET /api/profile?playerId=...  -> profile + level progress + recent matches
export async function GET(req: NextRequest) {
  const playerId = req.nextUrl.searchParams.get("playerId")
  if (!playerId) return NextResponse.json({ error: "playerId required" }, { status: 400 })

  try {
    const rows = await query(
      `select player_id, username, level, total_xp, coins, best_score, best_wave,
              total_kills, total_matches
       from player_profiles where player_id = $1`,
      [playerId]
    )
    if (rows.length === 0) return NextResponse.json({ profile: null })

    const p = rows[0]
    const recent = await query(
      `select score, kills, waves_survived, max_combo, survival_seconds, xp_earned, result, created_at
       from match_players where player_id = $1 order by created_at desc limit 10`,
      [playerId]
    )
    const lp = levelProgress(Number(p.total_xp))
    return NextResponse.json({ profile: { ...p, ...lp }, recent })
  } catch (e: any) {
    console.error("[profile GET] error:", e?.message)
    return NextResponse.json({ error: "lookup failed" }, { status: 500 })
  }
}

// POST /api/profile  { playerId, username }  -> upsert (used for username changes)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    if (!body?.playerId) return NextResponse.json({ error: "playerId required" }, { status: 400 })
    const username = (typeof body.username === "string" && body.username.trim() ? body.username.trim() : "anon").slice(0, 24)
    await query(
      `insert into player_profiles (player_id, username) values ($1,$2)
       on conflict (player_id) do update set username = excluded.username, last_seen_at = now()`,
      [body.playerId, username]
    )
    return NextResponse.json({ ok: true, username })
  } catch (e: any) {
    console.error("[profile POST] error:", e?.message)
    return NextResponse.json({ error: "upsert failed" }, { status: 500 })
  }
}
