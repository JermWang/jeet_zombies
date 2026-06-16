// Shared match-result schema + progression math + server-side anti-cheat sanity.
// This is the contract between the client (which reports a finished run) and the
// authoritative API route (which validates, scores XP, and writes the ledger).
// Keeping it framework-agnostic means a future realtime server can reuse it.

export interface MatchResultInput {
  playerId: string
  username: string
  score: number
  kills: number
  wavesSurvived: number
  maxCombo: number
  survivalSeconds: number
  result?: "died" | "extracted" | "disconnected"
  mode?: string
  gameMode?: "training" | "tournament"
  // Optional client-reported telemetry used only for anti-cheat heuristics.
  shotsFired?: number
}

export interface RiskFlag {
  flag_type: string
  severity: "low" | "medium" | "high"
  detail: Record<string, unknown>
}

// --- Progression curve ---------------------------------------------------
// Each level costs 250 * level XP. Cumulative XP to *reach* level L:
//   total(L) = 250 * (L-1) * L / 2
export const XP_PER_LEVEL_BASE = 250

export function totalXpForLevel(level: number): number {
  const l = Math.max(1, level)
  return Math.round(XP_PER_LEVEL_BASE * (l - 1) * l / 2)
}

export function levelForTotalXp(totalXp: number): number {
  // Invert total(L) = 125 * L * (L-1)  ->  L = (1 + sqrt(1 + totalXp/31.25)) / 2
  const l = Math.floor((1 + Math.sqrt(1 + totalXp / (XP_PER_LEVEL_BASE / 8))) / 2)
  return Math.max(1, l)
}

export function levelProgress(totalXp: number): { level: number; into: number; needed: number; pct: number } {
  const level = levelForTotalXp(totalXp)
  const floor = totalXpForLevel(level)
  const ceil = totalXpForLevel(level + 1)
  const into = totalXp - floor
  const needed = ceil - floor
  return { level, into, needed, pct: needed > 0 ? Math.min(1, into / needed) : 0 }
}

// --- XP rewards ----------------------------------------------------------
export function computeXpEarned(r: Pick<MatchResultInput, "score" | "kills" | "wavesSurvived" | "maxCombo">): number {
  return Math.round(r.score * 0.1) + r.kills * 5 + r.wavesSurvived * 25 + r.maxCombo * 3
}

// Soft-currency (coins) reward — kept modest; this is the DB-first economy.
export function computeCoinsEarned(r: Pick<MatchResultInput, "kills" | "wavesSurvived">): number {
  return r.kills * 2 + r.wavesSurvived * 10
}

// --- Anti-cheat sanity ---------------------------------------------------
// Lenient by design (Phase 8 is "ready, not overbuilt"): we record the match
// but flag and clamp obviously impossible results so leaderboards stay honest.
const MAX_SCORE_PER_KILL = 40 // base 10 * max 3.5x combo, rounded up + slack
const MAX_KILLS_PER_SECOND = 8
const MAX_REASONABLE_SECONDS = 2 * 60 * 60 // 2h
const MAX_REASONABLE_WAVES = 60

export function validateMatch(r: MatchResultInput): { flags: RiskFlag[]; clampXp: boolean } {
  const flags: RiskFlag[] = []

  if (r.score < 0 || r.kills < 0 || r.survivalSeconds < 0) {
    flags.push({ flag_type: "negative_values", severity: "high", detail: { score: r.score, kills: r.kills } })
  }
  if (r.kills > 0 && r.score > r.kills * MAX_SCORE_PER_KILL + 50) {
    flags.push({ flag_type: "impossible_score", severity: "high", detail: { score: r.score, kills: r.kills } })
  }
  if (r.kills === 0 && r.score > 50) {
    flags.push({ flag_type: "score_without_kills", severity: "medium", detail: { score: r.score } })
  }
  if (r.survivalSeconds > 0 && r.kills / r.survivalSeconds > MAX_KILLS_PER_SECOND) {
    flags.push({ flag_type: "impossible_rate", severity: "high", detail: { kills: r.kills, seconds: r.survivalSeconds } })
  }
  if (r.survivalSeconds > MAX_REASONABLE_SECONDS || r.wavesSurvived > MAX_REASONABLE_WAVES) {
    flags.push({ flag_type: "time_anomaly", severity: "medium", detail: { seconds: r.survivalSeconds, waves: r.wavesSurvived } })
  }

  const clampXp = flags.some((f) => f.severity === "high")
  return { flags, clampXp }
}

export function periodKeys(now = new Date()): { daily: string; weekly: string } {
  const d = now.toISOString().slice(0, 10) // YYYY-MM-DD (UTC)
  // ISO week key
  const tmp = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const dayNum = (tmp.getUTCDay() + 6) % 7
  tmp.setUTCDate(tmp.getUTCDate() - dayNum + 3)
  const firstThursday = tmp.getTime()
  tmp.setUTCMonth(0, 1)
  if (tmp.getUTCDay() !== 4) tmp.setUTCMonth(0, 1 + ((4 - tmp.getUTCDay()) + 7) % 7)
  const week = 1 + Math.ceil((firstThursday - tmp.getTime()) / (7 * 24 * 3600 * 1000))
  const weekly = `${now.getUTCFullYear()}-W${String(week).padStart(2, "0")}`
  return { daily: d, weekly }
}
