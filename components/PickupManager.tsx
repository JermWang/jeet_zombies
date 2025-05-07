'use client';

import React, { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import useGameStore from '@/hooks/useGameStore';
import type { WeaponPickupState, AmmoPickupState } from '@/hooks/useGameStore';
import WeaponPickup from './WeaponPickup';
import AmmoPickup from './AmmoPickup';
import { AMMO_PACK_CONFIGS } from '@/data/ammo';

// Define potential spawn points (x, y, z)
// Y should be appropriate for items on the ground, e.g., 0.5 or 1.0
const POTENTIAL_SPAWN_POINTS: Array<[number, number, number]> = [
  [10, 0.75, 15], [-20, 0.75, -10], [0, 0.75, 25], [30, 0.75, 30], [-30, 0.75, 20],
  [40, 0.75, -40], [-40, 0.75, -35], [15, 0.75, -25], [-10, 0.75, 40], [25, 0.75, 0],
  [5, 0.75, -5], [-5, 0.75, -5], [45, 0.75, 0], [-45, 0.75, 0], [0, 0.75, 45], [0, 0.75, -45]
];

const WEAPONS_TO_SPAWN: { weaponId: string }[] = [
  { weaponId: 'shotgun' },
  { weaponId: 'smg' },
  { weaponId: 'rifle' },
];

const AMMO_PACK_TYPES_TO_SPAWN: { type: string, count: number }[] = [
  { type: 'standard_ammo_pack', count: 5 },
];

// Fisher-Yates shuffle algorithm
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export default function PickupManager() {
  const { initializeWeaponPickups, initializeAmmoPickups, gameStarted, weaponPickups, ammoPickups } = useGameStore((state) => ({
    initializeWeaponPickups: state.initializeWeaponPickups,
    initializeAmmoPickups: state.initializeAmmoPickups,
    gameStarted: state.gameStarted,
    weaponPickups: state.weaponPickups,
    ammoPickups: state.ammoPickups,
  }));

  useEffect(() => {
    if (gameStarted) { // Only run when game starts (or perhaps on mount if resetGame handles it)
      console.log("[PickupManager] Initializing pickups for new game.");
      let availableSpawnPoints = shuffleArray(POTENTIAL_SPAWN_POINTS);
      const newWeaponPickups: WeaponPickupState[] = [];
      const newAmmoPickups: AmmoPickupState[] = [];

      // Spawn Weapons
      for (const weapon of WEAPONS_TO_SPAWN) {
        if (availableSpawnPoints.length === 0) {
          console.warn("[PickupManager] Not enough spawn points for all weapons!");
          break;
        }
        const spawnPos = availableSpawnPoints.pop()!;
        newWeaponPickups.push({
          id: `${weapon.weaponId}-pickup-${Math.random().toString(36).substr(2, 5)}`,
          weaponId: weapon.weaponId,
          position: spawnPos,
          collected: false,
        });
      }

      // Spawn Ammo Packs
      for (const ammoPack of AMMO_PACK_TYPES_TO_SPAWN) {
        const ammoConfig = AMMO_PACK_CONFIGS[ammoPack.type];
        if (!ammoConfig) {
            console.warn(`[PickupManager] Unknown ammo pack type: ${ammoPack.type}`);
            continue;
        }
        for (let i = 0; i < ammoPack.count; i++) {
          if (availableSpawnPoints.length === 0) {
            console.warn("[PickupManager] Not enough spawn points for all ammo packs!");
            break;
          }
          const spawnPos = availableSpawnPoints.pop()!;
          newAmmoPickups.push({
            id: `ammo-${ammoPack.type}-pickup-${Math.random().toString(36).substr(2, 5)}-${i}`,
            type: ammoPack.type,
            position: spawnPos,
            amount: ammoConfig.refillAmount, // Get amount from config
            collected: false,
          });
        }
      }
      initializeWeaponPickups(newWeaponPickups);
      initializeAmmoPickups(newAmmoPickups);
    }
    // This effect should ideally run when a new game starts. 
    // If useGameStore.resetGame already clears pickups, then running on gameStarted is fine.
  }, [gameStarted, initializeWeaponPickups, initializeAmmoPickups]);

  if (!gameStarted) {
    return null;
  }

  return (
    <>
      {weaponPickups.map((pickup) => (
        <WeaponPickup
          key={pickup.id}
          id={pickup.id}
          weaponId={pickup.weaponId}
          position={pickup.position}
        />
      ))}
      {ammoPickups.map((pickup) => (
        <AmmoPickup
          key={pickup.id}
          id={pickup.id}
          pickupType={pickup.type}
          position={pickup.position}
        />
      ))}
    </>
  );
} 