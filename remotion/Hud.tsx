import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { fontFamily as pressStart } from "@remotion/google-fonts/PressStart2P";

// Real meme kill-feed copy lifted from the game's JuiceManager.
const KILL_LINES = ["JEETED", "REKT", "PAPER HANDS", "RUGGED", "NGMI", "EXIT LIQUIDITY", "GET DUNKED", "LIQUIDATED"];

// Shots roughly every 14 frames; some shots resolve a kill.
const SHOTS = Array.from({ length: 34 }, (_, i) => 12 + i * 14);
const KILLS = SHOTS.filter((_, i) => i % 2 === 1);

const red = "#ff2d2d";

export const Hud: React.FC = () => {
  const frame = useCurrentFrame();

  // Nearest recent shot, for muzzle-flash / crosshair kick / shake.
  const lastShot = SHOTS.filter((s) => s <= frame).pop() ?? -999;
  const sinceShot = frame - lastShot;
  const flash = sinceShot >= 0 && sinceShot < 4 ? interpolate(sinceShot, [0, 4], [0.55, 0]) : 0;
  const kick = sinceShot >= 0 && sinceShot < 5 ? interpolate(sinceShot, [0, 5], [1.7, 1]) : 1;

  // Deterministic screen shake around shots.
  const shakeAmt = Math.max(0, 9 - sinceShot * 2.2);
  const sx = Math.sin(frame * 41.3) * shakeAmt;
  const sy = Math.cos(frame * 37.7) * shakeAmt;

  // Climbing score + combo.
  const killsSoFar = KILLS.filter((k) => k <= frame).length;
  const score = 2400 + killsSoFar * 1850 + Math.floor(frame * 7.5);
  const combo = killsSoFar;

  // Ammo cycles with reloads; health drains.
  const ammoCycle = frame % 150;
  const ammo = ammoCycle < 120 ? 30 - Math.floor((ammoCycle / 120) * 30) : 30;
  const reloading = ammoCycle >= 120;
  const health = Math.round(interpolate(frame, [0, 220, 300, 485], [100, 62, 78, 41], { extrapolateRight: "clamp" }));

  // Active kill-feed items (each lasts ~55 frames).
  const feed = KILLS.filter((k) => frame - k >= 0 && frame - k < 55).map((k, idx) => ({
    k,
    text: KILL_LINES[(SHOTS.indexOf(k) + idx) % KILL_LINES.length],
    age: frame - k,
  }));

  return (
    <AbsoluteFill style={{ fontFamily: pressStart }}>
      {/* screen-shake wrapper */}
      <AbsoluteFill style={{ transform: `translate(${sx}px, ${sy}px)` }}>
        {/* muzzle flash */}
        <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 58%, rgba(255,230,150,${flash}), transparent 45%)` }} />

        {/* low-health red vignette */}
        {health <= 45 && (
          <AbsoluteFill style={{ boxShadow: `inset 0 0 260px 70px rgba(220,0,0,${0.4 + Math.sin(frame / 5) * 0.2})` }} />
        )}

        {/* SCORE / KILLS top-left */}
        <div style={{ position: "absolute", top: 48, left: 56 }}>
          <div style={{ color: red, fontSize: 18 }}>SCORE</div>
          <div style={{ color: "#ffd23f", fontSize: 56, lineHeight: 1.1, textShadow: "0 3px 0 #000" }}>
            {score.toLocaleString()}
          </div>
          <div style={{ color: "#fff", fontSize: 22, marginTop: 10 }}>KILLS {killsSoFar}</div>
        </div>

        {/* combo callout */}
        {combo >= 2 && (
          <div style={{ position: "absolute", top: 150, left: "50%", transform: "translateX(-50%)", textAlign: "center" }}>
            <div style={{ color: "#ffd23f", fontSize: 64, textShadow: "0 3px 0 #000" }}>x{combo}</div>
            <div style={{ color: red, fontSize: 20, letterSpacing: 6 }}>COMBO</div>
          </div>
        )}

        {/* kill feed */}
        <div style={{ position: "absolute", right: 64, top: 300, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10 }}>
          {feed.map((f) => (
            <div
              key={f.k}
              style={{
                color: f.age < 6 ? "#fff" : red,
                fontSize: 30,
                opacity: interpolate(f.age, [0, 4, 45, 55], [0, 1, 1, 0]),
                transform: `translateX(${interpolate(f.age, [0, 6], [40, 0], { extrapolateRight: "clamp" })}px)`,
                textShadow: "0 2px 0 #000",
              }}
            >
              {f.text}
            </div>
          ))}
        </div>

        {/* crosshair */}
        <div style={{ position: "absolute", left: "50%", top: "50%", transform: `translate(-50%,-50%) scale(${kick})` }}>
          <div style={{ position: "relative", width: 30, height: 30 }}>
            <div style={{ position: "absolute", left: 13, top: 13, width: 6, height: 6, borderRadius: 6, background: red }} />
            <div style={{ position: "absolute", left: 3, top: 13.5, width: 24, height: 4, background: red }} />
            <div style={{ position: "absolute", left: 13.5, top: 3, width: 4, height: 24, background: red }} />
          </div>
        </div>

        {/* hit marker on kills */}
        {KILLS.some((k) => frame - k >= 0 && frame - k < 6) && (
          <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", color: red, fontSize: 40, fontWeight: 700 }}>✕</div>
        )}

        {/* health bar bottom-center */}
        <div style={{ position: "absolute", bottom: 54, left: "50%", transform: "translateX(-50%)", width: 360, textAlign: "center" }}>
          <div style={{ width: "100%", height: 22, background: "#1a1a1a", border: "3px solid #555" }}>
            <div style={{ width: `${health}%`, height: "100%", background: health > 40 ? red : "#8b0000", transition: "none" }} />
          </div>
          <div style={{ color: "#fff", fontSize: 16, marginTop: 8 }}>{health}/100 HP</div>
        </div>

        {/* ammo bottom-right */}
        <div style={{ position: "absolute", bottom: 54, right: 64, textAlign: "right" }}>
          <div style={{ color: red, fontSize: 18 }}>RIFLE</div>
          {reloading ? (
            <div style={{ color: red, fontSize: 34, opacity: 0.5 + Math.sin(frame / 3) * 0.5 }}>RELOADING…</div>
          ) : (
            <div style={{ color: red, fontSize: 46 }}>
              {ammo}
              <span style={{ color: "#7a1010", fontSize: 26 }}> / 90</span>
            </div>
          )}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
