"use client"

import { useState, useEffect } from "react"
import { useThree } from "@react-three/fiber"
import { Vector3 } from "@/utils/three-singleton"
import * as THREE from "three"

export default function ShootingDebug() {
  const [debugInfo, setDebugInfo] = useState({
    lastShootPosition: new Vector3(),
    lastShootDirection: new Vector3(),
    shootCount: 0,
    bulletCount: 0,
  })

  const { camera } = useThree()

  useEffect(() => {
    // Listen for player shoot events
    const handlePlayerShoot = (e: CustomEvent) => {
      const { position, direction } = e.detail

      setDebugInfo((prev) => ({
        ...prev,
        lastShootPosition: position ? position.clone() : prev.lastShootPosition,
        lastShootDirection: direction ? direction.clone() : prev.lastShootDirection,
        shootCount: prev.shootCount + 1,
      }))

      // Create a visible debug line
      const lineStart = position.clone()
      const lineEnd = position.clone().add(direction.clone().multiplyScalar(10))

      // Create a temporary line object
      const lineGeometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(lineStart.x, lineStart.y, lineStart.z),
        new THREE.Vector3(lineEnd.x, lineEnd.y, lineEnd.z),
      ])

      const lineMaterial = new THREE.LineBasicMaterial({
        color: 0xff0000,
        linewidth: 3,
      })

      const line = new THREE.Line(lineGeometry, lineMaterial)
      line.userData.debugLine = true

      // Add to scene
      const scene = camera.parent
      if (scene) {
        scene.add(line)

        // Remove after 1 second
        setTimeout(() => {
          scene.remove(line)
          line.geometry.dispose()
          line.material.dispose()
        }, 1000)
      }
    }

    window.addEventListener("playerShoot", handlePlayerShoot as EventListener)

    return () => {
      window.removeEventListener("playerShoot", handlePlayerShoot as EventListener)
    }
  }, [camera])

  return null // This component doesn't render anything visible
}
