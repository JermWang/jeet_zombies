"use client"

import { useThree, useFrame } from "@react-three/fiber"
import { useRef, useEffect } from "react"
import { Vector3, type Object3D, Frustum, Matrix4 } from "three"
import useGameStore from "@/hooks/useGameStore"

// This component implements distance and frustum culling to improve performance
export default function ObjectCulling() {
  const { scene, camera } = useThree()
  const { playerPosition } = useGameStore()

  // Create a frustum for view culling
  const frustum = useRef(new Frustum())
  const projScreenMatrix = useRef(new Matrix4())

  // Culling distances
  const CULL_DISTANCE = 40 // Objects beyond this distance will be culled
  const CULL_CHECK_INTERVAL = 15 // Only check culling every N frames
  const frameCount = useRef(0)

  // Store original visibility state
  const originalVisibility = useRef(new Map<Object3D, boolean>())
  const objectsToCheck = useRef<Object3D[]>([])

  // Initialize visibility map and collect objects to check
  useEffect(() => {
    const objectsToTrack: Object3D[] = []

    scene.traverse((object) => {
      // Only track mesh objects
      if ((object as any).isMesh) {
        // Skip player and zombie objects (we always want them visible)
        if (object.userData?.type === "player" || object.userData?.type === "zombie") return

        objectsToTrack.push(object)
        originalVisibility.current.set(object, object.visible)
      }
    })

    objectsToCheck.current = objectsToTrack

    return () => {
      // Restore visibility on unmount
      originalVisibility.current.forEach((visible, object) => {
        if (object && object.visible !== visible) {
          object.visible = visible
        }
      })
    }
  }, [scene])

  // Perform culling on each frame
  useFrame(() => {
    frameCount.current++

    // Only check culling every N frames to improve performance
    if (frameCount.current % CULL_CHECK_INTERVAL !== 0 || !playerPosition) return

    // Update the frustum
    projScreenMatrix.current.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
    frustum.current.setFromProjectionMatrix(projScreenMatrix.current)

    // Player position for distance culling
    const playerPos = new Vector3(playerPosition.x, playerPosition.y, playerPosition.z)

    // Check each object for culling
    objectsToCheck.current.forEach((object) => {
      // Get object position
      const objectPos = new Vector3()
      object.getWorldPosition(objectPos)

      // Distance culling
      const distance = playerPos.distanceTo(objectPos)

      // If object is too far away, hide it
      if (distance > CULL_DISTANCE) {
        object.visible = false
        return
      }

      // Frustum culling - only check if object is within distance
      const inFrustum = frustum.current.containsPoint(objectPos)

      // Set visibility based on frustum test
      object.visible = inFrustum
    })
  })

  return null
}
