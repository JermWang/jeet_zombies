'use client';

import React, { useRef, useState, useMemo, useCallback, useEffect } from 'react';
import { RigidBody, CuboidCollider, interactionGroups, RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber'; // Import useFrame
import useWeaponStore from '@/hooks/useWeaponStore';
import { useSoundEffects } from '@/hooks/useSoundEffects';
import { GROUP_PLAYER, GROUP_PICKUP } from '@/lib/physicsConstants'; // Import constants
import weapons from '@/data/weapons'; // To get model scale
import { useRapier } from '@react-three/rapier'; // Import useRapier
import useGameStore from '@/hooks/useGameStore';

interface WeaponPickupProps {
  id: string;
  weaponId: string;
  position: [number, number, number];
}

// Define geometry for each weapon pickup (simplified from Player.tsx)
const pickupGeometries: Record<string, React.ReactNode> = {
  shotgun: (
    <>
      <mesh castShadow receiveShadow material={new THREE.MeshStandardMaterial({ color: '#444' })}> 
        <boxGeometry args={[0.15, 0.15, 0.8]} />
      </mesh>
      <mesh castShadow position={[0, 0, 0.5]} material={new THREE.MeshStandardMaterial({ color: '#666' })}>
        <boxGeometry args={[0.15, 0.15, 0.4]} />
      </mesh>
      <mesh castShadow position={[0, -0.1, -0.3]} rotation={[0.2, 0, 0]} material={new THREE.MeshStandardMaterial({ color: '#444' })}>
        <boxGeometry args={[0.12, 0.2, 0.3]} />
      </mesh>
    </>
  ),
  smg: (
    <>
        <mesh castShadow receiveShadow material={new THREE.MeshStandardMaterial({ color: '#444' })}>
            <boxGeometry args={[0.12, 0.2, 0.6]} />
        </mesh>
        <mesh castShadow position={[0, 0, 0.4]} material={new THREE.MeshStandardMaterial({ color: '#666' })}>
            <boxGeometry args={[0.08, 0.08, 0.3]} />
        </mesh>
        <mesh castShadow position={[0, -0.2, 0]} rotation={[0.3, 0, 0]} material={new THREE.MeshStandardMaterial({ color: '#444' })}>
            <boxGeometry args={[0.1, 0.2, 0.15]} />
        </mesh>
        <mesh castShadow position={[0, -0.1, 0.1]} material={new THREE.MeshStandardMaterial({ color: '#666' })}>
            <boxGeometry args={[0.1, 0.15, 0.2]} />
        </mesh>
    </>
  ),
  rifle: (
    <>
        <mesh castShadow receiveShadow material={new THREE.MeshStandardMaterial({ color: '#444' })}>
            <boxGeometry args={[0.15, 0.15, 0.9]} />
        </mesh>
        <mesh castShadow position={[0, 0, 0.6]} material={new THREE.MeshStandardMaterial({ color: '#666' })}>
            <boxGeometry args={[0.1, 0.1, 0.4]} />
        </mesh>
        <mesh castShadow position={[0, -0.1, -0.2]} rotation={[0.2, 0, 0]} material={new THREE.MeshStandardMaterial({ color: '#444' })}>
            <boxGeometry args={[0.12, 0.2, 0.3]} />
        </mesh>
        <mesh castShadow position={[0, 0.15, 0.2]} material={new THREE.MeshStandardMaterial({ color: '#666' })}>
            <boxGeometry args={[0.1, 0.1, 0.2]} />
        </mesh>
    </>
  ),
  // Add pistol if needed, but player usually starts with it
};

// Collision group for the pickup sensor
const pickupCollisions = interactionGroups(
    1 << GROUP_PICKUP, // Belongs to Pickup group
    1 << GROUP_PLAYER   // Interacts ONLY with Player group
);

export default function WeaponPickup({ id, weaponId, position }: WeaponPickupProps) {
  const rigidBodyRef = useRef<RapierRigidBody>(null);
  const colliderRef = useRef<any>(null); // ADD ref for the collider
  const { addWeapon } = useWeaponStore();
  const weaponPickupState = useGameStore((state) => state.weaponPickups.find(p => p.id === id)); // Get state from store
  const isVisible = weaponPickupState ? !weaponPickupState.collected : true; // Determine visibility
  const rapier = useRapier(); // Get rapier context
  const groupRef = useRef<THREE.Group>(null); // ADD ref for the visual group
  // TODO: Add a generic item pickup sound effect
  // const { playItemPickupSound } = useSoundEffects(); 

  const weaponConfig = weapons[weaponId];
  const modelScale = weaponConfig?.model?.scale || 1;

  // --- Add useFrame for slow rotation --- 
  useFrame((_state, delta) => {
      if (groupRef.current) {
          groupRef.current.rotation.y += delta * 0.5; // Adjust speed (0.5 radians/sec)
      }
  });
  // --- END useFrame for rotation --- 

  if (!isVisible) {
    return null; // Don't render anything if picked up
  }

  // Collider args - adjust size as needed for pickup interaction area
  const colliderArgs: [number, number, number] = [0.3, 0.3, 0.6]; // Example size

  return (
    <RigidBody
      ref={rigidBodyRef}
      type="fixed" // Pickups don't move
      colliders={false} // Manual collider
      position={position}
      userData={{ type: 'pickup', weaponId: weaponId, pickupInstanceId: id }} // Store instanceId in userData
    >
      <CuboidCollider
        ref={colliderRef} // ADD ref prop
        args={colliderArgs} 
        sensor // Make it a sensor so player passes through
        collisionGroups={pickupCollisions}
      />
      <group 
        ref={groupRef} // Attach ref
        scale={modelScale * 1.2} 
        // REMOVED static random rotation
      > {/* Make slightly larger */}
        {pickupGeometries[weaponId] || (
          // Fallback geometry if weaponId not found
          <mesh>
            <boxGeometry args={[0.2, 0.2, 0.5]} />
            <meshStandardMaterial color="purple" />
          </mesh>
        )}
      </group>
      {/* Red Glow Point Light */}
      <pointLight 
          position={[0, 0.5, 0]} // Position light slightly above the base
          color="#ff0000" 
          intensity={15} // Adjust intensity for desired glow strength
          distance={3} // How far the glow reaches
          decay={2} // Standard decay
          castShadow={false}
      />
    </RigidBody>
  );
} 