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
  attackDamage?: number; // Optional: Damage dealt by this enemy type
  modelPath?: string; // Optional GLTF path for specific types (like boss)
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
    speed: 2.0, 
    attackRange: 1.5,
    attackDamage: 10,
  },
  zombie_brute: {
    health: 250,
    scale: 1.5, 
    colliderType: 'capsule',             
    hitboxArgs: [0.6, 2.6],             
    hitboxOffsetY: 1.3,                  // Collider center (height / 2)
    visualYOffset: 1.8,                  // Reverted: Original visual offset
    speed: 1.8, 
    attackRange: 2.0,
    attackDamage: 25,
  },
  zombie_boss: { // Keeping Cuboid for boss for now, adjust if needed
    health: 1000,
    scale: 1.8, 
    colliderType: 'cuboid', 
    hitboxArgs: [0.7, 0.8, 0.7], 
    hitboxOffsetY: 0.8, 
    visualYOffset: 1.0, // Reverted: Original visual offset (Adjust if needed)
    speed: 2.0,
    attackRange: 2.5,
    attackDamage: 40,
    modelPath: "/models/zombie_animated.glb", 
  },
  zombie_standard_bloody: { // Match standard shirt
    health: 100,
    scale: 1,
    colliderType: 'capsule', 
    hitboxArgs: [0.4, 1.2],  
    hitboxOffsetY: 0.6,      
    visualYOffset: 1.0,      // Reverted: Original visual offset
    speed: 2.0,
    attackRange: 1.5,
    attackDamage: 10,
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
    attackDamage: 15,
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
    attackDamage: 12,
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
    attackDamage: 30,
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