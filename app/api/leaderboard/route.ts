import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"
import { periodKeys } from "@/lib/matchResult"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// GET /api/leaderboard?period=daily|weekly|alltime&limit=25
export async function GET(req: NextRequest) {
  const period = req.nextUrl.searchParams.get("period") || "alltime"
  const limit = Math.min(100, Math.max(1, Number(req.nextUrl.searchParams.get("limit")) || 25))

  const { daily, weekly } = periodKeys()
  const periodKey = period === "daily" ? daily : period === "weekly" ? weekly : "all"

  try {
    const rows = await query(
      `select le.score, le.kills, le.wave, p.username, p.level, p.player_id
       from leaderboard_entries le
       join player_profiles p on p.player_id = le.player_id
       where le.period = $1 and le.period_key = $2
       order by le.score desc
       limit $3`,
      [period, periodKey, limit]
    )
    return NextResponse.json({ period, periodKey, entries: rows })
  } catch (e: any) {
    console.error("[leaderboard] error:", e?.message)
    return NextResponse.json({ error: "lookup failed", entries: [] }, { status: 500 })
  }
}
