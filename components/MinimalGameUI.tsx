"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import useGameStore from "@/hooks/useGameStore"
import TwitterIcon from "./ui/TwitterIcon"
import TelegramIcon from "./ui/TelegramIcon"
import { usePlayerProfile, type MatchSubmitResult } from "@/hooks/usePlayerProfile"
import useCosmetics from "@/hooks/useCosmetics"
import Leaderboard from "./Leaderboard"
import Locker from "./Locker"
import ChallengesPanel from "./ChallengesPanel"

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
    score,
    kills,
    maxCombo,
    gameStartTime,
    isGameOver,
    isPlayerHit,
    resetPlayerHit
  } = useGameStore()

  const [waveMessage, setWaveMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  // Ticking clock so the survival timer updates while playing
  const [nowTick, setNowTick] = useState(0);

  // --- Account / progression ---
  const { playerId, username, setUsername, profile, submitMatch } = usePlayerProfile();
  const loadCosmetics = useCosmetics((s) => s.load);
  const [matchResult, setMatchResult] = useState<MatchSubmitResult | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showLocker, setShowLocker] = useState(false);
  const [showChallenges, setShowChallenges] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const submittedRef = useRef(false);

  // Load the player's equipped cosmetics once we have an id (drives skin + tracer in-game)
  useEffect(() => { if (playerId) loadCosmetics(playerId); }, [playerId, loadCosmetics]);

  // Submit the finished run to the authoritative API exactly once per game-over.
  useEffect(() => {
    if (isGameOver && gameStarted && !submittedRef.current) {
      submittedRef.current = true;
      const secs = gameStartTime
        ? Math.floor(((typeof performance !== "undefined" ? performance.now() : Date.now()) - gameStartTime) / 1000)
        : 0;
      submitMatch({
        score, kills, wavesSurvived: currentWave, maxCombo, survivalSeconds: secs, result: "died",
      }).then(setMatchResult);
    }
    if (!isGameOver) {
      submittedRef.current = false;
      setMatchResult(null);
    }
  }, [isGameOver, gameStarted]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!gameStarted || isGameOver) return;
    const interval = setInterval(() => setNowTick((t) => t + 1), 500);
    return () => clearInterval(interval);
  }, [gameStarted, isGameOver]);

  // nowTick re-renders this component twice a second so the timer below stays live.
  void nowTick;
  const survivalSeconds = gameStartTime
    ? Math.max(0, Math.floor(((typeof performance !== "undefined" ? performance.now() : Date.now()) - gameStartTime) / 1000))
    : 0;
  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  // Define the contract address as a constant
  const CONTRACT_ADDRESS = "bXzXzvk94KC6V6U8wgLQ2DfH3owQMXyqGPA3czfDGFM";

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

  const buildShareText = () => {
    const r = matchResult;
    return `I just survived ${formatTime(survivalSeconds)} in JEET ZOMBIES 🧟\n` +
      `Score ${score.toLocaleString()} · ${kills} kills · Wave ${currentWave} · x${maxCombo} combo` +
      (r ? ` · Rank #${r.rank}` : "") +
      `\nThink you can do better, anon? 👇 $JEETZOMBIES`;
  };

  const handleShare = () => {
    const text = buildShareText();
    const url = "https://x.com/JeetZombies";
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
      "_blank", "noopener,noreferrer"
    );
  };

  const handleShareCopy = () => {
    navigator.clipboard.writeText(`${buildShareText()}\nhttps://x.com/JeetZombies`).then(() => {
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    }).catch(() => {});
  };

  const handleCopy = () => {
    // Use the constant
    navigator.clipboard.writeText(CONTRACT_ADDRESS).then(() => {
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

      {/* Top stats bar — score / kills / survival time */}
      {gameStarted && !isGameOver && (
        <div className="absolute top-4 left-4 flex flex-col gap-1 pointer-events-none">
          <div className="bg-black/70 border-2 border-red-600 rounded px-3 py-1.5 shadow-lg">
            <span className="text-red-500 text-xs">SCORE</span>
            <div className="text-yellow-400 text-2xl leading-none tabular-nums">
              {score.toLocaleString()}
            </div>
          </div>
          <div className="flex gap-1">
            <div className="bg-black/70 border border-red-700/60 rounded px-2 py-1 shadow">
              <span className="text-red-500 text-[10px]">KILLS</span>
              <div className="text-white text-base leading-none tabular-nums">{kills}</div>
            </div>
            <div className="bg-black/70 border border-red-700/60 rounded px-2 py-1 shadow">
              <span className="text-red-500 text-[10px]">TIME</span>
              <div className="text-white text-base leading-none tabular-nums">
                {formatTime(survivalSeconds)}
              </div>
            </div>
          </div>
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
          <div className="bg-black/85 p-8 rounded-lg border-2 border-red-700 shadow-2xl min-w-[320px]">
            <h2 className="text-5xl text-red-600 mb-1">YOU GOT JEETED</h2>
            <p className="text-red-400 font-pixel-alt text-sm mb-5">
              {kills >= 50 ? "Certified zombie slayer." : kills >= 20 ? "Not bad, anon." : "Paper hands. NGMI."}
            </p>

            {/* Match recap */}
            <div className="grid grid-cols-2 gap-3 mb-6 text-left">
              <div className="bg-neutral-900/80 rounded px-3 py-2">
                <div className="text-red-500 text-[10px]">SCORE</div>
                <div className="text-yellow-400 text-2xl tabular-nums">{score.toLocaleString()}</div>
              </div>
              <div className="bg-neutral-900/80 rounded px-3 py-2">
                <div className="text-red-500 text-[10px]">KILLS</div>
                <div className="text-white text-2xl tabular-nums">{kills}</div>
              </div>
              <div className="bg-neutral-900/80 rounded px-3 py-2">
                <div className="text-red-500 text-[10px]">WAVE REACHED</div>
                <div className="text-white text-2xl tabular-nums">{currentWave}</div>
              </div>
              <div className="bg-neutral-900/80 rounded px-3 py-2">
                <div className="text-red-500 text-[10px]">BEST COMBO</div>
                <div className="text-white text-2xl tabular-nums">x{maxCombo}</div>
              </div>
              <div className="bg-neutral-900/80 rounded px-3 py-2 col-span-2">
                <div className="text-red-500 text-[10px]">SURVIVED</div>
                <div className="text-white text-2xl tabular-nums">{formatTime(survivalSeconds)}</div>
              </div>
            </div>

            {/* XP / rank from the authoritative submit */}
            <div className="mb-5 min-h-[58px]">
              {matchResult ? (
                <div className="bg-black/40 rounded p-3 border border-yellow-600/40">
                  <div className="flex justify-between items-center text-sm mb-1">
                    <span className="text-yellow-400">+{matchResult.xpEarned} XP</span>
                    <span className="text-green-400">+{matchResult.coinsEarned} 🪙</span>
                    <span className="text-red-400">RANK #{matchResult.rank}</span>
                  </div>
                  <div className="text-left text-[10px] text-gray-400 mb-1 font-pixel-alt">
                    LEVEL {matchResult.level}
                  </div>
                  <div className="w-full h-2 bg-neutral-800 rounded overflow-hidden">
                    <div className="h-full bg-yellow-500 transition-all duration-700"
                      style={{ width: `${Math.round(matchResult.levelPct * 100)}%` }} />
                  </div>
                  {matchResult.flagged && (
                    <p className="text-[10px] text-red-600 mt-1 font-pixel-alt">⚠ run flagged — no rewards</p>
                  )}
                  {matchResult.completedChallenges?.length > 0 && (
                    <div className="mt-2 text-left">
                      {matchResult.completedChallenges.map((ch) => (
                        <p key={ch.challenge_key} className="text-[10px] text-green-400 font-pixel-alt">
                          ✓ {ch.description} (+{ch.reward_xp} XP)
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-gray-500 text-xs animate-pulse font-pixel-alt pt-4">saving run...</p>
              )}
            </div>

            {/* Share row */}
            <div className="flex gap-2 mb-3">
              <Button onClick={handleShare}
                className="flex-1 bg-[#1d9bf0] hover:bg-[#1a8cd8] text-white font-pixel text-sm py-2">
                SHARE ON X
              </Button>
              <Button onClick={handleShareCopy}
                className="bg-neutral-700 hover:bg-neutral-600 text-white font-pixel text-sm py-2 px-3">
                {shareCopied ? "COPIED!" : "COPY"}
              </Button>
            </div>

            <Button
              onClick={() => { setMatchResult(null); onReset(); }}
              className="bg-yellow-500 hover:bg-yellow-600 text-black font-pixel px-6 py-3 text-lg w-full"
            >
              RUN IT BACK
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

            {/* Player identity + level */}
            <div className="mt-3 flex items-center gap-2 text-sm">
              <span className="text-red-700 font-pixel-alt">PLAYER:</span>
              {editingName ? (
                <input
                  autoFocus
                  defaultValue={username}
                  maxLength={24}
                  onBlur={(e) => { setUsername(e.target.value); setEditingName(false); }}
                  onKeyDown={(e) => { if (e.key === "Enter") { setUsername((e.target as HTMLInputElement).value); setEditingName(false); } }}
                  className="bg-neutral-800 border border-red-700 text-white px-2 py-0.5 rounded font-pixel-alt text-sm w-40 outline-none"
                />
              ) : (
                <button onClick={() => setEditingName(true)} className="text-yellow-400 hover:text-yellow-300 font-pixel-alt">
                  {username} <span className="text-red-700 text-xs">✎</span>
                </button>
              )}
              {profile && (
                <span className="text-red-500 font-pixel-alt text-xs">Lv{profile.level}</span>
              )}
            </div>

            <Button
              onClick={onStart}
              className="bg-red-600 hover:bg-red-700 text-white font-pixel px-8 py-4 text-xl mt-3"
              disabled={!hasInteracted}
            >
              {hasInteracted ? "START GAME" : "CLICK TO ENABLE AUDIO"}
            </Button>

            <div className="mt-3 flex items-center gap-3 flex-wrap justify-center">
              <button onClick={() => setShowLeaderboard(true)}
                className="text-yellow-500 hover:text-yellow-300 font-pixel text-sm underline">
                🏆 LEADERBOARD
              </button>
              <button onClick={() => setShowLocker(true)}
                className="text-cyan-400 hover:text-cyan-300 font-pixel text-sm underline">
                🎽 LOCKER
              </button>
              <button onClick={() => setShowChallenges(true)}
                className="text-green-400 hover:text-green-300 font-pixel text-sm underline">
                ✅ CHALLENGES
              </button>
            </div>
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
              <p className="text-white font-pixel-alt text-base">Exclusively on GoFundMeme</p> 
            </div>
            <div className="flex items-center space-x-2 mt-1"> 
              {/* Use the constant for display */}
              <span className="text-gray-400 font-mono text-xs break-all">
                {CONTRACT_ADDRESS}
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

      {/* Hub modals */}
      {showLeaderboard && <Leaderboard onClose={() => setShowLeaderboard(false)} />}
      {showLocker && playerId && <Locker playerId={playerId} onClose={() => setShowLocker(false)} />}
      {showChallenges && playerId && <ChallengesPanel playerId={playerId} onClose={() => setShowChallenges(false)} />}
    </div>
  )
}
