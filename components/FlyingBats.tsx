"use client"

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { RigidBody, CuboidCollider, RapierRigidBody } from '@react-three/rapier';
import useGameStore from '@/hooks/useGameStore';
import { useSoundEffects } from '@/hooks/useSoundEffects';

// Bat Constants
const BAT_COUNT = 20;
const BAT_BODY_SIZE: [number, number, number] = [0.2, 0.2, 0.4];
const BAT_WING_SIZE: [number, number, number] = [0.5, 0.1, 0.3];
const BAT_COLOR = '#2a2a2a';
const FLIGHT_RADIUS = 15;
const FLIGHT_HEIGHT = 8;
const FLIGHT_SPEED = 0.5;
const FLAP_SPEED = 10;
const FLAP_ANGLE = Math.PI / 4;

// Bat Geometry (Shared)
const batBodyGeometry = new THREE.BoxGeometry(0.3, 0.1, 0.1);
const batWingGeometry = new THREE.BoxGeometry(0.05, 0.3, 0.1); // Thinner wings
const batMaterial = new THREE.MeshStandardMaterial({ color: '#222222', roughness: 0.8 });

// Bat Component
interface BatProps {
  position: [number, number, number];
  index: number;
}

const Bat = ({ position, index }: BatProps) => {
  const batRef = useRef<THREE.Group>(null!);
  const leftWingRef = useRef<THREE.Mesh>(null!);
  const rightWingRef = useRef<THREE.Mesh>(null!);

  const randomOffset = useMemo(() => Math.random() * Math.PI * 2, []);

  useFrame(({ clock }) => {
    const time = clock.getElapsedTime() + randomOffset;

    // Wing flap animation
    const flapSpeed = 10;
    const flapAngle = Math.sin(time * flapSpeed) * Math.PI * 0.2; // Flap range
    if (leftWingRef.current) {
      leftWingRef.current.rotation.z = flapAngle;
    }
    if (rightWingRef.current) {
      rightWingRef.current.rotation.z = -flapAngle;
    }
  });

  // Simplified Bat structure without physics
  return (
    <group ref={batRef} position={position}>
      {/* Body */}
      <mesh geometry={batBodyGeometry} material={batMaterial} castShadow />
      {/* Left Wing */}
      <mesh
        ref={leftWingRef}
        geometry={batWingGeometry}
        material={batMaterial}
        position={[-0.15, 0, 0]} // Position relative to body center
        rotation={[0, 0, 0]} // Initial rotation
        castShadow
      />
      {/* Right Wing */}
      <mesh
        ref={rightWingRef}
        geometry={batWingGeometry}
        material={batMaterial}
        position={[0.15, 0, 0]} // Position relative to body center
        rotation={[0, 0, 0]} // Initial rotation
        castShadow
      />
    </group>
  );
};

// Flying Bats Component (Manages multiple bats)
const FLIGHT_CENTER: [number, number, number] = [0, 15, -20];
const BATS_CENTER_VECTOR = new THREE.Vector3(...FLIGHT_CENTER);
const PROXIMITY_THRESHOLD = 20; // Distance to player to trigger sound

export default function FlyingBats() {
  const batRefs = useRef<(THREE.Group | null)[]>([]);
  const batAngles = useRef<number[]>([]);

  // Get player position from game store
  const playerPosition = useGameStore((state) => state.playerPosition);
  // Get sound playback function
  const playBatSound = useSoundEffects((state) => state.playBatSound);

  // Initialize bat angles
  if (batAngles.current.length !== BAT_COUNT) {
    batAngles.current = Array.from({ length: BAT_COUNT }, () => Math.random() * Math.PI * 2);
  }

  useFrame((state, delta) => {
    // Update bat positions for circular flight
    batAngles.current = batAngles.current.map((angle, i) => {
      const bat = batRefs.current[i];
      if (bat) {
        const currentAngle = angle + FLIGHT_SPEED * delta;
        const x = FLIGHT_CENTER[0] + Math.cos(currentAngle) * FLIGHT_RADIUS;
        const z = FLIGHT_CENTER[2] + Math.sin(currentAngle) * FLIGHT_RADIUS;
        const y = FLIGHT_CENTER[1] + Math.sin(currentAngle * 2) * 1; // Add some vertical bobbing

        bat.position.set(x, y, z);
        // Optional: Make bats look towards the center or along their path
        // bat.lookAt(BATS_CENTER_VECTOR); // Look at center (simpler)

        return currentAngle;
      }
      return angle;
    });

    // Check player proximity to bat group center
    if (playerPosition) { 
      const distanceToPlayer = playerPosition.distanceTo(BATS_CENTER_VECTOR);
      // console.log(`Distance to bats: ${distanceToPlayer.toFixed(2)}`); // Keep for debugging

      if (distanceToPlayer < PROXIMITY_THRESHOLD) {
        // Attempt to play sound - cooldown is handled internally by playBatSound
        // console.log("Player near bats, attempting to play sound..."); // Keep for debugging
        playBatSound();
      }
    }
  });

  // Create bat instances
  const bats = useMemo(() => {
    return Array.from({ length: BAT_COUNT }).map((_, i) => {
      const initialAngle = batAngles.current[i];
      const x = FLIGHT_CENTER[0] + Math.cos(initialAngle) * FLIGHT_RADIUS;
      const z = FLIGHT_CENTER[2] + Math.sin(initialAngle) * FLIGHT_RADIUS;
      const y = FLIGHT_CENTER[1];
      return (
        <group key={i} ref={(el: THREE.Group | null): void => { batRefs.current[i] = el }}>
          <Bat position={[x, y, z]} index={i} />
        </group>
      );
    });
  }, []);

  return <>{bats}</>;
} 