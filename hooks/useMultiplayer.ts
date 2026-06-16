"use client"

import { create } from "zustand"
import {
  ClientMessage,
  ServerMessage,
  PlayerSnapshot,
  EnemySnapshot,
  PROTOCOL_VERSION,
  DEFAULT_ROOM,
} from "@/lib/netProtocol"

// Client-side connector for the authoritative realtime server (server/realtime.ts).
// This is the Phase 3 seam: the single-player game does NOT use it yet, but a
// multiplayer match component can drive it — send inputs each frame, render the
// `players` / `enemies` snapshots, and predict the local player on top.

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8787"

interface MultiplayerState {
  ws: WebSocket | null
  connected: boolean
  selfId: string | null
  room: string | null
  players: PlayerSnapshot[]
  enemies: EnemySnapshot[]
  lastFlag: string | null

  connect: (playerId: string, username: string, room?: string) => void
  disconnect: () => void
  sendInput: (move: { x: number; z: number }, sprint: boolean, yaw: number) => void
  sendShoot: (origin: [number, number, number], dir: [number, number, number], weapon: string) => void
}

const useMultiplayer = create<MultiplayerState>((set, get) => {
  let inputSeq = 0

  const sendRaw = (msg: ClientMessage) => {
    const ws = get().ws
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg))
  }

  return {
    ws: null,
    connected: false,
    selfId: null,
    room: null,
    players: [],
    enemies: [],
    lastFlag: null,

    connect: (playerId, username, room = DEFAULT_ROOM) => {
      if (get().ws) return
      const ws = new WebSocket(WS_URL)
      set({ ws })

      ws.onopen = () => {
        set({ connected: true })
        sendRaw({ t: "join", v: PROTOCOL_VERSION, playerId, username, room })
      }
      ws.onclose = () => set({ ws: null, connected: false, selfId: null })
      ws.onerror = () => set({ connected: false })
      ws.onmessage = (ev) => {
        let msg: ServerMessage
        try { msg = JSON.parse(ev.data) } catch { return }
        switch (msg.t) {
          case "welcome": set({ selfId: msg.selfId, room: msg.room }); break
          case "state": set({ players: msg.players, enemies: msg.enemies }); break
          case "flag": set({ lastFlag: msg.reason }); break
          case "matchEnd": /* surface results to UI when MP is wired in */ break
        }
      }
    },

    disconnect: () => {
      const ws = get().ws
      if (ws) { try { sendRaw({ t: "leave" }); ws.close() } catch {} }
      set({ ws: null, connected: false, selfId: null, players: [], enemies: [] })
    },

    sendInput: (move, sprint, yaw) => {
      sendRaw({ t: "input", seq: inputSeq++, move, sprint, yaw })
    },

    sendShoot: (origin, dir, weapon) => {
      sendRaw({ t: "shoot", origin, dir, weapon })
    },
  }
})

export default useMultiplayer
