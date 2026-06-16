import { NextRequest, NextResponse } from "next/server"
import { query, withTransaction } from "@/lib/db"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// GET /api/cosmetics?playerId=...  -> full catalog + which the player owns/equips + coin balance
export async function GET(req: NextRequest) {
  const playerId = req.nextUrl.searchParams.get("playerId")
  try {
    const catalog = await query(`select id, slug, name, type, rarity, price_coins, meta from cosmetics order by price_coins asc`)
    let owned: any[] = []
    let coins = 0
    if (playerId) {
      owned = await query(
        `select cosmetic_id, equipped from inventory where player_id = $1`,
        [playerId]
      )
      const p = await query(`select coins from player_profiles where player_id = $1`, [playerId])
      coins = p[0] ? Number(p[0].coins) : 0
    }
    return NextResponse.json({ catalog, owned, coins })
  } catch (e: any) {
    console.error("[cosmetics GET] error:", e?.message)
    return NextResponse.json({ error: "lookup failed", catalog: [], owned: [] }, { status: 500 })
  }
}

// POST /api/cosmetics  { playerId, action: 'buy'|'equip', cosmeticId }
export async function POST(req: NextRequest) {
  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }) }
  const { playerId, action, cosmeticId } = body || {}
  if (!playerId || !cosmeticId || !["buy", "equip"].includes(action)) {
    return NextResponse.json({ error: "playerId, cosmeticId and valid action required" }, { status: 400 })
  }

  try {
    const result = await withTransaction(async (c) => {
      const cos = (await c.query(`select id, type, price_coins, name from cosmetics where id = $1`, [cosmeticId])).rows[0]
      if (!cos) throw new Error("unknown cosmetic")

      if (action === "buy") {
        const already = (await c.query(`select 1 from inventory where player_id = $1 and cosmetic_id = $2`, [playerId, cosmeticId])).rows[0]
        if (already) return { ok: true, alreadyOwned: true }

        const prof = (await c.query(`select coins from player_profiles where player_id = $1`, [playerId])).rows[0]
        const balance = prof ? Number(prof.coins) : 0
        const price = Number(cos.price_coins)
        if (balance < price) return { ok: false, error: "insufficient_coins", coins: balance }

        const newBal = balance - price
        if (price > 0) {
          await c.query(`update player_profiles set coins = $2 where player_id = $1`, [playerId, newBal])
          await c.query(
            `insert into ledger_entries (player_id, delta_coins, balance_after, reason) values ($1,$2,$3,'purchase')`,
            [playerId, -price, newBal]
          )
        }
        await c.query(
          `insert into inventory (player_id, cosmetic_id, equipped) values ($1,$2,false)
           on conflict (player_id, cosmetic_id) do nothing`,
          [playerId, cosmeticId]
        )
        return { ok: true, coins: newBal, bought: cos.name }
      }

      // action === 'equip' — one equipped item per type
      const owns = (await c.query(`select 1 from inventory where player_id = $1 and cosmetic_id = $2`, [playerId, cosmeticId])).rows[0]
      if (!owns) return { ok: false, error: "not_owned" }
      await c.query(
        `update inventory set equipped = false
         where player_id = $1 and cosmetic_id in (select id from cosmetics where type = $2)`,
        [playerId, cos.type]
      )
      await c.query(`update inventory set equipped = true where player_id = $1 and cosmetic_id = $2`, [playerId, cosmeticId])
      return { ok: true, equipped: cosmeticId }
    })

    return NextResponse.json(result)
  } catch (e: any) {
    console.error("[cosmetics POST] error:", e?.message)
    return NextResponse.json({ error: "action failed" }, { status: 500 })
  }
}
