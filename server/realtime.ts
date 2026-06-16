/**
 * Jeet Zombies — authoritative realtime match server (Phase 3 scaffold).
 *
 * Run:  npm run server        (one-shot)
 *       npm run dev:server     (watch mode)
 *
 * Design: clients send INPUTS only; this server owns the simulation —
 * player movement, enemy spawning/movement, hit resolution, kills, deaths,
 * and end-of-match rewards. It validates input rate + movement speed + fire
 * rate (anti-cheat hooks) and, on match end, POSTs authoritative results to
 * the same /api/match/submit endpoint the single-player client uses, so all
 * progression/leaderboard/anti-cheat logic lives in one place.
 *
 * This is a working skeleton: the enemy AI and hit model are intentionally
 * simplified versions of the client gameplay. It boots, accepts connections,
 * runs rooms, and is the clean seam for full gameplay parity later.
 */
import { config as loadEnv } from "dotenv"
loadEnv({ path: ".env.local" })

import { WebSocketServer, WebSocket } from "ws"
import {
  ClientMessage,
  ServerMessage,
  PlayerSnapshot,
  EnemySnapshot,
  MatchEndResult,
  DEFAULT_TICK_RATE,
  DEFAULT_ROOM,
  PROTOCOL_VERSION,
  NET_LIMITS,
} from "../lib/netProtocol"

const PORT = Number(process.env.REALTIME_PORT || 8787)
const APP_URL = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
const TICK_RATE = DEFAULT_TICK_RATE
const DT = 1 / TICK_RATE

// Minimal server-side weapon damage table (mirror of data/weapons.ts).
const WEAPON_DAMAGE: Record<string, number> = { pistol: 25, shotgun: 100, smg: 18, rifle: 50 }

interface ServerPlayer {
  id: string
  username: string
  ws: WebSocket
  x: number; y: number; z: number
  yaw: number
  hp: number
  kills: number
  score: number
  alive: boolean
  // pending input
  move: { x: number; z: number }
  sprint: boolean
  // anti-cheat windows
  inputTimes: number[]
  shotTimes: number[]
  joinedAt: number
  submitted: boolean // guards against double result submission
}

interface ServerEnemy { id: number; type: string; x: number; y: number; z: number; hp: number }

interface Room {
  id: string
  players: Map<string, ServerPlayer>
  enemies: ServerEnemy[]
  enemyIdCounter: number
  tick: number
  wave: number
  startedAt: number
  lastSpawn: number
  loop: NodeJS.Timeout | null
  ended: boolean
}

const rooms = new Map<string, Room>()

function getRoom(id: string): Room {
  let room = rooms.get(id)
  if (!room) {
    room = {
      id, players: new Map(), enemies: [], enemyIdCounter: 0,
      tick: 0, wave: 1, startedAt: Date.now(), lastSpawn: 0, loop: null, ended: false,
    }
    rooms.set(id, room)
    room.loop = setInterval(() => stepRoom(room!), 1000 / TICK_RATE)
    console.log(`[room ${id}] created`)
  }
  return room
}

function send(ws: WebSocket, msg: ServerMessage) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg))
}
function broadcast(room: Room, msg: ServerMessage) {
  for (const p of room.players.values()) send(p.ws, msg)
}

function snapshotPlayers(room: Room): PlayerSnapshot[] {
  return [...room.players.values()].map((p) => ({
    id: p.id, username: p.username, x: p.x, y: p.y, z: p.z, yaw: p.yaw, hp: p.hp, kills: p.kills, alive: p.alive,
  }))
}
function snapshotEnemies(room: Room): EnemySnapshot[] {
  return room.enemies.map((e) => ({ id: e.id, type: e.type, x: e.x, y: e.y, z: e.z }))
}

