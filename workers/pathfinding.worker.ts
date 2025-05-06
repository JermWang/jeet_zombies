// This file will be executed in a separate thread

// Define message types for type safety
interface PathfindingRequest {
  type: "findPath"
  id: number
  start: [number, number, number]
  end: [number, number, number]
  obstacles?: Array<{
    position: [number, number, number]
    radius: number
  }>
}

interface CalculationRequest {
  type: "calculate"
  id: number
  operation: string
  data: any
}

type WorkerRequest = PathfindingRequest | CalculationRequest

// Simple A* pathfinding implementation
function findPath(
  start: [number, number, number],
  end: [number, number, number],
  obstacles: Array<{ position: [number, number, number]; radius: number }> = [],
) {
  // For simplicity, we'll just do a direct path with obstacle avoidance
  // In a real implementation, you'd use a proper A* algorithm

  const startVec = { x: start[0], y: start[1], z: start[2] }
  const endVec = { x: end[0], y: end[1], z: end[2] }

  // Calculate direct vector
  const directVec = {
    x: endVec.x - startVec.x,
    y: endVec.y - startVec.y,
    z: endVec.z - startVec.z,
  }

  // Normalize
  const length = Math.sqrt(directVec.x * directVec.x + directVec.y * directVec.y + directVec.z * directVec.z)
  const normalizedVec = {
    x: directVec.x / length,
    y: directVec.y / length,
    z: directVec.z / length,
  }

  // Check for obstacles and adjust path if needed
  let adjustedVec = { ...normalizedVec }

  for (const obstacle of obstacles) {
    const obstaclePos = { x: obstacle.position[0], y: obstacle.position[1], z: obstacle.position[2] }

    // Calculate vector from start to obstacle
    const toObstacle = {
      x: obstaclePos.x - startVec.x,
      y: obstaclePos.y - startVec.y,
      z: obstaclePos.z - startVec.z,
    }

    // Project onto path direction
    const dot = toObstacle.x * normalizedVec.x + toObstacle.y * normalizedVec.y + toObstacle.z * normalizedVec.z

    // Find closest point on path to obstacle
    const closest = {
      x: startVec.x + normalizedVec.x * dot,
      y: startVec.y + normalizedVec.y * dot,
      z: startVec.z + normalizedVec.z * dot,
    }

    // Calculate distance from obstacle to path
    const distVec = {
      x: obstaclePos.x - closest.x,
      y: obstaclePos.y - closest.y,
      z: obstaclePos.z - closest.z,
    }

    const distance = Math.sqrt(distVec.x * distVec.x + distVec.y * distVec.y + distVec.z * distVec.z)

    // If path goes through obstacle, adjust it
    if (distance < obstacle.radius && dot > 0 && dot < length) {
      // Normalize the avoidance vector
      const avoidLength = Math.sqrt(distVec.x * distVec.x + distVec.y * distVec.y + distVec.z * distVec.z)
      if (avoidLength > 0) {
        const avoidNorm = {
          x: distVec.x / avoidLength,
          y: distVec.y / avoidLength,
          z: distVec.z / avoidLength,
        }

        // Add avoidance to adjusted vector (weighted by how close we are)
        const avoidWeight = Math.max(0, 1 - distance / obstacle.radius)
        adjustedVec.x += avoidNorm.x * avoidWeight
        adjustedVec.z += avoidNorm.z * avoidWeight
      }
    }
  }

  // Renormalize the adjusted vector
  const adjustedLength = Math.sqrt(
    adjustedVec.x * adjustedVec.x + adjustedVec.y * adjustedVec.y + adjustedVec.z * adjustedVec.z,
  )
  adjustedVec = {
    x: adjustedVec.x / adjustedLength,
    y: adjustedVec.y / adjustedLength,
    z: adjustedVec.z / adjustedLength,
  }

  // Generate path points (just start and end for simplicity)
  // In a real implementation, you'd generate intermediate points
  return {
    path: [start, end],
    direction: [adjustedVec.x, adjustedVec.y, adjustedVec.z],
  }
}

// Handle complex calculations
function performCalculation(operation: string, data: any) {
  switch (operation) {
    case "distance":
      // Calculate distance between points
      const p1 = data.point1
      const p2 = data.point2
      return Math.sqrt(Math.pow(p2[0] - p1[0], 2) + Math.pow(p2[1] - p1[1], 2) + Math.pow(p2[2] - p1[2], 2))

    case "batch-distances":
      // Calculate multiple distances at once
      return data.points.map((point: [number, number, number], index: number) => {
        if (index === 0) return 0
        const prevPoint = data.points[index - 1]
        return Math.sqrt(
          Math.pow(point[0] - prevPoint[0], 2) +
            Math.pow(point[1] - prevPoint[1], 2) +
            Math.pow(point[2] - prevPoint[2], 2),
        )
      })

    case "collision-check":
      // Check if two objects collide
      const obj1 = data.object1
      const obj2 = data.object2
      const distance = Math.sqrt(
        Math.pow(obj2.position[0] - obj1.position[0], 2) +
          Math.pow(obj2.position[1] - obj1.position[1], 2) +
          Math.pow(obj2.position[2] - obj1.position[2], 2),
      )
      return distance < obj1.radius + obj2.radius

    case "batch-collision-check":
      // Check multiple collisions at once
      const results: boolean[] = []
      const target = data.target

      for (const obj of data.objects) {
        const distance = Math.sqrt(
          Math.pow(obj.position[0] - target.position[0], 2) +
            Math.pow(obj.position[1] - target.position[1], 2) +
            Math.pow(obj.position[2] - target.position[2], 2),
        )
        results.push(distance < obj.radius + target.radius)
      }

      return results

    default:
      throw new Error(`Unknown operation: ${operation}`)
  }
}

// Handle messages from the main thread
self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const { type, id } = event.data

  try {
    let result

    if (type === "findPath") {
      const { start, end, obstacles } = event.data
      result = findPath(start, end, obstacles)
    } else if (type === "calculate") {
      const { operation, data } = event.data
      result = performCalculation(operation, data)
    }

    // Send the result back to the main thread
    self.postMessage({
      id,
      success: true,
      result,
    })
  } catch (error) {
    // Send error back to main thread
    self.postMessage({
      id,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

// Let the main thread know we're ready
self.postMessage({ type: "ready" })
