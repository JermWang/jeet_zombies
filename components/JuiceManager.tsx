"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import useGameStore from "@/hooks/useGameStore"

// Per-weapon screen-punch on fire — makes shooting feel weighty even on a miss.
const WEAPON_KICK: Record<string, number> = { pistol: 1.5, smg: 1.2, rifle: 2.2, shotgun: 4.5 }

interface DamageNumber { id: number; amount: number; kill: boolean; dx: number; dy: number }

/**
 * JuiceManager — a pure DOM overlay that turns combat events into "game feel".
 *
 * It listens to the lightweight window events emitted by useGameStore:
 *   - jz:enemyHit     { id, amount, killed }
 *   - jz:enemyKilled  { id, type, combo, gained }
 *   - jz:playerDamaged{ amount, health, gameOver }
 *
 * ...and renders hit markers, a combo callout, a meme kill-feed, and applies
 * a decaying screen-shake transform to the WebGL <canvas>. Nothing here touches
 * the R3F render loop, so it stays cheap and cannot stall the game thread.
 */

// --- Meme kill-feed copy. Escalates with combo for that viral frags.fun feel. ---
const KILL_LINES = [
  "JEETED",
  "REKT",
  "PAPER HANDS",
  "RUGGED",
  "SOLD THE BOTTOM",
  "GET DUNKED",
  "NGMI",
  "EXIT LIQUIDITY",
  "DOWN BAD",
  "LIQUIDATED",
]
const COMBO_LINES: Record<number, string> = {
  3: "ON A HEATER",
  5: "DIAMOND HANDS",
  8: "ZOMBIE SLAYER",
  12: "ABSOLUTELY GIGACHAD",
  16: "MARKET MAKER",
}

interface KillFeedItem {
  id: number
  text: string
  big: boolean
}

let kfCounter = 0

