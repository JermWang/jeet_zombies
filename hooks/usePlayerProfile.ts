"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useWallet } from "@solana/wallet-adapter-react"

// Identity model:
//  - Anonymous: a stable player_id (uuid) generated client-side in localStorage.
//  - Wallet-linked: when a Solana wallet connects, the server resolves it to a
//    canonical profile (same wallet = same profile across devices). The wallet
//    profile becomes the ACTIVE id, so all progress (XP, matches, leaderboard,
//    cosmetics, challenges) follows the wallet. Disconnecting reverts to anon.

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
  const [anonId, setAnonId] = useState<string | null>(null)
  // The ACTIVE id: wallet-linked profile id when connected, else the anon id.
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [username, setUsernameState] = useState<string>("anon")
  const [profile, setProfile] = useState<ProfileSummary | null>(null)
  const [walletLinked, setWalletLinked] = useState(false)

  const { publicKey, connected } = useWallet()
  const walletAddress = connected && publicKey ? publicKey.toBase58() : null

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
    setAnonId(id)
    setPlayerId(id)
    setUsernameState(name)
  }, [])

  // Link / unlink the wallet to a canonical profile.
  useEffect(() => {
    if (!anonId) return
    if (!walletAddress) {
      // disconnected -> fall back to anonymous identity
      if (walletLinked) { setWalletLinked(false); setPlayerId(anonId) }
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch("/api/profile/wallet", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ walletAddress, playerId: anonId, username }),
        })
        const data = await res.json()
        if (cancelled || !data?.playerId) return
        setPlayerId(data.playerId)
        setWalletLinked(true)
        if (data.profile?.username) setUsernameState(data.profile.username)
      } catch { /* wallet link best-effort */ }
    })()
    return () => { cancelled = true }
  }, [walletAddress, anonId]) // eslint-disable-line react-hooks/exhaustive-deps

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
    result?: string; gameMode?: "training" | "tournament"
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
      // For tournament runs, claim the $SURVIVAL reward (server validates + pays).
      if (stats.gameMode === "tournament" && walletAddress && (data as any).matchId) {
        try {
          await fetch("/api/tournament/reward", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ playerId, walletAddress, matchId: (data as any).matchId, score: stats.score }),
          })
        } catch { /* reward best-effort */ }
      }
      refresh()
      return data
    } catch {
      return null
    }
  }, [playerId, username, walletAddress, refresh])

  // Pay the entry fee + record a tournament entry. (Fee tx is dry-run-accepted
  // server-side until REWARDS_LIVE; a real SPL transfer is built here when live.)
  const enterTournament = useCallback(async (feeTxSig?: string): Promise<{ ok: boolean; error?: string }> => {
    if (!playerId || !walletAddress) return { ok: false, error: "wallet_required" }
    try {
      const res = await fetch("/api/tournament/enter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, walletAddress, feeTxSig: feeTxSig || "dry-run" }),
      })
      const data = await res.json()
      return { ok: !!data.ok, error: data.error }
    } catch {
      return { ok: false, error: "network" }
    }
  }, [playerId, walletAddress])

  return { playerId, username, setUsername, profile, refresh, submitMatch, enterTournament, walletLinked, walletAddress }
}