// ---- Authoritative simulation tick ----
function stepRoom(room: Room) {
  if (room.ended) return
  room.tick++
  const now = Date.now()

  // 1. Integrate player movement from the latest input (speed-clamped).
  const maxStep = NET_LIMITS.MAX_MOVE_SPEED * DT
  for (const p of room.players.values()) {
    if (!p.alive) continue
    let dx = p.move.x, dz = p.move.z
    const len = Math.hypot(dx, dz)
    if (len > 1) { dx /= len; dz /= len } // normalize intent
    const speed = (p.sprint ? NET_LIMITS.MAX_MOVE_SPEED : NET_LIMITS.MAX_MOVE_SPEED * 0.66) * DT
    const step = Math.min(speed, maxStep)
    p.x += dx * step
    p.z += dz * step
  }

  // 2. Spawn enemies (simple escalating wave cadence).
  const spawnInterval = Math.max(500, 1500 - room.wave * 80)
  const cap = Math.min(40, 6 + room.wave * 2)
  if (now - room.lastSpawn > spawnInterval && room.enemies.length < cap && room.players.size > 0) {
    room.lastSpawn = now
    const angle = Math.random() * Math.PI * 2
    const r = 30
    room.enemies.push({
      id: room.enemyIdCounter++, type: "zombie_standard_shirt",
      x: Math.cos(angle) * r, y: 0, z: Math.sin(angle) * r, hp: 100,
    })
  }

  // 3. Move enemies toward nearest alive player; contact damage.
  const alive = [...room.players.values()].filter((p) => p.alive)
  for (const e of room.enemies) {
    let target: ServerPlayer | null = null
    let best = Infinity
    for (const p of alive) {
      const d = (p.x - e.x) ** 2 + (p.z - e.z) ** 2
      if (d < best) { best = d; target = p }
    }
    if (!target) continue
    const dist = Math.sqrt(best)
    if (dist > 1.5) {
      const inv = (2.8 * DT) / dist
      e.x += (target.x - e.x) * inv
      e.z += (target.z - e.z) * inv
    } else if (room.tick % TICK_RATE === 0) {
      // ~1 bite/sec
      target.hp = Math.max(0, target.hp - 10)
      if (target.hp <= 0) target.alive = false
    }
  }

  // 4. Wave advance when cleared after some spawns.
  if (room.enemies.length === 0 && now - room.startedAt > 5000 && room.tick % TICK_RATE === 0) {
    // (enemies only hit 0 transiently; treat sustained empties as wave clear)
  }
  if (room.tick % (TICK_RATE * 20) === 0) room.wave++ // simple time-based escalation

  // 5. Broadcast snapshot.
  broadcast(room, { t: "state", tick: room.tick, players: snapshotPlayers(room), enemies: snapshotEnemies(room) })

  // 6. End conditions: everyone dead, or room empty.
  if (room.players.size === 0) { endRoom(room); return }
  if (alive.length === 0 && room.players.size > 0) endRoom(room)
}

// ---- Shoot handling (server resolves hits) ----
function handleShoot(room: Room, p: ServerPlayer, origin: number[], dir: number[], weapon: string) {
  const now = Date.now()
  p.shotTimes = p.shotTimes.filter((t) => now - t < 1000)
  if (p.shotTimes.length >= NET_LIMITS.MAX_SHOTS_PER_SEC) {
    send(p.ws, { t: "flag", reason: "fire_rate" })
    return
  }
  p.shotTimes.push(now)
  if (!p.alive) return

  const damage = WEAPON_DAMAGE[weapon] ?? 20
  const [ox, oy, oz] = origin
  const dl = Math.hypot(dir[0], dir[1], dir[2]) || 1
  const dx = dir[0] / dl, dy = dir[1] / dl, dz = dir[2] / dl

  // Nearest enemy roughly along the ray within 1.2 units lateral, 200 fwd.
  let hit: ServerEnemy | null = null
  let bestT = Infinity
  for (const e of room.enemies) {
    const vx = e.x - ox, vy = e.y + 0.9 - oy, vz = e.z - oz
    const t = vx * dx + vy * dy + vz * dz // projection onto ray
    if (t < 0 || t > 200) continue
    const cx = ox + dx * t, cy = oy + dy * t, cz = oz + dz * t
    const lateral = Math.hypot(e.x - cx, e.y + 0.9 - cy, e.z - cz)
    if (lateral < 1.2 && t < bestT) { bestT = t; hit = e }
  }
  if (hit) {
    hit.hp -= damage
    if (hit.hp <= 0) {
      room.enemies = room.enemies.filter((x) => x.id !== hit!.id)
      p.kills++
      p.score += 10
    }
  }
}

