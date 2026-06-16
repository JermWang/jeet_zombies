# Jeet Zombies — Realtime Match Server

Authoritative WebSocket server for multiplayer survival (Phase 3 scaffold).

## Run

```bash
npm run server       # start once
npm run dev:server   # watch mode (auto-restart on edits)
```

Reads `.env.local` (`REALTIME_PORT`, `APP_URL`). Listens on `ws://localhost:8787` by default.

## Architecture

```
 Browser client (hooks/useMultiplayer.ts)            Realtime server (server/realtime.ts)
 ───────────────────────────────────────             ─────────────────────────────────────
  sends INPUTS only:                       ─────►      Room (authoritative sim @ 20Hz)
    • { input: move, sprint, yaw }                       • integrates player movement (speed-clamped)
    • { shoot: origin, dir, weapon }                     • spawns + moves enemies
                                                         • resolves hits, owns kills/score/hp/deaths
  renders SNAPSHOTS:                       ◄─────       broadcasts { state: players[], enemies[] }
    • players[] (positions, hp, kills)
    • enemies[]                                        on match end → POST /api/match/submit
```

- **Single source of truth:** the server owns the simulation. Clients never report positions/kills — only intent. This is the anti-cheat foundation.
- **Shared contract:** `lib/netProtocol.ts` (message types, tick rate, anti-cheat limits) is imported by both sides.
- **Rewards reuse SP path:** on match end the server POSTs authoritative results to the same `/api/match/submit` endpoint the single-player client uses, so XP/leaderboard/anti-cheat logic lives in one place.

## Anti-cheat hooks (server-enforced)

- Movement integrated server-side and clamped to `MAX_MOVE_SPEED` (speed-hack proof).
- Input messages rate-limited (`MAX_INPUTS_PER_SEC`) — flood guard.
- Shots rate-limited (`MAX_SHOTS_PER_SEC`) — fire-rate hack guard; offenders get a `flag` message.
- Hit resolution is server-side ray-vs-enemy; client "I killed X" claims are ignored.

## Status / TODO

This boots, accepts connections, runs rooms, and submits results — the clean seam for full parity. Not yet wired into the single-player game (so SP stays intact). Next steps:
- Match-component that calls `useMultiplayer.connect()` and renders remote players/enemies.
- Client-side prediction + reconciliation for the local player.
- Port full enemy archetypes/waves from `data/enemies.ts` + `WaveManager` into the server sim.
- Matchmaking / lobby (room assignment, ready-up, countdown).
- Move from a standalone process to a deployable target (Fly.io / Railway / a Node host); swap `ws` for a scalable transport if needed.
