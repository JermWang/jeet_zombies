# Jeet Survival — $SURVIVAL DeFi Mechanics Plan

Play-to-earn design for a skill-based survival shooter. Two modes: **Training**
(free, unranked, no payouts) and **Tournament** (paid entry, ranked, $SURVIVAL
rewards). This document is the source of truth for tokenomics, custody, reward
math, anti-abuse, security, and compliance.

> ⚠️ **Before going live, read "Compliance" and "Security".** Paid-entry contests
> that pay token rewards based on performance can be regulated (skill-contest
> vs. gambling, money transmission) depending on jurisdiction. Get legal sign-off
> and gate by region. Nothing in the code moves real funds until you set the env
> keys AND set `REWARDS_LIVE=true` (default is dry-run).

---

## 1. Token overview

| | |
|---|---|
| Symbol | `$SURVIVAL` |
| Total supply | 1,000,000,000 (1B) |
| Decimals | 6 (pump.fun standard) |
| Initial reward reserve | **1.5% = 15,000,000 $SURVIVAL** held in the **Rewards Hot Wallet** |
| Purpose of reserve | Seed tournament payouts for the first few days of launch |

The 15M reserve is the **emission budget** for early rewards. It must be spent on
a controlled daily schedule so it isn't drained in hours (see §4, Emission control).

---

## 2. Wallet / custody architecture

Three distinct wallets, never mixed:

1. **User wallets (non-custodial).** Players connect Phantom/Solflare. They sign
   their own entry-fee payments. We never hold user keys.
2. **Treasury wallet (fee sink).** Receives tournament entry fees. Should be a
   multisig or hardware wallet — funds accumulate here. **Cold-ish; we only
   *receive* to it, never auto-spend from it.**
3. **Rewards Hot Wallet (payout signer).** Holds the 15M reserve and signs
   reward payouts server-side. This is the only key the server holds. Keep its
   balance minimal (top up from treasury/cold storage as needed). **This is the
   key you provide via `DEV_WALLET_PRIVATE_KEY` — treat it as a hot wallet that
   could be fully drained if leaked.**

```
 User wallet ──(entry fee SPL transfer, user-signed)──▶ Treasury wallet
 Rewards Hot Wallet ──(payout SPL transfer, server-signed)──▶ User wallet
```

**Key rules:**
- The Rewards Hot Wallet private key lives ONLY in server env (`DEV_WALLET_PRIVATE_KEY`),
  never `NEXT_PUBLIC_*`, never shipped to the client, never logged.
- Cap the hot wallet's balance to ~1–2 days of expected payouts; refill manually.
- Treasury is separate so a hot-wallet compromise can't touch collected fees.

---

## 3. Game modes

### Training (free)
- No wallet required. Anonymous localStorage identity is fine.
- Full gameplay, personal stats, but **does NOT** count toward ranked leaderboard
  and **earns no $SURVIVAL**. XP/cosmetics (off-chain, DB) still accrue.

### Tournament (paid, ranked)
- **Requires:** connected wallet + a created profile (username) — enforced both
  client-side (gating UI) and server-side (entry API rejects missing wallet/profile).
- Player pays a small **entry fee** in $SURVIVAL (or SOL — configurable) to the
  Treasury. Server verifies the on-chain payment before granting an entry.
- Score is **server-authoritative** (anti-cheat via existing `risk_flags`).
- Rewards paid in $SURVIVAL from the Rewards Hot Wallet based on performance
  (see §4).

---

## 4. Reward economics

