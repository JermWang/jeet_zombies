"use client";

import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Howl } from 'howler';
import StandardZombieModel from './StandardZombieModel';

const ZOMBIE_COUNT = 23;
const SPAWN_AREA_WIDTH = 80;
const SPAWN_AREA_DEPTH = 60;
const MOVEMENT_SPEED = 1.5;
const Y_OFFSET = 0.9;

// Placeholder sound files - replace with your actual file paths
const ZOMBIE_SOUNDS = [
  '/sounds/zombie_groan1.mp3',
  '/sounds/zombie_groan2.mp3',
  '/sounds/zombie_moan1.mp3',
];
const MIN_SOUND_INTERVAL = 3000; // 3 seconds
const MAX_SOUND_INTERVAL = 7000; // 7 seconds

const animateZombieLegs = (
  leftLeg: THREE.Mesh | null,
  rightLeg: THREE.Mesh | null,
  time: number
) => {
  const walkSpeed = 3.0;
  const swingAmplitude = 0.7;
  const phase = time * walkSpeed;

  if (leftLeg) leftLeg.rotation.x = Math.sin(phase) * swingAmplitude;
  if (rightLeg) rightLeg.rotation.x = Math.sin(phase + Math.PI) * swingAmplitude;
};

interface ZombieState {
  id: string;
  position: THREE.Vector3;
  movementAngle: number;
}

const PreviewZombies = () => {
  const zombieLegRefs = useRef<{
    leftLeg: THREE.Mesh | null;
    rightLeg: THREE.Mesh | null;
  }[]>(Array(ZOMBIE_COUNT).fill(null).map(() => ({ leftLeg: null, rightLeg: null })));

  const initialZombies = useMemo<ZombieState[]>(() => {
    const zombies: ZombieState[] = [];
    for (let i = 0; i < ZOMBIE_COUNT; i++) {
      zombies.push({
        id: `zombie-${i}`,
        position: new THREE.Vector3(
          (Math.random() - 0.5) * SPAWN_AREA_WIDTH,
          Y_OFFSET,
          (Math.random() - 0.5) * SPAWN_AREA_DEPTH - SPAWN_AREA_DEPTH / 2
        ),
        movementAngle: Math.random() * Math.PI * 2,
      });
    }
    return zombies.sort(() => Math.random() - 0.5);
  }, []);

  const zombieData = useRef(initialZombies);
  const zombieGroupRefs = useRef<(THREE.Group | null)[]>(Array(initialZombies.length).fill(null));
  const soundIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const soundsRef = useRef<Howl[]>([]);

  // Load sounds and set up interval for playing them
  useEffect(() => {
    soundsRef.current = ZOMBIE_SOUNDS.map(src => new Howl({ src: [src], volume: 0.2 }));

    const playRandomSound = () => {
      if (soundsRef.current.length > 0) {
        const soundIndex = Math.floor(Math.random() * soundsRef.current.length);
        soundsRef.current[soundIndex].play();
      }
      // Schedule next sound
      const nextInterval = MIN_SOUND_INTERVAL + Math.random() * (MAX_SOUND_INTERVAL - MIN_SOUND_INTERVAL);
      soundIntervalRef.current = setTimeout(playRandomSound, nextInterval);
    };

    // Start the sound loop
    const initialDelay = MIN_SOUND_INTERVAL + Math.random() * (MAX_SOUND_INTERVAL - MIN_SOUND_INTERVAL);
    soundIntervalRef.current = setTimeout(playRandomSound, initialDelay);

    return () => {
      if (soundIntervalRef.current) {
        clearTimeout(soundIntervalRef.current);
      }
      soundsRef.current.forEach(sound => sound.unload()); // Unload sounds on component unmount
    };
  }, []);

  useFrame((state, delta) => {
    const time = state.clock.elapsedTime;

    zombieData.current.forEach((zombie, index) => {
      const group = zombieGroupRefs.current[index];
      if (!group) return;

      const speedMultiplier = 0.8 + Math.random() * 0.4;
      const currentSpeed = MOVEMENT_SPEED * speedMultiplier;

      group.position.x += Math.cos(zombie.movementAngle) * currentSpeed * delta;
      group.position.z += Math.sin(zombie.movementAngle) * currentSpeed * delta;
      
      group.rotation.y = -zombie.movementAngle + Math.PI / 2;

      const halfWidth = SPAWN_AREA_WIDTH / 2;
      const halfDepth = SPAWN_AREA_DEPTH / 2;
      if (group.position.x > halfWidth) group.position.x = -halfWidth + 1;
      if (group.position.x < -halfWidth) group.position.x = halfWidth - 1;
      if (group.position.z > halfDepth) group.position.z = -halfDepth + 1;
      if (group.position.z < -halfDepth) group.position.z = halfDepth - 1;
      
      const limbs = zombieLegRefs.current[index];
      if (limbs) {
        animateZombieLegs(limbs.leftLeg, limbs.rightLeg, time);
      }
    });
  });

  return (
    <group>
      {initialZombies.map((zombie, index) => (
        <group 
          key={zombie.id} 
          ref={el => { zombieGroupRefs.current[index] = el; }} 
          position={zombie.position}
          rotation={[0, -zombie.movementAngle + Math.PI / 2, 0]}
        >
          <StandardZombieModel 
            leftLegRef={el => { if (zombieLegRefs.current[index]) zombieLegRefs.current[index].leftLeg = el as THREE.Mesh; }}
            rightLegRef={el => { if (zombieLegRefs.current[index]) zombieLegRefs.current[index].rightLeg = el as THREE.Mesh; }}
          />
        </group>
      ))}
    </group>
  );
};

export default PreviewZombies; 