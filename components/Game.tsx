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

  return (
    <>
      <Canvas shadows camera={{ position: [0, 5, 30], fov: 60 }}> {/* Adjust initial camera for better overview */}
        {/* Re-enable WaveManager */}
        {gameStarted && <WaveManager />} 
        <Suspense fallback={<Loading />}>
          <Physics gravity={[0, -9.81, 0]} debug={isDebugMode}>
            {/* Add OrbitControls and Sparkles when game is NOT started */}
            {!gameStarted && (
              <>
                <OrbitControls 
                  autoRotate 
                  autoRotateSpeed={0.5} 
                  enableZoom={false} 
                  enablePan={false} 
                  minPolarAngle={Math.PI / 4} // Prevent looking straight down
                  maxPolarAngle={Math.PI / 2} // Prevent looking straight up
                  target={[0, 1, 0]} // Point towards center of map
                />
                <Sparkles 
                  count={200}
                  scale={[20, 20, 20]}
                  size={3}
                  speed={0.3}
                  noise={0.1}
                  color="red"
                />
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
    </>
  )
}
