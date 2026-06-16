"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"

interface Challenge {
  id: string
  challenge_key: string
  description: string
  goal_type: string
  goal_value: number
  reward_xp: number
  reward_coins: number
  progress: number
  completed: boolean
}

export default function ChallengesPanel({ playerId, onClose }: { playerId: string; onClose: () => void }) {
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    fetch(`/api/challenges?playerId=${encodeURIComponent(playerId)}`)
      .then((r) => r.json())
      .then((d) => { if (active) setChallenges(d.challenges || []) })
      .catch(() => { if (active) setChallenges([]) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [playerId])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm pointer-events-auto font-pixel">
      <div className="bg-neutral-900 border-2 border-red-700 rounded-lg p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-red-500 text-2xl">DAILY CHALLENGES</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-3xl leading-none">&times;</button>
        </div>
        <p className="text-red-700 text-[10px] mb-4 font-pixel-alt">Resets daily · rewards auto-claim on completion</p>

        {loading ? (
          <p className="text-red-400 text-center py-10 animate-pulse">LOADING...</p>
        ) : challenges.length === 0 ? (
          <p className="text-gray-400 text-center py-10 font-pixel-alt">No challenges today.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {challenges.map((ch) => {
              const pct = Math.min(100, Math.round((ch.progress / ch.goal_value) * 100))
              return (
                <div key={ch.id} className={`rounded border p-3 ${ch.completed ? "border-green-700 bg-green-950/30" : "border-neutral-700 bg-black/40"}`}>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-sm font-pixel-alt text-white">{ch.description}</span>
                    {ch.completed && <span className="text-green-400 text-xs">✓ DONE</span>}
                  </div>
                  <div className="w-full h-2 bg-neutral-800 rounded overflow-hidden mb-1.5">
                    <div className={`h-full ${ch.completed ? "bg-green-500" : "bg-red-500"} transition-all`} style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex justify-between text-[10px] font-pixel-alt">
                    <span className="text-gray-400 tabular-nums">{Math.min(ch.progress, ch.goal_value)}/{ch.goal_value}</span>
                    <span className="text-yellow-500">+{ch.reward_xp} XP · +{ch.reward_coins} 🪙</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <Button onClick={onClose} className="bg-red-600 hover:bg-red-700 text-white font-pixel w-full mt-4">CLOSE</Button>
      </div>
    </div>
  )
}
