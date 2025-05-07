"use client"

import { Canvas, useFrame } from "@react-three/fiber"
import { Physics, useRapier } from "@react-three/rapier"
import { Suspense, useEffect, useState } from "react"
// import { EffectComposer, Bloom, Noise } from "@react-three/postprocessing" // Postprocessing removed
// import Environment from "./Environment"
import SimpleEnvironment from "./SimpleEnvironment"
import Player from "./Player"
// import SimplePlayer from "./SimplePlayer"
import Enemies from "./Enemies"
import Loading from "./Loading"
import { MinimalGameUI } from "./MinimalGameUI"
import useGameStore from "@/hooks/useGameStore"
// import Shooting from "./Shooting"
// import BulletImpacts from "./BulletImpacts"
import GunUI from "./GunUI"
import AudioInitializer from "./AudioInitializer" // Fixed import
import { ShootingManager } from "./ShootingManager"
import EnvironmentAssets from './EnvironmentAssets'
import FlyingBats from './FlyingBats'
import GameEventManager from "./GameEventManager"
import Zombies from "./Zombies"
import usePhysicsWorker from "@/hooks/usePhysicsWorker"; // Import the hook
import WaveManager from "./WaveManager"; // Import the new component
import BossManager from "./BossManager"; // Import the new boss manager
import WeaponPickup from "./WeaponPickup"; // Import the pickup component
import WaveUI from "./WaveUI"; // Import the new UI component
import SpawnPointFinder from "./SpawnPointFinder"; // ADDED
import { OrbitControls, Sparkles } from "@react-three/drei"; // Import Sparkles
import DriftingSparkles from './DriftingSparkles'; // Ensuring this is the active import
import AmbientSoundManager from './AmbientSoundManager'; // ADD THIS LINE
import PreviewCycleCamera from './PreviewCycleCamera'; // ADD THIS LINE
import PreviewZombies from './PreviewZombies'; // ADD THIS LINE
// import ScreenSpaceParticles from './ScreenSpaceParticles'; // REMOVE THIS LINE

// Helper component to drive the physics worker step AND the main world step
const PhysicsStepper = () => {
  const { stepPhysics } = usePhysicsWorker();
  const playerPosition = useGameStore((state) => state.playerPosition);
  const rapier = useRapier(); // Get the main rapier context
  
  useFrame((_state, delta) => {
    // Step the main Rapier world
    rapier.world.step();

    // Step the physics worker (if needed for offloaded calculations)
    if (playerPosition) {
        const posArray: [number, number, number] = [playerPosition.x, playerPosition.y, playerPosition.z];
        stepPhysics(delta, posArray);
    } else {
        stepPhysics(delta);
    }
  });
  return null; // This component doesn't render anything
};

const ErrorFallback = ({ error }: { error: Error }) => (
  <mesh position={[0, 1, 0]}>
    <boxGeometry args={[1, 1, 1]} />
    <meshStandardMaterial color="red" />
  </mesh>
);

