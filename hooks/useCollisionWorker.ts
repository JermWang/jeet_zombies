"use client"

import { useState, useEffect, useRef, useCallback } from "react"

// Define types for collision objects
interface CollisionObject {
  id: number
  type: string
  position: [number, number, number]
  radius: number
  velocity?: [number, number, number]
  static?: boolean
}

// Define collision pair
interface CollisionPair {
  a: CollisionObject
  b: CollisionObject
  distance: number
}

// Define raycast hit
interface RaycastHit {
  object: CollisionObject
  distance: number
  point: [number, number, number]
}

export default function useCollisionWorker() {
  const [isReady, setIsReady] = useState(false)
  const [objectCount, setObjectCount] = useState(0)
  const [lastDetectionTime, setLastDetectionTime] = useState(0)
  const workerRef = useRef<Worker | null>(null)
  const initialized = useRef(false)
  const nextObjectId = useRef(1)
  const objectsRef = useRef<Map<number, CollisionObject>>(new Map())
  const lastCollisions = useRef<CollisionPair[]>([])

  // Initialize collision worker
  useEffect(() => {
    // Skip if already initialized or running on server
    if (initialized.current || typeof window === "undefined") return
    initialized.current = true

    try {
      // Create collision worker
      const worker = new Worker(new URL("../workers/collision.worker.ts", import.meta.url))

      // Set up message handler
      worker.onmessage = (event) => {
        const { type, success, collisions, objectCount, time, hit } = event.data

        if (type === "ready") {
          // Initialize collision system
          worker.postMessage({
            type: "init",
            data: {
              cellSize: 5, // 5 unit grid cells
            },
          })
        }

        if (type === "init" && success) {
          setIsReady(true)
        }

        if (type === "detect" && collisions) {
          lastCollisions.current = collisions
          setObjectCount(objectCount || 0)
          setLastDetectionTime(time || 0)

          // Dispatch event with collision data
          window.dispatchEvent(
            new CustomEvent("collisionDetected", {
              detail: { collisions, time },
            }),
          )
        }

        if (type === "detectTypes" && collisions) {
          // Dispatch event with typed collision data
          window.dispatchEvent(
            new CustomEvent("typedCollisionDetected", {
              detail: {
                typeA: event.data.typeA,
                typeB: event.data.typeB,
                collisions,
                time,
              },
            }),
          )
        }

        if (type === "raycast" && hit !== undefined) {
          // Dispatch event with raycast result
          window.dispatchEvent(
            new CustomEvent("raycastResult", {
              detail: {
                hit,
                time,
                id: event.data.id,
              },
            }),
          )
        }
      }

      // Handle worker errors
      worker.onerror = (error) => {
        console.error("Collision worker error:", error)
      }

      // Save worker reference
      workerRef.current = worker

      // Clean up worker on unmount
      return () => {
        worker.terminate()
        workerRef.current = null
      }
    } catch (error) {
      console.error("Failed to create collision worker:", error)
    }
  }, [])

  // Add object to collision system
  const addObject = useCallback(
    (object: Omit<CollisionObject, "id">): number => {
      if (!workerRef.current || !isReady) return -1

      const id = nextObjectId.current++
      const newObject = { ...object, id }

      // Store object locally
      objectsRef.current.set(id, newObject)

      // Send to worker
      workerRef.current.postMessage({
        type: "add",
        data: newObject,
      })

      return id
    },
    [isReady],
  )

  // Update object position
  const updateObject = useCallback(
    (id: number, position: [number, number, number], velocity?: [number, number, number]) => {
      if (!workerRef.current || !isReady || !objectsRef.current.has(id)) return

      // Update local object
      const object = objectsRef.current.get(id)!
      object.position = position
      if (velocity) {
        object.velocity = velocity
      }

      // Send to worker
      workerRef.current.postMessage({
        type: "update",
        data: {
          id,
          position,
          velocity,
        },
      })
    },
    [isReady],
  )

  // Remove object from collision system
  const removeObject = useCallback(
    (id: number) => {
      if (!workerRef.current || !isReady) return

      // Remove from local storage
      objectsRef.current.delete(id)

      // Send to worker
      workerRef.current.postMessage({
        type: "remove",
        data: { id },
      })
    },
    [isReady],
  )

  // Detect all collisions
  const detectCollisions = useCallback(() => {
    if (!workerRef.current || !isReady) return []

    workerRef.current.postMessage({
      type: "detect",
    })

    return lastCollisions.current
  }, [isReady])

  // Detect collisions between specific types
  const detectTypeCollisions = useCallback(
    (typeA: string, typeB: string) => {
      if (!workerRef.current || !isReady) return []

      workerRef.current.postMessage({
        type: "detectTypes",
        data: {
          typeA,
          typeB,
        },
      })

      return []
    },
    [isReady],
  )

  // Perform raycast
  const raycast = useCallback(
    (
      origin: [number, number, number],
      direction: [number, number, number],
      maxDistance: number,
      objectType?: string,
    ): Promise<RaycastHit | null> => {
      if (!workerRef.current || !isReady) return Promise.resolve(null)

      return new Promise((resolve) => {
        const id = Date.now()

        // Set up one-time event listener for this raycast
        const handleRaycastResult = (e: CustomEvent) => {
          if (e.detail.id === id) {
            window.removeEventListener("raycastResult", handleRaycastResult as EventListener)
            resolve(e.detail.hit)
          }
        }

        window.addEventListener("raycastResult", handleRaycastResult as EventListener)

        // Send raycast request
        workerRef.current.postMessage({
          type: "raycast",
          id,
          data: {
            origin,
            direction,
            maxDistance,
            objectType,
          },
        })
      })
    },
    [isReady],
  )

  return {
    isReady,
    objectCount,
    lastDetectionTime,
    addObject,
    updateObject,
    removeObject,
    detectCollisions,
    detectTypeCollisions,
    raycast,
  }
}
