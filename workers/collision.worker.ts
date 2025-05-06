// Dedicated worker for collision detection

// Define types for collision objects
interface CollisionObject {
  id: number
  type: string
  position: [number, number, number]
  radius: number
  velocity?: [number, number, number]
  static?: boolean
}

// Define spatial grid for efficient collision detection
interface SpatialGrid {
  cellSize: number
  cells: Map<string, CollisionObject[]>
}

// Define collision pair
interface CollisionPair {
  a: CollisionObject
  b: CollisionObject
  distance: number
}

// Create spatial grid for efficient collision detection
const grid: SpatialGrid = {
  cellSize: 5, // Size of each grid cell
  cells: new Map(),
}

// Store all objects for collision detection
const objects: Map<number, CollisionObject> = new Map()

// Get cell key for position
function getCellKey(x: number, y: number, z: number): string {
  const cellX = Math.floor(x / grid.cellSize)
  const cellY = Math.floor(y / grid.cellSize)
  const cellZ = Math.floor(z / grid.cellSize)
  return `${cellX},${cellY},${cellZ}`
}

// Add object to spatial grid
function addToGrid(object: CollisionObject): void {
  const [x, y, z] = object.position
  const cellKey = getCellKey(x, y, z)

  if (!grid.cells.has(cellKey)) {
    grid.cells.set(cellKey, [])
  }

  grid.cells.get(cellKey)!.push(object)
}

// Remove object from spatial grid
function removeFromGrid(object: CollisionObject): void {
  const [x, y, z] = object.position
  const cellKey = getCellKey(x, y, z)

  if (grid.cells.has(cellKey)) {
    const cell = grid.cells.get(cellKey)!
    const index = cell.findIndex((obj) => obj.id === object.id)

    if (index !== -1) {
      cell.splice(index, 1)
    }

    if (cell.length === 0) {
      grid.cells.delete(cellKey)
    }
  }
}

// Update object position in grid
function updateObjectInGrid(object: CollisionObject): void {
  // Remove from old position
  removeFromGrid(object)

  // Add to new position
  addToGrid(object)
}

// Get neighboring cells for a position
function getNeighboringCells(x: number, y: number, z: number): string[] {
  const cellX = Math.floor(x / grid.cellSize)
  const cellY = Math.floor(y / grid.cellSize)
  const cellZ = Math.floor(z / grid.cellSize)

  const neighbors: string[] = []

  // Check 3x3x3 grid of cells around the position
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dz = -1; dz <= 1; dz++) {
        neighbors.push(`${cellX + dx},${cellY + dy},${cellZ + dz}`)
      }
    }
  }

  return neighbors
}

// Get potential collision candidates for an object
function getPotentialCollisions(object: CollisionObject): CollisionObject[] {
  const [x, y, z] = object.position
  const neighboringCells = getNeighboringCells(x, y, z)

  const candidates: CollisionObject[] = []

  for (const cellKey of neighboringCells) {
    if (grid.cells.has(cellKey)) {
      const cellObjects = grid.cells.get(cellKey)!

      for (const obj of cellObjects) {
        // Don't check against self
        if (obj.id !== object.id) {
          candidates.push(obj)
        }
      }
    }
  }

  return candidates
}

// Check if two objects are colliding
function checkCollision(a: CollisionObject, b: CollisionObject): boolean {
  const dx = a.position[0] - b.position[0]
  const dy = a.position[1] - b.position[1]
  const dz = a.position[2] - b.position[2]

  const distanceSquared = dx * dx + dy * dy + dz * dz
  const radiusSum = a.radius + b.radius

  return distanceSquared <= radiusSum * radiusSum
}

// Detect all collisions in the scene
function detectCollisions(): CollisionPair[] {
  const collisions: CollisionPair[] = []
  const checkedPairs = new Set<string>()

  // Check each object against potential collisions
  for (const object of objects.values()) {
    const candidates = getPotentialCollisions(object)

    for (const candidate of candidates) {
      // Create a unique key for this pair to avoid checking twice
      const pairKey = object.id < candidate.id ? `${object.id}-${candidate.id}` : `${candidate.id}-${object.id}`

      // Skip if we've already checked this pair
      if (checkedPairs.has(pairKey)) {
        continue
      }

      checkedPairs.add(pairKey)

      // Check for collision
      if (checkCollision(object, candidate)) {
        // Calculate distance for collision response
        const dx = candidate.position[0] - object.position[0]
        const dy = candidate.position[1] - object.position[1]
        const dz = candidate.position[2] - object.position[2]
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz)

        collisions.push({
          a: object,
          b: candidate,
          distance,
        })
      }
    }
  }

  return collisions
}

