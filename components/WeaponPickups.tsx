"use client"

import { useRef, useState, useEffect } from "react"
import { useFrame } from "@react-three/fiber"
import { Vector3 } from "three"
import useGameStore from "@/hooks/useGameStore"
import useWeaponStore from "@/hooks/useWeaponStore"
import useSoundEffects from "@/hooks/useSoundEffects"

interface WeaponPickup {
  id: string
  position: Vector3
  weaponId: string
  rotationSpeed: number
  bobSpeed: number
  bobHeight: number
  collected: boolean
}

export default function WeaponPickups() {
  const { isGameOver, gameStarted, playerPosition } = useGameStore()
  const { pickupWeapon, availableWeapons } = useWeaponStore()
  const { playSound } = useSoundEffects(false)

  // Create weapon pickups
  const [pickups, setPickups] = useState<WeaponPickup[]>([
    {
      id: "pickup-shotgun",
      position: new Vector3(5, 1, 5),
      weaponId: "shotgun",
      rotationSpeed: 1,
      bobSpeed: 1.5,
      bobHeight: 0.3,
      collected: false,
    },
    {
      id: "pickup-smg",
      position: new Vector3(-5, 1, 5),
      weaponId: "smg",
      rotationSpeed: 1.2,
      bobSpeed: 1.8,
      bobHeight: 0.25,
      collected: false,
    },
    {
      id: "pickup-rifle",
      position: new Vector3(0, 1, -10),
      weaponId: "rifle",
      rotationSpeed: 0.8,
      bobSpeed: 1.2,
      bobHeight: 0.35,
      collected: false,
    },
  ])

  // References for pickup models
  const pickupRefs = useRef<{ [key: string]: any }>({})

  // Animate pickups
  useFrame((state, delta) => {
    if (isGameOver || !gameStarted) return

    // Animate each pickup
    pickups.forEach((pickup) => {
      if (pickup.collected) return

      const ref = pickupRefs.current[pickup.id]
      if (!ref) return

      // Rotate the pickup
      ref.rotation.y += pickup.rotationSpeed * delta

      // Bob up and down
      const time = state.clock.elapsedTime
      ref.position.y = pickup.position.y + Math.sin(time * pickup.bobSpeed) * pickup.bobHeight

      // Check for player collision if player position exists
      if (playerPosition) {
        const distance = playerPosition.distanceTo(pickup.position)

        // If player is close enough, collect the weapon
        if (distance < 2 && !pickup.collected && !availableWeapons.includes(pickup.weaponId)) {
          setPickups((prev) => prev.map((p) => (p.id === pickup.id ? { ...p, collected: true } : p)))

          // Add weapon to player's inventory
          pickupWeapon(pickup.weaponId)

          // Play pickup sound
          playSound("weaponSwitch")
        }
      }
    })
  })

  // Reset pickups when game restarts
  useEffect(() => {
    if (!gameStarted) {
      setPickups((prev) => prev.map((pickup) => ({ ...pickup, collected: false })))
    }
  }, [gameStarted])

  return (
    <>
      {pickups.map(
        (pickup) =>
          !pickup.collected && (
            <group
              key={pickup.id}
              ref={(el) => (pickupRefs.current[pickup.id] = el)}
              position={pickup.position.toArray()}
            >
              {/* Weapon model based on type */}
              {pickup.weaponId === "shotgun" && (
                <>
                  {/* Main barrel */}
                  <mesh castShadow>
                    <boxGeometry args={[0.15, 0.15, 1.2]} />
                    <meshStandardMaterial color="#222222" metalness={0.7} roughness={0.3} />
                  </mesh>

                  {/* Second barrel */}
                  <mesh castShadow position={[0, -0.15, 0]}>
                    <boxGeometry args={[0.15, 0.15, 1.2]} />
                    <meshStandardMaterial color="#222222" metalness={0.7} roughness={0.3} />
                  </mesh>

                  {/* Shotgun barrel */}
                  <mesh castShadow position={[0, 0, 0.7]}>
                    <cylinderGeometry args={[0.08, 0.08, 0.6, 8]} rotation={[Math.PI / 2, 0, 0]} />
                    <meshStandardMaterial color="#333333" metalness={0.8} roughness={0.2} />
                  </mesh>

                  {/* Shotgun handle */}
                  <mesh castShadow position={[0, -0.2, -0.3]} rotation={[0.5, 0, 0]}>
                    <boxGeometry args={[0.12, 0.4, 0.15]} />
                    <meshStandardMaterial color="#3d2817" metalness={0.2} roughness={0.8} />
                  </mesh>

                  {/* Shotgun pump */}
                  <mesh castShadow position={[0, -0.1, 0.2]}>
                    <boxGeometry args={[0.18, 0.1, 0.4]} />
                    <meshStandardMaterial color="#3d2817" metalness={0.2} roughness={0.8} />
                  </mesh>
                </>
              )}
              {pickup.weaponId === "smg" && (
                <>
                  {/* SMG body */}
                  <mesh castShadow>
                    <boxGeometry args={[0.12, 0.2, 0.8]} />
                    <meshStandardMaterial color="#111111" metalness={0.8} roughness={0.2} />
                  </mesh>

                  {/* SMG barrel */}
                  <mesh castShadow position={[0, 0, 0.5]}>
                    <cylinderGeometry args={[0.04, 0.04, 0.5, 8]} rotation={[Math.PI / 2, 0, 0]} />
                    <meshStandardMaterial color="#222222" metalness={0.9} roughness={0.1} />
                  </mesh>

                  {/* SMG handle */}
                  <mesh castShadow position={[0, -0.25, 0]} rotation={[0.4, 0, 0]}>
                    <boxGeometry args={[0.1, 0.3, 0.15]} />
                    <meshStandardMaterial color="#111111" metalness={0.7} roughness={0.3} />
                  </mesh>

                  {/* SMG magazine */}
                  <mesh castShadow position={[0, -0.15, -0.2]}>
                    <boxGeometry args={[0.1, 0.25, 0.15]} />
                    <meshStandardMaterial color="#333333" metalness={0.6} roughness={0.4} />
                  </mesh>

                  {/* SMG stock */}
                  <mesh castShadow position={[0, 0, -0.4]}>
                    <boxGeometry args={[0.1, 0.15, 0.3]} />
                    <meshStandardMaterial color="#111111" metalness={0.7} roughness={0.3} />
                  </mesh>
                </>
              )}
              {pickup.weaponId === "rifle" && (
                <>
                  {/* Rifle body */}
                  <mesh castShadow>
                    <boxGeometry args={[0.15, 0.15, 1.4]} />
                    <meshStandardMaterial color="#111111" metalness={0.8} roughness={0.2} />
                  </mesh>

                  {/* Rifle barrel */}
                  <mesh castShadow position={[0, 0, 0.8]}>
                    <cylinderGeometry args={[0.05, 0.05, 0.7, 8]} rotation={[Math.PI / 2, 0, 0]} />
                    <meshStandardMaterial color="#222222" metalness={0.9} roughness={0.1} />
                  </mesh>

                  {/* Rifle handle */}
                  <mesh castShadow position={[0, -0.2, -0.2]} rotation={[0.5, 0, 0]}>
                    <boxGeometry args={[0.12, 0.4, 0.15]} />
                    <meshStandardMaterial color="#3d2817" metalness={0.2} roughness={0.8} />
                  </mesh>

                  {/* Rifle magazine */}
                  <mesh castShadow position={[0, -0.2, 0]}>
                    <boxGeometry args={[0.12, 0.3, 0.15]} />
                    <meshStandardMaterial color="#333333" metalness={0.6} roughness={0.4} />
                  </mesh>

                  {/* Rifle scope */}
                  <mesh castShadow position={[0, 0.15, 0.2]}>
                    <cylinderGeometry args={[0.06, 0.06, 0.3, 8]} rotation={[Math.PI / 2, 0, 0]} />
                    <meshStandardMaterial color="#222222" metalness={0.9} roughness={0.1} />
                  </mesh>

                  {/* Rifle scope lens - reduced emissive intensity */}
                  <mesh position={[0, 0.15, 0.35]}>
                    <sphereGeometry args={[0.06, 8, 8]} />
                    <meshStandardMaterial color="#3333ff" emissive="#0000ff" emissiveIntensity={0.2} />{" "}
                    {/* Reduced from 0.5 */}
                  </mesh>
                </>
              )}
              {/* Glow effect - reduced intensity */}
              <pointLight color="#ff3300" intensity={0.5} distance={3} /> {/* Reduced from 1 */}
              {/* Floating label */}
              <mesh position={[0, 1, 0]}>
                <planeGeometry args={[1, 0.3]} />
                <meshBasicMaterial color="#000000" transparent opacity={0.7} />
              </mesh>
              {/* Label text */}
              <mesh position={[0, 1, 0.01]}>
                <planeGeometry args={[0.9, 0.2]} />
                <meshBasicMaterial color="#ff3300" transparent opacity={0.7} /> {/* Reduced from 0.9 */}
              </mesh>
            </group>
          ),
      )}
    </>
  )
}
