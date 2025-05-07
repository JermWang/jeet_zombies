"use client"

import { useRef, useEffect } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import { THREE } from "@/utils/three-singleton"

export default function EnhancedLighting() {
  const { scene } = useThree()
  const directionalLightRef = useRef<THREE.DirectionalLight>(null)
  const ambientLightRef = useRef<THREE.AmbientLight>(null)
  const pointLightsRef = useRef<THREE.PointLight[]>([])

  // Set up scene lighting
  useEffect(() => {
    // Set background color
    scene.background = new THREE.Color(0x111111)

    // Set up fog for atmosphere
    scene.fog = new THREE.Fog(0x111111, 20, 100)

    return () => {
      // Clean up
      scene.fog = null
    }
  }, [scene])

  // Animate lights
  useFrame((state, delta) => {
    // Animate directional light
    if (directionalLightRef.current) {
      directionalLightRef.current.position.x = Math.sin(state.clock.elapsedTime * 0.1) * 10
    }

    // Animate point lights
    pointLightsRef.current.forEach((light, index) => {
      const time = state.clock.elapsedTime * 0.5
      const offset = index * Math.PI * 0.5
      light.intensity = 1 + Math.sin(time + offset) * 0.2
    })
  })

  return (
    <>
      {/* Main directional light (sun) */}
      <directionalLight
        ref={directionalLightRef}
        position={[10, 20, 10]}
        intensity={1.5}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-far={50}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
      />

      {/* Ambient light for overall scene brightness */}
      <ambientLight ref={ambientLightRef} intensity={0.3} />

      {/* Point lights for atmosphere - REMOVING castShadow and fixing ref typing */}
      <pointLight
        ref={(el) => { 
          if (el && !pointLightsRef.current.includes(el)) { // Prevent duplicates if re-rendered
            pointLightsRef.current.push(el);
          } 
        }}
        position={[10, 5, 10]}
        intensity={1}
        distance={20}
        decay={2}
      />
      <pointLight
        ref={(el) => { 
          if (el && !pointLightsRef.current.includes(el)) {
            pointLightsRef.current.push(el);
          }
        }}
        position={[-10, 5, -10]}
        intensity={1}
        distance={20}
        decay={2}
      />
      <pointLight
        ref={(el) => { 
          if (el && !pointLightsRef.current.includes(el)) {
            pointLightsRef.current.push(el);
          }
        }}
        position={[10, 5, -10]}
        intensity={1}
        distance={20}
        decay={2}
      />
      <pointLight
        ref={(el) => { 
          if (el && !pointLightsRef.current.includes(el)) {
            pointLightsRef.current.push(el);
          }
        }}
        position={[-10, 5, 10]}
        intensity={1}
        distance={20}
        decay={2}
      />

      {/* Hemisphere light for natural sky/ground reflection */}
      <hemisphereLight args={[0x606060, 0x404040, 0.6]} />
    </>
  )
}