// Detect collisions for specific types
function detectTypeCollisions(typeA: string, typeB: string): CollisionPair[] {
  const collisions: CollisionPair[] = []

  // Get all objects of typeA
  const objectsA = Array.from(objects.values()).filter((obj) => obj.type === typeA)

  // Get all objects of typeB
  const objectsB = Array.from(objects.values()).filter((obj) => obj.type === typeB)

  // Check each object of typeA against each object of typeB
  for (const objA of objectsA) {
    for (const objB of objectsB) {
      if (checkCollision(objA, objB)) {
        // Calculate distance for collision response
        const dx = objB.position[0] - objA.position[0]
        const dy = objB.position[1] - objA.position[1]
        const dz = objB.position[2] - objA.position[2]
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz)

        collisions.push({
          a: objA,
          b: objB,
          distance,
        })
      }
    }
  }

  return collisions
}

// Handle messages from main thread
self.onmessage = (event) => {
  const { type, data } = event.data

  switch (type) {
    case "init":
      // Initialize grid with custom cell size if provided
      if (data && data.cellSize) {
        grid.cellSize = data.cellSize
      }

      // Clear existing data
      grid.cells.clear()
      objects.clear()

      self.postMessage({ type: "init", success: true })
      break

    case "add":
      // Add object to collision system
      if (data) {
        objects.set(data.id, data)
        addToGrid(data)

        self.postMessage({
          type: "add",
          id: data.id,
          success: true,
        })
      }
      break

    case "update":
      // Update object position
      if (data && objects.has(data.id)) {
        const object = objects.get(data.id)!

        // Update position
        object.position = data.position

        // Update velocity if provided
        if (data.velocity) {
          object.velocity = data.velocity
        }

        // Update in grid
        updateObjectInGrid(object)

        self.postMessage({
          type: "update",
          id: data.id,
          success: true,
        })
      }
      break

    case "remove":
      // Remove object from collision system
      if (data && data.id !== undefined && objects.has(data.id)) {
        const object = objects.get(data.id)!
        removeFromGrid(object)
        objects.delete(data.id)

        self.postMessage({
          type: "remove",
          id: data.id,
          success: true,
        })
      }
      break

    case "detect":
      // Detect all collisions
      const startTime = performance.now()
      const collisions = detectCollisions()
      const endTime = performance.now()

      self.postMessage({
        type: "detect",
        collisions,
        objectCount: objects.size,
        time: endTime - startTime,
      })
      break

    case "detectTypes":
      // Detect collisions between specific types
      if (data && data.typeA && data.typeB) {
        const startTime = performance.now()
        const collisions = detectTypeCollisions(data.typeA, data.typeB)
        const endTime = performance.now()

        self.postMessage({
          type: "detectTypes",
          typeA: data.typeA,
          typeB: data.typeB,
          collisions,
          time: endTime - startTime,
        })
      }
      break

    case "raycast":
      // Perform raycast from origin in direction
      if (data && data.origin && data.direction && data.maxDistance) {
        const startTime = performance.now()

        const origin = data.origin
        const direction = data.direction
        const maxDistance = data.maxDistance

        // Normalize direction
        const length = Math.sqrt(
          direction[0] * direction[0] + direction[1] * direction[1] + direction[2] * direction[2],
        )

        const normalizedDir = [direction[0] / length, direction[1] / length, direction[2] / length]

        // Check all objects for intersection
        let closestHit = null
        let closestDistance = maxDistance

        for (const object of objects.values()) {
          // Skip if filtering by type and type doesn't match
          if (data.objectType && object.type !== data.objectType) {
            continue
          }

          // Simple sphere intersection test
          const dx = object.position[0] - origin[0]
          const dy = object.position[1] - origin[1]
          const dz = object.position[2] - origin[2]

          // Project vector onto ray direction
          const t = dx * normalizedDir[0] + dy * normalizedDir[1] + dz * normalizedDir[2]

          // If behind ray origin or beyond max distance, skip
          if (t < 0 || t > closestDistance) {
            continue
          }

          // Calculate closest point on ray to sphere center
          const px = origin[0] + normalizedDir[0] * t
          const py = origin[1] + normalizedDir[1] * t
          const pz = origin[2] + normalizedDir[2] * t

          // Calculate distance from closest point to sphere center
          const distance = Math.sqrt(
            Math.pow(px - object.position[0], 2) +
              Math.pow(py - object.position[1], 2) +
              Math.pow(pz - object.position[2], 2),
          )

          // If distance is less than radius, we have a hit
          if (distance <= object.radius) {
            // Calculate actual hit distance
            const hitDistance = t - Math.sqrt(object.radius * object.radius - distance * distance)

            // If this is the closest hit so far, store it
            if (hitDistance < closestDistance) {
              closestDistance = hitDistance
              closestHit = {
                object,
                distance: hitDistance,
                point: [
                  origin[0] + normalizedDir[0] * hitDistance,
                  origin[1] + normalizedDir[1] * hitDistance,
                  origin[2] + normalizedDir[2] * hitDistance,
                ],
              }
            }
          }
        }

        const endTime = performance.now()

        self.postMessage({
          type: "raycast",
          hit: closestHit,
          time: endTime - startTime,
        })
      }
      break
  }
}

// Let the main thread know we're ready
self.postMessage({ type: "ready" })
