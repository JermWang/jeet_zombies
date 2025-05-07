'use client';

import React, { useRef } from 'react';
import { RigidBody, CuboidCollider, interactionGroups, RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import useGameStore from '@/hooks/useGameStore';
import { getAmmoPackConfig } from '@/data/ammo'; // To get model scale & amount if needed from config
import { GROUP_PLAYER, GROUP_PICKUP } from '@/lib/physicsConstants';

interface AmmoPickupProps {
  id: string; // Unique instance ID
  pickupType: string; // e.g., 'standard_ammo_pack' to fetch config
  position: [number, number, number];
}

const pickupCollisions = interactionGroups(
    1 << GROUP_PICKUP,
    1 << GROUP_PLAYER
);

export default function AmmoPickup({ id, pickupType, position }: AmmoPickupProps) {
  const groupRef = useRef<THREE.Group>(null);
  const ammoPackDetails = getAmmoPackConfig(pickupType);
  const pickupState = useGameStore((state) => state.ammoPickups.find(p => p.id === id));
  const isVisible = pickupState ? !pickupState.collected : true;

  const modelScale = ammoPackDetails?.scale || 0.3;
  const refillAmount = ammoPackDetails?.refillAmount || 10; // Fallback amount

  useFrame((_state, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.7; // Slightly faster rotation than weapons
    }
  });

  if (!isVisible) {
    return null;
  }

  // Simple box geometry for ammo pickup
  const colliderArgs: [number, number, number] = [modelScale, modelScale, modelScale];

  return (
    <RigidBody
      type="fixed"
      colliders={false}
      position={position}
      userData={{ type: 'ammoPickup', pickupInstanceId: id, amount: refillAmount }}
    >
      <CuboidCollider
        args={colliderArgs}
        sensor
        collisionGroups={pickupCollisions}
      />
      <group ref={groupRef} scale={modelScale}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="darkgreen" emissive="green" emissiveIntensity={0.5} />
        </mesh>
        {/* Placeholder for a more detailed model if ammoPackDetails.modelPath exists */}
      </group>
      <pointLight 
          position={[0, modelScale * 1.5, 0]}
          color="#00ff00" 
          intensity={10} 
          distance={3} 
          decay={2}
          castShadow={false}
      />
    </RigidBody>
  );
} 