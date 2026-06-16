import { NextRequest, NextResponse } from "next/server"
import { withTransaction } from "@/lib/db"
import { applyChallengeProgress, type CompletedChallenge } from "@/lib/challenges"
import {
  MatchResultInput,
  computeXpEarned,
  computeCoinsEarned,
  validateMatch,
  levelForTotalXp,
  levelProgress,
  periodKeys,
} from "@/lib/matchResult"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function sanitize(body: any): MatchResultInput | null {
  if (!body || typeof body.playerId !== "string") return null
  const num = (v: any) => (Number.isFinite(Number(v)) ? Math.max(0, Math.floor(Number(v))) : 0)
  return {
    playerId: body.playerId,
    username: typeof body.username === "string" && body.username.trim() ? body.username.trim().slice(0, 24) : "anon",
    score: num(body.score),
    kills: num(body.kills),
    wavesSurvived: num(body.wavesSurvived),
    maxCombo: num(body.maxCombo),
    survivalSeconds: num(body.survivalSeconds),
    result: ["died", "extracted", "disconnected"].includes(body.result) ? body.result : "died",
    mode: typeof body.mode === "string" ? body.mode.slice(0, 32) : "survival_solo",
    shotsFired: num(body.shotsFired),
  }
}

export async function POST(req: NextRequest) {
  let input: MatchResultInput | null
  try {
    input = sanitize(await req.json())
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 })
  }
  if (!input) return NextResponse.json({ error: "playerId required" }, { status: 400 })

  const { flags, clampXp } = validateMatch(input)
  const xpEarned = clampXp ? 0 : computeXpEarned(input)
  const coinsEarned = clampXp ? 0 : computeCoinsEarned(input)
  // Flagged (high-severity) runs are recorded for audit but never reach the
  // leaderboard or raise best_score — keeps the boards honest.
  const lbScore = clampXp ? 0 : input.score
  const lbWave = clampXp ? 0 : input.wavesSurvived
  const lbKills = clampXp ? 0 : input.kills

  try {
    const result = await withTransaction(async (c) => {
      // 1. Upsert profile (anonymous-friendly: created on first submit)
      await c.query(
        `insert into player_profiles (player_id, username)
         values ($1, $2)
         on conflict (player_id) do update set username = excluded.username, last_seen_at = now()`,
        [input!.playerId, input!.username]
      )

      // 2. Match + match_player rows
      const match = (
        await c.query(
          `insert into matches (mode, duration_seconds) values ($1, $2) returning id`,
          [input!.mode, input!.survivalSeconds]
        )
      ).rows[0]

      await c.query(
        `insert into match_players
           (match_id, player_id, score, kills, waves_survived, max_combo, survival_seconds, xp_earned, result)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [match.id, input!.playerId, input!.score, input!.kills, input!.wavesSurvived,
         input!.maxCombo, input!.survivalSeconds, xpEarned, input!.result]
      )

      // 3. XP event + profile totals
      if (xpEarned > 0) {
        await c.query(
          `insert into xp_events (player_id, match_id, amount, reason) values ($1,$2,$3,'match_reward')`,
          [input!.playerId, match.id, xpEarned]
        )
      }

      const profile = (
        await c.query(
          `update player_profiles set
             total_xp      = total_xp + $2,
             coins         = coins + $3,
             best_score    = greatest(best_score, $4),
             best_wave     = greatest(best_wave, $5),
             total_kills   = total_kills + $6,
             total_matches = total_matches + 1,
             last_seen_at  = now()
           where player_id = $1
           returning total_xp, coins, best_score, best_wave, total_kills, total_matches`,
          [input!.playerId, xpEarned, coinsEarned, lbScore, lbWave, lbKills]
        )
      ).rows[0]

      // keep denormalized level in sync
      const newLevel = levelForTotalXp(Number(profile.total_xp))
      await c.query(`update player_profiles set level = $2 where player_id = $1`, [input!.playerId, newLevel])

      // 4. Coin ledger
      if (coinsEarned > 0) {
        await c.query(
          `insert into ledger_entries (player_id, delta_coins, balance_after, reason, ref_match_id)
           values ($1,$2,$3,'match_reward',$4)`,
          [input!.playerId, coinsEarned, profile.coins, match.id]
        )
      }

      // 5. Leaderboards (daily / weekly / alltime) — keep best score per period.
      //    Skipped entirely for flagged runs so cheaters never reach the board.
      if (!clampXp) {
        const { daily, weekly } = periodKeys()
        const periods: [string, string][] = [["daily", daily], ["weekly", weekly], ["alltime", "all"]]
        for (const [period, key] of periods) {
          await c.query(
            `insert into leaderboard_entries (player_id, period, period_key, score, kills, wave, updated_at)
             values ($1,$2,$3,$4,$5,$6, now())
             on conflict (player_id, period, period_key) do update set
               score = greatest(leaderboard_entries.score, excluded.score),
               kills = greatest(leaderboard_entries.kills, excluded.kills),
               wave  = greatest(leaderboard_entries.wave,  excluded.wave),
               updated_at = now()`,
            [input!.playerId, period, key, input!.score, input!.kills, input!.wavesSurvived]
          )
        }
      }

      // 5b. Daily challenge progress (legit runs only)
      let completedChallenges: CompletedChallenge[] = []
      if (!clampXp) {
        completedChallenges = await applyChallengeProgress(c, input!.playerId, {
          kills: input!.kills,
          wavesSurvived: input!.wavesSurvived,
          score: input!.score,
          maxCombo: input!.maxCombo,
        })
      }

      // 6. Anti-cheat flags
      for (const f of flags) {
        await c.query(
          `insert into risk_flags (player_id, match_id, flag_type, severity, detail) values ($1,$2,$3,$4,$5)`,
          [input!.playerId, match.id, f.flag_type, f.severity, JSON.stringify(f.detail)]
        )
      }

      // 7. Rank (all-time)
      const rankRow = (
        await c.query(
          `select count(*) + 1 as rank from leaderboard_entries
           where period = 'alltime' and period_key = 'all' and score > $1`,
          [input!.score]
        )
      ).rows[0]

      // Re-read final totals so challenge rewards are reflected in the response.
      const finalProfile = (
        await c.query(`select total_xp, coins, best_score from player_profiles where player_id = $1`, [input!.playerId])
      ).rows[0]

      // keep denormalized level in sync after challenge XP too
      const finalLevel = levelForTotalXp(Number(finalProfile.total_xp))
      await c.query(`update player_profiles set level = $2 where player_id = $1`, [input!.playerId, finalLevel])

      const lp = levelProgress(Number(finalProfile.total_xp))
      return {
        matchId: match.id,
        xpEarned,
        coinsEarned,
        totalXp: Number(finalProfile.total_xp),
        coins: Number(finalProfile.coins),
        level: lp.level,
        levelInto: lp.into,
        levelNeeded: lp.needed,
        levelPct: lp.pct,
        bestScore: finalProfile.best_score,
        rank: Number(rankRow.rank),
        flagged: flags.length > 0,
        completedChallenges,
      }
    })

    return NextResponse.json(result)
  } catch (e: any) {
    console.error("[match/submit] error:", e?.message)
    return NextResponse.json({ error: "submit failed" }, { status: 500 })
  }
}
