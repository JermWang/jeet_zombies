"use client"

import { useState, useEffect } from "react"
import useWeaponStore from "@/hooks/useWeaponStore"
import weapons from "@/data/weapons"

export default function GunUI() {
  const { currentWeapon, ammo, isReloading, availableWeapons } = useWeaponStore()
  const currentAmmo = ammo[currentWeapon]
  const weaponData = weapons[currentWeapon]

  // Dynamic crosshair — expands briefly on each shot for tactile feedback.
  const [firing, setFiring] = useState(false)
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>
    const onShoot = () => { setFiring(true); clearTimeout(t); t = setTimeout(() => setFiring(false), 90) }
    window.addEventListener("playerShoot", onShoot)
    return () => { window.removeEventListener("playerShoot", onShoot); clearTimeout(t) }
  }, [])

  if (!currentAmmo || !weaponData) {
    // Handle case where weapon data might not be loaded yet or is invalid
    return null; 
  }

  // Colors inspired by the image
  const accentColor = "red-500";
  const primaryTextColor = "red-500"; // Main text is red
  const secondaryTextColor = "red-700"; // Reserve ammo text is darker red
  const backgroundColor = "black/70";

  // Find the index of the current weapon for highlighting
  const currentWeaponIndex = availableWeapons.findIndex(w => w === currentWeapon);

  return (
    <div className="absolute inset-0 pointer-events-none font-pixel">
      {/* Center: Crosshair — expands on fire for tactile feedback */}
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
        <div
          className="w-6 h-6 flex items-center justify-center transition-transform duration-75 ease-out"
          style={{ transform: firing ? "scale(1.6)" : "scale(1)" }}
        >
          <div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div>
          <div className="absolute w-5 h-1 bg-red-500"></div>
          <div className="absolute w-1 h-5 bg-red-500"></div>
        </div>
      </div>

      {/* Bottom-Right: weapon name + inventory + ammo, all grouped together
          (moved off the top-left so it no longer overlaps the SCORE/KILLS/TIME stats) */}
      <div className="absolute bottom-6 right-6 flex flex-col items-end gap-2">
        {/* Current weapon */}
        <div className="text-red-500 text-xl bg-black/70 px-3 py-1.5 rounded border-2 border-red-500 shadow-lg whitespace-nowrap">
          {weaponData.name}
        </div>

        {/* Ammo / reload */}
        {isReloading ? (
          <div className="text-red-500 font-bold text-2xl animate-pulse bg-black/70 px-4 py-2 rounded border-2 border-red-500 shadow-lg">
            RELOADING...
          </div>
        ) : (
          <div className="bg-black/70 px-4 py-2 rounded border-2 border-red-500 shadow-lg flex flex-col items-end">
            <div className="text-red-500 text-3xl">
              {currentAmmo.current}
              <span className="font-pixel-alt text-xl text-red-700"> / {currentAmmo.reserve}</span>
            </div>
            <div className="flex flex-wrap justify-end gap-1 mt-2 max-w-[120px]">
              {Array.from({ length: Math.min(currentAmmo.current, 30) }).map((_, index) => (
                <div key={index} className="w-1 h-3 bg-red-500 rounded-sm" />
              ))}
            </div>
          </div>
        )}

        {/* Inventory list */}
        <div className="bg-black/70 px-2 py-1 rounded border border-red-700/50 shadow-md whitespace-nowrap flex flex-col gap-0.5">
          {availableWeapons.map((weaponId, index) => (
            <div
              key={weaponId}
              className={`text-xs font-pixel-alt flex items-center gap-2 ${weaponId === currentWeapon ? "text-yellow-400" : "text-red-700"}`}
            >
              <span className={`w-4 h-4 flex items-center justify-center rounded-sm ${weaponId === currentWeapon ? "bg-yellow-600/80 text-black" : "bg-red-900/70 text-red-700"}`}>
                {index + 1}
              </span>
              <span>{weapons[weaponId]?.name || weaponId}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
