import React, { useMemo } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useTexture } from "./useAssets";

const ZOMBIE_COUNT = 9;
const SPAWN_Z = -36;
const DESPAWN_Z = 7;
const LANE = 32;

// Camera handheld push-in + subtle bob — reads like first-person gameplay.
const CameraRig: React.FC = () => {
  const frame = useCurrentFrame();
  const { camera } = useThree();
  const t = frame / 30;
  camera.position.set(Math.sin(t * 1.6) * 0.25, 1.8 + Math.sin(t * 2.3) * 0.06, 9 - Math.min(t * 0.18, 3));
  camera.lookAt(0, 1.0, -10);
  return null;
};

// The game's actual regular zombie — procedural voxel build mirroring
// components/ZombieModel.tsx (green skin, red shirt, glowing red eyes).
const VoxelZombie: React.FC<{ walk: number }> = ({ walk }) => {
  const skin = "#5a8a58";
  const shirt = "#a13a3a";
  const pants = "#6b4d3b";
  const legSwing = Math.sin(walk) * 0.5;
  return (
    <group>
      {/* head */}
      <mesh position={[0, 0.7, 0]} castShadow>
        <boxGeometry args={[0.6, 0.6, 0.6]} />
        <meshStandardMaterial color={skin} roughness={0.85} />
      </mesh>
      {/* eyes (emissive red) */}
      {[-0.15, 0.15].map((x) => (
        <mesh key={x} position={[x, 0.75, 0.31]}>
          <boxGeometry args={[0.1, 0.1, 0.05]} />
          <meshStandardMaterial color="#ff0000" emissive="#ff0000" emissiveIntensity={2.5} toneMapped={false} />
        </mesh>
      ))}
      {/* mouth */}
      <mesh position={[0, 0.55, 0.31]}>
        <boxGeometry args={[0.22, 0.14, 0.05]} />
        <meshStandardMaterial color="#3a0000" roughness={1} />
      </mesh>
      {/* torso (red shirt) */}
      <mesh position={[0, 0.05, 0]} castShadow>
        <boxGeometry args={[0.7, 0.75, 0.45]} />
        <meshStandardMaterial color={shirt} roughness={0.8} />
      </mesh>
      {/* outstretched arms */}
      {[-0.475, 0.475].map((x) => (
        <mesh key={x} position={[x, 0.2, 0.32]} rotation={[-Math.PI / 2.6, 0, 0]} castShadow>
          <boxGeometry args={[0.16, 0.8, 0.25]} />
          <meshStandardMaterial color={skin} roughness={0.85} />
        </mesh>
      ))}
      {/* legs (walk swing) */}
      <mesh position={[-0.16, -0.55, 0]} rotation={[legSwing, 0, 0]} castShadow>
        <boxGeometry args={[0.26, 0.75, 0.26]} />
        <meshStandardMaterial color={pants} roughness={0.85} />
      </mesh>
      <mesh position={[0.16, -0.55, 0]} rotation={[-legSwing, 0, 0]} castShadow>
        <boxGeometry args={[0.26, 0.75, 0.26]} />
        <meshStandardMaterial color={pants} roughness={0.85} />
      </mesh>
    </group>
  );
};

const Horde: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  const lanes = useMemo(
    () =>
      new Array(ZOMBIE_COUNT).fill(0).map((_, i) => ({
        x: (i - (ZOMBIE_COUNT - 1) / 2) * 1.9 + (i % 2 ? 0.5 : -0.4),
        speed: 3.2 + (i % 3) * 0.8,
        phase: (i * LANE) / ZOMBIE_COUNT,
        bob: i * 1.3,
        scale: 1.15 + (i % 4) * 0.12,
      })),
    []
  );

  return (
    <group>
      {lanes.map((z, i) => {
        const travelled = (t * z.speed + z.phase) % LANE;
        const zPos = SPAWN_Z + travelled;
        if (zPos > DESPAWN_Z) return null;
        const walk = t * 7 + z.bob;
        const bob = Math.abs(Math.sin(walk)) * 0.09;
        return (
          <group
            key={i}
            position={[z.x + Math.sin(t * 1.5 + i) * 0.15, 1.05 * z.scale + bob, zPos]}
            rotation={[0, Math.PI + Math.sin(t * 2 + i) * 0.06, 0]}
            scale={z.scale}
          >
            <VoxelZombie walk={walk} />
          </group>
        );
      })}
    </group>
  );
};

export const GameScene: React.FC = () => {
  const ground = useTexture("textures/PavingStones/PavingStones142_1K-JPG_Color.jpg");
  const groundTex = useMemo(() => {
    if (!ground) return null;
    const t = ground.clone();
    t.repeat.set(16, 16);
    t.needsUpdate = true;
    return t;
  }, [ground]);

  return (
    <>
      <color attach="background" args={["#120a0c"]} />
      <fog attach="fog" args={["#120a0c", 16, 46]} />

      <CameraRig />

      <ambientLight intensity={0.9} color="#caa9b0" />
      <hemisphereLight args={["#ffd9c2", "#241016", 0.8]} />
      <directionalLight position={[4, 9, 7]} intensity={2.4} color="#ffd9b0" castShadow />
      <pointLight position={[0, 5, 7]} intensity={70} distance={32} color="#ff5a3c" />
      <pointLight position={[-9, 4, -8]} intensity={50} distance={36} color="#9d00ff" />
      <pointLight position={[9, 4, -12]} intensity={45} distance={36} color="#ff8c00" />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -8]} receiveShadow>
        <planeGeometry args={[100, 100]} />
        {groundTex ? (
          <meshStandardMaterial map={groundTex} roughness={0.92} color="#9a8a82" />
        ) : (
          <meshStandardMaterial color="#2a1c1e" roughness={1} />
        )}
      </mesh>

      <Horde />
    </>
  );
};
