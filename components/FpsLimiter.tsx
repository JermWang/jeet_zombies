"use client"

import { useEffect, useRef } from "react"

interface FpsLimiterProps {
  targetFps: number
}

/**
 * FpsLimiter component that limits the frame rate to improve consistency
 * This helps maintain a stable experience by preventing frame rate fluctuations
 */
export default function FpsLimiter({ targetFps = 60 }: FpsLimiterProps) {
  const requestRef = useRef<number | null>(null)
  const previousTimeRef = useRef<number | null>(null)
  const fpsIntervalRef = useRef<number>(1000 / targetFps)

  // Update the FPS interval when targetFps changes
  useEffect(() => {
    fpsIntervalRef.current = 1000 / targetFps
  }, [targetFps])

  useEffect(() => {
    // Skip if running in SSR
    if (typeof window === "undefined") return

    // Store original requestAnimationFrame
    const originalRequestAnimationFrame = window.requestAnimationFrame
    const originalCancelAnimationFrame = window.cancelAnimationFrame

    // Override requestAnimationFrame with our FPS-limited version
    window.requestAnimationFrame = (callback: FrameRequestCallback): number => {
      const animate = (time: number) => {
        if (previousTimeRef.current === null) {
          previousTimeRef.current = time
          requestRef.current = originalRequestAnimationFrame(animate)
          return
        }

        const elapsed = time - previousTimeRef.current

        // Only call the callback if enough time has elapsed
        if (elapsed > fpsIntervalRef.current) {
          // Adjust for the frame rate by calculating how many frames we should have had
          previousTimeRef.current = time - (elapsed % fpsIntervalRef.current)
          callback(time)
        }

        requestRef.current = originalRequestAnimationFrame(animate)
      }

      requestRef.current = originalRequestAnimationFrame(animate)
      return requestRef.current
    }

    // Restore original functions on cleanup
    return () => {
      if (requestRef.current !== null) {
        originalCancelAnimationFrame(requestRef.current)
      }
      window.requestAnimationFrame = originalRequestAnimationFrame
      window.cancelAnimationFrame = originalCancelAnimationFrame
    }
  }, [])

  // This component doesn't render anything
  return null
}