### Entry fee
- Configurable via `ENTRY_FEE_AMOUNT` (in token base units) + `ENTRY_FEE_MINT`.
- Suggested launch: a "small fee" e.g. **5,000–25,000 $SURVIVAL** (tune to token
  price so it's ~$0.10–$0.50). Fees fund the prize pool + treasury.

### Payout model — pick one (configurable):
1. **Performance payout (recommended for launch).** Each tournament run earns
   $SURVIVAL scaled by a server-validated score, capped per run:
   `reward = clamp(round(score * REWARD_PER_SCORE), 0, MAX_REWARD_PER_RUN)`.
   Plus milestone bonuses (e.g., reach wave 10 = +X). Simple, instant, no lobby.
2. **Pooled tournament.** Entry fees pool; top-N on a periodic leaderboard
   (hourly/daily) split the pool (e.g., 50/25/15/10%). Bigger payouts, needs a
   settlement job.

Start with **#1** (instant per-run rewards from the reserve) and layer #2 later.

### Emission control (protect the 15M reserve)
- `DAILY_REWARD_BUDGET` (e.g., 15M / 3 days ≈ 5M/day). The server tracks paid
  rewards per UTC day in the DB; once the daily budget is hit, further payouts
  are queued for the next day (or scaled down). This guarantees the reserve
  lasts the intended "couple of days," not the first hour.
- Per-wallet daily cap (`MAX_REWARD_PER_WALLET_DAY`) to stop one farmer draining it.
- Reward-to-fee ratio target: keep average payout < entry fee × small multiple so
  the system isn't trivially +EV to spam (this is also an anti-cheat lever).

---

## 5. Anti-abuse / sybil resistance

- **Server-authoritative scores** (already built): the realtime/match server owns
  kills/score; clients can't self-report. Tournament rewards only use validated scores.
- **Wallet-gated**: one reward stream per wallet; `risk_flags` already catch
  impossible score/rate/time. Flagged runs earn **zero** (existing logic).
- **Rate limits**: max tournament entries per wallet per hour; min match duration
  to be reward-eligible (no instant-quit farming).
- **Per-wallet + global daily caps** (above).
- **Idempotent payouts**: every payout keyed by `match_id` (unique) so retries
  can't double-pay.

---

## 6. Security checklist

- [ ] `DEV_WALLET_PRIVATE_KEY` only in server env (Vercel encrypted env / a secrets
      manager), never `NEXT_PUBLIC_`, never committed, never logged.
- [ ] Rewards Hot Wallet holds ≤ ~1–2 days of payout budget; refill manually.
- [ ] Treasury separate from hot wallet; treasury never auto-spends.
- [ ] All payout amounts clamped server-side (`MAX_REWARD_PER_RUN`, daily budget).
- [ ] Payouts idempotent by `match_id`; DB transaction wraps "record + pay".
- [ ] On-chain fee verification: confirm tx is finalized, correct mint, correct
      recipient (treasury), correct amount, and not previously consumed.
- [ ] `REWARDS_LIVE=false` (dry-run) until fully tested on devnet/mainnet with a
      tiny float. Dry-run logs intended transfers without sending.
- [ ] Monitoring/alerts on hot-wallet balance + daily emission.

---

## 7. Compliance (DO NOT SKIP)

Paid entry + token payouts based on results may be regulated as a **prize
competition, contest of skill, or gambling**, and collecting/paying tokens may
implicate **money transmission / securities** rules depending on jurisdiction.

- [ ] Legal review of the paid mode in target markets.
- [ ] **Geofence** restricted regions (server-side, by IP) and require an age/ToS gate.
- [ ] Publish Terms of Service + clear "skill-based, no guarantee of reward" copy.
- [ ] Keep Training (free) fully functional and unrestricted as the default mode.
- [ ] This plan implements the **technical isolation** (paid mode behind flags +
      gating); the legal/regulatory determination is the operator's responsibility.

---

## 8. Data model (DB-first ledger; chain is settlement)

New tables (see migration `defi_tournaments`):
- `tournaments` — a tournament window/config (mode, entry fee, mint, period).
- `tournament_entries` — a player's paid entry (wallet, fee tx signature, status).
- `reward_payouts` — every $SURVIVAL payout (player, wallet, amount, match_id,
  tx signature, status: pending/sent/failed, dry_run flag). Idempotent on match_id.
- `matches.game_mode` — 'training' | 'tournament'.
- Reuse existing `ledger_entries` (off-chain coin balance) + `risk_flags`.

The DB is the source of truth for *who is owed what*; the chain tx is the
*settlement receipt* recorded back onto `reward_payouts`.

---

## 9. Env vars

```
# Rewards Hot Wallet (server-only — NEVER NEXT_PUBLIC, never commit)
DEV_WALLET_PRIVATE_KEY=<base58 secret key of the rewards hot wallet>
# $SURVIVAL token
SURVIVAL_TOKEN_MINT=<mint address>
NEXT_PUBLIC_SURVIVAL_TOKEN_MINT=<same mint, for client display/payment build>
# Fee sink
TREASURY_WALLET=<treasury public key>
# Economics (base units; 6 decimals)
ENTRY_FEE_AMOUNT=10000000          # e.g. 10 $SURVIVAL (10 * 10^6)
ENTRY_FEE_MINT=survival            # 'survival' | 'sol'
REWARD_PER_SCORE=2                 # base units per validated score point
MAX_REWARD_PER_RUN=2000000000      # cap per run
DAILY_REWARD_BUDGET=5000000000000  # ~5M/day of the 15M reserve
MAX_REWARD_PER_WALLET_DAY=...      # per-wallet daily cap
# Safety switch — keep false until tested
REWARDS_LIVE=false                 # false = dry-run (logs, no chain tx)
# RPC (already set) — uses NEXT_PUBLIC_SOLANA_RPC_URL / SOLANA_RPC_URL (Helius)
```

---

## 10. Phased rollout

1. **Now (this PR):** modes UI (Training vs Tournament, side-by-side), wallet+profile
   gating for Tournament, DB schema, server token module + entry/payout APIs — all
   **dry-run** (no funds move).
2. **Devnet test:** point env at devnet, mint a test token, run full entry→play→payout
   loop, verify idempotency + caps.
3. **Mainnet soft launch:** fund hot wallet with a small float, `REWARDS_LIVE=true`,
   low caps, monitor.
4. **Scale:** raise caps, add pooled tournaments (#4.2), add a settlement cron.
