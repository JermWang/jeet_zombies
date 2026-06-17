"use client"

import { useState } from "react"
import dynamic from "next/dynamic"
import TwitterIcon from "./ui/TwitterIcon"
import PumpFunIcon from "./ui/PumpFunIcon"

// Wallet button is client-only (touches window); load without SSR to avoid hydration issues.
const WalletMultiButton = dynamic(
  () => import("@solana/wallet-adapter-react-ui").then((m) => m.WalletMultiButton),
  { ssr: false, loading: () => <div className="h-9 w-[150px] rounded bg-red-700/40 animate-pulse" /> }
)

// Contract address (hardcoded so it always shows, env-independent).
const TOKEN_MINT = "25zCPGEWXUbhRDyZejRw1G3JSNRNXvQ3FF2fDJpgpump"

function shorten(addr: string) {
  return addr.length > 12 ? `${addr.slice(0, 4)}…${addr.slice(-4)}` : addr
}

export default function NavBar() {
  const [copied, setCopied] = useState(false)

  const copyCA = () => {
    if (!TOKEN_MINT) return
    navigator.clipboard.writeText(TOKEN_MINT).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }).catch(() => {})
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-[1100] h-14 px-4 flex items-center justify-between gap-3 bg-black/85 backdrop-blur-sm border-b-2 border-red-700 pointer-events-auto font-pixel">
      {/* Left: brand */}
      <a href="/" className="flex items-center gap-2 shrink-0">
        <PumpFunIcon className="w-6 h-6" />
        <span className="text-red-500 text-lg sm:text-xl tracking-wide hidden xs:inline">JEET SURVIVAL</span>
      </a>

      {/* Center: contract address */}
      <div className="flex items-center gap-2 min-w-0">
        {TOKEN_MINT ? (
          <button
            onClick={copyCA}
            title="Copy contract address"
            className="flex items-center gap-2 bg-neutral-900/80 border border-red-700/60 rounded px-3 py-1.5 hover:border-red-500 transition-colors"
          >
            <span className="text-red-600 text-[10px] font-pixel-alt">CA</span>
            <span className="text-gray-200 font-mono text-xs">{shorten(TOKEN_MINT)}</span>
            <span className="text-yellow-400 text-[10px] font-pixel-alt">{copied ? "COPIED" : "COPY"}</span>
          </button>
        ) : (
          <span className="text-gray-500 font-pixel-alt text-xs whitespace-nowrap">CA: dropping soon 👀</span>
        )}
      </div>

      {/* Right: socials + wallet */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <a
          href="https://x.com/JeetSurvival"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="X (Twitter)"
          className="text-gray-200 hover:text-white transition-colors"
        >
          <TwitterIcon className="w-5 h-5" />
        </a>
        <a
          href={TOKEN_MINT ? `https://pump.fun/coin/${TOKEN_MINT}` : "https://pump.fun"}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="pump.fun"
          className="hover:opacity-80 transition-opacity"
        >
          <PumpFunIcon className="w-5 h-5" />
        </a>
        <WalletMultiButton style={{
          height: 36,
          fontSize: 13,
          background: "#dc2626",
          borderRadius: 6,
          fontFamily: "var(--font-press-start)",
        }} />
      </div>
    </nav>
  )
}