// Submit one player's authoritative result to the same API the SP client uses.
// Tracked on the player so a given run is only ever submitted once (disconnect
// vs. all-dead races).
async function submitResult(room: Room, p: ServerPlayer, result: "died" | "disconnected") {
  if (p.submitted) return
  p.submitted = true
  try {
    await fetch(`${APP_URL}/api/match/submit`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        playerId: p.id, username: p.username, score: p.score, kills: p.kills,
        wavesSurvived: room.wave, maxCombo: 0,
        survivalSeconds: Math.floor((Date.now() - p.joinedAt) / 1000),
        result, mode: "survival_mp",
      }),
    })
  } catch (e: any) {
    console.warn(`[room ${room.id}] result submit failed for ${p.id}:`, e?.message)
  }
}

async function endRoom(room: Room) {
  if (room.ended) return
  room.ended = true
  if (room.loop) clearInterval(room.loop)
  const durationSeconds = Math.floor((Date.now() - room.startedAt) / 1000)

  const results: MatchEndResult = {
    room: room.id,
    durationSeconds,
    wave: room.wave,
    players: [...room.players.values()].map((p) => ({
      playerId: p.id, username: p.username, score: p.score, kills: p.kills,
      survivedSeconds: Math.floor((Date.now() - p.joinedAt) / 1000),
    })),
  }
  broadcast(room, { t: "matchEnd", results })
  console.log(`[room ${room.id}] ended — wave ${room.wave}, ${results.players.length} players`)

  for (const p of room.players.values()) await submitResult(room, p, "died")
  rooms.delete(room.id)
}

// ---- Connection handling ----
const wss = new WebSocketServer({ port: PORT })
console.log(`🧟 Jeet Zombies realtime server listening on ws://localhost:${PORT} (tick ${TICK_RATE}Hz)`)

wss.on("connection", (ws) => {
  let player: ServerPlayer | null = null
  let room: Room | null = null

  ws.on("message", (raw) => {
    let msg: ClientMessage
    try { msg = JSON.parse(raw.toString()) } catch { return }

    if (msg.t === "join") {
      if (msg.v !== PROTOCOL_VERSION) { send(ws, { t: "flag", reason: "version_mismatch" }); ws.close(); return }
      room = getRoom(msg.room || DEFAULT_ROOM)
      player = {
        id: msg.playerId, username: String(msg.username || "anon").slice(0, NET_LIMITS.MAX_USERNAME_LEN),
        ws, x: 0, y: 0, z: 0, yaw: 0, hp: 100, kills: 0, score: 0, alive: true,
        move: { x: 0, z: 0 }, sprint: false, inputTimes: [], shotTimes: [], joinedAt: Date.now(),
        submitted: false,
      }
      room.players.set(player.id, player)
      send(ws, { t: "welcome", selfId: player.id, room: room.id, tickRate: TICK_RATE, version: PROTOCOL_VERSION })
      broadcast(room, { t: "joined", player: snapshotPlayers(room).find((p) => p.id === player!.id)! })
      return
    }

    if (!player || !room) return

    if (msg.t === "input") {
      const now = Date.now()
      player.inputTimes = player.inputTimes.filter((t) => now - t < 1000)
      if (player.inputTimes.length >= NET_LIMITS.MAX_INPUTS_PER_SEC) {
        send(ws, { t: "flag", reason: "input_flood" }); return
      }
      player.inputTimes.push(now)
      player.move = { x: msg.move.x, z: msg.move.z }
      player.sprint = !!msg.sprint
      player.yaw = msg.yaw
    } else if (msg.t === "shoot") {
      handleShoot(room, player, msg.origin, msg.dir, msg.weapon)
    } else if (msg.t === "ping") {
      send(ws, { t: "pong", time: msg.time })
    } else if (msg.t === "leave") {
      ws.close()
    }
  })

  ws.on("close", () => {
    if (player && room) {
      // Submit the leaving player's run before removing them (unless the room is
      // already ending, which submits everyone itself).
      if (!room.ended) submitResult(room, player, "disconnected")
      room.players.delete(player.id)
      broadcast(room, { t: "left", playerId: player.id })
      if (room.players.size === 0) endRoom(room)
    }
  })
})
