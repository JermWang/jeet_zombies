"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import useCosmetics, { type Cosmetic } from "@/hooks/useCosmetics"

const RARITY_COLOR: Record<string, string> = {
  common: "text-gray-300 border-gray-600",
  rare: "text-blue-400 border-blue-600",
  epic: "text-purple-400 border-purple-600",
  legendary: "text-yellow-400 border-yellow-500",
}

const TYPE_LABEL: Record<string, string> = {
  skin: "SKINS", trail: "TRACERS", title: "TITLES", weapon_skin: "WEAPON SKINS",
}

export default function Locker({ playerId, onClose }: { playerId: string; onClose: () => void }) {
  const { catalog, owned, coins, load, buy, equip } = useCosmetics()
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => { if (playerId) load(playerId) }, [playerId, load])

  const byType = catalog.reduce<Record<string, Cosmetic[]>>((acc, c) => {
    (acc[c.type] ||= []).push(c)
    return acc
  }, {})

  const handleBuy = async (c: Cosmetic) => {
    setBusy(c.id); setMsg(null)
    const r = await buy(playerId, c.id)
    if (!r.ok && r.error === "insufficient_coins") setMsg("Not enough coins, anon. Go farm some zombies.")
    setBusy(null)
  }
  const handleEquip = async (c: Cosmetic) => {
    setBusy(c.id); await equip(playerId, c.id); setBusy(null)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm pointer-events-auto font-pixel">
      <div className="bg-neutral-900 border-2 border-red-700 rounded-lg p-6 w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-red-500 text-2xl">LOCKER</h2>
          <div className="flex items-center gap-4">
            <span className="text-green-400 text-lg">🪙 {coins.toLocaleString()}</span>
            <button onClick={onClose} className="text-gray-400 hover:text-white text-3xl leading-none">&times;</button>
          </div>
        </div>

        {msg && <p className="text-red-400 text-xs mb-3 font-pixel-alt">{msg}</p>}

        {["skin", "trail", "title"].map((type) => (
          <div key={type} className="mb-5">
            <h3 className="text-red-700 text-xs mb-2 tracking-widest">{TYPE_LABEL[type]}</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {(byType[type] || []).map((c) => {
                const isOwned = owned[c.id] !== undefined
                const isEquipped = owned[c.id] === true
                const swatch = c.meta?.body || c.meta?.color
                return (
                  <div key={c.id} className={`rounded border p-2 bg-black/40 ${RARITY_COLOR[c.rarity] || RARITY_COLOR.common}`}>
                    <div className="flex items-center gap-2 mb-1">
                      {swatch && swatch !== "rainbow" && (
                        <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: swatch }} />
                      )}
                      {swatch === "rainbow" && (
                        <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: "linear-gradient(90deg,red,orange,yellow,green,blue,violet)" }} />
                      )}
                      <span className="text-xs truncate font-pixel-alt">{c.name}</span>
                    </div>
                    <div className="text-[9px] uppercase opacity-70 mb-1.5">{c.rarity}</div>
                    {isEquipped ? (
                      <div className="text-center text-[10px] text-green-400 border border-green-700 rounded py-1">EQUIPPED</div>
                    ) : isOwned ? (
                      <Button onClick={() => handleEquip(c)} disabled={busy === c.id}
                        className="w-full bg-neutral-700 hover:bg-neutral-600 text-white text-[10px] py-1 h-auto font-pixel">
                        {busy === c.id ? "..." : "EQUIP"}
                      </Button>
                    ) : (
                      <Button onClick={() => handleBuy(c)} disabled={busy === c.id}
                        className="w-full bg-red-600 hover:bg-red-700 text-white text-[10px] py-1 h-auto font-pixel">
                        {busy === c.id ? "..." : c.price_coins === 0 ? "CLAIM" : `🪙 ${c.price_coins}`}
                      </Button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}

        <Button onClick={onClose} className="bg-red-600 hover:bg-red-700 text-white font-pixel w-full mt-2">CLOSE</Button>
      </div>
    </div>
  )
}
