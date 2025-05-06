"use client"

import React, { useRef, useEffect, useState, useMemo, useCallback } from "react"
import { RigidBody, CapsuleCollider, useRapier, RapierRigidBody } from "@react-three/rapier"
import { useFrame, useLoader } from "@react-three/fiber"
import { useGLTF, useAnimations } from "@react-three/drei"
import * as THREE from 'three'
import useGameStore from "@/hooks/useGameStore" // Corrected path
import { useSoundEffects } from "@/hooks/useSoundEffects" // Added for death sounds

// Define constants locally
const ZOMBIE_SPEED = 1.5;
const ATTACK_DISTANCE_THRESHOLD = 1.8;
const COLLIDER_ARGS: [number, number] = [0.6, 0.4]; // height/2, radius
const COLLIDER_OFFSET_Y = COLLIDER_ARGS[0]; // Offset based on height/2

// Define Enemy types and their properties
interface EnemyConfig {
  health: number;
  scale: number;
  colliderArgs: [number, number] | [number, number, number]; // [radius, height] or [hx, hy, hz]
  colliderType: 'capsule' | 'cuboid';
  speed: number;
  attackRange: number;
  modelPath?: string; // Optional GLTF path for specific types
}

const ENEMY_CONFIGS: Record<string, EnemyConfig> = {
  zombie_standard_shirt: {
    health: 100,
    scale: 1,
    colliderArgs: [0.4, 0.9], // radius, height
    colliderType: 'capsule',
    speed: 2.5,
    attackRange: 1.5,
  },
  zombie_brute: {
    health: 250,
    scale: 1.5,
    colliderArgs: [0.6, 1.35], // radius, height (scaled)
    colliderType: 'capsule',
    speed: 1.8,
    attackRange: 2.0,
  },
  zombie_boss: {
    health: 1000,
    scale: 1.8,
    colliderArgs: [0.7, 1.6], // radius, height (scaled)
    colliderType: 'capsule',
    speed: 2.0,
    attackRange: 2.5,
    modelPath: "/models/zombie_animated.glb", // Boss uses the GLTF
  },
  // Add more types if needed
}

