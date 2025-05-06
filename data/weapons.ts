// Define weapon types and their properties
export interface WeaponData {
  id: string
  name: string
  damage: number
  fireRate: number // shots per second
  reloadTime: number // seconds
  magazineSize: number
  maxAmmo: number
  recoil: number // 0-1 scale
  spread: number // 0-1 scale
  automatic: boolean
  bulletSpeed: number
  bulletLifetime: number
  model: {
    scale: number
    position: [number, number, number]
    rotation: [number, number, number]
  }
  sound: string
  muzzleFlash: {
    color: string
    intensity: number
    size: number
    duration: number
  }
}

// Define all available weapons
const weapons: Record<string, WeaponData> = {
  pistol: {
    id: "pistol",
    name: "PISTOL",
    damage: 25,
    fireRate: 2,
    reloadTime: 1.5,
    magazineSize: 12,
    maxAmmo: 120,
    recoil: 0.3,
    spread: 0.05,
    automatic: false,
    bulletSpeed: 30,
    bulletLifetime: 2,
    model: {
      scale: 1,
      position: [0.4, -0.15, 0.5],
      rotation: [0, 0, 0],
    },
    sound: "shoot",
    muzzleFlash: {
      color: "#ffaa00",
      intensity: 5,
      size: 0.1,
      duration: 0.1,
    },
  },
  shotgun: {
    id: "shotgun",
    name: "SHOTGUN",
    damage: 100,
    fireRate: 0.8,
    reloadTime: 2.5,
    magazineSize: 8,
    maxAmmo: 48,
    recoil: 0.8,
    spread: 0.2,
    automatic: false,
    bulletSpeed: 25,
    bulletLifetime: 1,
    model: {
      scale: 1.2,
      position: [0.4, -0.15, 0.5],
      rotation: [0, 0, 0],
    },
    sound: "shotgun",
    muzzleFlash: {
      color: "#ffaa00",
      intensity: 8,
      size: 0.15,
      duration: 0.15,
    },
  },
  smg: {
    id: "smg",
    name: "SMG",
    damage: 18,
    fireRate: 10,
    reloadTime: 2,
    magazineSize: 30,
    maxAmmo: 180,
    recoil: 0.4,
    spread: 0.1,
    automatic: true,
    bulletSpeed: 35,
    bulletLifetime: 1.5,
    model: {
      scale: 0.9,
      position: [0.4, -0.15, 0.5],
      rotation: [0, 0, 0],
    },
    sound: "smg",
    muzzleFlash: {
      color: "#ffaa00",
      intensity: 4,
      size: 0.08,
      duration: 0.08,
    },
  },
  rifle: {
    id: "rifle",
    name: "RIFLE",
    damage: 50,
    fireRate: 5,
    reloadTime: 2.2,
    magazineSize: 20,
    maxAmmo: 120,
    recoil: 0.5,
    spread: 0.03,
    automatic: true,
    bulletSpeed: 40,
    bulletLifetime: 2.5,
    model: {
      scale: 1.1,
      position: [0.4, -0.15, 0.5],
      rotation: [0, 0, 0],
    },
    sound: "rifle",
    muzzleFlash: {
      color: "#ffaa00",
      intensity: 6,
      size: 0.12,
      duration: 0.12,
    },
  },
}

export default weapons
