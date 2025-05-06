"use client"

import { useRef, useMemo, useEffect } from "react"
import { useFrame } from "@react-three/fiber"
import { type InstancedMesh, Object3D, MeshStandardMaterial } from "three"
import useGameStore from "@/hooks/useGameStore"
// Import the texture store at the top of the file
import { useTextureStore, createFallbackTexture } from "@/utils/textureLoader"

// This component handles instanced rendering for repeated objects
export default function InstancedMeshes() {
  // References for instanced meshes
  const gravesRef = useRef<InstancedMesh>(null)
  const treesRef = useRef<InstancedMesh>(null)
  const treeTopRef = useRef<InstancedMesh>(null)
  const rocksRef = useRef<InstancedMesh>(null)

  // Add this near the top of the component with other refs
  const matricesInitialized = useRef(false)

  // Temporary object for matrix calculations
  const tempObject = useMemo(() => new Object3D(), [])

  // Get game state
  const { gameStarted } = useGameStore()

  // Generate instance data only once - with increased counts
  const { gravePositions, treePositions, rockPositions } = useMemo(() => {
    // Gravestone positions
    const gravePositions = []
    for (let i = 0; i < 30; i++) {
      const angle = (i / 30) * Math.PI * 2
      const radius = 8 + Math.random() * 12
      const x = Math.sin(angle) * radius
      const z = Math.cos(angle) * radius
      const height = 0.5 + Math.random() * 1
      const tilt = Math.random() * 0.3 - 0.15
      gravePositions.push({ x, z, height, tilt, rotation: Math.random() * Math.PI * 2 })
    }

    // Tree positions
    const treePositions = []
    for (let i = 0; i < 15; i++) {
      const angle = (i / 15) * Math.PI * 2
      const radius = 12 + Math.random() * 15
      const x = Math.sin(angle) * radius
      const z = Math.cos(angle) * radius
      const height = 3 + Math.random() * 3
      const tilt = Math.random() * 0.2 - 0.1
      treePositions.push({ x, z, height, tilt, rotation: Math.random() * Math.PI * 2 })
    }

    // Rock positions
    const rockPositions = []
    for (let i = 0; i < 20; i++) {
      const angle = Math.random() * Math.PI * 2
      const radius = 5 + Math.random() * 20
      const x = Math.sin(angle) * radius
      const z = Math.cos(angle) * radius
      const scale = 0.3 + Math.random() * 0.7
      rockPositions.push({ x, z, scale, rotation: Math.random() * Math.PI * 2 })
    }

    return { gravePositions, treePositions, rockPositions }
  }, [])

  // Set up instances once on first render
  useFrame(() => {
    if (!gameStarted || matricesInitialized.current) return

    // Set up gravestones
    if (gravesRef.current) {
      gravePositions.forEach((grave, i) => {
        tempObject.position.set(grave.x, grave.height / 2, grave.z)
        tempObject.rotation.set(grave.tilt, grave.rotation, grave.tilt)
        tempObject.scale.set(1, grave.height / 0.5, 1)
        tempObject.updateMatrix()
        gravesRef.current.setMatrixAt(i, tempObject.matrix)
      })
      gravesRef.current.instanceMatrix.needsUpdate = true
    }

    // Set up trees
    if (treesRef.current && treeTopRef.current) {
      treePositions.forEach((tree, i) => {
        // Tree trunk
        tempObject.position.set(tree.x, tree.height / 2, tree.z)
        tempObject.rotation.set(tree.tilt, tree.rotation, tree.tilt)
        tempObject.scale.set(1, tree.height / 3, 1)
        tempObject.updateMatrix()
        treesRef.current.setMatrixAt(i, tempObject.matrix)

        // Tree top
        tempObject.position.set(tree.x, tree.height + 1, tree.z)
        tempObject.rotation.set(tree.tilt, tree.rotation, tree.tilt)
        tempObject.scale.set(1.5, 2, 1.5)
        tempObject.updateMatrix()
        treeTopRef.current.setMatrixAt(i, tempObject.matrix)
      })
      treesRef.current.instanceMatrix.needsUpdate = true
      treeTopRef.current.instanceMatrix.needsUpdate = true
    }

    // Set up rocks
    if (rocksRef.current) {
      rockPositions.forEach((rock, i) => {
        tempObject.position.set(rock.x, rock.scale / 2, rock.z)
        tempObject.rotation.set(0, rock.rotation, 0)
        tempObject.scale.set(rock.scale, rock.scale, rock.scale)
        tempObject.updateMatrix()
        rocksRef.current.setMatrixAt(i, tempObject.matrix)
      })
      rocksRef.current.instanceMatrix.needsUpdate = true
    }

    // Mark as initialized so we don't keep updating
    matricesInitialized.current = true
  }, [gameStarted, gravePositions, treePositions, rockPositions, tempObject])

  // Add this effect to reset initialization when game state changes
  useEffect(() => {
    matricesInitialized.current = false
  }, [gameStarted])

  // Create shared materials to reduce draw calls
  const graveMaterial = useMemo(
    () =>
      new MeshStandardMaterial({
        color: "#333333",
        roughness: 0.9,
        metalness: 0.1,
        emissive: "#111111",
        emissiveIntensity: 0.05,
        map: useTextureStore.getState().getTexture("grave") || createFallbackTexture(),
      }),
    [],
  )

  const treeTrunkMaterial = useMemo(
    () =>
      new MeshStandardMaterial({
        color: "#3d2817",
        roughness: 0.9,
        metalness: 0.1,
        emissive: "#330000",
        emissiveIntensity: 0.05,
        map: useTextureStore.getState().getTexture("treeBark") || createFallbackTexture(),
      }),
    [],
  )

  const treeTopMaterial = useMemo(
    () =>
      new MeshStandardMaterial({
        color: "#1a3300",
        roughness: 0.8,
        metalness: 0.0,
        emissive: "#001100",
        emissiveIntensity: 0.02,
        map: useTextureStore.getState().getTexture("treeLeaves") || createFallbackTexture(),
      }),
    [],
  )

  const rockMaterial = useMemo(
    () =>
      new MeshStandardMaterial({
        color: "#444444",
        roughness: 0.9,
        metalness: 0.2,
        map: useTextureStore.getState().getTexture("rock") || createFallbackTexture(),
      }),
    [],
  )

  return (
    <>
      {/* Instanced gravestones */}
      <instancedMesh
        ref={gravesRef}
        args={[undefined, undefined, gravePositions.length]}
        castShadow
        receiveShadow
        frustumCulled={true}
      >
        <boxGeometry args={[0.8, 0.5, 0.2]} />
        <primitive object={graveMaterial} />
      </instancedMesh>

      {/* Instanced tree trunks */}
      <instancedMesh
        ref={treesRef}
        args={[undefined, undefined, treePositions.length]}
        castShadow
        receiveShadow
        frustumCulled={true}
      >
        <cylinderGeometry args={[0.3, 0.5, 3]} />
        <primitive object={treeTrunkMaterial} />
      </instancedMesh>

      {/* Instanced tree tops */}
      <instancedMesh
        ref={treeTopRef}
        args={[undefined, undefined, treePositions.length]}
        castShadow
        receiveShadow
        frustumCulled={true}
      >
        <coneGeometry args={[1, 2, 8]} />
        <primitive object={treeTopMaterial} />
      </instancedMesh>

      {/* Instanced rocks */}
      <instancedMesh
        ref={rocksRef}
        args={[undefined, undefined, rockPositions.length]}
        castShadow
        receiveShadow
        frustumCulled={true}
      >
        <dodecahedronGeometry args={[1, 0]} />
        <primitive object={rockMaterial} />
      </instancedMesh>
    </>
  )
}
