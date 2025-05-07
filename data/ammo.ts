export interface AmmoPackConfig {
  id: string;
  name: string;
  refillAmount: number; // How much ammo this pack provides
  modelPath?: string; // Optional path to a 3D model for the ammo box
  scale?: number; // Optional scale for the model
}

export const AMMO_PACK_CONFIGS: Record<string, AmmoPackConfig> = {
  standard_ammo_pack: {
    id: "standard_ammo_pack",
    name: "Ammo Pack",
    refillAmount: 30, // Gives 30 ammo units
    // modelPath: "/models/ammo_box.glb", // Example if you have a model
    scale: 0.5,
  },
  // Add more ammo pack types if needed (e.g., small_ammo_pack, large_ammo_pack)
};

// Helper function to get config, similar to getEnemyConfig
export const getAmmoPackConfig = (type: string): AmmoPackConfig | undefined => {
  return AMMO_PACK_CONFIGS[type];
}; 