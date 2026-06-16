import { Connection, Keypair, PublicKey } from "@solana/web3.js"
import {
  getOrCreateAssociatedTokenAccount,
  transfer,
  getMint,
} from "@solana/spl-token"
import bs58 from "bs58"

// ⚠️ SERVER ONLY. Never import this into client code. The rewards hot-wallet key
// (DEV_WALLET_PRIVATE_KEY) must never reach the browser. By default everything
// here runs in DRY-RUN (no on-chain transfer) until REWARDS_LIVE === "true".

export const REWARDS_LIVE = process.env.REWARDS_LIVE === "true"

export function getConnection(): Connection {
  const rpc = process.env.SOLANA_RPC_URL || process.env.NEXT_PUBLIC_SOLANA_RPC_URL
  if (!rpc) throw new Error("SOLANA_RPC_URL not set")
  return new Connection(rpc, "confirmed")
}

export function getRewardsKeypair(): Keypair | null {
  const sk = process.env.DEV_WALLET_PRIVATE_KEY
  if (!sk) return null
  try {
    // Accept base58 (Phantom export) or JSON array.
    const bytes = sk.trim().startsWith("[") ? Uint8Array.from(JSON.parse(sk)) : bs58.decode(sk.trim())
    return Keypair.fromSecretKey(bytes)
  } catch (e: any) {
    console.error("[solana] bad DEV_WALLET_PRIVATE_KEY:", e?.message)
    return null
  }
}

export function getSurvivalMint(): PublicKey | null {
  const m = process.env.SURVIVAL_TOKEN_MINT || process.env.NEXT_PUBLIC_SURVIVAL_TOKEN_MINT
  return m ? new PublicKey(m) : null
}

export interface PayoutResult {
  ok: boolean
  dryRun: boolean
  txSig?: string
  error?: string
}

// Send `amount` (base units) of $SURVIVAL from the rewards hot wallet to a player.
// Dry-run unless REWARDS_LIVE and keys/mint are configured.
export async function payoutSurvival(toWallet: string, amount: number): Promise<PayoutResult> {
  if (amount <= 0) return { ok: false, dryRun: true, error: "non_positive_amount" }

  const keypair = getRewardsKeypair()
  const mint = getSurvivalMint()

  if (!REWARDS_LIVE || !keypair || !mint) {
    // DRY-RUN: log intent, move nothing.
    console.log(`[solana][DRY-RUN] would pay ${amount} $SURVIVAL -> ${toWallet} (live=${REWARDS_LIVE}, key=${!!keypair}, mint=${!!mint})`)
    return { ok: true, dryRun: true }
  }

  try {
    const connection = getConnection()
    const to = new PublicKey(toWallet)
    const fromAta = await getOrCreateAssociatedTokenAccount(connection, keypair, mint, keypair.publicKey)
    const toAta = await getOrCreateAssociatedTokenAccount(connection, keypair, mint, to)
    const sig = await transfer(connection, keypair, fromAta.address, toAta.address, keypair.publicKey, amount)
    return { ok: true, dryRun: false, txSig: sig }
  } catch (e: any) {
    console.error("[solana] payout failed:", e?.message)
    return { ok: false, dryRun: false, error: e?.message || "payout_failed" }
  }
}

export interface FeeVerification {
  ok: boolean
  amount?: number
  error?: string
}

// Verify an entry-fee SPL-token payment: the tx must be finalized, pay the
// treasury, in the configured mint, for at least the required amount.
export async function verifyEntryFee(txSig: string, payerWallet: string): Promise<FeeVerification> {
  const required = Number(process.env.ENTRY_FEE_AMOUNT || 0)
  const mint = getSurvivalMint()
  const treasury = process.env.TREASURY_WALLET

  // Dry-run / unconfigured: accept any signature so the flow is testable off-chain.
  if (!REWARDS_LIVE || !mint || !treasury) {
    console.log(`[solana][DRY-RUN] accepting entry fee tx ${txSig} from ${payerWallet}`)
    return { ok: true, amount: required }
  }

  try {
    const connection = getConnection()
    const tx = await connection.getParsedTransaction(txSig, { maxSupportedTransactionVersion: 0, commitment: "confirmed" })
    if (!tx) return { ok: false, error: "tx_not_found" }
    if (tx.meta?.err) return { ok: false, error: "tx_failed" }

    // Compare pre/post token balances of the treasury's ATA for this mint.
    const pre = tx.meta?.preTokenBalances || []
    const post = tx.meta?.postTokenBalances || []
    const mintStr = mint.toBase58()
    const treasuryReceived = post
      .filter((b) => b.owner === treasury && b.mint === mintStr)
      .reduce((sum, b) => {
        const before = pre.find((p) => p.accountIndex === b.accountIndex)
        const delta = Number(b.uiTokenAmount.amount) - Number(before?.uiTokenAmount.amount || 0)
        return sum + Math.max(0, delta)
      }, 0)

    if (treasuryReceived < required) return { ok: false, error: "insufficient_fee", amount: treasuryReceived }
    return { ok: true, amount: treasuryReceived }
  } catch (e: any) {
    console.error("[solana] fee verify failed:", e?.message)
    return { ok: false, error: e?.message || "verify_failed" }
  }
}

// void getMint to keep the import (used when extending decimals handling)
void getMint
