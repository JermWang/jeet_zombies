"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"

type Period = "daily" | "weekly" | "alltime"

interface Entry {
  username: string
  level: number
  score: number
  kills: number
  wave: number
  player_id: string
}

export default function Leaderboard({ onClose }: { onClose: () => void }) {
  const [period, setPeriod] = useState<Period>("alltime")
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    fetch(`/api/leaderboard?period=${period}&limit=25`)
      .then((r) => r.json())
      .then((d) => { if (active) setEntries(d.entries || []) })
      .catch(() => { if (active) setEntries([]) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [period])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm pointer-events-auto font-pixel">
      <div className="bg-neutral-900 border-2 border-red-700 rounded-lg p-6 w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-red-500 text-2xl">LEADERBOARD</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-3xl leading-none">&times;</button>
        </div>

        <div className="flex gap-1 mb-4">
          {(["daily", "weekly", "alltime"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1 text-xs rounded font-pixel-alt uppercase ${
                period === p ? "bg-red-600 text-white" : "bg-neutral-800 text-red-400 hover:bg-neutral-700"
              }`}
            >
              {p === "alltime" ? "All Time" : p}
            </button>
          ))}
        </div>

        <div className="min-h-[260px]">
          {loading ? (
            <p className="text-red-400 text-center py-10 animate-pulse">LOADING...</p>
          ) : entries.length === 0 ? (
            <p className="text-gray-400 text-center py-10 font-pixel-alt">No runs yet. Be the first, anon.</p>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="text-red-700 text-[10px] uppercase">
                  <th className="py-1 w-8">#</th>
                  <th className="py-1">Player</th>
                  <th className="py-1 text-right">Score</th>
                  <th className="py-1 text-right">Kills</th>
                  <th className="py-1 text-right">Wave</th>
                </tr>
              </thead>
              <tbody className="font-pixel-alt">
                {entries.map((e, i) => (
                  <tr key={e.player_id} className={`border-t border-neutral-800 ${i < 3 ? "text-yellow-400" : "text-gray-200"}`}>
                    <td className="py-1.5">{i + 1}</td>
                    <td className="py-1.5 truncate max-w-[160px]">
                      <span className="text-red-500 text-[10px] mr-1">Lv{e.level}</span>{e.username}
                    </td>
                    <td className="py-1.5 text-right tabular-nums">{e.score.toLocaleString()}</td>
                    <td className="py-1.5 text-right tabular-nums">{e.kills}</td>
                    <td className="py-1.5 text-right tabular-nums">{e.wave}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <Button onClick={onClose} className="bg-red-600 hover:bg-red-700 text-white font-pixel w-full mt-4">
          CLOSE
        </Button>
      </div>
    </div>
  )
}
