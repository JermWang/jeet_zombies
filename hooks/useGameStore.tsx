"use client"

import { createWithEqualityFn } from 'zustand/traditional'
import { shallow } from 'zustand/shallow'
import type { Vector3 } from "three"
import { Vector3 as Vector3Impl } from "three"
import * as THREE from 'three' // Import THREE for Vector3 usage
import { useSoundEffects } from "@/hooks/useSoundEffects"; // Import sound effects hook

// --- Constants ---
const MAX_ENEMIES_IN_POOL = 50; // Define pool size here

// --- Enemy Config (Copied from Enemies.tsx for simplicity) ---
interface EnemyConfig {
  health: number;
  scale: number;
  colliderArgs: [number, number] | [number, number, number]; // [radius, height] or [hx, hy, hz]
  colliderType: 'capsule' | 'cuboid';
  speed: number;
  attackRange: number;
  minDamage?: number; // NEW
  maxDamage?: number; // NEW
  modelPath?: string;
}

const ENEMY_CONFIGS: Record<string, EnemyConfig> = {
  zombie_standard_shirt: {
    health: 100,
    scale: 1,
    colliderArgs: [0.4, 0.9],
    colliderType: 'capsule',
    speed: 2.5,
    attackRange: 1.5,
    minDamage: 10, // Current default
    maxDamage: 10, // Current default
  },
  zombie_brute: {
    health: 250,
    scale: 1.5,
    colliderArgs: [0.6, 1.35],
    colliderType: 'capsule',
    speed: 1.8,
    attackRange: 2.0,
    minDamage: 30, // NEW Brute damage
    maxDamage: 50, // NEW Brute damage
  },
  zombie_boss: {
    health: 1000,
    scale: 1.8,
    colliderArgs: [0.7, 1.6],
    colliderType: 'capsule',
    speed: 2.0,
    attackRange: 2.5,
    minDamage: 50,  // Placeholder boss damage
    maxDamage: 75, // Placeholder boss damage
    modelPath: "/models/zombie_animated.glb",
  },
}

// --- Enemy State Interface ---
export interface EnemyState {
  id: number;
  type: string;
  position: THREE.Vector3;
  health: number;
  isDead: boolean; // If true, this enemy is inactive and available in the pool
  physicsBodyId: number | null; // Keep this if used by worker
  isHit?: boolean; // ADDED: Flag for hit flash visual
}

// NEW: Weapon Pickup State Interface
export interface WeaponPickupState {
  id: string; // Unique ID for each pickup instance
  weaponId: string; // Type of weapon (e.g., 'shotgun')
  position: [number, number, number]; // World position
  collected: boolean;
}

// NEW: Ammo Pickup State Interface
export interface AmmoPickupState {
  id: string; // Unique ID for this pickup instance
  type: string; // Type of ammo pack (e.g., 'standard_ammo_pack')
  position: [number, number, number];
  amount: number; // Amount of ammo this specific instance provides (can be from config)
  collected: boolean;
}

interface GameState {
  health: number
  score: number
  isGameOver: boolean
  gameStarted: boolean
  wavesEnabled: boolean
  playerPosition: Vector3 | null
  cameraAngle: number
  isDebugMode: boolean
  isPlayerHit: boolean; // NEW: For player hit flash effect
  // Enemy State
  enemies: EnemyState[]; // This now acts as the pool
  enemyIdCounter: number; // Still useful for unique IDs

  // Wave State
  currentWave: number;
  zombiesRemainingInWave: number;
  totalZombiesInWave: number; // NEW: Total zombies for the current wave
  waveStatus: 'Idle' | 'Spawning' | 'Active' | 'BetweenWaves';

  // NEW: Weapon Pickups State
  weaponPickups: WeaponPickupState[];

  // NEW: Ammo Pickups State
  ammoPickups: AmmoPickupState[];

  // NEW: Boss Fight State
  bossFightActive: boolean;

  findSafeSpawnPoint: (() => THREE.Vector3 | null) | null; // ADDED: Function holder

