"use client"

import { useRef, useMemo } from "react"
import { useFrame } from "@react-three/fiber"

export default function Particles() {
  const particlesRef = useRef<any>(null)

  // Create particles - drastically reduced count
  const particleCount = 30 // Reduced from 100

  // Use useMemo to create stable particle positions
  const particles = useMemo(() => {
    const temp = []
    for (let i = 0; i < particleCount; i++) {
      const x = (Math.random() - 0.5) * 50
      const y = (Math.random() - 0.5) * 30
      const z = (Math.random() - 0.5) * 50

      // Store particle position
      temp.push(x, y, z)
    }
    return new Float32Array(temp)
  }, [])

  // Create particle colors (red with varying opacity)
  const colors = useMemo(() => {
    const temp = []
    for (let i = 0; i < particleCount; i++) {
      // Red with random intensity
      temp.push(1, 0, 0) // RGB for red
    }
    return new Float32Array(temp)
  }, [])

  // Minimal animation - only rotate the entire system
  useFrame((state) => {
    if (particlesRef.current) {
      // Only update every 3 frames
      if (Math.floor(state.clock.elapsedTime * 30) % 3 === 0) {
        try {
          particlesRef.current.rotation.y += 0.0005 // Greatly reduced rotation speed
        } catch (e) {
          console.error("Error updating particles:", e)
        }
      }
    }
  })

  return (
    <points ref={particlesRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={particles.length / 3} array={particles} itemSize={3} />
        <bufferAttribute attach="attributes-color" count={colors.length / 3} array={colors} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial size={0.2} vertexColors transparent opacity={0.3} sizeAttenuation />
    </points>
  )
}
