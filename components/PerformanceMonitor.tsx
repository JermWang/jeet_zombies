"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Activity, MemoryStickIcon as Memory, Cpu, Layers, X } from "lucide-react"

interface PerformanceData {
  fps?: number
  drawCalls?: number
  triangles?: number
  geometries?: number
  textures?: number
  entities?: number
  zombieCount?: number
  bulletCount?: number
  updateTime?: number
  renderTime?: number
  jsHeapSize?: number
  jsHeapSizeLimit?: number
  jsHeapUsed?: number
  gcEvents?: number
  lastGcTime?: number
  sceneGraph?: {
    meshes: number
    materials: number
    lights: number
    cameras: number
    textures: number
  }
  componentTimes?: Record<string, number>
}

interface PerformanceMonitorProps {
  performanceData?: PerformanceData
}

export default function PerformanceMonitor({ performanceData = {} }: PerformanceMonitorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [fps, setFps] = useState(0)
  const [memory, setMemory] = useState<number | null>(null)
  const [memoryStats, setMemoryStats] = useState({
    geometries: 0,
    textures: 0,
    jsHeap: null as number | null,
    jsHeapTotal: null as number | null,
    jsHeapLimit: null as number | null,
  })
  const [sceneInfo, setSceneInfo] = useState({
    objects: 0,
    meshes: 0,
    materials: 0,
    lights: 0,
  })
  const [activeComponents, setActiveComponents] = useState({
    zombies: true,
    environment: true,
    particles: true,
    lighting: true,
    postProcessing: true,
  })
  const [showMonitor, setShowMonitor] = useState(true)

  useEffect(() => {
    let frameCount = 0
    let lastTime = performance.now()
    let frameId: number

    const updateFps = () => {
      frameCount++
      const now = performance.now()
      const delta = now - lastTime

      if (delta >= 1000) {
        setFps(Math.round((frameCount * 1000) / delta))
        frameCount = 0
        lastTime = now

        // Update memory usage if available
        if (
          typeof window !== "undefined" &&
          // @ts-ignore
          window.performance &&
          // @ts-ignore
          window.performance.memory
        ) {
          // @ts-ignore
          setMemory(Math.round(window.performance.memory.usedJSHeapSize / (1024 * 1024)))
        }
      }

      frameId = requestAnimationFrame(updateFps)
    }

    frameId = requestAnimationFrame(updateFps)

    // Toggle monitor with M key
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "m" || e.key === "M") {
        setShowMonitor((prev) => !prev)
      }
    }
    window.addEventListener("keydown", handleKeyDown)

    return () => {
      cancelAnimationFrame(frameId)
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [])

  // Update state from props
  useEffect(() => {
    if (performanceData.fps !== undefined) {
      setFps(performanceData.fps)
    }

    if (
      performanceData.geometries !== undefined ||
      performanceData.textures !== undefined ||
      performanceData.jsHeapSize !== undefined ||
      performanceData.jsHeapSizeLimit !== undefined ||
      performanceData.jsHeapUsed !== undefined
    ) {
      setMemoryStats({
        geometries: performanceData.geometries || 0,
        textures: performanceData.textures || 0,
        jsHeap: performanceData.jsHeapUsed || null,
        jsHeapTotal: performanceData.jsHeapSize || null,
        jsHeapLimit: performanceData.jsHeapSizeLimit || null,
      })
    }

    if (performanceData.entities !== undefined || performanceData.sceneGraph !== undefined) {
      setSceneInfo({
        objects: performanceData.entities || 0,
        meshes: performanceData.sceneGraph?.meshes || 0,
        materials: performanceData.sceneGraph?.materials || 0,
        lights: performanceData.sceneGraph?.lights || 0,
      })
    }
  }, [performanceData])

  // Calculate FPS locally if not provided
  // useEffect(() => {
  //   if (performanceData.fps === undefined) {
  //     const frameCount = { value: 0 }
  //     const lastTime = { value: performance.now() }

  //     const interval = setInterval(() => {
  //       const now = performance.now()
  //       const elapsed = now - lastTime.value
  //       if (elapsed > 0) {
  //         const currentFps = Math.round((frameCount.value * 1000) / elapsed)
  //         setFps(currentFps)
  //         frameCount.value = 0
  //         lastTime.value = now
  //       }
  //     }, 1000)

  //     const updateFrameCount = () => {
  //       frameCount.value++
  //       requestAnimationFrame(updateFrameCount)
  //     }

  //     const frameId = requestAnimationFrame(updateFrameCount)

  //     return () => {
  //       clearInterval(interval)
  //       cancelAnimationFrame(frameId)
  //     }
  //   }
  // }, [performanceData.fps])

  // Toggle component visibility
  const toggleComponent = (component: keyof typeof activeComponents) => {
    setActiveComponents((prev) => ({
      ...prev,
      [component]: !prev[component],
    }))

    // Dispatch event to notify components
    window.dispatchEvent(
      new CustomEvent("toggleComponent", {
        detail: { component, active: !activeComponents[component] },
      }),
    )
  }

  // Format memory size
  const formatMemory = (mb: number | null) => {
    if (mb === null) return "N/A"
    return `${mb} MB`
  }

  if (!showMonitor) return null

  return (
    <div className="absolute top-4 right-4 z-50 pointer-events-auto">
      <Button
        variant="outline"
        size="sm"
        className="bg-black/70 border-2 border-red-900 hover:bg-red-900/20 text-red-500 font-silkscreen text-xs h-8 pixel-border"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Activity className="h-4 w-4 mr-1" />
        PERFORMANCE
      </Button>

      {isOpen && (
        <div className="absolute top-10 right-0 bg-black/90 border-2 border-red-900 p-4 rounded pixel-border w-80">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-red-500 font-silkscreen text-sm">PERFORMANCE MONITOR</h3>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-red-500 hover:bg-red-900/20"
              onClick={() => setIsOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-4">
            {/* FPS Counter */}
            <div className="bg-black/70 p-2 border border-red-900 rounded">
              <div className="flex justify-between items-center">
                <div className="flex items-center">
                  <Cpu className="h-4 w-4 text-red-500 mr-2" />
                  <span className="text-red-400 font-silkscreen text-xs">FPS</span>
                </div>
                <span
                  className={`font-silkscreen text-sm ${fps > 45 ? "text-green-500" : fps > 30 ? "text-yellow-500" : "text-red-500"}`}
                >
                  {fps}
                </span>
              </div>
            </div>

            {/* Memory Usage */}
            <div className="bg-black/70 p-2 border border-red-900 rounded">
              <div className="flex items-center mb-2">
                <Memory className="h-4 w-4 text-red-500 mr-2" />
                <span className="text-red-400 font-silkscreen text-xs">MEMORY USAGE</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="text-red-300 font-silkscreen">Geometries</div>
                <div className="text-right text-red-300 font-silkscreen">{memoryStats.geometries}</div>
                <div className="text-red-300 font-silkscreen">Textures</div>
                <div className="text-right text-red-300 font-silkscreen">{memoryStats.textures}</div>
                {memoryStats.jsHeap !== null && (
                  <>
                    <div className="text-red-300 font-silkscreen">JS Heap</div>
                    <div className="text-right text-red-300 font-silkscreen">{formatMemory(memoryStats.jsHeap)}</div>
                    <div className="text-red-300 font-silkscreen">JS Heap Total</div>
                    <div className="text-right text-red-300 font-silkscreen">
                      {formatMemory(memoryStats.jsHeapTotal)}
                    </div>
                    <div className="text-red-300 font-silkscreen">JS Heap Limit</div>
                    <div className="text-right text-red-300 font-silkscreen">
                      {formatMemory(memoryStats.jsHeapLimit)}
                    </div>
                  </>
                )}
                {memory !== null && (
                  <>
                    <div className="text-red-300 font-silkscreen">JS Heap</div>
                    <div className="text-right text-red-300 font-silkscreen">{memory} MB</div>
                  </>
                )}
              </div>
            </div>

            {/* Scene Information */}
            <div className="bg-black/70 p-2 border border-red-900 rounded">
              <div className="flex items-center mb-2">
                <Layers className="h-4 w-4 text-red-500 mr-2" />
                <span className="text-red-400 font-silkscreen text-xs">SCENE OBJECTS</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="text-red-300 font-silkscreen">Total Objects</div>
                <div className="text-right text-red-300 font-silkscreen">{sceneInfo.objects}</div>
                <div className="text-red-300 font-silkscreen">Meshes</div>
                <div className="text-right text-red-300 font-silkscreen">{sceneInfo.meshes}</div>
                <div className="text-red-300 font-silkscreen">Materials</div>
                <div className="text-right text-red-300 font-silkscreen">{sceneInfo.materials}</div>
                <div className="text-red-300 font-silkscreen">Lights</div>
                <div className="text-right text-red-300 font-silkscreen">{sceneInfo.lights}</div>
              </div>
            </div>

            {/* Component Toggles */}
            <div className="bg-black/70 p-2 border border-red-900 rounded">
              <div className="flex items-center mb-2">
                <Layers className="h-4 w-4 text-red-500 mr-2" />
                <span className="text-red-400 font-silkscreen text-xs">TOGGLE COMPONENTS</span>
              </div>
              <div className="grid grid-cols-1 gap-2">
                {Object.entries(activeComponents).map(([key, value]) => (
                  <Button
                    key={key}
                    variant="outline"
                    size="sm"
                    className={`${
                      value ? "bg-red-900/30 border-red-500" : "bg-black/70 border-red-900"
                    } text-red-400 font-silkscreen text-xs h-7 pixel-border`}
                    onClick={() => toggleComponent(key as keyof typeof activeComponents)}
                  >
                    {key.charAt(0).toUpperCase() + key.slice(1)}: {value ? "ON" : "OFF"}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
