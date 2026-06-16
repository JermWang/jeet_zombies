import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"
import { verifyEntryFee } from "@/lib/solana"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// POST /api/tournament/enter  { playerId, walletAddress, feeTxSig }
// Verifies the entry-fee payment on-chain (dry-run accepts any sig) and records
// a paid tournament entry. Requires a wallet AND an existing profile.
export async function POST(req: NextRequest) {
  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }) }

  const { playerId, walletAddress, feeTxSig } = body || {}
  if (!playerId || !walletAddress) {
    return NextResponse.json({ error: "playerId and walletAddress required (connect a wallet)" }, { status: 400 })
  }

  // Must have a created profile to enter ranked.
  const prof = await query(`select 1 from player_profiles where player_id = $1`, [playerId])
  if (prof.length === 0) {
    return NextResponse.json({ error: "profile_required" }, { status: 403 })
  }

  const v = await verifyEntryFee(String(feeTxSig || "dry-run"), walletAddress)
  if (!v.ok) {
    return NextResponse.json({ error: v.error || "fee_not_verified" }, { status: 402 })
  }

  try {
    const row = await query(
      `insert into tournament_entries (player_id, wallet_address, fee_amount, fee_mint, fee_tx_sig, status)
       values ($1,$2,$3,$4,$5,'paid')
       on conflict (fee_tx_sig) do nothing
       returning id`,
      [playerId, walletAddress, v.amount || 0, process.env.ENTRY_FEE_MINT || "survival", feeTxSig || null]
    )
    return NextResponse.json({ ok: true, entryId: row[0]?.id ?? null, feeAmount: v.amount || 0 })
  } catch (e: any) {
    console.error("[tournament/enter] error:", e?.message)
    return NextResponse.json({ error: "entry_failed" }, { status: 500 })
  }
}
