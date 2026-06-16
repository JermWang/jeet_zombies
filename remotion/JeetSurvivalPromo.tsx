import React from "react";
import {
  AbsoluteFill,
  Audio,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { fontFamily as pressStart } from "@remotion/google-fonts/PressStart2P";
import { GameScene } from "./GameScene";
import { Hud } from "./Hud";

const RED = "#ff2d2d";
const GAMEPLAY_START = 75;
const SHOTS = Array.from({ length: 34 }, (_, i) => 12 + i * 14); // mirror of Hud

// ---------- Intro title card ----------
const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const slam = spring({ frame, fps, config: { damping: 12, stiffness: 180 } });
  const scale = interpolate(slam, [0, 1], [1.6, 1]);
  // 1 for frames 0-60, fading to 0 by frame 90.
  const opacity = interpolate(frame, [60, 90], [1, 0], { extrapolateLeft: "clamp" });
  return (
    <AbsoluteFill style={{ background: "#000", justifyContent: "center", alignItems: "center", fontFamily: pressStart, opacity }}>
      <Img src={staticFile("jeetsurvival.jpg")} style={{ position: "absolute", width: "100%", height: "100%", objectFit: "cover", opacity: 0.16, filter: "saturate(1.1)" }} />
      <AbsoluteFill style={{ background: "radial-gradient(circle at 50% 50%, transparent 20%, #000 85%)" }} />
      <div style={{ transform: `scale(${scale})`, textAlign: "center" }}>
        <div style={{ color: RED, fontSize: 96, textShadow: "0 5px 0 #000", letterSpacing: 4 }}>JEET</div>
        <div style={{ color: RED, fontSize: 96, textShadow: "0 5px 0 #000", letterSpacing: 4 }}>SURVIVAL</div>
        <div style={{ color: "#ffd23f", fontSize: 22, marginTop: 22 }}>HOLY SHIT thats alotta jeets</div>
      </div>
    </AbsoluteFill>
  );
};

// ---------- Feature flash ----------
const FeatureFlash: React.FC = () => {
  const frame = useCurrentFrame();
  const rows: { t: string; c: string; at: number }[] = [
    { t: "RUNNERS · TANKS · SPITTERS · EXPLODERS", c: "#8a3a3a", at: 0 },
    { t: "ENDLESS ESCALATING WAVES", c: "#6b8f2a", at: 26 },
    { t: "COMBOS · XP · GLOBAL LEADERBOARDS", c: "#ffd23f", at: 52 },
    { t: "UNLOCK SKINS & TRACERS", c: "#9d00ff", at: 78 },
  ];
  return (
    <AbsoluteFill style={{ background: "#0a0506", justifyContent: "center", alignItems: "center", fontFamily: pressStart, gap: 40 }}>
      {rows.map((r) => {
        const f = frame - r.at;
        const op = interpolate(f, [0, 8, 90, 100], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        const x = interpolate(f, [0, 10], [-60, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        return (
          <div key={r.t} style={{ color: r.c, fontSize: 34, opacity: op, transform: `translateX(${x}px)`, textShadow: "0 3px 0 #000", textAlign: "center" }}>
            {r.t}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// ---------- CTA ----------
const Cta: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 11 } });
  return (
    <AbsoluteFill style={{ background: "#000", justifyContent: "center", alignItems: "center", fontFamily: pressStart, textAlign: "center" }}>
      <Img src={staticFile("jeetsurvival.jpg")} style={{ position: "absolute", width: "100%", height: "100%", objectFit: "cover", opacity: 0.12 }} />
      <AbsoluteFill style={{ background: "radial-gradient(circle, transparent 8%, #000 75%)" }} />
      <div style={{ transform: `scale(${interpolate(pop, [0, 1], [0.7, 1])})` }}>
        <div style={{ color: "#ffd23f", fontSize: 90, textShadow: "0 5px 0 #000" }}>PLAY FREE</div>
        <div style={{ color: "#fff", fontSize: 44, marginTop: 24 }}>jeetsurvival.fun</div>
        <div style={{ color: "#54D195", fontSize: 26, marginTop: 28 }}>live on pump.fun · $JEETSURVIVAL</div>
        <div style={{ color: RED, fontSize: 22, marginTop: 16 }}>x.com/JeetSurvival</div>
      </div>
    </AbsoluteFill>
  );
};

export const JeetSurvivalPromo: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {/* ===== Gameplay (3D real assets + HUD) ===== */}
      <Sequence from={GAMEPLAY_START} durationInFrames={490}>
        <AbsoluteFill>
          <ThreeCanvas width={1920} height={1080} camera={{ fov: 55, position: [0, 2.4, 9] }}>
            <GameScene />
          </ThreeCanvas>
          <Hud />
        </AbsoluteFill>
      </Sequence>

      {/* ===== Intro over the top, fades out ===== */}
      <Sequence from={0} durationInFrames={92}>
        <Intro />
      </Sequence>

      {/* ===== Feature flash ===== */}
      <Sequence from={560} durationInFrames={105}>
        <FeatureFlash />
      </Sequence>

      {/* ===== CTA ===== */}
      <Sequence from={660} durationInFrames={90}>
        <Cta />
      </Sequence>

      {/* ===== Audio: real game sounds ===== */}
      <Audio src={staticFile("sounds/ambient.mp3")} volume={0.45} />
      <Sequence from={20} durationInFrames={120}>
        <Audio src={staticFile("sounds/AI VOICE/the jeets are coming.mp3")} volume={0.9} />
      </Sequence>
      <Sequence from={GAMEPLAY_START - 10} durationInFrames={120}>
        <Audio src={staticFile("sounds/AI VOICE/wave starting.mp3")} volume={0.85} />
      </Sequence>
      {/* gunshots synced to the HUD's shot cadence (every other shot to keep it clean) */}
      {SHOTS.filter((_, i) => i % 2 === 0).map((s) => (
        <Sequence key={s} from={GAMEPLAY_START + s} durationInFrames={12}>
          <Audio src={staticFile("sounds/rifle.mp3")} volume={0.5} />
        </Sequence>
      ))}
      {/* zombie death stingers on a few kills */}
      {[120, 200, 320, 440].map((s) => (
        <Sequence key={`d${s}`} from={s} durationInFrames={20}>
          <Audio src={staticFile("sounds/zombieDeath.mp3")} volume={0.6} />
        </Sequence>
      ))}
      <Sequence from={662} durationInFrames={40}>
        <Audio src={staticFile("sounds/gameStart.mp3")} volume={0.7} />
      </Sequence>
    </AbsoluteFill>
  );
};