// Individual Enemy Component (Formerly Zombie)
function Enemy({ 
  id,
  position, 
  type = 'zombie_standard_shirt',
  health, // Added prop
  isDead // Added prop
}: { 
  id: number; 
  position: THREE.Vector3; 
  type?: string; 
  health: number; // Added prop type
  isDead: boolean; // Added prop type
}) {
  const enemyRef = useRef<RapierRigidBody>(null)
  const groupRef = useRef<THREE.Group>(null)
  const { playZombieDeathSound } = useSoundEffects(); // Get death sound player
  const [deathAnimationPlayed, setDeathAnimationPlayed] = useState(false); // Track if death sound/logic ran
  
  // --- Refs for procedural animation --- 
  // Use separate refs for each type if structure differs significantly, 
  // or use a generic Group ref if applying animation to the main group.
  // For now, we assume the animation logic targets specific parts named consistently.
  const leftArmRef = useRef<THREE.Object3D>(null); // Use generic Object3D for flexibility
  const rightArmRef = useRef<THREE.Object3D>(null);
  const leftLegRef = useRef<THREE.Object3D>(null);
  const rightLegRef = useRef<THREE.Object3D>(null);
  
  // --- GLTF Loading (Boss Only) --- 
  let gltf: any = null; // Default to null
  if (type === 'zombie_boss') {
    gltf = useGLTF('/models/zombie_animated.glb'); // Only call hook for boss
  }
  const scene = gltf?.scene ?? null; // Safely access scene
  const animations = gltf?.animations ?? []; // Safely access animations

  // --- Animations Hook --- 
  // Pass animations array (empty for non-boss)
  const { actions, names } = useAnimations(animations, groupRef) 
  
  const { playerPosition } = useGameStore()

  const [currentAction, setCurrentAction] = useState<string | null>(null)

  // --- Materials ---
  const greenSkinMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: '#5a8a58', roughness: 0.8 }), []);
  const redEyeMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: '#ff0000', emissive: '#ff0000', emissiveIntensity: 2 }), []);
  const redShirtMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: '#a13a3a', roughness: 0.7 }), []);
  const brownPantsMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: '#6b4d3b', roughness: 0.7 }), []);
  const bloodyWoundMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: '#8a0303' }), []);
  const redSkinMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: '#a82a2a', roughness: 0.7 }), []);
  const yellowEyeMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: '#ffff00', emissive: '#ffff00', emissiveIntensity: 2 }), []);
  const hornMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: '#4a4a4a', roughness: 0.6 }), []);
  const boneMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: '#e0e0e0', roughness: 0.8 }), []);
  const wingMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: '#333333', roughness: 0.7 }), []);
  const darkBrownLoinclothMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: '#4d382a', roughness: 0.7 }), []);
  // New material for mouth
  const mouthMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: '#400000', roughness: 0.9 }), []); // Dark red/black

  // --- Calculate Collider Props Based on Type ---
  const colliderProps = useMemo(() => {
    let args: [number, number] = [...COLLIDER_ARGS]; // Default size [0.6, 0.4]
    let offsetY = COLLIDER_OFFSET_Y; // Default offset 0.6

    if (type === 'zombie_brute') {
        args = [COLLIDER_ARGS[0] * 3, COLLIDER_ARGS[1] * 2]; // Triple height [1.8, 0.8]
        offsetY = COLLIDER_OFFSET_Y * 3; // Triple offset 1.8
    }
    // Add other type adjustments here if needed

    return { args, offsetY };
  }, [type]);

  // --- Handle Death State --- 
  useEffect(() => {
    if (isDead && enemyRef.current && !deathAnimationPlayed) {
      console.log(`Enemy ${id} is dead. Disabling physics and starting removal timer.`);
      setDeathAnimationPlayed(true); // Prevent running multiple times
      
      // Disable physics interactions
      enemyRef.current.setEnabled(false);

      // TODO: Play death animation if available (e.g., for boss)
      if (type === 'zombie_boss' && actions && actions.death) {
        console.log(`Playing death animation for Boss Zombie ${id}`);
        const deathAction = actions.death;
        deathAction.reset().setLoop(THREE.LoopOnce, 1).play();
        deathAction.clampWhenFinished = true;
        // Optional: Listen for animation finish to trigger removal?
        // For now, use a simple timer.
      }

      // Play death sound
      playZombieDeathSound();

      // Set a timer to remove the enemy from the game state after a delay
      const removalTimer = setTimeout(() => {
        console.log(`[Enemy Component] ID ${id} removal timer fired (visual only, store handles removal)`);
      }, 2000); // Remove after 2 seconds (adjust as needed)

      // Cleanup timer if the component unmounts before the timer fires
      return () => clearTimeout(removalTimer);
    }
  }, [isDead, id, playZombieDeathSound, actions, type, deathAnimationPlayed]);

  // Initial animation setup (only relevant for boss for now)
   useEffect(() => {
    // Only attempt if boss type and actions are ready AND not dead
    if (!isDead && type === 'zombie_boss' && actions && names.length > 0) { 
        console.log(`Boss Zombie (${position.x},${position.z}) Animations Available:`, names);
        const initialAction = names.includes('idle') ? 'idle' : names[0];
        if (initialAction && actions[initialAction]) { 
            actions[initialAction]?.reset().play(); 
            setCurrentAction(initialAction);
            console.log(`Boss Zombie (${position.x},${position.z}) playing initial: ${initialAction}`);
        }
    }
  }, [actions, names, type, position, isDead]); // Dependencies

  useFrame((state, delta) => {
    // Don't run frame logic if dead
    if (isDead || !enemyRef.current || !playerPosition || !groupRef.current) return;
    const enemyRb = enemyRef.current;

    // --- Movement/Rotation Logic (Still Commented Out) --- 
    // ... 

    // --- Animation Logic --- 
    const time = state.clock.elapsedTime;

    // == Boss Animation (GLTF Based) ==
    if (type === 'zombie_boss' && actions) {
        // TODO: Add proper state logic instead of forcing run
        const desiredAnimation = 'idle'; // Example: default to idle 
        if (currentAction !== desiredAnimation && actions[desiredAnimation]) {
           // ... (existing boss animation switching logic, maybe use idle instead of run) ...
            // actions[desiredAnimation]?.reset().play(); // Simplified for now
            // setCurrentAction(desiredAnimation);
        }
    }
    /* // Temporarily disable procedural walk animation for performance testing
    // == Procedural Walk Animation (for zombie_standard_shirt) ==
    else if (type === 'zombie_standard_shirt') {
        const walkSpeed = 3.0;
        const swingAmplitude = 0.3; 
        // const bobAmplitude = 0.04; // Removed
        // const lurchAmplitude = 0.03; // Removed

        // Calculate angles and offsets
        const angle = Math.sin(time * walkSpeed) * swingAmplitude;
        // const bobY = Math.sin(time * walkSpeed * 2) * bobAmplitude; // Removed
        // const lurchX = Math.cos(time * walkSpeed) * lurchAmplitude; // Removed

        // Apply rotations ONLY to legs
        if (leftLegRef.current) leftLegRef.current.rotation.x = angle;
        if (rightLegRef.current) rightLegRef.current.rotation.x = -angle;

        // Removed application of bob and lurch 
        // if (groupRef.current) {
        //     groupRef.current.position.y = colliderProps.offsetY + bobY; 
        //     groupRef.current.position.x = lurchX; 
        // }
    }
    // == Procedural Walk Animation (for zombie_brute) ==
    else if (type === 'zombie_brute') {
        const walkSpeed = 2.0;
        const swingAmplitude = 0.2; 
        // const bobAmplitude = 0.05; // Removed
        // const lurchAmplitude = 0.04; // Removed

        // Calculate angles and offsets
        const angle = Math.sin(time * walkSpeed) * swingAmplitude;
        // const bobY = Math.sin(time * walkSpeed * 2) * bobAmplitude; // Removed 
        // const lurchX = Math.cos(time * walkSpeed) * lurchAmplitude; // Removed

        // Apply rotations ONLY to legs (arms fixed forward)
        if (leftLegRef.current) leftLegRef.current.rotation.x = angle;
        if (rightLegRef.current) rightLegRef.current.rotation.x = -angle;

        // Removed application of bob and lurch
        // if (groupRef.current) {
        //     groupRef.current.position.y = colliderProps.offsetY + bobY; 
        //     groupRef.current.position.x = lurchX; 
        // }
    }
    // Add else if blocks for other types' procedural animations here
    */ // End temporary disable

  });

  return (
    <RigidBody
      ref={enemyRef}
      colliders={false} 
      position={position} 
      type="dynamic"
      mass={50}
      canSleep={false}
      enabledRotations={[false, true, false]} 
      userData={{ type: 'enemy', enemyType: type, id: id }} 
      linearDamping={0.5}
      angularDamping={0.5}
    >
      {/* Use dynamic collider props */}
      <CapsuleCollider 
        args={colliderProps.args} 
        position={[0, colliderProps.offsetY, 0]} 
        // Sensor property can be useful for non-colliding triggers, but we need solid collisions
        // sensor={isDead} // Example: Make collider a sensor when dead?
      />
      
      {/* Adjust group position based on type - Use dynamic offsetY for non-boss */}
      <group ref={groupRef} dispose={null} position={ type === 'zombie_boss' ? [0, -0.4, 0] : [0, colliderProps.offsetY, 0] } >
        {/* The non-boss group origin is now aligned with the collider center */}
        
        {/* --- Boss Zombie --- */}
        {type === 'zombie_boss' && scene && (
          <primitive object={scene} scale={1.0} />
        )}

        {/* --- Basic Zombie Geometries --- */}
        {type === 'zombie_child' && (
            // This type is currently removed from lineup
            <mesh castShadow position={[0, 0, 0]} material={greenSkinMaterial}>
                <boxGeometry args={[0.5, 1.0, 0.5]} />
            </mesh>
        )}
        {type === 'zombie_standard_shirt' && (
            // Voxel build for standard zombie with shirt
            <group>
                {/* Head */} 
                <mesh castShadow position={[0, 0.7, 0]} material={greenSkinMaterial}> 
                    <boxGeometry args={[0.6, 0.6, 0.6]} />
                </mesh>
                {/* Eyes */}
                <mesh position={[0.15, 0.75, 0.3]} material={redEyeMaterial}> 
                    <boxGeometry args={[0.1, 0.1, 0.05]} />
                </mesh>
                 <mesh position={[-0.15, 0.75, 0.3]} material={redEyeMaterial}> 
                    <boxGeometry args={[0.1, 0.1, 0.05]} />
                </mesh>
                {/* Mouth */}
                <mesh position={[0, 0.6, 0.3]} material={mouthMaterial}> 
                    <boxGeometry args={[0.2, 0.15, 0.05]} />
                </mesh>
                {/* Torso (Red Shirt) */} 
                <mesh castShadow position={[0, 0.05, 0]} material={redShirtMaterial}> 
                    <boxGeometry args={[0.7, 0.7, 0.45]} /> 
                </mesh>
                {/* Shirt Tear Detail (Green Skin showing) */}
                <mesh position={[0.15, 0.1, 0.23]} material={greenSkinMaterial}> {/* Offset slightly forward */}
                    <boxGeometry args={[0.2, 0.15, 0.02]} />
                </mesh>
                {/* Arms - Apply Mesh ref */} 
                <mesh ref={leftArmRef as React.Ref<THREE.Mesh>} castShadow position={[-0.5, 0.1, 0.3]} rotation={[ -Math.PI / 2, 0, 0 ]} material={greenSkinMaterial}> 
                    <boxGeometry args={[0.25, 0.8, 0.25]} /> 
                </mesh>
                 <mesh ref={rightArmRef as React.Ref<THREE.Mesh>} castShadow position={[0.5, 0.1, 0.3]} rotation={[ -Math.PI / 2, 0, 0 ]} material={greenSkinMaterial}> 
                    <boxGeometry args={[0.25, 0.8, 0.25]} />
                </mesh>
                {/* Legs - Apply Mesh ref */} 
                 <mesh ref={leftLegRef as React.Ref<THREE.Mesh>} castShadow position={[-0.15, -0.65, 0]} material={brownPantsMaterial}> 
                    <boxGeometry args={[0.25, 0.7, 0.25]} /> 
                </mesh>
                 <mesh ref={rightLegRef as React.Ref<THREE.Mesh>} castShadow position={[0.15, -0.65, 0]} material={brownPantsMaterial}> 
                    <boxGeometry args={[0.25, 0.7, 0.25]} /> 
                </mesh>
            </group>
        )}
        {type === 'zombie_standard_bloody' && (
            // Placeholder - Slightly larger green box
             <mesh castShadow position={[0, 0, 0]} material={greenSkinMaterial}>
                <boxGeometry args={[0.7, 1.6, 0.7]} />
            </mesh>
        )}
        {type === 'zombie_brute' && (
            // Voxel build for brute zombie - Scale the visual group
            <group scale={2}> 
                {/* Head - Square, Flat Top */}
                <mesh castShadow position={[0, 0.95, 0]} material={greenSkinMaterial}> {/* Main head block */}
                    <boxGeometry args={[0.7, 0.6, 0.7]} /> 
                </mesh>
                <mesh castShadow position={[0, 1.25, 0]} material={greenSkinMaterial}> {/* Flat top */}
                    <boxGeometry args={[0.75, 0.1, 0.75]} /> 
                </mesh>
                {/* Eyes (adjusted position) */}
                <mesh position={[0.2, 0.95, 0.35]} material={redEyeMaterial}> 
                    <boxGeometry args={[0.12, 0.12, 0.05]} />
                </mesh>
                 <mesh position={[-0.2, 0.95, 0.35]} material={redEyeMaterial}> 
                    <boxGeometry args={[0.12, 0.12, 0.05]} />
                </mesh>
                {/* Mouth */}
                <mesh position={[0, 0.8, 0.35]} material={mouthMaterial}> 
                    <boxGeometry args={[0.25, 0.18, 0.05]} />
                </mesh>
                {/* Torso (Green Skin) - Bulkier */}
                <mesh castShadow position={[0, 0.15, 0]} material={greenSkinMaterial}> {/* Main Torso */}
                    <boxGeometry args={[0.8, 0.9, 0.5]} /> 
                </mesh>
                <mesh castShadow position={[0.55, 0.4, 0]} material={greenSkinMaterial}> {/* Right Shoulder */}
                    <boxGeometry args={[0.3, 0.4, 0.5]} /> 
                </mesh>
                 <mesh castShadow position={[-0.55, 0.4, 0]} material={greenSkinMaterial}> {/* Left Shoulder */}
                    <boxGeometry args={[0.3, 0.4, 0.5]} /> 
                </mesh>
                {/* Arms - Apply Group ref */} 
                <group ref={leftArmRef as React.Ref<THREE.Group>} position={[-0.6, 0.3, 0.4]} rotation={[ -Math.PI / 2, 0, 0 ]}> 
                    <mesh castShadow material={greenSkinMaterial} position={[0, 0.2, 0]}> {/* Bicep */}
                         <boxGeometry args={[0.35, 0.4, 0.35]} /> 
                    </mesh>
                    <mesh castShadow material={greenSkinMaterial} position={[0, -0.3, 0]}>{/* Forearm */}
                         <boxGeometry args={[0.3, 0.4, 0.3]} /> 
                    </mesh>
                </group>
                 <group ref={rightArmRef as React.Ref<THREE.Group>} position={[0.6, 0.3, 0.4]} rotation={[ -Math.PI / 2, 0, 0 ]}> 
                     <mesh castShadow material={greenSkinMaterial} position={[0, 0.2, 0]}> {/* Bicep */}
                         <boxGeometry args={[0.35, 0.4, 0.35]} /> 
                    </mesh>
                    <mesh castShadow material={greenSkinMaterial} position={[0, -0.3, 0]}>{/* Forearm */}
                         <boxGeometry args={[0.3, 0.4, 0.3]} /> 
                    </mesh>
                </group>
                {/* Legs (Brown Shorts) - Thicker */}
                {/* Left Leg - Apply ref to group, Reverted Y position */}
                 <group ref={leftLegRef as React.Ref<THREE.Group>} position={[-0.2, -0.8, 0]}> 
                     <mesh castShadow material={brownPantsMaterial} position={[0, 0.25, 0]}> {/* Thigh */}
                         <boxGeometry args={[0.4, 0.5, 0.4]} /> 
                     </mesh>
                     <mesh castShadow material={greenSkinMaterial} position={[0, -0.3, 0]}> {/* Shin - Lowered Y, Increased height */}
                         <boxGeometry args={[0.35, 0.6, 0.35]} /> 
                     </mesh>
                     {/* Torn Short Detail - Adjusted Y pos */}
                     <mesh material={brownPantsMaterial} position={[0.1, 0.05, 0.21]} rotation={[0,0,0.2]}><boxGeometry args={[0.1, 0.15, 0.02]} /></mesh>
                     <mesh material={brownPantsMaterial} position={[-0.1, 0.05, 0.21]} rotation={[0,0,-0.2]}><boxGeometry args={[0.1, 0.15, 0.02]} /></mesh>
                 </group>
                {/* Right Leg - Apply ref to group, Reverted Y position */}
                 <group ref={rightLegRef as React.Ref<THREE.Group>} position={[0.2, -0.8, 0]}> 
                      <mesh castShadow material={brownPantsMaterial} position={[0, 0.25, 0]}> {/* Thigh */}
                         <boxGeometry args={[0.4, 0.5, 0.4]} /> 
                     </mesh>
                     <mesh castShadow material={greenSkinMaterial} position={[0, -0.3, 0]}> {/* Shin - Lowered Y, Increased height */} 
                         <boxGeometry args={[0.35, 0.6, 0.35]} /> 
                     </mesh>
                     {/* Torn Short Detail - Adjusted Y pos */}
                     <mesh material={brownPantsMaterial} position={[0.1, 0.05, 0.21]} rotation={[0,0,0.2]}><boxGeometry args={[0.1, 0.15, 0.02]} /></mesh>
                     <mesh material={brownPantsMaterial} position={[-0.1, 0.05, 0.21]} rotation={[0,0,-0.2]}><boxGeometry args={[0.1, 0.15, 0.02]} /></mesh>
                 </group>
            </group>
        )}

        {/* --- Demon Geometries --- */}
         {type === 'demon_imp' && (
             // This type is currently removed from lineup
            <mesh castShadow position={[0, 0, 0]} material={redSkinMaterial}>
                <boxGeometry args={[0.4, 0.8, 0.4]} />
            </mesh>
        )}
         {type === 'demon_lean' && (
            // Placeholder - Medium red box
            <mesh castShadow position={[0, 0, 0]} material={redSkinMaterial}>
                <boxGeometry args={[0.6, 1.7, 0.6]} />
            </mesh>
        )}
        {type === 'demon_skeletal_winged' && (
            // Placeholder - Bone colored box
            <mesh castShadow position={[0, 0, 0]} material={boneMaterial}>
                <boxGeometry args={[0.5, 1.5, 0.5]} />
            </mesh>
        )}
         {type === 'demon_brute' && (
            // Placeholder - Large red box
            <mesh castShadow position={[0, 0, 0]} material={redSkinMaterial}>
                <boxGeometry args={[1.0, 2.0, 1.0]} />
            </mesh>
        )}
        {/* Add implementations for other types here */}

      </group>
    </RigidBody>
  )
}

// Main Enemies Manager Component
export default function Enemies() {
  // Get state and functions from the store
  const enemies = useGameStore((state) => state.enemies); // Only select enemies

  return (
    <group>
      {enemies.map((data) => (
        <Enemy 
          key={data.id} // Use stable ID from store state
          id={data.id} 
          position={data.position} 
          type={data.type} 
          health={data.health} // Pass health
          isDead={data.isDead} // Pass isDead
        />
      ))}
    </group>
  )
} 