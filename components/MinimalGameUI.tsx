"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import useGameStore from "@/hooks/useGameStore"
import TwitterIcon from "./ui/TwitterIcon"
import TelegramIcon from "./ui/TelegramIcon"

interface MinimalGameUIProps {
  gameStarted: boolean
  onStart: () => void
  onReset: () => void
  hasInteracted: boolean
}

export function MinimalGameUI({ gameStarted, onStart, onReset, hasInteracted }: MinimalGameUIProps) {
  const [showControls, setShowControls] = useState(false)
  const {
    isDebugMode,
    toggleDebugMode,
    currentWave,
    waveStatus,
    zombiesRemainingInWave,
    health,
    isGameOver,
    isPlayerHit,
    resetPlayerHit
  } = useGameStore()

  const [waveMessage, setWaveMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isPlayerHit) {
      const timer = setTimeout(() => {
        resetPlayerHit();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [isPlayerHit, resetPlayerHit]);

  useEffect(() => {
    if (!gameStarted) {
      setWaveMessage(null);
      return;
    }

    let message: string | null = null;
    let timeoutId: NodeJS.Timeout | null = null;

    if (waveStatus === 'Spawning') {
      message = `WAVE ${currentWave} STARTING`;
    } else if (waveStatus === 'BetweenWaves') {
      message = `WAVE ${currentWave} CLEARED!`;
    }

    if (message) {
      setWaveMessage(message);
      timeoutId = setTimeout(() => {
        setWaveMessage(null);
      }, 3000);
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [waveStatus, currentWave, gameStarted]);

  const handleCopy = () => {
    const contractAddress = "rKzH4ZqgqLSRygvFdrcTNg2cEVSCWSkmDcYJpAvGGFM";
    navigator.clipboard.writeText(contractAddress).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(err => {
      console.error('Failed to copy text: ', err);
    });
  };

  return (
    <div className="absolute inset-0 pointer-events-none text-white font-pixel">
      {isPlayerHit && (
        <div className="absolute inset-0 bg-red-700 opacity-30 z-50"></div>
      )}

      {/* Conditionally render Debug Toggle Button */}
      {process.env.NODE_ENV === 'development' && (
        <div className="absolute top-4 right-4 pointer-events-auto z-10">
          <button
            onClick={toggleDebugMode}
            className="px-3 py-1 bg-gray-700 text-white text-xs rounded hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors"
          >
            Toggle Debug ({isDebugMode ? "On" : "Off"})
          </button>
        </div>
      )}

      {/* Health Bar - Repositioned and Restyled */}
      {gameStarted && !isGameOver && ( // Only show if game started and not game over
        <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex flex-col items-center pointer-events-auto w-64">
          {/* Health bar background */}
          <div className="w-full h-5 bg-neutral-800 border-2 border-neutral-600 rounded-sm overflow-hidden">
            {/* Health bar fill */}
            <div
              className={`h-full ${health > 60 ? 'bg-red-500' : health > 30 ? 'bg-red-600' : 'bg-red-700'} transition-all duration-150 ease-linear`}
              style={{ width: `${Math.max(0, health)}%` }} // Ensure width is not negative
            />
          </div>
          {/* Health text below bar */}
          <p className="mt-1 text-sm text-white">
            {health}/100 HP
          </p>
        </div>
      )}

      {/* In-game Controls Button */}
      {gameStarted && !isGameOver && (
        <div className="absolute bottom-4 left-4 pointer-events-auto z-30">
          <Button
            onClick={() => setShowControls(true)}
            className="bg-red-600 hover:bg-red-700 text-white font-pixel text-xs px-3 py-1 rounded"
          >
            Controls
          </Button>
        </div>
      )}

      {/* In-game Controls Panel Modal */}
      {gameStarted && !isGameOver && showControls && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center pointer-events-auto z-50 backdrop-blur-sm">
          <div className="bg-neutral-800 p-6 rounded-lg shadow-xl text-left max-w-md w-full border border-neutral-700">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-red-500 font-pixel text-2xl">CONTROLS:</h2>
              <Button
                onClick={() => setShowControls(false)}
                className="text-gray-400 hover:text-white font-pixel text-3xl leading-none p-1"
                variant="ghost" 
              >
                &times;
              </Button>
            </div>
            <ul className="text-red-300 font-pixel-alt space-y-1 text-lg">
              <li>WASD - Move</li>
              <li>MOUSE - Look around</li>
              <li>LEFT CLICK - Shoot</li>
              <li>R - Reload</li>
              <li>1-3 - Switch weapons</li>
              <li>SPACE - Jump</li>
              <li>SHIFT - Sprint</li>
              <li>PRESS E TO INTERACT</li>
            </ul>
          </div>
        </div>
      )}

      {gameStarted && (
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 text-center">
              {waveMessage && (
                  <div className="text-3xl text-red-500 mb-2 animate-pulse">
                      {waveMessage}
                  </div>
              )}
               {waveStatus === 'Active' && (
                  <div className="text-xl text-yellow-400">
                      WAVE {currentWave} - REMAINING: {zombiesRemainingInWave}
                  </div>
              )}
              {waveStatus === 'BetweenWaves' && (
                 <div className="text-xl text-green-400">
                      NEXT WAVE STARTING SOON...
                 </div>
              )}
          </div>
      )}

      {isGameOver && gameStarted && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center pointer-events-auto z-20">
          <div className="bg-black/80 p-8 rounded-lg">
            <h2 className="text-5xl text-red-600 mb-4">GAME OVER</h2>
            <Button
              onClick={onReset}
              className="bg-yellow-500 hover:bg-yellow-600 text-black font-pixel px-6 py-3 text-lg"
            >
              RESTART
            </Button>
          </div>
        </div>
      )}

      {!gameStarted && !isGameOver && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center pointer-events-auto">
          <div className="flex flex-col items-center mb-6">
            <div className="relative inline-block">
              <h1 className="text-4xl font-pixel text-red-600 uppercase">JEET ZOMBIES</h1>
              <span
                className="absolute -top-1 -right-8 text-xs font-pixel text-yellow-400 transform"
              >
                BETA
              </span>
            </div>

            <Button
              onClick={onStart}
              className="bg-red-600 hover:bg-red-700 text-white font-pixel px-8 py-4 text-xl mt-4"
              disabled={!hasInteracted}
            >
              {hasInteracted ? "START GAME" : "CLICK TO ENABLE AUDIO"}
            </Button>
          </div>

          <div className="mt-4">
            <button
              onClick={() => setShowControls(!showControls)}
              className="text-red-400 hover:text-red-300 font-pixel underline"
            >
              {showControls ? "Hide Controls" : "Show Controls"}
            </button>
          </div>

          <div className="flex flex-col items-center space-y-2 mt-6 pointer-events-auto px-4 w-full">
            <div className="flex space-x-4">
              <a 
                href="https://x.com/JeetZombies" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-blue-400 hover:text-blue-300"
                aria-label="Twitter"
              >
                <TwitterIcon className="w-6 h-6" />
              </a>
            </div>
            <div className="flex items-center justify-center mt-2"> 
              <img src="/BonkLogo.webp" alt="Bonk Logo" className="w-6 h-6 mr-2" /> 
              <p className="text-white font-pixel-alt text-base">Exclusively on Bonk.Fun</p> 
            </div>
            <div className="flex items-center space-x-2 mt-1"> 
              <span className="text-gray-400 font-mono text-xs break-all">
                rKzH4ZqgqLSRygvFdrcTNg2cEVSCWSkmDcYJpAvGGFM
              </span>
              <Button
                onClick={handleCopy}
                className="bg-red-600 hover:bg-red-700 text-white font-pixel-alt text-sm px-3 py-1 flex-shrink-0"
              >
                {copied ? "Copied!" : "Copy"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