  decreaseHealth: (amount: number) => void
  increaseScore: (amount: number) => void
  resetPlayerHit: () => void; // NEW: Action to reset player hit state
  startGame: () => void
  resetGame: () => void
  setPlayerPosition: (position: Vector3) => void
  setCameraAngle: (angle: number) => void
  setWavesEnabled: (enabled: boolean) => void
  toggleDebugMode: () => void
  // Enemy Functions
  spawnEnemy: (type: string, position: THREE.Vector3) => number | null; // Renamed, returns ID or null
  damageEnemy: (id: number, amount: number) => void;
  deactivateEnemy: (id: number) => void; // Renamed
  setEnemyPhysicsId: (id: number, physicsId: number) => void; // New action
  // Wave Actions
  startWaveSpawning: (waveNumber: number, totalZombieCount: number) => void; // Renamed param
  setWaveActive: () => void;
  setWaveBetween: () => void; // Action for starting the break
  setFindSafeSpawnPoint: (finder: (() => THREE.Vector3 | null) | null) => void; // ADDED: Action to set the function

  // NEW: Weapon Pickup Actions
  initializeWeaponPickups: (pickups: WeaponPickupState[]) => void;
  collectWeaponPickup: (id: string) => void;

  // NEW: Ammo Pickup Actions
  initializeAmmoPickups: (pickups: AmmoPickupState[]) => void;
  collectAmmoPickup: (id: string) => void;

  // NEW: Boss Fight Actions
  setBossFightActive: (isActive: boolean) => void;
}

// Timeout map to prevent duplicate flash resets
const enemyHitResetTimeouts = new Map<number, NodeJS.Timeout>();
const FLASH_DURATION_MS = 150; // Duration for the hit flash

