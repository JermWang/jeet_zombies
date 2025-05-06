"use client"

import { useFrame } from "@react-three/fiber"
import { useRef } from "react"

export default function FrameTimer() {
  const lastFrameTime = useRef(performance.now())
  const frameCount = useRef(0)

  useFrame(() => {
    // Increment frame counter
    frameCount.current++

    // Only measure every 5th frame to reduce overhead
    if (frameCount.current % 5 !== 0) return

    // Start frame timer
    const now = performance.now()
    const frameDuration = now - lastFrameTime.current
    lastFrameTime.current = now

    if (typeof window !== "undefined" && (window as any).startComponentTimer) {
      ;(window as any).startComponentTimer("RenderFrame")
    }

    // End frame timer at the end of the frame
    return () => {
      if (typeof window !== "undefined" && (window as any).endComponentTimer) {
        ;(window as any).endComponentTimer("RenderFrame")
      }

      // Dispatch frame timing event
      window.dispatchEvent(
        new CustomEvent("frameTiming", {
          detail: {
            duration: frameDuration,
            fps: Math.round(1000 / frameDuration),
          },
        }),
      )
    }
  })

  return null
}
