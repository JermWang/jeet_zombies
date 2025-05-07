import React, { Suspense, useEffect, Dispatch, SetStateAction } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Physics, useRapier } from '@react-three/rapier';
import useGameStore from '@/hooks/useGameStore';
import usePhysicsWorker from "@/hooks/usePhysicsWorker";

// Import all necessary components that were inside Canvas
import SimpleEnvironment from "./SimpleEnvironment";
import Player from "./Player";
import Zombies from "./Zombies";
import Loading from "./Loading";
import { ShootingManager } from "./ShootingManager";
import AudioInitializer from "./AudioInitializer";
import EnvironmentAssets from './EnvironmentAssets';
import FlyingBats from './FlyingBats';
import GameEventManager from "./GameEventManager";
import WaveManager from "./WaveManager";
import BossManager from "./BossManager";
import SpawnPointFinder from "./SpawnPointFinder";
import DriftingSparkles from './DriftingSparkles';
import AmbientSoundManager from './AmbientSoundManager';
import PreviewCycleCamera from './PreviewCycleCamera';
import PreviewZombies from './PreviewZombies';
import WeaponPickup from './WeaponPickup';

interface GameSceneProps {
  gameStarted: boolean;
  onPreviewFadeOpacityChange: Dispatch<SetStateAction<number>>;
  onInitialPreviewReady: () => void;
}

const GameScene = React.memo<GameSceneProps>(({
  gameStarted,
  onPreviewFadeOpacityChange,
  onInitialPreviewReady
}) => {
  console.log('[GameScene] Rendering. gameStarted:', gameStarted);
  const { gameStarted: gameStartedFromStore } = useGameStore();

  const PhysicsStepper = () => {
    const { stepPhysics } = usePhysicsWorker(); 
    const playerPosition = useGameStore((state) => state.playerPosition);
    const rapier = useRapier();
    
    useFrame((_state, delta) => {
      if (rapier.world) {
        rapier.world.step();
      }
      if (stepPhysics) {
        if (playerPosition) {
            const posArray: [number, number, number] = [playerPosition.x, playerPosition.y, playerPosition.z];
            stepPhysics(delta, posArray);
        } else {
            stepPhysics(delta);
        }
      }
    });
    return null;
  };

  return (
    <Canvas shadows camera={{ position: [0, 5, 30], fov: 60 }}>
      <WaveManager />
      <Suspense fallback={<Loading />}>
        <Physics gravity={[0, -9.81, 0]} debug={true}>
          {!gameStarted && (
            <>
              <PreviewCycleCamera
                onFadeOpacityChange={onPreviewFadeOpacityChange}
                onInitialFadeComplete={onInitialPreviewReady}
              />
              <PreviewZombies />
            </>
          )}
          <SimpleEnvironment />
          <EnvironmentAssets />
          <Player />
          <Zombies />
          <BossManager />
          <ShootingManager />
          <AudioInitializer />
          <FlyingBats />
          <GameEventManager />
          <PhysicsStepper />
          <SpawnPointFinder />
          <AmbientSoundManager />
          <DriftingSparkles />
          <group visible={gameStartedFromStore}>
            <WeaponPickup weaponId="shotgun" position={[-10, 1.5, -5]} />
            <WeaponPickup weaponId="smg" position={[10, 1.5, -5]} />
            <WeaponPickup weaponId="rifle" position={[0, 1.5, 15]} />
          </group>
        </Physics>
      </Suspense>
    </Canvas>
  );
});

GameScene.displayName = 'GameScene';
export default GameScene; 