"use client"

import { create } from "zustand"

export interface Cosmetic {
  id: string
  slug: string
  name: string
  type: "skin" | "trail" | "weapon_skin" | "title"
  rarity: "common" | "rare" | "epic" | "legendary"
  price_coins: number
  meta: Record<string, any>
}

interface OwnedRow { cosmetic_id: string; equipped: boolean }

interface CosmeticsState {
  catalog: Cosmetic[]
  owned: Record<string, boolean> // cosmeticId -> equipped
  coins: number
  loaded: boolean

  load: (playerId: string) => Promise<void>
  buy: (playerId: string, cosmeticId: string) => Promise<{ ok: boolean; error?: string }>
  equip: (playerId: string, cosmeticId: string) => Promise<void>

  // Derived gear applied in-game
  equippedOfType: (type: Cosmetic["type"]) => Cosmetic | null
  skinColors: () => { body: string; visor: string }
  trailColor: () => string
  title: () => string
}

const DEFAULTS = { skin: "skin_default", trail: "trail_green", title: "title_jeet" }

const useCosmetics = create<CosmeticsState>((set, get) => ({
  catalog: [],
  owned: {},
  coins: 0,
  loaded: false,

  load: async (playerId) => {
    try {
      const res = await fetch(`/api/cosmetics?playerId=${encodeURIComponent(playerId)}`)
      const data = await res.json()
      const owned: Record<string, boolean> = {}
      for (const o of (data.owned || []) as OwnedRow[]) owned[o.cosmetic_id] = o.equipped
      set({ catalog: data.catalog || [], owned, coins: Number(data.coins) || 0, loaded: true })
    } catch {
      set({ loaded: true })
    }
  },

  buy: async (playerId, cosmeticId) => {
    try {
      const res = await fetch("/api/cosmetics", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, action: "buy", cosmeticId }),
      })
      const data = await res.json()
      if (data.ok) await get().load(playerId)
      return { ok: !!data.ok, error: data.error }
    } catch {
      return { ok: false, error: "network" }
    }
  },

  equip: async (playerId, cosmeticId) => {
    try {
      await fetch("/api/cosmetics", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, action: "equip", cosmeticId }),
      })
      await get().load(playerId)
    } catch { /* ignore */ }
  },

  equippedOfType: (type) => {
    const { catalog, owned } = get()
    const equippedId = Object.keys(owned).find((id) => owned[id] && catalog.find((c) => c.id === id)?.type === type)
    if (equippedId) return catalog.find((c) => c.id === equippedId) || null
    // fall back to the free default for that type
    return catalog.find((c) => c.slug === (DEFAULTS as any)[type]) || null
  },

  skinColors: () => {
    const skin = get().equippedOfType("skin")
    return {
      body: skin?.meta?.body || "#cc0000",
      visor: skin?.meta?.visor || "#ff3a00",
    }
  },

  trailColor: () => {
    const trail = get().equippedOfType("trail")
    const c = trail?.meta?.color
    return !c || c === "rainbow" ? "#39ff14" : c
  },

  title: () => get().equippedOfType("title")?.name || "",
}))

export default useCosmetics
