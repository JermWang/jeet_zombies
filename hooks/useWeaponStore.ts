import { create } from "zustand"
import weapons from "@/data/weapons" // Make sure this is a default import
import { useSoundEffects } from "./useSoundEffects" // Import the sound effects store

interface WeaponState {
  currentWeapon: string
  availableWeapons: string[]
  ammo: Record<string, { current: number; reserve: number }>
  isReloading: boolean
  isShooting: boolean
  lastShotTime: number

  // Actions
  setCurrentWeapon: (weaponId: string) => void
  addWeapon: (weaponId: string) => void
  shoot: () => boolean
  reload: () => void
  setReloading: (isReloading: boolean) => void
  setShooting: (isShooting: boolean) => void
  addAmmo: (weaponId: string, amount: number) => void
  refuelAllWeapons: (amount: number) => void
}

const useWeaponStore = create<WeaponState>((set, get) => ({
  currentWeapon: "pistol",
  availableWeapons: ["pistol"],
  ammo: {
    pistol: { current: 12, reserve: 60 },
    shotgun: { current: 8, reserve: 32 },
    smg: { current: 30, reserve: 90 },
    rifle: { current: 20, reserve: 60 },
  },
  isReloading: false,
  isShooting: false,
  lastShotTime: 0,

  setCurrentWeapon: (weaponId) => {
    if (get().availableWeapons.includes(weaponId)) {
      set({ currentWeapon: weaponId })
    }
  },

  addWeapon: (weaponId) => {
    if (!get().availableWeapons.includes(weaponId)) {
      set((state) => ({
        availableWeapons: [...state.availableWeapons, weaponId],
      }))
    }
  },

  shoot: () => {
    const { currentWeapon, ammo, isReloading } = get()

    if (isReloading) return false

    if (ammo[currentWeapon].current > 0) {
      set((state) => ({
        ammo: {
          ...state.ammo,
          [currentWeapon]: {
            ...state.ammo[currentWeapon],
            current: state.ammo[currentWeapon].current - 1,
          },
        },
        lastShotTime: Date.now(),
      }))
      return true
    } else {
      get().reload()
      return false
    }
  },

  reload: () => {
    const { currentWeapon, ammo, isReloading } = get()
    const { playReloadSound } = useSoundEffects.getState() // Get sound function directly

    if (isReloading) return
    if (ammo[currentWeapon].current === weapons[currentWeapon].magazineSize) return
    if (ammo[currentWeapon].reserve <= 0) return

    console.log("[WeaponStore] Starting reload...")
    set({ isReloading: true })
    playReloadSound() // Re-enable sound playback

    setTimeout(() => {
      set((state) => {
        const currentAmmo = state.ammo[currentWeapon].current
        const reserveAmmo = state.ammo[currentWeapon].reserve
        const magazineSize = weapons[currentWeapon].magazineSize
        const ammoNeeded = magazineSize - currentAmmo
        const ammoToAdd = Math.min(ammoNeeded, reserveAmmo)

        return {
          isReloading: false,
          ammo: {
            ...state.ammo,
            [currentWeapon]: {
              current: currentAmmo + ammoToAdd,
              reserve: reserveAmmo - ammoToAdd,
            },
          },
        }
      })
      console.log("[WeaponStore] Reload finished.")
    }, weapons[currentWeapon].reloadTime * 1000)
  },

  setReloading: (isReloading) => {
    set({ isReloading })
  },

  setShooting: (isShooting) => {
    set({ isShooting })
  },

  addAmmo: (weaponId, amount) => {
    set((state) => ({
      ammo: {
        ...state.ammo,
        [weaponId]: {
          ...state.ammo[weaponId],
          reserve: Math.min(state.ammo[weaponId].reserve + amount, weapons[weaponId].maxAmmo),
        },
      },
    }))
  },

  refuelAllWeapons: (amount) => {
    set((state) => {
      const newAmmo = { ...state.ammo };
      state.availableWeapons.forEach(weaponId => {
        if (newAmmo[weaponId] && weapons[weaponId]) { // Ensure weapon exists in ammo record and config
          newAmmo[weaponId] = {
            ...newAmmo[weaponId],
            reserve: Math.min(newAmmo[weaponId].reserve + amount, weapons[weaponId].maxAmmo),
          };
        }
      });
      return { ammo: newAmmo };
    });
  },
}))

export default useWeaponStore
