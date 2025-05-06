// Physics worker for offloading physics calculations

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

interface PhysicsRequest {
  type: "init" | "step" | "addBody" | "removeBody" | "updateBody"
  id?: number
  world?: Partial<PhysicsWorld>
  body?: PhysicsBody
  bodies?: PhysicsBody[]
  deltaTime?: number
  playerPosition?: [number, number, number]
}

// Initialize physics world
let world: PhysicsWorld = {
  bodies: [],
  gravity: [0, -9.8, 0],
  timeStep: 1 / 60,
}

// Store player position within the worker
let latestPlayerPosition: [number, number, number] | null = null;

// Configurable speed for zombies
const ZOMBIE_MOVE_SPEED = 1.5; // Example speed, can be adjusted

// Simple collision detection
function checkCollision(a: PhysicsBody, b: PhysicsBody): boolean {
  const dx = a.position[0] - b.position[0]
  const dy = a.position[1] - b.position[1]
  const dz = a.position[2] - b.position[2]
  const distance = Math.sqrt(dx * dx + dy * dy + dz * dz)
  return distance < a.radius + b.radius
}

// Simple physics step
function stepPhysics(deltaTime: number): PhysicsBody[] {
  const dt = deltaTime || world.timeStep

  for (const body of world.bodies) {
    if (body.isStatic) continue

    // Apply gravity
    body.velocity[1] += world.gravity[1] * dt

    // --- Add Movement towards Player --- 
    if (latestPlayerPosition) {
        // Calculate direction towards player (horizontal only)
        const dx = latestPlayerPosition[0] - body.position[0];
        const dz = latestPlayerPosition[2] - body.position[2];
        const distance = Math.sqrt(dx * dx + dz * dz);
        
        if (distance > 0.1) { // Avoid division by zero and jittering when close
            const dirX = dx / distance;
            const dirZ = dz / distance;
            
            // Set horizontal velocity towards player
            body.velocity[0] = dirX * ZOMBIE_MOVE_SPEED;
            body.velocity[2] = dirZ * ZOMBIE_MOVE_SPEED;
        } else {
            // Stop horizontal movement if very close
             body.velocity[0] = 0;
             body.velocity[2] = 0;
        }
    } else {
        // No player position yet, maybe stop?
        body.velocity[0] = 0;
        body.velocity[2] = 0;
    }
    // ----------------------------------

    // Update position based on total velocity
    body.position[0] += body.velocity[0] * dt
    body.position[1] += body.velocity[1] * dt
    body.position[2] += body.velocity[2] * dt

    // Simple ground collision
    if (body.position[1] < body.radius) {
      body.position[1] = body.radius
      body.velocity[1] = -body.velocity[1] * 0.5 // Bounce with damping
    }
  }

  // Check for collisions between bodies
  const collisions: [number, number][] = []

  for (let i = 0; i < world.bodies.length; i++) {
    for (let j = i + 1; j < world.bodies.length; j++) {
      const bodyA = world.bodies[i]
      const bodyB = world.bodies[j]

      // Skip if either body is static
      if (bodyA.isStatic && bodyB.isStatic) continue

      if (checkCollision(bodyA, bodyB)) {
        collisions.push([bodyA.id, bodyB.id])

        // Simple collision response
        if (!bodyA.isStatic && !bodyB.isStatic) {
          // Calculate collision normal
          const dx = bodyB.position[0] - bodyA.position[0]
          const dy = bodyB.position[1] - bodyA.position[1]
          const dz = bodyB.position[2] - bodyA.position[2]
          const distance = Math.sqrt(dx * dx + dy * dy + dz * dz)

          if (distance === 0) continue // Avoid division by zero

          const nx = dx / distance
          const ny = dy / distance
          const nz = dz / distance

          // Calculate relative velocity
          const rvx = bodyB.velocity[0] - bodyA.velocity[0]
          const rvy = bodyB.velocity[1] - bodyA.velocity[1]
          const rvz = bodyB.velocity[2] - bodyA.velocity[2]

          // Calculate relative velocity along normal
          const velAlongNormal = rvx * nx + rvy * ny + rvz * nz

          // Do not resolve if velocities are separating
          if (velAlongNormal > 0) continue

          // Calculate restitution (bounciness)
          const restitution = 0.2

          // Calculate impulse scalar
          const impulseScalar = -(1 + restitution) * velAlongNormal
          const totalMass = bodyA.mass + bodyB.mass

          // Apply impulse
          const impulse = impulseScalar / totalMass

          bodyA.velocity[0] -= impulse * bodyB.mass * nx
          bodyA.velocity[1] -= impulse * bodyB.mass * ny
          bodyA.velocity[2] -= impulse * bodyB.mass * nz

          bodyB.velocity[0] += impulse * bodyA.mass * nx
          bodyB.velocity[1] += impulse * bodyA.mass * ny
          bodyB.velocity[2] += impulse * bodyA.mass * nz

          // Correct position to prevent sinking
          const percent = 0.2 // Penetration percentage to correct
          const correction = (Math.max(0, bodyA.radius + bodyB.radius - distance) / totalMass) * percent

          bodyA.position[0] -= correction * bodyB.mass * nx
          bodyA.position[1] -= correction * bodyB.mass * ny
          bodyA.position[2] -= correction * bodyB.mass * nz

          bodyB.position[0] += correction * bodyA.mass * nx
          bodyB.position[1] += correction * bodyA.mass * ny
          bodyB.position[2] += correction * bodyA.mass * nz
        }
      }
    }
  }

  return world.bodies
}

