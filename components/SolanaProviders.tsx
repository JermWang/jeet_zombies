"use client"

import React, { useMemo } from "react"
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react"
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui"
import { clusterApiUrl } from "@solana/web3.js"
import type { Adapter } from "@solana/wallet-adapter-base"

import "@solana/wallet-adapter-react-ui/styles.css"

// Wraps the app in Solana wallet context. Phantom / Solflare / Backpack etc.
// auto-register via the Wallet Standard, so we don't hardcode an adapter list.
export default function SolanaProviders({ children }: { children: React.ReactNode }) {
  const endpoint = useMemo(
    () => process.env.NEXT_PUBLIC_SOLANA_RPC_URL || clusterApiUrl("mainnet-beta"),
    []
  )
  const wallets = useMemo<Adapter[]>(() => [], [])

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  )
}
