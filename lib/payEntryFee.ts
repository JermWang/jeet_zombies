"use client"

import { Connection, PublicKey, Transaction } from "@solana/web3.js"
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
} from "@solana/spl-token"

// Client-side: build + send a $SURVIVAL entry-fee transfer from the player's
// wallet to the treasury, signed by the connected wallet. Returns the tx
// signature the server then verifies on-chain (/api/tournament/enter).
export async function payEntryFee(opts: {
  connection: Connection
  payer: PublicKey
  sendTransaction: (tx: Transaction, connection: Connection) => Promise<string>
  mint: string
  treasury: string
  amount: number // base units
}): Promise<string> {
  const mint = new PublicKey(opts.mint)
  const treasury = new PublicKey(opts.treasury)

  const fromAta = await getAssociatedTokenAddress(mint, opts.payer)
  const toAta = await getAssociatedTokenAddress(mint, treasury)

  const tx = new Transaction()
  // Create the treasury's token account on first ever payment if it doesn't exist.
  const toInfo = await opts.connection.getAccountInfo(toAta)
  if (!toInfo) {
    tx.add(createAssociatedTokenAccountInstruction(opts.payer, toAta, treasury, mint))
  }
  tx.add(createTransferInstruction(fromAta, toAta, opts.payer, opts.amount))

  const sig = await opts.sendTransaction(tx, opts.connection)
  await opts.connection.confirmTransaction(sig, "confirmed")
  return sig
}