// Handle messages from main thread
self.onmessage = (event: MessageEvent<PhysicsRequest>) => {
  const { type, id, world: worldUpdate, body, bodies, deltaTime, playerPosition } = event.data

  try {
    switch (type) {
      case "init":
        if (worldUpdate) {
          world = { ...world, ...worldUpdate }
        }
        console.log("[Worker] Initialized world:", world);
        self.postMessage({ type: "init", success: true })
        break

      case "step":
        // Update player position if included in the step message
        if (playerPosition) {
            latestPlayerPosition = playerPosition;
        }
        // Now step the physics, providing a fallback for deltaTime
        const updatedBodies = stepPhysics(deltaTime ?? world.timeStep)

        self.postMessage({
          type: "step",
          bodies: updatedBodies,
        })
        break

      case "addBody":
        if (body) {
          world.bodies.push(body)
          console.log(`[Worker] Added body ID: ${body.id}. Current body IDs:`, world.bodies.map(b => b.id));
          self.postMessage({ type: "addBody", id: body.id, success: true })
        } else {
            console.warn("[Worker] Received addBody request without body data.");
             self.postMessage({ type: "addBody", success: false, error: "No body data provided" });
        }
        break

      case "removeBody":
        if (id !== undefined) {
          const initialLength = world.bodies.length;
          world.bodies = world.bodies.filter((b) => b.id !== id)
          const success = world.bodies.length < initialLength;
           console.log(`[Worker] Attempted remove body ID: ${id}. Success: ${success}. Current body IDs:`, world.bodies.map(b => b.id));
          self.postMessage({ type: "removeBody", id, success: success })
        } else {
            console.warn("[Worker] Received removeBody request without ID.");
            self.postMessage({ type: "removeBody", success: false, error: "No ID provided" });
        }
        break

      case "updateBody":
        if (body) {
          const index = world.bodies.findIndex((b) => b.id === body.id)
          if (index !== -1) {
            world.bodies[index] = body
            console.log(`[Worker] Updated body ID: ${body.id}`);
            self.postMessage({ type: "updateBody", id: body.id, success: true })
          } else {
            console.warn(`[Worker] Received updateBody request for unknown ID: ${body.id}`);
            self.postMessage({ type: "updateBody", id: body.id, success: false, error: "Body ID not found" });
          }
        } else {
           console.warn("[Worker] Received updateBody request without body data.");
           self.postMessage({ type: "updateBody", success: false, error: "No body data provided" });
        }
        break
    }
  } catch (error) {
    console.error("[Worker] Error processing message:", type, error);
    self.postMessage({
      type,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

// Let the main thread know we're ready
console.log("[Worker] Worker script loaded, posting ready message.");
self.postMessage({ type: "ready" })
