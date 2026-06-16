import * as THREE from 'three';

// Define Enemy types and their properties
export interface EnemyConfig {
  health: number;
  scale: number; // Visual scale multiplier (applied in ZombieModel)
  hitboxArgs: [number, number, number] | [number, number]; // Cuboid [hx, hy, hz] or Capsule [radius, height]
  colliderType: 'cuboid' | 'capsule'; // ADDED collider type
  hitboxOffsetY: number; // Vertical offset for the hitbox center relative to RigidBody origin (ground)
  visualYOffset: number; // Vertical offset for the visual model relative to RigidBody origin (ground)
  speed: number;
  attackRange: number;
  minDamage?: number; // UPDATED (from attackDamage)
  maxDamage?: number; // NEW
  modelPath?: string; // Optional GLTF path for specific types (like boss)
  attackDistanceThreshold?: number; // ADDED
  animation?: {                 // ADDED
    walkSpeed?: number;
    swingAmplitude?: number;
    bodyBobAmplitude?: number;
  };
  // --- Phase 5: archetype identity + special behaviors ---
  archetype?: 'walker' | 'runner' | 'tank' | 'spitter' | 'exploder' | 'boss';
  tint?: string;            // skin tint so archetypes read at a glance
  scale?: number;           // (already above) visual scale reused by ZombieModel
  // Spitter: ranged attack
  rangedRange?: number;     // max distance to spit from
  rangedCooldown?: number;  // seconds between spits
  rangedMinDamage?: number;
  rangedMaxDamage?: number;
  // Exploder: detonates on reaching the player
  explosionRadius?: number;
  explosionMinDamage?: number;
  explosionMaxDamage?: number;
}