const useGameStore = createWithEqualityFn<GameState>(
  (set, get) => ({
  health: 100,
  score: 0,
  isGameOver: false,
  gameStarted: false,
  wavesEnabled: true,
  playerPosition: null,
  cameraAngle: 0,
  isDebugMode: true,
  isPlayerHit: false, // NEW: Initial state for player hit
    enemies: [],
  enemyIdCounter: 0,
  currentWave: 0,
  zombiesRemainingInWave: 0,
    totalZombiesInWave: 0,
  waveStatus: 'Idle',
    findSafeSpawnPoint: null,

  // NEW: Weapon Pickups State
  weaponPickups: [], // NEW: Initialize weapon pickups array

  // NEW: Ammo Pickups State
  // ammoPickups: [], // DUPLICATE REMOVED

  // NEW: Boss fight state init
  bossFightActive: false,

  // NEW: Ammo pickups state init
  ammoPickups: [],

  decreaseHealth: (amount) =>
    set((state) => {
        const newHealth = Math.max(0, state.health - amount);
        const gameOver = newHealth <= 0;
      // NEW: Play game over sounds if it just became game over
      if (gameOver && !state.isGameOver) { 
        useSoundEffects.getState().playTransitionSound();
        useSoundEffects.getState().playOuttaControlSound();
      }
      return {
        health: newHealth,
        isGameOver: gameOver, // Use the calculated gameOver state
        isPlayerHit: true, 
        };
    }),

  increaseScore: (amount) =>
    set((state) => ({
      score: state.score + amount,
    })),

  resetPlayerHit: () => set({ isPlayerHit: false }), // NEW: Implementation for resetPlayerHit

  startGame: () => {
    const initialEnemies: EnemyState[] = [];
    let counter = 0;
    for (let i = 0; i < MAX_ENEMIES_IN_POOL; i++) {
        initialEnemies.push({
            id: counter++,
          type: 'zombie_standard_shirt',
          position: new Vector3Impl(0, -1000, 0),
            health: 0,
          isDead: true,
            physicsBodyId: null,
        });
    }
    set({
      gameStarted: true,
      isGameOver: false,
      health: 100,
      score: 0,
      enemies: initialEnemies, 
        enemyIdCounter: counter,
      currentWave: 0,
      zombiesRemainingInWave: 0,
        totalZombiesInWave: 0,
      waveStatus: 'Idle',
      bossFightActive: false, // Reset boss fight state
    });
    console.log(`Game started, enemy pool initialized. Wave status: Idle.`);
  },

  resetGame: () => {
    const initialEnemies: EnemyState[] = [];
    let counter = 0;
    for (let i = 0; i < MAX_ENEMIES_IN_POOL; i++) {
        initialEnemies.push({
            id: counter++,
            type: 'zombie_standard_shirt',
            position: new Vector3Impl(0, -1000, 0), // Move inactive enemies far away
            health: 0,
            isDead: true,
            physicsBodyId: null,
        });
    }
     set({
      health: 100,
      score: 0,
      isGameOver: false,       // Ensure game over is reset
      gameStarted: false,      // THIS IS THE KEY CHANGE: Return to main menu
      playerPosition: null,    // Reset player position (or to a menu default if any)
      enemies: initialEnemies, 
      enemyIdCounter: counter, // Reset counter if re-pooling from scratch
      currentWave: 0,
      zombiesRemainingInWave: 0,
      totalZombiesInWave: 0,
      waveStatus: 'Idle',
      findSafeSpawnPoint: null, // Reset this if it was set during gameplay
      isPlayerHit: false,       // Reset player hit state
      weaponPickups: get().weaponPickups.map(wp => ({ ...wp, collected: false })), // Reset collected state for all pickups
      ammoPickups: get().ammoPickups.map(ap => ({ ...ap, collected: false })), // NEW: Reset ammo pickups
      bossFightActive: false, // Reset boss fight state
    });
     console.log(`Game reset, returning to main menu. Wave status: Idle.`);
  },

  setPlayerPosition: (position) =>
    set({
      playerPosition: position,
    }),

  setCameraAngle: (angle) =>
    set({
      cameraAngle: angle,
    }),

  setWavesEnabled: (enabled) =>
    set({
      wavesEnabled: enabled,
    }),

  toggleDebugMode: () => set((state) => ({ isDebugMode: !state.isDebugMode })),

  spawnEnemy: (type, position) => {
    let spawnedEnemyId: number | null = null;

    set((state) => {
      const config = ENEMY_CONFIGS[type];
      if (!config) {
        console.warn(`[spawnEnemy Store Action] Attempted to spawn enemy with unknown type: ${type}`);
        return state; // No change, return original state reference
      }
      
      const availableEnemyIndex = state.enemies.findIndex(enemy => enemy.isDead);

      if (availableEnemyIndex !== -1) {
        spawnedEnemyId = state.enemies[availableEnemyIndex].id; // Get ID before mapping
        
        const newEnemiesArray = state.enemies.map((enemy, index) => {
          if (index === availableEnemyIndex) {
            // Return a NEW object only for the changed enemy
            return {
              ...enemy, // Spread existing properties
              type: type,
              position: new Vector3Impl(position.x, position.y, position.z), // Ensure a new Vector3 instance
              health: config.health,
              isDead: false,
              physicsBodyId: null, // Reset physicsBodyId, will be set by physics system
              isHit: false,
            };
          }
          return enemy; // Return existing object reference for unchanged enemies
        });

        return { 
          ...state, // Preserve other state parts
          enemies: newEnemiesArray, 
          zombiesRemainingInWave: state.zombiesRemainingInWave + 1 
        };
      } else {
          console.warn("[spawnEnemy Store Action] No inactive enemies available in the pool.");
          return state; // No change, return original state reference
      }
    });
    return spawnedEnemyId;
  },

  damageEnemy: (id, amount) => {
    set((state) => {
      let targetEnemyHit = false;
      let enemyDied = false; // NEW: Flag to check if enemy died in this action
      const newEnemies = state.enemies.map(enemy => {
        if (enemy.id === id && !enemy.isDead) {
          targetEnemyHit = true;
          const newHealth = Math.max(0, enemy.health - amount);
          const justDied = newHealth <= 0;
          if (justDied) enemyDied = true; // NEW: Set flag if enemy died
          return {
            ...enemy,
            health: newHealth,
            isDead: justDied,
            isHit: true, // Set isHit to true for visual feedback
          };
        }
        return enemy;
      });

      if (targetEnemyHit) {
        const newlyDeactivatedCount = newEnemies.find(e => e.id === id)?.isDead && !state.enemies.find(e => e.id === id)?.isDead ? 1 : 0;
        // NEW: Play death sound if enemyDied is true
        if (enemyDied) {
          useSoundEffects.getState().playZombieDeathSound(); 
        }
        return {
          ...state,
          enemies: newEnemies,
          score: newEnemies.find(e => e.id === id)?.isDead ? state.score + 10 : state.score, // Add score if enemy died
          zombiesRemainingInWave: state.zombiesRemainingInWave - newlyDeactivatedCount,
        };
      }
      return state; // No enemy found or no change
    });

    // Reset the isHit flag after a short delay for visual effect
    const enemyToReset = useGameStore.getState().enemies.find(e => e.id === id);
    if (enemyToReset && enemyToReset.isHit) {
        // Clear existing timeout for this enemy if one exists
        const existingTimeout = enemyHitResetTimeouts.get(id);
        if (existingTimeout) clearTimeout(existingTimeout);

        const newTimeout = setTimeout(() => {
            set(state => ({
                ...state,
                enemies: state.enemies.map(e => 
                    e.id === id ? { ...e, isHit: false } : e
                )
            }));
            enemyHitResetTimeouts.delete(id);
        }, FLASH_DURATION_MS);
        enemyHitResetTimeouts.set(id, newTimeout);
    }
  },

  deactivateEnemy: (id) => { // Used for when an enemy is explicitly removed or despawned by game logic other than dying
    set((state) => {
      let wasActive = false;
      const newEnemies = state.enemies.map(enemy => {
        if (enemy.id === id && !enemy.isDead) {
          wasActive = true;
          return {
            ...enemy,
            health: 0, // Typically set health to 0
            isDead: true,
            position: new Vector3Impl(0, -1000, 0), // Move out of sight
          };
        }
        return enemy;
      });

      if (wasActive) {
        return {
          ...state,
          enemies: newEnemies,
          zombiesRemainingInWave: Math.max(0, state.zombiesRemainingInWave - 1),
        };
      }
      return state;
    });
  },

  setEnemyPhysicsId: (id, physicsId) => {
    set((state) => ({
      ...state,
      enemies: state.enemies.map(enemy =>
        enemy.id === id ? { ...enemy, physicsBodyId: physicsId } : enemy
      ),
    }));
  },

  startWaveSpawning: (waveNumber, totalZombieCount) => {
    set({
        currentWave: waveNumber,
      waveStatus: 'Spawning',
        zombiesRemainingInWave: 0, // Reset for the new wave, will increment as they spawn
        totalZombiesInWave: totalZombieCount, // Set total for this wave
    });
      console.log(`[WaveManager] Wave ${waveNumber} spawning started. Total zombies: ${totalZombieCount}`);
  },
  setWaveActive: () => {
    set({ waveStatus: 'Active' });
      console.log(`[WaveManager] Wave ${get().currentWave} is now active.`);
  },
  setWaveBetween: () => {
    set({ waveStatus: 'BetweenWaves' });
      console.log(`[WaveManager] Wave ${get().currentWave} cleared. Entering between-wave state.`);
  },
  setFindSafeSpawnPoint: (finder) => {
    set({ findSafeSpawnPoint: finder });
  },

  // NEW: Weapon Pickup Actions
  initializeWeaponPickups: (pickups) => set({ weaponPickups: pickups }),
  collectWeaponPickup: (id) =>
    set((state) => ({
      weaponPickups: state.weaponPickups.map((pickup) =>
        pickup.id === id ? { ...pickup, collected: true } : pickup
      ),
    })),

  // NEW: Ammo Pickup Actions
  initializeAmmoPickups: (pickups) => set({ ammoPickups: pickups }),
  collectAmmoPickup: (id) =>
    set((state) => ({
      ammoPickups: state.ammoPickups.map((pickup) =>
        pickup.id === id ? { ...pickup, collected: true } : pickup
      ),
    })),

  // NEW: Boss Fight Action Implementation
  setBossFightActive: (isActive) => set({ bossFightActive: isActive }),

  }),
  shallow // Default equality function
);

// Import getEnemyConfig needed for score calculation
import { getEnemyConfig } from "@/data/enemies"; 

export default useGameStore
