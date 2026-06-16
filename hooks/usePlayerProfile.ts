"use client"

import { useCallback, useEffect, useRef, useState } from "react"

// Anonymous-friendly identity: a stable player_id is generated client-side and
// stored in localStorage. The server upserts a profile on first match submit.
// Wallet login can later replace/merge this id without changing the data model.

const ID_KEY = "jz_player_id"
const NAME_KEY = "jz_username"

const MEME_ADJ = ["Diamond", "Paper", "Based", "Cope", "Giga", "Degen", "Rekt", "Comfy", "Jeet", "Wagmi"]
const MEME_NOUN = ["Hands", "Chad", "Ape", "Holder", "Whale", "Bagholder", "Frog", "Slayer", "Anon", "Maxi"]

function randomName() {
  const a = MEME_ADJ[Math.floor(Math.random() * MEME_ADJ.length)]
  const n = MEME_NOUN[Math.floor(Math.random() * MEME_NOUN.length)]
  return `${a}${n}${Math.floor(Math.random() * 1000)}`
}

export interface MatchSubmitResult {
  matchId: string
  xpEarned: number
  coinsEarned: number
  totalXp: number
  coins: number
  level: number
  levelInto: number
  levelNeeded: number
  levelPct: number
  bestScore: number
  rank: number
  flagged: boolean
  completedChallenges: { challenge_key: string; description: string; reward_xp: number; reward_coins: number }[]
}

export interface ProfileSummary {
  username: string
  level: number
  total_xp: number
  coins: number
  best_score: number
  best_wave: number
  total_kills: number
  total_matches: number
  into: number
  needed: number
  pct: number
}

export function usePlayerProfile() {
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [username, setUsernameState] = useState<string>("anon")
  const [profile, setProfile] = useState<ProfileSummary | null>(null)

  useEffect(() => {
    if (typeof window === "undefined") return
    let id = localStorage.getItem(ID_KEY)
    if (!id) {
      id = (crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`)
      localStorage.setItem(ID_KEY, id)
    }
    let name = localStorage.getItem(NAME_KEY)
    if (!name) {
      name = randomName()
      localStorage.setItem(NAME_KEY, name)
    }
    setPlayerId(id)
    setUsernameState(name)
  }, [])

  const refresh = useCallback(async () => {
    if (!playerId) return
    try {
      const res = await fetch(`/api/profile?playerId=${encodeURIComponent(playerId)}`)
      const data = await res.json()
      if (data?.profile) setProfile(data.profile)
    } catch { /* offline / not yet created — fine */ }
  }, [playerId])

  useEffect(() => { if (playerId) refresh() }, [playerId, refresh])

  const setUsername = useCallback(async (name: string) => {
    const clean = name.trim().slice(0, 24) || "anon"
    setUsernameState(clean)
    if (typeof window !== "undefined") localStorage.setItem(NAME_KEY, clean)
    if (playerId) {
      try {
        await fetch("/api/profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playerId, username: clean }),
        })
      } catch { /* ignore */ }
    }
  }, [playerId])

  const submitMatch = useCallback(async (stats: {
    score: number; kills: number; wavesSurvived: number; maxCombo: number; survivalSeconds: number
    result?: string
  }): Promise<MatchSubmitResult | null> => {
    if (!playerId) return null
    try {
      const res = await fetch("/api/match/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, username, ...stats }),
      })
      if (!res.ok) return null
      const data = (await res.json()) as MatchSubmitResult
      refresh()
      return data
    } catch {
      return null
    }
  }, [playerId, username, refresh])

  return { playerId, username, setUsername, profile, refresh, submitMatch }
}