export default function Game() {
  const { gameStarted, startGame, resetGame, isDebugMode } = useGameStore()
  const [hasInteracted, setHasInteracted] = useState(false)
  const [previewFadeOpacity, setPreviewFadeOpacity] = useState(1);
  const [isInitialPreviewReady, setIsInitialPreviewReady] = useState(false); // New state for loading

  useEffect(() => {
    const handleInteraction = () => {
      setHasInteracted(true)
      window.removeEventListener("click", handleInteraction)
      window.removeEventListener("keydown", handleInteraction)
    }

    window.addEventListener("click", handleInteraction)
    window.addEventListener("keydown", handleInteraction)

    return () => {
      window.removeEventListener("click", handleInteraction)
      window.removeEventListener("keydown", handleInteraction)
    }
  }, [])

  const handleInitialPreviewReady = () => {
    setIsInitialPreviewReady(true);
  };

  return (
    <>
      {/* Loading Text - Shown on black screen before initial fade-in completes */}
      {!gameStarted && !isInitialPreviewReady && previewFadeOpacity === 1 && (
        <div 
          className="fixed inset-0 flex items-center justify-center pointer-events-none z-[1001]"
          // zIndex higher than fade overlay to be visible on top of full black
        >
          <p className="text-2xl font-pixel text-red-500 animate-pulse">LOADING...</p>
        </div>
      )}

      {/* Fade overlay for pre-game camera transitions */}
      {!gameStarted && (
        <div
          style={{
            position: 'fixed', 
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'black',
            opacity: previewFadeOpacity, 
            pointerEvents: 'none',
            zIndex: 1000, 
          }}
        />
      )}
      
      {/* 2D Screen Space Particles for Start Screen */}
      {/* {!gameStarted && <ScreenSpaceParticles />} // REMOVE THIS LINE */}

      <Canvas shadows camera={{ position: [0, 5, 30], fov: 60 }}> {/* Adjust initial camera for better overview */}
        {/* Re-enable WaveManager */}
        {gameStarted && <WaveManager />} 
        <Suspense fallback={<Loading />}>
          <Physics gravity={[0, -9.81, 0]} debug={gameStarted ? isDebugMode : false}>
            {/* Add OrbitControls and Sparkles when game is NOT started */}
            {!gameStarted && (
              <>
                <PreviewCycleCamera 
                  onFadeOpacityChange={setPreviewFadeOpacity} 
                  onInitialFadeComplete={handleInitialPreviewReady} // Pass callback
                />
                <PreviewZombies /> {/* ADD PREVIEW ZOMBIES */}
              </>
            )}
            <SimpleEnvironment />
            <EnvironmentAssets />
            {/* Restore conditional rendering for Player/Enemies */} 
            {gameStarted && <Player />}
            {/* {gameStarted && <Enemies />} */}
            {/* Ensure Zombies component is rendered if needed */} 
            {/* {gameStarted && <Zombies />} */} {/* Temporarily removing condition */}
            <Zombies />                     {/* Render unconditionally */}
            {/* Render boss zombies individually */}
            {gameStarted && <BossManager />} 
            <ShootingManager />
            <AudioInitializer />
            <FlyingBats />
            <GameEventManager />
            {/* Add the component that calls stepPhysics */} 
            <PhysicsStepper /> 
            <SpawnPointFinder /> {/* ADDED: Render the finder inside Physics */}
            <AmbientSoundManager /> {/* ADD THIS LINE INSIDE CANVAS/PHYSICS IF APPROPRIATE, OR OUTSIDE CANVAS IF NOT 3D SPECIFIC */}

            {/* --- Sparkles for both start screen and in-game --- */}
            <DriftingSparkles /> 

            {/* --- Weapon Pickups --- */} 
            {gameStarted && (
                <>
                    <WeaponPickup weaponId="shotgun" position={[-10, 1.5, -5]} />
                    <WeaponPickup weaponId="smg" position={[10, 1.5, -5]} />
                    <WeaponPickup weaponId="rifle" position={[0, 1.5, 15]} />
                </>
            )}
            {/* --- End Weapon Pickups --- */} 

            {/* EffectComposer removed to prevent runtime error */}
            {/* {gameStarted && (
              <EffectComposer>
                <Noise opacity={0.02} />
              </EffectComposer>
            )} */}
          </Physics>
        </Suspense>
      </Canvas>

      {gameStarted && <WaveUI />} 

      <MinimalGameUI 
        gameStarted={gameStarted} 
        onStart={startGame} 
        onReset={resetGame} 
        hasInteracted={hasInteracted} 
      />
      {gameStarted && <GunUI />}
      {/* Add AmbientSoundManager here if it should be outside the Canvas but tied to gameStarted state */}
      {/* For example, if it should persist even if Canvas unmounts/remounts for some reason but game is still on */} 
      {/* However, since it uses useGameStore, it can effectively be anywhere as long as it's mounted when gameStarted is true */} 
      {/* Let's place it with other global game systems for clarity, often these are outside the Canvas */} 
    </>
  )
}