export default function JuiceManager() {
  const [hitMarker, setHitMarker] = useState<{ id: number; kill: boolean } | null>(null)
  const [killFeed, setKillFeed] = useState<KillFeedItem[]>([])
  const [combo, setCombo] = useState(0)
  const [comboPulse, setComboPulse] = useState(0)
  const [damageNumbers, setDamageNumbers] = useState<DamageNumber[]>([])

  // Low-health state drives a pulsing red vignette (clear danger feedback).
  const health = useGameStore((s) => s.health)
  const gameStarted = useGameStore((s) => s.gameStarted)
  const isGameOver = useGameStore((s) => s.isGameOver)
  const lowHealth = gameStarted && !isGameOver && health > 0 && health <= 30

  // --- Screen shake state (imperative, runs on its own rAF) ---
  const shakeAmount = useRef(0)
  const shakeRaf = useRef<number | null>(null)
  const canvasEl = useRef<HTMLCanvasElement | null>(null)

  const runShake = useCallback(() => {
    if (!canvasEl.current) {
      canvasEl.current = document.querySelector("canvas")
    }
    const tick = () => {
      const el = canvasEl.current
      shakeAmount.current *= 0.86 // decay
      if (shakeAmount.current < 0.15) {
        shakeAmount.current = 0
        if (el) el.style.transform = ""
        shakeRaf.current = null
        return
      }
      if (el) {
        const a = shakeAmount.current
        const dx = (Math.random() * 2 - 1) * a
        const dy = (Math.random() * 2 - 1) * a
        const rot = (Math.random() * 2 - 1) * a * 0.12
        el.style.transform = `translate(${dx}px, ${dy}px) rotate(${rot}deg)`
      }
      shakeRaf.current = requestAnimationFrame(tick)
    }
    if (shakeRaf.current == null) {
      shakeRaf.current = requestAnimationFrame(tick)
    }
  }, [])

  const addShake = useCallback((amount: number) => {
    shakeAmount.current = Math.min(shakeAmount.current + amount, 22)
    runShake()
  }, [runShake])

  const pushKillFeed = useCallback((text: string, big = false) => {
    const item: KillFeedItem = { id: kfCounter++, text, big }
    setKillFeed((prev) => [...prev.slice(-4), item])
    window.setTimeout(() => {
      setKillFeed((prev) => prev.filter((k) => k.id !== item.id))
    }, big ? 2600 : 2000)
  }, [])

  useEffect(() => {
    let hitTimer: number | undefined
    let comboTimer: number | undefined

    const onHit = (e: Event) => {
      const detail = (e as CustomEvent).detail || {}
      setHitMarker({ id: kfCounter++, kill: !!detail.killed })
      window.clearTimeout(hitTimer)
      hitTimer = window.setTimeout(() => setHitMarker(null), detail.killed ? 220 : 110)
      addShake(detail.killed ? 5 : 2)

      // Floating damage number near the crosshair (scattered so they don't stack).
      if (typeof detail.amount === "number") {
        const dn: DamageNumber = {
          id: kfCounter++,
          amount: Math.round(detail.amount),
          kill: !!detail.killed,
          dx: (Math.random() * 2 - 1) * 46,
          dy: (Math.random() * 2 - 1) * 24,
        }
        setDamageNumbers((prev) => [...prev.slice(-9), dn])
        window.setTimeout(() => setDamageNumbers((prev) => prev.filter((d) => d.id !== dn.id)), 650)
      }
    }

    // Every shot the player fires gives a weapon-weighted screen punch.
    const onShoot = (e: Event) => {
      const detail = (e as CustomEvent).detail || {}
      addShake(WEAPON_KICK[detail.weaponId as string] ?? 1.5)
    }

    const onKill = (e: Event) => {
      const detail = (e as CustomEvent).detail || {}
      const c: number = detail.combo || 1
      setCombo(c)
      setComboPulse((p) => p + 1)
      window.clearTimeout(comboTimer)
      comboTimer = window.setTimeout(() => setCombo(0), 3500)

      // Pick a kill line; surface a combo milestone line when one is hit.
      const milestone = COMBO_LINES[c]
      if (milestone) {
        pushKillFeed(milestone, true)
        addShake(7)
      } else {
        pushKillFeed(KILL_LINES[Math.floor(Math.random() * KILL_LINES.length)])
      }
    }

    const onPlayerDamaged = (e: Event) => {
      const detail = (e as CustomEvent).detail || {}
      addShake(Math.min(6 + (detail.amount || 0) * 0.2, 14))
    }

    const onExplosion = () => {
      addShake(16)
      pushKillFeed("💥 BOOM", true)
    }

    window.addEventListener("jz:enemyHit", onHit)
    window.addEventListener("jz:enemyKilled", onKill)
    window.addEventListener("jz:playerDamaged", onPlayerDamaged)
    window.addEventListener("jz:explosion", onExplosion)
    window.addEventListener("playerShoot", onShoot)

    return () => {
      window.removeEventListener("jz:enemyHit", onHit)
      window.removeEventListener("jz:enemyKilled", onKill)
      window.removeEventListener("jz:playerDamaged", onPlayerDamaged)
      window.removeEventListener("jz:explosion", onExplosion)
      window.removeEventListener("playerShoot", onShoot)
      window.clearTimeout(hitTimer)
      window.clearTimeout(comboTimer)
      if (shakeRaf.current != null) cancelAnimationFrame(shakeRaf.current)
      if (canvasEl.current) canvasEl.current.style.transform = ""
    }
  }, [addShake, pushKillFeed])

  return (
    <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden font-pixel select-none">
      {/* Hit marker — pops at screen center on every connecting shot */}
      {hitMarker && (
        <div
          key={hitMarker.id}
          className="absolute left-1/2 top-1/2"
          style={{ transform: "translate(-50%, -50%)" }}
        >
          <svg width="40" height="40" viewBox="0 0 40 40" className="jz-hitmarker">
            {[
              [6, 6, 13, 13],
              [34, 6, 27, 13],
              [6, 34, 13, 27],
              [34, 34, 27, 27],
            ].map(([x1, y1, x2, y2], i) => (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={hitMarker.kill ? "#ff2d2d" : "#ffffff"}
                strokeWidth={hitMarker.kill ? 4 : 3}
                strokeLinecap="round"
              />
            ))}
          </svg>
        </div>
      )}

      {/* Combo callout */}
      {combo >= 2 && (
        <div
          key={comboPulse}
          className="absolute left-1/2 top-[18%] -translate-x-1/2 text-center jz-combo-pop"
        >
          <div className="text-yellow-400 text-4xl drop-shadow-[0_2px_0_rgba(0,0,0,0.8)]">
            x{combo}
          </div>
          <div className="text-red-500 text-sm tracking-widest">COMBO</div>
        </div>
      )}

      {/* Kill feed — stacked, fades out */}
      <div className="absolute right-6 top-1/3 flex flex-col items-end gap-1">
        {killFeed.map((k) => (
          <div
            key={k.id}
            className={`jz-killfeed ${
              k.big
                ? "text-yellow-400 text-2xl"
                : "text-red-500 text-lg"
            } drop-shadow-[0_2px_0_rgba(0,0,0,0.9)]`}
          >
            {k.text}
          </div>
        ))}
      </div>

      {/* Floating damage numbers near the crosshair */}
      <div className="absolute left-1/2 top-1/2">
        {damageNumbers.map((d) => (
          <span
            key={d.id}
            className={`jz-dmg absolute font-pixel tabular-nums ${
              d.kill ? "text-red-500 text-2xl" : "text-yellow-300 text-lg"
            } drop-shadow-[0_2px_0_rgba(0,0,0,0.9)]`}
            style={{ left: d.dx, top: d.dy }}
          >
            {d.amount}
          </span>
        ))}
      </div>

      {/* Low-health vignette — pulses red when you're nearly dead */}
      {lowHealth && (
        <div
          className="jz-lowhp absolute inset-0"
          style={{ boxShadow: "inset 0 0 140px 40px rgba(220,0,0,0.55)" }}
        />
      )}

      <style jsx global>{`
        @keyframes jz-dmg {
          0% { transform: translateY(0) scale(0.6); opacity: 0; }
          25% { transform: translateY(-10px) scale(1.1); opacity: 1; }
          100% { transform: translateY(-42px) scale(1); opacity: 0; }
        }
        .jz-dmg { animation: jz-dmg 0.65s ease-out forwards; }
        @keyframes jz-lowhp { 0%,100% { opacity: 0.35; } 50% { opacity: 0.9; } }
        .jz-lowhp { animation: jz-lowhp 1.1s ease-in-out infinite; }
        @keyframes jz-hitmarker {
          0% { transform: scale(0.5); opacity: 0; }
          30% { transform: scale(1.15); opacity: 1; }
          100% { transform: scale(1); opacity: 0; }
        }
        .jz-hitmarker { animation: jz-hitmarker 0.22s ease-out; }
        @keyframes jz-combo-pop {
          0% { transform: translateX(-50%) scale(1.6); opacity: 0; }
          40% { transform: translateX(-50%) scale(1); opacity: 1; }
          100% { transform: translateX(-50%) scale(1); opacity: 1; }
        }
        .jz-combo-pop { animation: jz-combo-pop 0.25s cubic-bezier(0.2, 1.4, 0.4, 1); }
        @keyframes jz-killfeed {
          0% { transform: translateX(40px); opacity: 0; }
          12% { transform: translateX(0); opacity: 1; }
          80% { opacity: 1; }
          100% { opacity: 0; }
        }
        .jz-killfeed { animation: jz-killfeed 2s ease-out forwards; }
      `}</style>
    </div>
  )
}
