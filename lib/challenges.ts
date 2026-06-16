import type { PoolClient } from "pg"

export interface CompletedChallenge {
  challenge_key: string
  description: string
  reward_xp: number
  reward_coins: number
}

interface MatchStats {
  kills: number
  wavesSurvived: number
  score: number
  maxCombo: number
}

// Evaluate today's daily challenges against a finished run and persist progress.
// Cumulative goals (kills, matches) accumulate; "best" goals (waves, score, combo)
// take the max. Newly-completed challenges pay out XP + coins (once) and are
// returned so the client can surface a "challenge complete" toast.
// Must run inside the same transaction as the match write (pass the PoolClient).
export async function applyChallengeProgress(
  c: PoolClient,
  playerId: string,
  stats: MatchStats
): Promise<CompletedChallenge[]> {
  const today = new Date().toISOString().slice(0, 10) // UTC YYYY-MM-DD
  const challenges = (
    await c.query(`select * from daily_challenges where period_key = $1`, [today])
  ).rows

  const completed: CompletedChallenge[] = []

  for (const ch of challenges) {
    const existing = (
      await c.query(
        `select progress, completed from player_challenge_progress where player_id = $1 and challenge_id = $2`,
        [playerId, ch.id]
      )
    ).rows[0]

    if (existing?.completed) continue // already done — don't pay twice

    const prev = existing?.progress ?? 0
    let next = prev
    switch (ch.goal_type) {
      case "kills":   next = prev + stats.kills; break
      case "matches": next = prev + 1; break
      case "waves":   next = Math.max(prev, stats.wavesSurvived); break
      case "score":   next = Math.max(prev, stats.score); break
      case "combo":   next = Math.max(prev, stats.maxCombo); break
    }

    const isComplete = next >= ch.goal_value

    await c.query(
      `insert into player_challenge_progress (player_id, challenge_id, progress, completed, claimed, updated_at)
       values ($1,$2,$3,$4,$4, now())
       on conflict (player_id, challenge_id) do update set
         progress  = excluded.progress,
         completed = excluded.completed,
         claimed   = player_challenge_progress.claimed or excluded.completed,
         updated_at = now()`,
      [playerId, ch.id, next, isComplete]
    )

    if (isComplete) {
      if (ch.reward_xp > 0) {
        await c.query(`update player_profiles set total_xp = total_xp + $2 where player_id = $1`, [playerId, ch.reward_xp])
        await c.query(
          `insert into xp_events (player_id, amount, reason) values ($1,$2,'daily_challenge')`,
          [playerId, ch.reward_xp]
        )
      }
      if (ch.reward_coins > 0) {
        const bal = (
          await c.query(
            `update player_profiles set coins = coins + $2 where player_id = $1 returning coins`,
            [playerId, ch.reward_coins]
          )
        ).rows[0]
        await c.query(
          `insert into ledger_entries (player_id, delta_coins, balance_after, reason)
           values ($1,$2,$3,'challenge')`,
          [playerId, ch.reward_coins, bal.coins]
        )
      }
      completed.push({
        challenge_key: ch.challenge_key,
        description: ch.description,
        reward_xp: ch.reward_xp,
        reward_coins: ch.reward_coins,
      })
    }
  }

  return completed
}
