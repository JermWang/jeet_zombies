"use client"

import { useThree, useFrame } from "@react-three/fiber"
import { useRef, useEffect } from "react"
import { Vector3, type Object3D, type BufferGeometry } from "three"
import useGameStore from "@/hooks/useGameStore"

// This component implements level of detail (LOD) for better performance
export default function LevelOfDetail() {
  const { scene } = useThree()
  const { playerPosition } = useGameStore()

  // LOD distances
  const HIGH_DETAIL_DISTANCE = 15
  const MEDIUM_DETAIL_DISTANCE = 30

  // Store original geometries for LOD
  const originalGeometries = useRef(new Map<Object3D, BufferGeometry>())
  const simplifiedGeometries = useRef(new Map<Object3D, BufferGeometry>())
  const verySimplifiedGeometries = useRef(new Map<Object3D, BufferGeometry>())

  // LOD check interval
  const LOD_CHECK_INTERVAL = 30 // Only check LOD every N frames
  const frameCount = useRef(0)
  const objectsWithLOD = useRef<Object3D[]>([])

  // Initialize LOD geometries
  useEffect(() => {
    const objectsToProcess: Object3D[] = []

    // Find objects that can have LOD applied
    scene.traverse((object: any) => {
      if (object.isMesh && object.geometry && !object.userData?.noLOD) {
        // Skip player and zombies
        if (object.userData?.type === "player" || object.userData?.type === "zombie") return

        objectsToProcess.push(object)

        // Store original geometry
        originalGeometries.current.set(object, object.geometry)

        // Create simplified geometries
        // In a real implementation, we would use proper decimation algorithms
        // Here we're just storing references to the original for simplicity
        simplifiedGeometries.current.set(object, object.geometry)
        verySimplifiedGeometries.current.set(object, object.geometry)
      }
    })

    objectsWithLOD.current = objectsToProcess

    return () => {
      // Restore original geometries on unmount
      objectsWithLOD.current.forEach((object: any) => {
        const originalGeometry = originalGeometries.current.get(object)
        if (originalGeometry && object.geometry !== originalGeometry) {
          object.geometry = originalGeometry
        }
      })
    }
  }, [scene])

  // Apply LOD based on distance
  useFrame(() => {
    frameCount.current++

    // Only check LOD every N frames to improve performance
    if (frameCount.current % LOD_CHECK_INTERVAL !== 0 || !playerPosition) return

    // Player position for distance calculations
    const playerPos = new Vector3(playerPosition.x, playerPosition.y, playerPosition.z)

    // Update LOD for each object
    objectsWithLOD.current.forEach((object: any) => {
      if (!object.visible) return // Skip invisible objects

      // Get object position
      const objectPos = new Vector3()
      object.getWorldPosition(objectPos)

      // Calculate distance
      const distance = playerPos.distanceTo(objectPos)

      // Apply appropriate LOD based on distance
      if (distance <= HIGH_DETAIL_DISTANCE) {
        // High detail - use original geometry
        const originalGeometry = originalGeometries.current.get(object)
        if (originalGeometry && object.geometry !== originalGeometry) {
          object.geometry = originalGeometry
        }
      } else if (distance <= MEDIUM_DETAIL_DISTANCE) {
        // Medium detail
        const mediumGeometry = simplifiedGeometries.current.get(object)
        if (mediumGeometry && object.geometry !== mediumGeometry) {
          object.geometry = mediumGeometry
        }
      } else {
        // Low detail
        const lowGeometry = verySimplifiedGeometries.current.get(object)
        if (lowGeometry && object.geometry !== lowGeometry) {
          object.geometry = lowGeometry
        }
      }
    })
  })

  return null
}
