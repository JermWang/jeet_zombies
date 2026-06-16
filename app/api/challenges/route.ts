import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// GET /api/challenges?playerId=...  -> today's daily challenges + this player's progress
export async function GET(req: NextRequest) {
  const playerId = req.nextUrl.searchParams.get("playerId")
  const today = new Date().toISOString().slice(0, 10)

  try {
    const rows = await query(
      `select dc.id, dc.challenge_key, dc.description, dc.goal_type, dc.goal_value,
              dc.reward_xp, dc.reward_coins,
              coalesce(pcp.progress, 0)   as progress,
              coalesce(pcp.completed, false) as completed
       from daily_challenges dc
       left join player_challenge_progress pcp
         on pcp.challenge_id = dc.id and pcp.player_id = $2
       where dc.period_key = $1
       order by dc.reward_xp asc`,
      [today, playerId || "00000000-0000-0000-0000-000000000000"]
    )
    return NextResponse.json({ periodKey: today, challenges: rows })
  } catch (e: any) {
    console.error("[challenges] error:", e?.message)
    return NextResponse.json({ error: "lookup failed", challenges: [] }, { status: 500 })
  }
}
