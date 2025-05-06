"use client"

import { useState, useEffect } from "react"
import useGameStore from "@/hooks/useGameStore"

interface GameUIProps {
  isMuted: boolean
  toggleMute: () => void
  isGameOver: boolean
  startGame: () => void
  resetGame: () => void
}

export default function GameUI({ isMuted, toggleMute, isGameOver, startGame, resetGame }: GameUIProps) {
  const { health, score, zombiesKilled, gameStarted } = useGameStore()
  const [showControls, setShowControls] = useState(false)

  // Toggle controls with H key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "h" || e.key === "H") {
        setShowControls((prev) => !prev)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  return (
    <>
      {/* Health and Score UI */}
      {gameStarted && !isGameOver && (
        <div className="absolute top-4 left-4 pointer-events-none">
          {/* Health bar */}
          <div className="mb-2">
            <div className="flex items-center">
              <div className="text-white font-bold mr-2">HP</div>
              <div className="w-40 h-4 bg-gray-800 rounded overflow-hidden">
                <div
                  className={`h-full ${health > 50 ? "bg-green-600" : health > 25 ? "bg-yellow-500" : "bg-red-600"}`}
                  style={{ width: `${Math.max(0, health)}%` }}
                ></div>
              </div>
              <div className="text-white font-bold ml-2">{Math.max(0, health)}%</div>
            </div>
          </div>

          {/* Score */}
          <div className="bg-gray-800/70 p-2 rounded">
            <div className="text-white font-bold">Score: {score}</div>
            <div className="text-gray-300">Zombies Killed: {zombiesKilled}</div>
          </div>
        </div>
      )}

      {/* Sound toggle button */}
      <button
        onClick={toggleMute}
        className="absolute top-4 right-4 bg-gray-800/70 p-2 rounded hover:bg-gray-700/70 transition-colors"
        aria-label={isMuted ? "Unmute" : "Mute"}
      >
        {isMuted ? <span className="text-white">🔇</span> : <span className="text-white">🔊</span>}
      </button>

      {/* Controls help */}
      {showControls && (
        <div className="absolute bottom-4 left-4 bg-gray-800/90 p-3 rounded max-w-xs">
          <h3 className="text-white font-bold mb-2">Controls</h3>
          <ul className="text-gray-300 text-sm space-y-1">
            <li>WASD - Move</li>
            <li>Mouse - Look around</li>
            <li>Left Click - Shoot</li>
            <li>R - Reload</li>
            <li>Shift - Sprint</li>
            <li>Space - Jump</li>
            <li>1-4 - Switch weapons</li>
            <li>H - Toggle this help</li>
            <li>P - Toggle performance metrics</li>
          </ul>
        </div>
      )}

      {/* Start screen */}
      {!gameStarted && !isGameOver && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80">
          <div className="text-center p-8 bg-gray-900 rounded-lg max-w-md">
            <h1 className="text-4xl font-bold text-red-600 mb-4">ZOMBIE SURVIVAL</h1>
            <p className="text-gray-300 mb-6">
              Survive waves of zombies in this first-person shooter. How long can you last?
            </p>
            <button
              onClick={startGame}
              className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
            >
              START GAME
            </button>
            <div className="mt-4 text-gray-400 text-sm">
              <p>WASD to move, Mouse to aim, Left Click to shoot</p>
              <p>Press H during game for full controls</p>
            </div>
          </div>
        </div>
      )}

      {/* Game over screen */}
      {isGameOver && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80">
          <div className="text-center p-8 bg-gray-900 rounded-lg max-w-md">
            <h1 className="text-4xl font-bold text-red-600 mb-4">GAME OVER</h1>
            <p className="text-xl text-white mb-2">Score: {score}</p>
            <p className="text-lg text-gray-300 mb-6">Zombies Killed: {zombiesKilled}</p>
            <button
              onClick={resetGame}
              className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
            >
              PLAY AGAIN
            </button>
          </div>
        </div>
      )}
    </>
  )
}
