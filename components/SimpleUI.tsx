"use client"

interface SimpleUIProps {
  gameStarted: boolean
  isGameOver: boolean
  score: number
  health: number
  startGame: () => void
  resetGame: () => void
}

export default function SimpleUI({ gameStarted, isGameOver, score, health, startGame, resetGame }: SimpleUIProps) {
  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Game stats - only show when game is active */}
      {gameStarted && !isGameOver && (
        <div className="absolute top-4 left-4 bg-black/70 p-2 rounded">
          <p className="text-white">Score: {score}</p>
          <p className="text-white">Health: {health}</p>
        </div>
      )}

      {/* Game start screen */}
      {!gameStarted && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 pointer-events-auto">
          <div className="text-center p-8 bg-black border-2 border-red-600 rounded-lg">
            <h1 className="text-2xl text-red-500 mb-4">JEET ZOMBIES</h1>
            <p className="text-red-300 mb-6">SURVIVE THE ZOMBIE APOCALYPSE</p>
            <button onClick={startGame} className="px-6 py-3 bg-red-700 text-white rounded-lg hover:bg-red-600">
              START GAME
            </button>
          </div>
        </div>
      )}

      {/* Game over screen */}
      {isGameOver && gameStarted && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 pointer-events-auto">
          <div className="text-center p-8 bg-black border-2 border-red-600 rounded-lg">
            <h1 className="text-2xl text-red-500 mb-4">GAME OVER</h1>
            <p className="text-xl text-red-300 mb-2">SCORE: {score}</p>
            <button onClick={resetGame} className="px-6 py-3 bg-red-700 text-white rounded-lg hover:bg-red-600 mt-4">
              TRY AGAIN
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
