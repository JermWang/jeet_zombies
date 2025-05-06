"use client"

import { create } from "zustand"
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
  },
  zombie_brute: {
    health: 250,
    scale: 1.5,
    colliderArgs: [0.6, 1.35],
    colliderType: 'capsule',
    speed: 1.8,
    attackRange: 2.0,
  },
  zombie_boss: {
    health: 1000,
    scale: 1.8,
    colliderArgs: [0.7, 1.6],
    colliderType: 'capsule',
    speed: 2.0,
    attackRange: 2.5,
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

interface GameState {
  health: number
  score: number
  isGameOver: boolean
  gameStarted: boolean
  wavesEnabled: boolean
  playerPosition: Vector3 | null
  cameraAngle: number
  isDebugMode: boolean
  // Enemy State
  enemies: EnemyState[]; // This now acts as the pool
  enemyIdCounter: number; // Still useful for unique IDs

  // Wave State
  currentWave: number;
  zombiesRemainingInWave: number;
  totalZombiesInWave: number; // NEW: Total zombies for the current wave
  waveStatus: 'Idle' | 'Spawning' | 'Active' | 'BetweenWaves';

  findSafeSpawnPoint: (() => THREE.Vector3 | null) | null; // ADDED: Function holder

  decreaseHealth: (amount: number) => void
  increaseScore: (amount: number) => void
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
}

// Timeout map to prevent duplicate flash resets
const enemyHitResetTimeouts = new Map<number, NodeJS.Timeout>();
const FLASH_DURATION_MS = 150; // Duration for the hit flash

const useGameStore = create<GameState>((set, get) => ({
  health: 100,
  score: 0,
  isGameOver: false,
  gameStarted: false,
  wavesEnabled: true,
  playerPosition: null,
  cameraAngle: 0,
  isDebugMode: true,
  // Enemy State Initialization
  enemies: [], // Pool starts empty, populated by startGame/resetGame
  enemyIdCounter: 0,

  // Wave State Initialization
  currentWave: 0,
  zombiesRemainingInWave: 0,
  totalZombiesInWave: 0, // Initialize new state
  waveStatus: 'Idle',

  findSafeSpawnPoint: null, // ADDED: Initial state

  decreaseHealth: (amount) =>
    set((state) => {
      const newHealth = Math.max(0, state.health - amount)
      return {
        health: newHealth,
        isGameOver: newHealth <= 0,
      }
    }),

  increaseScore: (amount) =>
    set((state) => ({
      score: state.score + amount,
    })),

  // Initialize or reset the game state, including pre-populating the enemy pool
  startGame: () => {
    const initialEnemies: EnemyState[] = [];
    let counter = 0;
    for (let i = 0; i < MAX_ENEMIES_IN_POOL; i++) {
        initialEnemies.push({
            id: counter++,
            type: 'zombie_standard_shirt', // Default type, can be changed on spawn
            position: new Vector3Impl(0, -1000, 0), // Start inactive enemies off-screen
            health: 0,
            isDead: true, // Start all enemies in the pool as inactive
            physicsBodyId: null,
        });
    }
    set({
      gameStarted: true,
      isGameOver: false,
      health: 100,
      score: 0,
      enemies: initialEnemies, 
      enemyIdCounter: counter, // Set counter based on pool size
      currentWave: 0,
      zombiesRemainingInWave: 0,
      totalZombiesInWave: 0, // Initialize new state
      waveStatus: 'Idle',
    });
    console.log(`Game started, enemy pool initialized. Wave status: Idle.`);

    // --- ALSO SPAWN THE BOSS --- 
    const bossSpawnPos = new Vector3Impl(0, -0.04, -10); 
    console.log("Attempting to spawn initial boss...");
    get().spawnEnemy('zombie_boss', bossSpawnPos); // Call spawnEnemy for the boss

  },

  // Reset could potentially reuse the existing pool or re-initialize like startGame
  resetGame: () => {
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
      health: 100,
      score: 0,
      isGameOver: false,
      gameStarted: true, 
      playerPosition: new Vector3Impl(0, 1, 0),
      enemies: initialEnemies, 
      enemyIdCounter: counter,
      currentWave: 0,
      zombiesRemainingInWave: 0,
      totalZombiesInWave: 0, // Initialize new state
      waveStatus: 'Idle',
      findSafeSpawnPoint: null, // Reset function reference
    });
     console.log(`Game reset, enemy pool re-initialized. Wave status: Idle.`);
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

  // --- Enemy Management Functions (Object Pooling Logic) ---

  // Finds an inactive enemy, activates it, and sets its properties
  spawnEnemy: (type, position) => {
    // --- Add Stack Trace ---
    console.trace(`[spawnEnemy Store Action] Called for type: ${type}`);
    // -----------------------
    // --- Add Detailed Logging ---
    console.log(`[spawnEnemy Store Action] Received call. Type: ${type}, Requested Position: { x: ${position.x.toFixed(2)}, y: ${position.y.toFixed(2)}, z: ${position.z.toFixed(2)} }`);
    // -------------------------
    const config = ENEMY_CONFIGS[type];
    if (!config) {
      console.warn(`[spawnEnemy Store Action] Attempted to spawn enemy with unknown type: ${type}`);
      return null; 
    }

    let spawnedEnemyId: number | null = null;

    set((state) => {
      // --- Add Detailed Logging ---
      console.log(`[spawnEnemy Store Action] Searching pool (size: ${state.enemies.length}) for inactive enemy...`);
      // -------------------------
      const availableEnemyIndex = state.enemies.findIndex(enemy => enemy.isDead);

      if (availableEnemyIndex !== -1) {
        const enemiesCopy = [...state.enemies]; 
        const enemyToSpawn = enemiesCopy[availableEnemyIndex];
        spawnedEnemyId = enemyToSpawn.id; // Store the ID early for logging
        // --- Add Detailed Logging ---
        console.log(`[spawnEnemy Store Action] Found inactive Enemy ID: ${spawnedEnemyId} at pool index ${availableEnemyIndex}. Activating...`);
        console.log(`[spawnEnemy Store Action] Assigning position: { x: ${position.x.toFixed(2)}, y: ${position.y.toFixed(2)}, z: ${position.z.toFixed(2)} } to Enemy ID: ${spawnedEnemyId}`);
        // -------------------------

        // Update the found enemy's state
        enemyToSpawn.type = type;
        // console.log(`[spawnEnemy Store Action] Assigning position: X=${position.x.toFixed(2)}, Y=${position.y.toFixed(2)}, Z=${position.z.toFixed(2)} to Enemy ID: ${spawnedEnemyId}`);
        enemyToSpawn.position.copy(position); 
        enemyToSpawn.health = config.health;
        enemyToSpawn.isDead = false; 
        enemyToSpawn.physicsBodyId = null; // Reset physics IDs
        enemyToSpawn.isHit = false; // Reset hit state
        
        // Optionally log state changes here if needed
        
        return { enemies: enemiesCopy }; 
      } else {
        // --- Add Detailed Logging ---
        console.warn(`[spawnEnemy Store Action] No inactive enemy found in the pool (Pool Size: ${state.enemies.length}). Spawn failed.`);
        // -------------------------
        spawnedEnemyId = null; // Ensure ID is null if no spawn
        return {}; // No change to state
      }
    });

    // Return the ID of the spawned enemy (or null if failed)
    console.log(`[spawnEnemy Store Action] Returning spawned ID: ${spawnedEnemyId}`);
    return spawnedEnemyId;
  },

  damageEnemy: (id, amount) => {
    let enemyKilled = false; 
    let scoreToAdd = 0;
    const config = get().enemies.find(e => e.id === id)?.type ? getEnemyConfig(get().enemies.find(e => e.id === id)!.type) : null;
    let shouldPlayDeathSound = false; // Flag to play sound outside set

    set((state) => {
      const newEnemies = state.enemies.map((enemy) => {
        if (enemy.id === id && !enemy.isDead) {
          const newHealth = Math.max(0, enemy.health - amount);
          const isNowDead = newHealth <= 0;
          if (isNowDead && !enemy.isDead) {
             console.log(`Enemy ${enemy.type} (ID: ${id}) died.`);
             enemyKilled = true; 
             shouldPlayDeathSound = true; // Set flag to play sound
             if (config) { // Use the config fetched outside set
                // Simple score based on initial health, adjust as needed
                scoreToAdd = config.health / 10; 
             }
          }
          // Set isHit to true, update health, update isDead
          return { ...enemy, health: newHealth, isDead: isNowDead, isHit: !isNowDead }; // Only set isHit if not dead
        }
        return enemy;
      });
      return { enemies: newEnemies };
    });

    // Clear any existing reset timeout for this enemy
    if (enemyHitResetTimeouts.has(id)) {
      clearTimeout(enemyHitResetTimeouts.get(id));
    }

    // Set a new timeout to reset the isHit flag if the enemy wasn't killed
    if (!enemyKilled) {
      const timeoutId = setTimeout(() => {
        set((state) => ({
          enemies: state.enemies.map((enemy) =>
            enemy.id === id ? { ...enemy, isHit: false } : enemy
          ),
        }));
        enemyHitResetTimeouts.delete(id); // Remove from map once executed
      }, FLASH_DURATION_MS);
      enemyHitResetTimeouts.set(id, timeoutId);
    }

    // Play death sound if flagged
    if (shouldPlayDeathSound) {
        const soundState = useSoundEffects.getState();
        if (soundState.playZombieDeathSound) { // Check if function exists
             soundState.playZombieDeathSound();
        } else {
            console.warn("[GameStore damageEnemy] playZombieDeathSound function not found in sound state.");
        }
    }

    if (enemyKilled && scoreToAdd > 0) {
      get().increaseScore(scoreToAdd);
       console.log(`Increased score by ${scoreToAdd} for killing enemy ID ${id}`);
    }
  },

  // Marks an enemy as inactive (returns it to the pool)
  deactivateEnemy: (id) => {
    console.log(`[deactivateEnemy Store Action] Deactivating enemy ID: ${id}`);
    const playZombieDeathSound = useSoundEffects.getState().playZombieDeathSound;
    set((state) => {
       const enemiesCopy = [...state.enemies];
       const enemyIndex = enemiesCopy.findIndex(e => e.id === id);
       if (enemyIndex !== -1) {
           enemiesCopy[enemyIndex].isDead = true;
           enemiesCopy[enemyIndex].health = 0;
           enemiesCopy[enemyIndex].position.set(0, -1000, 0); // Move inactive off-screen
           enemiesCopy[enemyIndex].physicsBodyId = null; // Clear physics ID
            console.log(`[deactivateEnemy Store Action] Successfully deactivated enemy ID: ${id}`);
           return { enemies: enemiesCopy };
       } else {
            console.warn(`[deactivateEnemy Store Action] Could not find enemy ID: ${id} to deactivate.`);
           return {};
       }
   });
   // Update wave count if waves are active
    if (get().waveStatus === 'Active') {
       set((state) => ({ zombiesRemainingInWave: state.zombiesRemainingInWave - 1 }));
   }
  },

  // Updates the physics body ID for a specific enemy
  setEnemyPhysicsId: (id, physicsId) => {
    set((state) => ({
      enemies: state.enemies.map((enemy) =>
        enemy.id === id ? { ...enemy, physicsBodyId: physicsId } : enemy
      ),
    }));
  },

  // --- Wave Action Implementations ---
  startWaveSpawning: (waveNumber, totalZombieCount) => {
    console.log(`Store: Setting state for Wave ${waveNumber} spawning (${totalZombieCount} zombies)`);
    set({
      waveStatus: 'Spawning',
      currentWave: waveNumber,
      zombiesRemainingInWave: totalZombieCount, // Start remaining count
      totalZombiesInWave: totalZombieCount, // Store total count
    });
  },

  setWaveActive: () => {
    console.log("Store: Setting wave status to Active");
    set({ waveStatus: 'Active' });
  },
  
  setWaveBetween: () => {
    console.log("Store: Setting wave status to BetweenWaves");
    set({ waveStatus: 'BetweenWaves' });
  },

  // ADDED: Action to set the function reference
  setFindSafeSpawnPoint: (finder) => {
    // console.log("[Store] Setting findSafeSpawnPoint function."); // Optional log
    set({ findSafeSpawnPoint: finder });
  },
}))

// Import getEnemyConfig needed for score calculation
import { getEnemyConfig } from "@/data/enemies"; 

export default useGameStore
