// Centralized feature gating. Multiplayer ships as opt-in BETA: it stays hidden
// in production unless NEXT_PUBLIC_MP_ENABLED is explicitly "true" AND a realtime
// server URL is configured. This keeps the launch build (single-player + full
// progression) clean while the realtime server is hosted/hardened separately.

export const MP_ENABLED =
  process.env.NEXT_PUBLIC_MP_ENABLED === "true" && !!process.env.NEXT_PUBLIC_WS_URL

export const WS_URL = process.env.NEXT_PUBLIC_WS_URL || ""
