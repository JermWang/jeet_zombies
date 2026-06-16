"use client"

import { useProgress } from "@react-three/drei"
import { useEffect, useState } from "react"

// DOM overlay that reflects real asset-loading progress (textures, GLBs, HDRI)
// via three's DefaultLoadingManager. Replaces the old static "LOADING..." text.
export default function LoadingOverlay() {
  const { active, progress, item, loaded, total } = useProgress()
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    // Keep it up briefly after completion so the bar visibly reaches 100%.
    if (!active && progress >= 100) {
      const t = setTimeout(() => setVisible(false), 400)
      return () => clearTimeout(t)
    }
    if (active) setVisible(true)
  }, [active, progress])

  if (!visible) return null

  return (
    <div className="fixed inset-0 z-[1002] flex flex-col items-center justify-center bg-black pointer-events-none font-pixel">
      <h1 className="text-4xl text-red-600 mb-2 animate-pulse">JEET SURVIVAL</h1>
      <p className="text-red-400 font-pixel-alt text-xs mb-6 uppercase tracking-widest">Loading the horde...</p>

      <div className="w-64 h-3 bg-neutral-900 border-2 border-red-800 rounded-sm overflow-hidden">
        <div
          className="h-full bg-red-600 transition-all duration-200 ease-out"
          style={{ width: `${Math.min(100, Math.round(progress))}%` }}
        />
      </div>
      <p className="text-yellow-400 font-pixel-alt text-sm mt-2 tabular-nums">
        {Math.min(100, Math.round(progress))}%
        {total > 0 && <span className="text-red-700"> · {loaded}/{total}</span>}
      </p>
    </div>
  )
}
