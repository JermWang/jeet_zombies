"use client"
import { useThree, useFrame } from "@react-three/fiber"
import { useRef } from "react"

// This component collects stats from Three.js and sends them to the PerformanceMonitor
export default function StatsCollector() {
  const { gl, scene } = useThree()
  const lastUpdateTime = useRef(performance.now())
  const frameCount = useRef(0)

  // Send stats updates to the PerformanceMonitor
  useFrame(() => {
    // Increment frame counter
    frameCount.current++

    // Only update every 120 frames (about once per 2 seconds at 60fps)
    if (frameCount.current % 120 !== 0) return

    // Calculate time since last update
    const now = performance.now()
    const updateTime = now - lastUpdateTime.current
    lastUpdateTime.current = now

    // Calculate FPS - avoid division by zero
    const fps = updateTime > 0 ? Math.round((120 * 1000) / updateTime) : 0

    // Dispatch performance data event with minimal processing
    window.dispatchEvent(
      new CustomEvent("performanceUpdate", {
        detail: {
          fps,
          drawCalls: gl.info.render.calls,
          triangles: gl.info.render.triangles,
          updateTime: gl.info.render.frame * 1000,
          renderTime: gl.info.render.frame * 1000,
          geometries: gl.info.memory.geometries,
          textures: gl.info.memory.textures,
          entities: scene.children.length,
          zombieCount: 0, // Skip counting for performance
          bulletCount: 0, // Skip counting for performance
          jsHeapUsed: (window.performance as any)?.memory?.usedJSHeapSize
            ? Math.round((window.performance as any).memory.usedJSHeapSize / (1024 * 1024))
            : 0,
          jsHeapSize: (window.performance as any)?.memory?.totalJSHeapSize
            ? Math.round((window.performance as any).memory.totalJSHeapSize / (1024 * 1024))
            : 0,
          jsHeapSizeLimit: (window.performance as any)?.memory?.jsHeapSizeLimit
            ? Math.round((window.performance as any).memory.jsHeapSizeLimit / (1024 * 1024))
            : 0,
        },
      }),
    )
  })

  return null
}
