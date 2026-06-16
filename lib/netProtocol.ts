// Shared realtime protocol between the browser client and the authoritative
// match server (server/realtime.ts). Framework-agnostic so both sides import it.
//
// Authoritative model: the client sends INPUTS (movement intent, shoot requests);
// the server simulates the match, owns positions/kills/deaths/rewards, and
// broadcasts authoritative SNAPSHOTS. The client renders snapshots (with optional
// local prediction for the controlled player). Never trust client-reported state.

export const PROTOCOL_VERSION = 1
export const DEFAULT_TICK_RATE = 20 // server simulation ticks per second
export const DEFAULT_ROOM = "lobby-1"

// ---- Client -> Server ----
export type ClientMessage =
  | { t: "join"; v: number; playerId: string; username: string; room?: string }
  | { t: "input"; seq: number; move: { x: number; z: number }; sprint: boolean; yaw: number }
  | { t: "shoot"; origin: [number, number, number]; dir: [number, number, number]; weapon: string }
  | { t: "ping"; time: number }
  | { t: "leave" }

// ---- Server -> Client ----
export type ServerMessage =
  | { t: "welcome"; selfId: string; room: string; tickRate: number; version: number }
  | { t: "state"; tick: number; players: PlayerSnapshot[]; enemies: EnemySnapshot[] }
  | { t: "joined"; player: PlayerSnapshot }
  | { t: "left"; playerId: string }
  | { t: "matchEnd"; results: MatchEndResult }
  | { t: "flag"; reason: string } // anti-cheat notice to the offending client
  | { t: "pong"; time: number }

export interface PlayerSnapshot {
  id: string
  username: string
  x: number
  y: number
  z: number
  yaw: number
  hp: number
  kills: number
  alive: boolean
}

export interface EnemySnapshot {
  id: number
  type: string
  x: number
  y: number
  z: number
}

export interface MatchEndResult {
  room: string
  durationSeconds: number
  wave: number
  players: { playerId: string; username: string; score: number; kills: number; survivedSeconds: number }[]
}

// ---- Anti-cheat tunables (server-enforced) ----
export const NET_LIMITS = {
  MAX_MOVE_SPEED: 12,        // units/sec — matches client MOVE_SPEED * sprint
  MAX_INPUTS_PER_SEC: 60,    // input message flood guard
  MAX_SHOTS_PER_SEC: 25,     // fastest weapon fire-rate + slack
  MAX_USERNAME_LEN: 24,
}
