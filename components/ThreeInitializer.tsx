"use client"

import { useEffect } from "react"
import { getThreeSingleton } from "@/utils/three-singleton"

export default function ThreeInitializer() {
  useEffect(() => {
    // Initialize Three.js singleton
    const THREE = getThreeSingleton()

    // Make sure it's available globally
    if (typeof window !== "undefined") {
      // @ts-ignore
      window.THREE = THREE
    }

    console.log("Three.js singleton initialized")
  }, [])

  return null
}
