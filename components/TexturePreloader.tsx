"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useTextureStore } from "@/utils/textureLoader"

interface TexturePreloaderProps {
  onLoaded: () => void
  children: React.ReactNode
}

export default function TexturePreloader({ onLoaded, children }: TexturePreloaderProps) {
  const { loadTextures, isLoaded, isLoading, loadingProgress } = useTextureStore()
  const [showChildren, setShowChildren] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    console.log("TexturePreloader state:", { isLoaded, isLoading, loadingProgress })

    if (!isLoaded && !isLoading) {
      console.log("Starting texture loading...")
      try {
        loadTextures().catch((err) => {
          console.error("Error loading textures:", err)
          setError("Failed to load textures")
          // Force completion even on error
          setShowChildren(true)
          onLoaded()
        })
      } catch (err) {
        console.error("Exception in loadTextures:", err)
        setError("Exception in texture loading")
        // Force completion even on error
        setShowChildren(true)
        onLoaded()
      }
    }

    if (isLoaded && !showChildren) {
      console.log("Textures loaded successfully!")
      setShowChildren(true)
      onLoaded()
    }

    // Add a safety timeout to prevent infinite loading
    const timer = setTimeout(() => {
      if (!showChildren) {
        console.log("Safety timeout triggered - forcing load completion")
        setShowChildren(true)
        onLoaded()
      }
    }, 5000) // 5 second safety timeout

    return () => clearTimeout(timer)
  }, [isLoaded, isLoading, loadTextures, onLoaded, showChildren])

  if (!showChildren) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-black text-white">
        <h2 className="mb-4 text-xl font-bold">Loading Textures</h2>
        <div className="w-64 h-4 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 transition-all duration-300"
            style={{ width: `${loadingProgress * 100}%` }}
          ></div>
        </div>
        <p className="mt-2">{Math.floor(loadingProgress * 100)}%</p>
        {error && <p className="mt-4 text-red-500">{error}</p>}
      </div>
    )
  }

  return <>{children}</>
}
