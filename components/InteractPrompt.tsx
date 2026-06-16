"use client"

import { useEffect, useState } from "react"

// Shows a "[E] Pick up X" prompt when the player is near an interactable.
// Driven by the jz:nearInteract window event dispatched from Player.
export default function InteractPrompt() {
  const [label, setLabel] = useState<string | null>(null)

  useEffect(() => {
    const onNear = (e: Event) => setLabel((e as CustomEvent).detail?.label ?? null)
    window.addEventListener("jz:nearInteract", onNear)
    return () => window.removeEventListener("jz:nearInteract", onNear)
  }, [])

  if (!label) return null

  return (
    <div className="pointer-events-none fixed left-1/2 top-[58%] -translate-x-1/2 z-40 font-pixel select-none">
      <div className="flex items-center gap-2 bg-black/75 border-2 border-yellow-500 rounded px-4 py-2 shadow-lg jz-interact-pop">
        <kbd className="bg-yellow-500 text-black text-sm px-2 py-0.5 rounded font-bold">E</kbd>
        <span className="text-yellow-300 text-sm">{label}</span>
      </div>
      <style jsx global>{`
        @keyframes jz-interact-pop { 0% { transform: scale(0.85); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
        .jz-interact-pop { animation: jz-interact-pop 0.12s ease-out; }
      `}</style>
    </div>
  )
}
