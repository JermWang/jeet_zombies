"use client"

import dynamic from "next/dynamic"
import { useState } from "react"

// Import our r3f patch
import "../utils/r3f-patch"

// Dynamically import the Game component
const Game = dynamic(() => import("@/components/Game"), { ssr: false })

export default function Home() {
  const [showDebug, setShowDebug] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  try {
    return (
      <main className="w-full h-screen relative">
        {/* Debug UI */}
        <div className="absolute top-0 right-0 z-50 p-4">
          <button 
            onClick={() => setShowDebug(!showDebug)} 
            className="bg-red-600 text-white font-pixel-alt px-2 py-1 text-sm mb-2"
          >
            {showDebug ? "Hide Debug" : "Show Debug"}
          </button>
          
          {showDebug && (
            <div className="bg-black/80 p-4 text-white font-pixel-alt max-w-md">
              <h3 className="text-red-500 mb-2">Project Info:</h3>
              <ul className="text-xs space-y-1">
                <li>Next.js: v14.0.0</li>
                <li>React: v18.2.0</li>
                <li>Three.js: v0.157.0</li>
                <li>React Three Fiber: v8.14.5</li>
                <li>React Three Drei: v9.88.0</li>
                <li>React Three Rapier: v1.1.1</li>
              </ul>
            </div>
          )}
        </div>
        
        {/* Game component */}
        <Game />
      </main>
    )
  } catch (e) {
    const error = e as Error
    setError(error)
    return (
      <div className="w-full h-screen flex items-center justify-center bg-black text-white p-4">
        <div className="max-w-md">
          <h1 className="text-red-500 font-pixel text-xl mb-4">ERROR LOADING GAME</h1>
          <div className="font-pixel-alt text-sm mb-4">
            <p className="text-red-400">Message: {error?.message}</p>
            <p className="text-gray-400 mt-2">Stack: {error?.stack}</p>
          </div>
          <button 
            onClick={() => window.location.reload()} 
            className="bg-red-600 text-white font-pixel-alt px-4 py-2"
          >
            RELOAD PAGE
          </button>
        </div>
      </div>
    )
  }
}
