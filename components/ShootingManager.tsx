"use client";

import { useState, useEffect, useCallback, useRef, memo } from 'react';
import * as THREE from 'three';
import { Bullet } from './Bullet'; // Import the Bullet component
import useGameStore from "@/hooks/useGameStore"; // NEW: Import useGameStore

interface BulletState {
  id: number;
  position: THREE.Vector3;
  direction: THREE.Vector3;
  weaponId: string;
  damage: number; // Added damage property
}

const BULLET_SPEED = 100; // Match speed defined in Bullet or move constant

// Wrap the component function in memo()
export const ShootingManager = memo(function ShootingManager() {
  // console.log("ShootingManager Render"); // Removed log
  const [bullets, setBullets] = useState<BulletState[]>([]);
  const bulletIdCounter = useRef(0); // Use useRef for the ID counter
  const isGameOver = useGameStore((state) => state.isGameOver); // NEW: Get isGameOver state

  // Function to remove a bullet by its ID
  const removeBullet = useCallback((idToRemove: number) => {
    setBullets((prevBullets) => 
        prevBullets.filter((bullet) => bullet.id !== idToRemove)
    );
    // console.log(`Removed bullet ${idToRemove}`);
  }, []);

  useEffect(() => {
    // Listener for the playerShoot custom event
    const handlePlayerShoot = (event: CustomEvent) => {
      // NEW: Prevent shooting if game is over
      if (isGameOver) {
        console.log("[ShootingManager] Game is over. playerShoot event ignored.");
        return;
      }

      const { position, direction, weaponId, damage } = event.detail; // Get damage from event
      
      if (!position || !direction || !weaponId || typeof damage === 'undefined') {
        console.error("Invalid playerShoot event detail:", event.detail);
        return;
      }

      console.log("ShootingManager received playerShoot", { weaponId, damage });

      const newBullet: BulletState = {
        id: bulletIdCounter.current++,
        position: position.clone(), // Clone vectors
        direction: direction.clone(),
        weaponId: weaponId,
        damage: damage, // Store damage
      };

      setBullets((prevBullets) => [...prevBullets, newBullet]);
    };

    // Add event listener
    window.addEventListener("playerShoot", handlePlayerShoot as EventListener);

    // Cleanup listener on component unmount
    return () => {
      window.removeEventListener("playerShoot", handlePlayerShoot as EventListener);
    };
  }, [isGameOver]); // Empty dependency array means this runs once on mount

  return (
    <group> {/* Group to hold all bullet meshes */} 
      {bullets.map((bullet) => (
        <Bullet
          key={bullet.id}
          id={bullet.id}
          initialPosition={bullet.position}
          initialDirection={bullet.direction}
          weaponId={bullet.weaponId}
          damage={bullet.damage} // Pass damage to Bullet component
          onDespawn={removeBullet} // Pass callback to remove this bullet
        />
      ))}
    </group>
  );
}); // Close the memo wrapper 