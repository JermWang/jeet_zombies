"use client"

import { useState, useEffect, useRef, useCallback } from "react"

interface PhysicsBody {
  id: number
  position: [number, number, number]
  velocity: [number, number, number]
  mass: number
  radius: number
  isStatic: boolean
}

interface PhysicsWorld {
  bodies: PhysicsBody[]
  gravity: [number, number, number]
  timeStep: number
}

interface UsePhysicsWorker {
  isReady: boolean
  bodies: PhysicsBody[]
  stepPhysics: (deltaTime?: number, playerPosition?: [number, number, number]) => void
  addBody: (bodyData: Omit<PhysicsBody, 'id'> & { type: string }) => number
  removeBody: (id: number) => void
  physicsStepTime: number
  updateBodyVelocity: (id: number, velocity: [number, number, number]) => void
}

export default function usePhysicsWorker() {
  const [isReady, setIsReady] = useState(false)
  const [bodies, setBodies] = useState<PhysicsBody[]>([])
  const workerRef = useRef<Worker | null>(null)
  const initialized = useRef(false)
  const nextBodyId = useRef(1)
  const lastStepTime = useRef(performance.now())
  const stepTimeRef = useRef(0)

  // Initialize physics worker
  useEffect(() => {
    // Skip if already initialized or running on server
    if (initialized.current || typeof window === 'undefined') return
    initialized.current = true

    try {
      // Create physics worker
      const worker = new Worker(new URL('../workers/physics.worker.ts', import.meta.url))
      
      // Set up message handler
      worker.onmessage = (event) => {
        const { type, bodies: updatedBodies, success, time } = event.data
        
        if (type === 'ready') {
          // Initialize physics world
          worker.postMessage({
            type: 'init',
            world: {
              gravity: [0, -20, 0],
              timeStep: 1/60
            }
          })
        }
        
        if (type === 'init' && success) {
          setIsReady(true)
        }
        
        if (type === 'step' && updatedBodies) {
          setBodies(updatedBodies)
          stepTimeRef.current = time || 0
          
          // Dispatch event with physics step time
          window.dispatchEvent(new CustomEvent('physicsStep', {
            detail: { time }
          }))
        }
      }
      
      // Handle worker errors
      worker.onerror = (error) => {
        console.error('Physics worker error:', error)
      }
      
      // Save worker reference
      workerRef.current = worker
      
      // Clean up worker on unmount
      return () => {
        worker.terminate()
        workerRef.current = null
      }
    } catch (error) {
      console.error('Failed to create physics worker:', error)
    }
  }, [])
  
  // Step physics simulation, now accepts optional player position
  const stepPhysics = useCallback((deltaTime?: number, playerPosition?: [number, number, number]) => {
    if (!workerRef.current || !isReady) return
    
    const now = performance.now()
    const dt = deltaTime || (now - lastStepTime.current) / 1000
    lastStepTime.current = now
    
    // Include player position in the step message if provided
    workerRef.current.postMessage({
      type: 'step',
      deltaTime: dt,
      ...(playerPosition && { playerPosition }) // Conditionally add playerPosition
    })
  }, [isReady])
  
  // Add a physics body
  const addBody = useCallback((bodyData: Omit<PhysicsBody, 'id'> & { type: string }) => {
    if (!workerRef.current || !isReady) return -1
    
    const id = nextBodyId.current++
    
    // Copy position to potentially modify it
    const position: [number, number, number] = [...bodyData.position];

    // Apply offset if it's a boss
    if (bodyData.type === 'zombie_boss') {
        console.log(`Applying physics Y-offset (-0.04) for boss ID: ${id}`);
        position[1] -= 0.04; // Adjust the Y-coordinate
    }

    // Create the final body object with the new ID and potentially modified position
    const newBody: PhysicsBody = {
      id: id,
      position: position, // Use the potentially adjusted position
      velocity: bodyData.velocity,
      mass: bodyData.mass,
      radius: bodyData.radius,
      isStatic: bodyData.isStatic,
    };
    
    workerRef.current.postMessage({
      type: 'addBody',
      body: newBody
    })
    
    return id // Return the generated physics body ID
  }, [isReady])
  
  // Remove a physics body
  const removeBody = useCallback((id: number) => {
    if (!workerRef.current || !isReady) return
    
    workerRef.current.postMessage({
      type: 'removeBody',
      id
    })
  }, [isReady])

  const updateBodyVelocity = useCallback((id: number, velocity: [number, number, number]) => {
    if (workerRef.current && isReady) {
      workerRef.current.postMessage({ type: 'updateVelocity', id, velocity });
    } else {
      console.warn("Physics worker not ready for velocity update");
    }
  }, [isReady])

  // Public API of the hook
  return { isReady, bodies, stepPhysics, addBody, removeBody, physicsStepTime: stepTimeRef.current, updateBodyVelocity };
}

// Remove the extraneous text below
// Let's update the Game component to include our ZombieAI and WorkerMonitor components:
