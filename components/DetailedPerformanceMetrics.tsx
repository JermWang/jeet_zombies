"use client"

import React from "react"
import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Activity, MemoryStickIcon, Cpu, Layers, X, ChevronDown, ChevronUp, Network, Zap } from "lucide-react"

// Track frame times for FPS calculation
const frameTimes: number[] = []
const MAX_FRAME_TIMES = 60

interface PerformanceData {
  fps: number
  drawCalls: number
  triangles: number
  geometries: number
  textures: number
  entities: number
  zombieCount: number
  bulletCount: number
  updateTime: number
  renderTime: number
  jsHeapSize: number
  jsHeapSizeLimit: number
  jsHeapUsed: number
  gcEvents: number
  lastGcTime: number
  sceneGraph: {
    meshes: number
    materials: number
    lights: number
    cameras: number
    textures: number
  }
  componentTimes: Record<string, number>
  workerStatus?: {
    ready: boolean
    activeWorkers: number
    totalWorkers: number
    queueLength: number
  }
  collisionStatus?: {
    objectCount: number
    lastDetectionTime: number
  }
  memory: number
}

interface DetailedPerformanceMetricsProps {
  data?: PerformanceData
}

export default function DetailedPerformanceMetrics({ data }: DetailedPerformanceMetricsProps) {
  const [isOpen, setIsOpen] = useState(true)
  const [isExpanded, setIsExpanded] = useState(false)
  const [metrics, setMetrics] = useState<PerformanceData>({
    fps: 0,
    drawCalls: 0,
    triangles: 0,
    geometries: 0,
    textures: 0,
    entities: 0,
    zombieCount: 0,
    bulletCount: 0,
    updateTime: 0,
    renderTime: 0,
    jsHeapSize: 0,
    jsHeapSizeLimit: 0,
    jsHeapUsed: 0,
    gcEvents: 0,
    lastGcTime: 0,
    sceneGraph: {
      meshes: 0,
      materials: 0,
      lights: 0,
      cameras: 0,
      textures: 0,
    },
    componentTimes: {},
    workerStatus: {
      ready: false,
      activeWorkers: 0,
      totalWorkers: 0,
      queueLength: 0,
    },
    collisionStatus: {
      objectCount: 0,
      lastDetectionTime: 0,
    },
    memory: 0,
  })

  // Refs for performance tracking
  const lastUpdateTime = useRef(performance.now())
  const lastRenderTime = useRef(performance.now())
  const gcCounter = useRef(0)
  const lastHeapSize = useRef(0)
  const updateStartTime = useRef(0)
  const frameCount = useRef(0)
  const componentTimers = useRef<Record<string, number>>({})
  const componentTimes = useRef<Record<string, number>>({})
  const lastMetricsUpdate = useRef(0)

  // Update metrics from props
  useEffect(() => {
    if (data) {
      setMetrics(data)
    }
  }, [data])

  // Listen for collision system updates
  useEffect(() => {
    const handleCollisionUpdate = (e: CustomEvent) => {
      const { objectCount, time } = e.detail

      setMetrics((prev) => ({
        ...prev,
        collisionStatus: {
          objectCount,
          lastDetectionTime: time,
        },
      }))
    }

    window.addEventListener("collisionDetected", handleCollisionUpdate as EventListener)

    return () => {
      window.removeEventListener("collisionDetected", handleCollisionUpdate as EventListener)
    }
  }, [])

  // Start component timer
  const startComponentTimer = (componentName: string) => {
    componentTimers.current[componentName] = performance.now()
  }

  // End component timer
  const endComponentTimer = (componentName: string) => {
    if (componentTimers.current[componentName]) {
      const time = performance.now() - componentTimers.current[componentName]
      componentTimes.current[componentName] = time
    }
  }

  // Expose timer functions globally
  useEffect(() => {
    if (typeof window !== "undefined") {
      ;(window as any).startComponentTimer = startComponentTimer
      ;(window as any).endComponentTimer = endComponentTimer
    }

    return () => {
      if (typeof window !== "undefined") {
        delete (window as any).startComponentTimer
        delete (window as any).endComponentTimer
      }
    }
  }, [])

  // Track garbage collection events
  useEffect(() => {
    const checkForGC = () => {
      if (typeof performance !== "undefined" && (performance as any).memory) {
        const memory = (performance as any).memory
        if (memory.usedJSHeapSize < lastHeapSize.current * 0.8) {
          // Significant drop in heap size indicates GC
          gcCounter.current++
          lastHeapSize.current = memory.usedJSHeapSize
          return true
        }
        lastHeapSize.current = memory.usedJSHeapSize
      }
      return false
    }

    const interval = setInterval(checkForGC, 1000)
    return () => clearInterval(interval)
  }, [])

  // Calculate FPS
  const calculateFPS = () => {
    const now = performance.now()
    frameTimes.push(now)

    // Remove old frames
    while (frameTimes.length > 0 && frameTimes[0] <= now - 1000) {
      frameTimes.shift()
    }

    return frameTimes.length
  }

  // Get memory usage
  const getMemoryUsage = () => {
    if (typeof performance !== "undefined" && (performance as any).memory) {
      const memory = (performance as any).memory
      return {
        jsHeapSize: Math.round(memory.totalJSHeapSize / (1024 * 1024)),
        jsHeapSizeLimit: Math.round(memory.jsHeapSizeLimit / (1024 * 1024)),
        jsHeapUsed: Math.round(memory.usedJSHeapSize / (1024 * 1024)),
      }
    }
    return {
      jsHeapSize: 0,
      jsHeapSizeLimit: 0,
      jsHeapUsed: 0,
    }
  }

  // Update metrics periodically
  useEffect(() => {
    let frameCount = 0
    let lastTime = performance.now()
    let frameId: number

    const updateMetrics = () => {
      frameCount++
      const now = performance.now()
      const delta = now - lastTime

      if (delta >= 1000) {
        // Calculate FPS
        const currentFps = Math.round((frameCount * 1000) / delta)
        frameCount = 0
        lastTime = now

        // Get component timing data from window
        const componentTimes = typeof window !== "undefined" ? (window as any).componentTimes || {} : {}

        // Update all metrics
        setMetrics((prev) => ({
          ...prev,
          fps: currentFps,
          // @ts-ignore - Chrome-specific memory API
          memory: Math.round((window.performance?.memory?.usedJSHeapSize || 0) / (1024 * 1024)),
          // These would ideally come from Three.js renderer info
          drawCalls: (window as any).drawCalls || 0,
          triangles: (window as any).triangles || 0,
          textures: (window as any).textures || 0,
          componentTimes,
        }))
      }

      frameId = requestAnimationFrame(updateMetrics)
    }

    frameId = requestAnimationFrame(updateMetrics)

    return () => {
      cancelAnimationFrame(frameId)
    }
  }, [])

  // Format time
  const formatTime = (time: number) => {
    return time < 1 ? `${(time * 1000).toFixed(2)}μs` : `${time.toFixed(2)}ms`
  }

  // Format memory
  const formatMemory = (mb: number) => {
    return `${mb} MB`
  }

  // Color code based on performance
  const getPerformanceColor = (fps: number) => {
    if (fps >= 55) return "text-green-500"
    if (fps >= 30) return "text-yellow-500"
    return "text-red-500"
  }

  // Color code based on memory usage
  const getMemoryColor = (used: number, total: number) => {
    const percentage = (used / total) * 100
    if (percentage < 50) return "text-green-500"
    if (percentage < 80) return "text-yellow-500"
    return "text-red-500"
  }

  // Identify bottlenecks
  const getBottlenecks = () => {
    const bottlenecks = []

    if (metrics.fps < 30) bottlenecks.push("Low FPS")
    if (metrics.drawCalls > 100) bottlenecks.push("High Draw Calls")
    if (metrics.triangles > 100000) bottlenecks.push("High Triangle Count")
    if (metrics.updateTime > 16) bottlenecks.push("Slow Update Time")
    if (metrics.renderTime > 16) bottlenecks.push("Slow Render Time")
    if (metrics.jsHeapUsed / metrics.jsHeapSize > 0.8) bottlenecks.push("High Memory Usage")
    if (metrics.zombieCount > 15) bottlenecks.push("Too Many Zombies")
    if (metrics.bulletCount > 30) bottlenecks.push("Too Many Bullets")
    if (metrics.sceneGraph.lights > 10) bottlenecks.push("Too Many Lights")

    // Check component times
    Object.entries(metrics.componentTimes).forEach(([component, time]) => {
      if (time > 5) bottlenecks.push(`Slow Component: ${component}`)
    })

    return bottlenecks
  }

  return (
    <div className="absolute top-4 left-4 z-50 pointer-events-auto">
      <Button
        variant="outline"
        size="sm"
        className="bg-black/70 border-2 border-red-900 hover:bg-red-900/20 text-red-500 font-silkscreen text-xs h-8 pixel-border"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Activity className="h-4 w-4 mr-1" />
        PERFORMANCE METRICS
      </Button>

      {isOpen && (
        <div className="absolute top-10 left-0 bg-black/90 border-2 border-red-900 p-4 rounded pixel-border w-80 max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-red-500 font-silkscreen text-sm">DETAILED PERFORMANCE METRICS</h3>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-red-500 hover:bg-red-900/20"
                onClick={() => setIsExpanded(!isExpanded)}
              >
                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-red-500 hover:bg-red-900/20"
                onClick={() => setIsOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            {/* FPS Counter */}
            <div className="bg-black/70 p-2 border border-red-900 rounded">
              <div className="flex justify-between items-center">
                <div className="flex items-center">
                  <Cpu className="h-4 w-4 text-red-500 mr-2" />
                  <span className="text-red-400 font-silkscreen text-xs">FPS</span>
                </div>
                <span className={`font-silkscreen text-sm ${getPerformanceColor(metrics.fps)}`}>{metrics.fps}</span>
              </div>
            </div>

            {/* Bottlenecks */}
            <div className="bg-black/70 p-2 border border-red-900 rounded">
              <div className="flex items-center mb-2">
                <Activity className="h-4 w-4 text-red-500 mr-2" />
                <span className="text-red-400 font-silkscreen text-xs">BOTTLENECKS</span>
              </div>
              <div className="text-xs">
                {getBottlenecks().length > 0 ? (
                  getBottlenecks().map((bottleneck, i) => (
                    <div key={i} className="text-red-300 font-silkscreen mb-1">
                      • {bottleneck}
                    </div>
                  ))
                ) : (
                  <div className="text-green-500 font-silkscreen">No significant bottlenecks detected</div>
                )}
              </div>
            </div>

            {/* Render Stats */}
            <div className="bg-black/70 p-2 border border-red-900 rounded">
              <div className="flex items-center mb-2">
                <Layers className="h-4 w-4 text-red-500 mr-2" />
                <span className="text-red-400 font-silkscreen text-xs">RENDER STATS</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="text-red-300 font-silkscreen">Draw Calls</div>
                <div
                  className={`text-right font-silkscreen ${metrics.drawCalls > 100 ? "text-red-500" : "text-red-300"}`}
                >
                  {metrics.drawCalls}
                </div>
                <div className="text-red-300 font-silkscreen">Triangles</div>
                <div
                  className={`text-right font-silkscreen ${metrics.triangles > 100000 ? "text-red-500" : "text-red-300"}`}
                >
                  {metrics.triangles.toLocaleString()}
                </div>
                <div className="text-red-300 font-silkscreen">Update Time</div>
                <div
                  className={`text-right font-silkscreen ${metrics.updateTime > 16 ? "text-red-500" : "text-red-300"}`}
                >
                  {formatTime(metrics.updateTime)}
                </div>
                <div className="text-red-300 font-silkscreen">Render Time</div>
                <div
                  className={`text-right font-silkscreen ${metrics.renderTime > 16 ? "text-red-500" : "text-red-300"}`}
                >
                  {formatTime(metrics.renderTime)}
                </div>
              </div>
            </div>

            {/* Memory Usage */}
            <div className="bg-black/70 p-2 border border-red-900 rounded">
              <div className="flex items-center mb-2">
                <MemoryStickIcon className="h-4 w-4 text-red-500 mr-2" />
                <span className="text-red-400 font-silkscreen text-xs">MEMORY USAGE</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="text-red-300 font-silkscreen">JS Heap Used</div>
                <div className={`text-right font-silkscreen ${getMemoryColor(metrics.jsHeapUsed, metrics.jsHeapSize)}`}>
                  {formatMemory(metrics.jsHeapUsed)}
                </div>
                <div className="text-red-300 font-silkscreen">JS Heap Total</div>
                <div className="text-right text-red-300 font-silkscreen">{formatMemory(metrics.jsHeapSize)}</div>
                <div className="text-red-300 font-silkscreen">JS Heap Limit</div>
                <div className="text-right text-red-300 font-silkscreen">{formatMemory(metrics.jsHeapSizeLimit)}</div>
                <div className="text-red-300 font-silkscreen">GC Events</div>
                <div className="text-right text-red-300 font-silkscreen">{metrics.gcEvents}</div>
                {metrics.lastGcTime > 0 && (
                  <>
                    <div className="text-red-300 font-silkscreen">Last GC</div>
                    <div className="text-right text-red-300 font-silkscreen">
                      {((performance.now() - metrics.lastGcTime) / 1000).toFixed(1)}s ago
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Entity Counts */}
            <div className="bg-black/70 p-2 border border-red-900 rounded">
              <div className="flex items-center mb-2">
                <Layers className="h-4 w-4 text-red-500 mr-2" />
                <span className="text-red-400 font-silkscreen text-xs">ENTITY COUNTS</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="text-red-300 font-silkscreen">Total Entities</div>
                <div className="text-right text-red-300 font-silkscreen">{metrics.entities}</div>
                <div className="text-red-300 font-silkscreen">Zombies</div>
                <div
                  className={`text-right font-silkscreen ${metrics.zombieCount > 15 ? "text-red-500" : "text-red-300"}`}
                >
                  {metrics.zombieCount}
                </div>
                <div className="text-red-300 font-silkscreen">Bullets</div>
                <div
                  className={`text-right font-silkscreen ${metrics.bulletCount > 30 ? "text-red-500" : "text-red-300"}`}
                >
                  {metrics.bulletCount}
                </div>
                <div className="text-red-300 font-silkscreen">Geometries</div>
                <div className="text-right text-red-300 font-silkscreen">{metrics.geometries}</div>
                <div className="text-red-300 font-silkscreen">Textures</div>
                <div className="text-right text-red-300 font-silkscreen">{metrics.textures}</div>
              </div>
            </div>

            {/* Scene Graph - Only shown when expanded */}
            {isExpanded && metrics.sceneGraph && (
              <div className="bg-black/70 p-2 border border-red-900 rounded">
                <div className="flex items-center mb-2">
                  <Layers className="h-4 w-4 text-red-500 mr-2" />
                  <span className="text-red-400 font-silkscreen text-xs">SCENE GRAPH</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="text-red-300 font-silkscreen">Meshes</div>
                  <div className="text-right text-red-300 font-silkscreen">{metrics.sceneGraph.meshes}</div>
                  <div className="text-red-300 font-silkscreen">Materials</div>
                  <div className="text-right text-red-300 font-silkscreen">{metrics.sceneGraph.materials}</div>
                  <div className="text-red-300 font-silkscreen">Lights</div>
                  <div
                    className={`text-right font-silkscreen ${metrics.sceneGraph.lights > 10 ? "text-red-500" : "text-red-300"}`}
                  >
                    {metrics.sceneGraph.lights}
                  </div>
                  <div className="text-red-300 font-silkscreen">Cameras</div>
                  <div className="text-right text-red-300 font-silkscreen">{metrics.sceneGraph.cameras}</div>
                  <div className="text-red-300 font-silkscreen">Textures</div>
                  <div className="text-right text-red-300 font-silkscreen">{metrics.sceneGraph.textures}</div>
                </div>
              </div>
            )}

            {/* Component Times - Only shown when expanded */}
            {isExpanded && metrics.componentTimes && Object.keys(metrics.componentTimes).length > 0 && (
              <div className="bg-black/70 p-2 border border-red-900 rounded">
                <div className="flex items-center mb-2">
                  <Cpu className="h-4 w-4 text-red-500 mr-2" />
                  <span className="text-red-400 font-silkscreen text-xs">COMPONENT TIMES</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {Object.entries(metrics.componentTimes)
                    .sort(([, a], [, b]) => b - a)
                    .map(([component, time]) => (
                      <React.Fragment key={component}>
                        <div className="text-red-300 font-silkscreen">{component}</div>
                        <div className={`text-right font-silkscreen ${time > 5 ? "text-red-500" : "text-red-300"}`}>
                          {formatTime(time)}
                        </div>
                      </React.Fragment>
                    ))}
                </div>
              </div>
            )}

            {/* Worker Status - Only shown when expanded */}
            {isExpanded && metrics.workerStatus && (
              <div className="bg-black/70 p-2 border border-red-900 rounded">
                <div className="flex items-center mb-2">
                  <Network className="h-4 w-4 text-red-500 mr-2" />
                  <span className="text-red-400 font-silkscreen text-xs">WORKER STATUS</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="text-red-300 font-silkscreen">Ready</div>
                  <div
                    className={`text-right font-silkscreen ${metrics.workerStatus.ready ? "text-green-500" : "text-red-500"}`}
                  >
                    {metrics.workerStatus.ready ? "Yes" : "No"}
                  </div>
                  <div className="text-red-300 font-silkscreen">Active</div>
                  <div className="text-right text-red-300 font-silkscreen">{metrics.workerStatus.activeWorkers}</div>
                  <div className="text-red-300 font-silkscreen">Total</div>
                  <div className="text-right text-red-300 font-silkscreen">{metrics.workerStatus.totalWorkers}</div>
                  <div className="text-red-300 font-silkscreen">Queue</div>
                  <div className="text-right text-red-300 font-silkscreen">{metrics.workerStatus.queueLength}</div>
                </div>
              </div>
            )}

            {/* Collision Status - Only shown when expanded */}
            {isExpanded && metrics.collisionStatus && (
              <div className="bg-black/70 p-2 border border-red-900 rounded">
                <div className="flex items-center mb-2">
                  <Zap className="h-4 w-4 text-red-500 mr-2" />
                  <span className="text-red-400 font-silkscreen text-xs">COLLISION STATUS</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="text-red-300 font-silkscreen">Objects</div>
                  <div className="text-right text-red-300 font-silkscreen">{metrics.collisionStatus.objectCount}</div>
                  <div className="text-red-300 font-silkscreen">Detection Time</div>
                  <div className="text-right text-red-300 font-silkscreen">
                    {formatTime(metrics.collisionStatus.lastDetectionTime)}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