// Centralized configuration for different enemy types
export const ENEMY_CONFIGS: Record<string, EnemyConfig> = {
  zombie_standard_shirt: {
    health: 100,
    scale: 1, 
    colliderType: 'capsule',             
    hitboxArgs: [0.4, 1.2],             
    hitboxOffsetY: 0.6,                  // Collider center (height / 2)
    visualYOffset: 0.6,                  // Match hitboxOffsetY for testing
    speed: 3.0,
    attackRange: 1.5,
    minDamage: 10, // UPDATED
    maxDamage: 10, // NEW
    attackDistanceThreshold: 1.8, // ADDED example value
    animation: {                  // ADDED example values
        walkSpeed: 3.0,
        swingAmplitude: 0.2,
        bodyBobAmplitude: 0.05,
    },
  },
  zombie_brute: {
    health: 250,
    scale: 1.5, 
    colliderType: 'capsule',             
    hitboxArgs: [0.6, 2.6],             
    hitboxOffsetY: 1.3,                  // Collider center (height / 2)
    visualYOffset: 1.8,                  // Reverted: Original visual offset
    speed: 2.7,
    attackRange: 2.0,
    minDamage: 30, // UPDATED
    maxDamage: 50, // NEW
  },
  zombie_boss: { // Keeping Cuboid for boss for now, adjust if needed
    health: 1000,
    scale: 1.8, 
    colliderType: 'cuboid', 
    hitboxArgs: [0.7, 0.8, 0.7], 
    hitboxOffsetY: 0.8, 
    visualYOffset: 1.0, // Reverted: Original visual offset (Adjust if needed)
    speed: 3.0,
    attackRange: 2.5,
    minDamage: 50,  // Placeholder UPDATED
    maxDamage: 75, // Placeholder NEW
    modelPath: "/models/zombie_animated.glb", 
  },
  // ============ Phase 5 Archetypes ============
  zombie_runner: { // Fast, fragile — punishes slow aim
    health: 55,
    scale: 0.9,
    colliderType: 'capsule',
    hitboxArgs: [0.35, 1.0],
    hitboxOffsetY: 0.5,
    visualYOffset: 0.6,
    speed: 5.8,
    attackRange: 1.4,
    minDamage: 8,
    maxDamage: 12,
    archetype: 'runner',
    tint: '#8a3a3a', // sickly red
    attackDistanceThreshold: 1.6,
  },
  zombie_tank: { // Huge, slow, massive HP and hits
    health: 650,
    scale: 2.0,
    colliderType: 'capsule',
    hitboxArgs: [0.85, 3.0],
    hitboxOffsetY: 1.5,
    visualYOffset: 1.6,
    speed: 1.5,
    attackRange: 2.6,
    minDamage: 40,
    maxDamage: 60,
    archetype: 'tank',
    tint: '#3f5d3a', // dark mossy green
    attackDistanceThreshold: 2.8,
  },
  zombie_spitter: { // Ranged — keeps pressure from afar
    health: 90,
    scale: 1.05,
    colliderType: 'capsule',
    hitboxArgs: [0.4, 1.2],
    hitboxOffsetY: 0.6,
    visualYOffset: 0.6,
    speed: 2.2,
    attackRange: 1.5,
    minDamage: 8,
    maxDamage: 8,
    archetype: 'spitter',
    tint: '#6b8f2a', // toxic yellow-green
    rangedRange: 20,
    rangedCooldown: 2.6,
    rangedMinDamage: 7,
    rangedMaxDamage: 13,
  },
  zombie_exploder: { // Rushes in and detonates — area denial
    health: 70,
    scale: 1.1,
    colliderType: 'capsule',
    hitboxArgs: [0.45, 1.2],
    hitboxOffsetY: 0.6,
    visualYOffset: 0.6,
    speed: 3.4,
    attackRange: 2.0,
    minDamage: 0,
    maxDamage: 0,
    archetype: 'exploder',
    tint: '#9a2c12', // angry orange-red
    explosionRadius: 4.5,
    explosionMinDamage: 35,
    explosionMaxDamage: 55,
    attackDistanceThreshold: 2.2,
  },

  zombie_standard_bloody: { // Match standard shirt
    health: 100,
    scale: 1,
    colliderType: 'capsule', 
    hitboxArgs: [0.4, 1.2],  
    hitboxOffsetY: 0.6,      
    visualYOffset: 1.0,      // Reverted: Original visual offset
    speed: 3.0,
    attackRange: 1.5,
    minDamage: 10, // UPDATED
    maxDamage: 10, // NEW
  },
  // --- Placeholders (Revert to original visual offsets) --- 
  demon_lean: { 
    health: 150,
    scale: 1.2,
    colliderType: 'cuboid',
    hitboxArgs: [0.5, 0.9, 0.4], 
    hitboxOffsetY: 0.45, 
    visualYOffset: 0.9, // Reverted: Original visual offset
    speed: 2.8,
    attackRange: 1.8,
    minDamage: 15, // UPDATED
    maxDamage: 15, // NEW
  },
   demon_skeletal_winged: { 
    health: 120,
    scale: 1.1,
    colliderType: 'cuboid',
    hitboxArgs: [0.4, 0.75, 0.4], 
    hitboxOffsetY: 0.375, 
    visualYOffset: 0.75, // Reverted: Original visual offset
    speed: 3.2,
    attackRange: 1.6,
    minDamage: 12, // UPDATED
    maxDamage: 12, // NEW
  },
   demon_brute: { 
    health: 350,
    scale: 1.8,
    colliderType: 'cuboid',
    hitboxArgs: [0.7, 1.25, 0.6], 
    hitboxOffsetY: 0.625, 
    visualYOffset: 1.25, // Reverted: Original visual offset
    speed: 1.5,
    attackRange: 2.2,
    minDamage: 30, // UPDATED
    maxDamage: 30, // NEW
  },
};

// Helper function to get config, falling back to a default if type not found
export const getEnemyConfig = (type: string): EnemyConfig => {
    const config = ENEMY_CONFIGS[type];
    if (config) {
        return config;
    }
    console.warn(`No config found for enemy type: ${type}. Using default.`);
    // Return a default config (e.g., standard zombie) to prevent errors
    return ENEMY_CONFIGS['zombie_standard_shirt']; 
}; 