"use client"

import { useState, useEffect } from "react"
import useWeaponStore from "@/hooks/useWeaponStore"
import weapons from "@/data/weapons"

export default function GunUI() {
  const { currentWeapon, ammo, isReloading, availableWeapons } = useWeaponStore()
  const currentAmmo = ammo[currentWeapon]
  const weaponData = weapons[currentWeapon]

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
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-6">
      {/* Top Left: Current Weapon Name & Inventory */}
      <div className="flex flex-col items-start">
        {/* Current Weapon */}
        <div className={`text-${primaryTextColor} font-pixel text-xl bg-${backgroundColor} px-3 py-1.5 rounded border-2 border-${accentColor} shadow-lg w-min whitespace-nowrap mb-1`}>
          {weaponData.name}
        </div>
        {/* Inventory List */}
        <div className={`bg-${backgroundColor} px-2 py-1 rounded border border-red-700/50 shadow-md w-min whitespace-nowrap flex flex-col gap-0.5`}>
          {availableWeapons.map((weaponId, index) => (
            <div
              key={weaponId}
              className={`
                text-xs font-pixel-alt flex items-center gap-2
                ${weaponId === currentWeapon ? `text-yellow-400` : `text-${secondaryTextColor}`}
              `}
            >
              <span className={`
                  w-4 h-4 flex items-center justify-center rounded-sm
                  ${weaponId === currentWeapon ? 'bg-yellow-600/80 text-black' : `bg-red-900/70 text-${secondaryTextColor}`}
                `}
              >
                {index + 1}
              </span>
              <span>{weapons[weaponId]?.name || weaponId}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Center: Crosshair - Thicker, solid red */}
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
        <div className="w-6 h-6 flex items-center justify-center">
          {/* Center dot - slightly larger - Remove shadow */}
          <div className={`w-1.5 h-1.5 bg-red-500 rounded-full`}></div> 
          {/* Horizontal line - Use h-1 for thicker line */}
          <div className={`absolute w-5 h-1 bg-red-500`}></div> 
          {/* Vertical line - Use w-1 for thicker line */}
          <div className={`absolute w-1 h-5 bg-red-500`}></div> 
        </div>
      </div>

      {/* Bottom Right: Ammo Count & Reload Status - Red text */}
      <div className="self-end text-right">
        {isReloading ? (
          <div className={`text-${primaryTextColor} font-pixel font-bold text-2xl animate-pulse bg-${backgroundColor} px-4 py-2 rounded border-2 border-${accentColor} shadow-lg`}>
            RELOADING...
          </div>
        ) : (
          // Container for numeric count and visual bullets
          <div className={`bg-${backgroundColor} px-4 py-2 rounded border-2 border-${accentColor} shadow-lg flex flex-col items-end`}>
            {/* Numeric Count */}
            <div className={`text-${primaryTextColor} font-pixel text-3xl`}>
              {currentAmmo.current}
              <span className={`font-pixel-alt text-xl text-${secondaryTextColor}`}> / {currentAmmo.reserve}</span>
            </div>
            {/* Visual Bullets Container */}
            <div className="flex flex-wrap justify-end gap-1 mt-2 max-w-[120px]"> 
              {Array.from({ length: currentAmmo.current }).map((_, index) => (
                <div key={index} className={`w-1 h-3 bg-${primaryTextColor} rounded-sm`} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
