"use client"

import { RigidBody } from "@react-three/rapier"
import { THREE } from "@/utils/three-singleton"
import { useLoader } from "@react-three/fiber"
import { TextureLoader } from "three/src/loaders/TextureLoader.js"
import { useEffect } from "react"
import { Environment } from "@react-three/drei"
import { CuboidCollider } from "@react-three/rapier"

export default function SimpleEnvironment() {
  // Load ground textures (Paving Stones)
  const [groundColorMap, groundNormalMap, groundRoughnessMap, groundAOMap] = useLoader(TextureLoader, [
    '/textures/PavingStones/PavingStones142_1K-JPG_Color.jpg',
    '/textures/PavingStones/PavingStones142_1K-JPG_NormalGL.jpg',
    '/textures/PavingStones/PavingStones142_1K-JPG_Roughness.jpg',
    '/textures/PavingStones/PavingStones142_1K-JPG_AmbientOcclusion.jpg'
  ]);

  // Load grass textures
  const [grassColorMap, grassNormalMap, grassRoughnessMap, grassAOMap] = useLoader(TextureLoader, [
    '/textures/grass/Ground068_1K-JPG_Color.jpg',
    '/textures/grass/Ground068_1K-JPG_NormalGL.jpg',
    '/textures/grass/Ground068_1K-JPG_Roughness.jpg',
    '/textures/grass/Ground068_1K-JPG_AmbientOcclusion.jpg'
  ]);

  // Load wall textures (now bricks)
  const [brickColorMap, brickNormalMap, brickRoughnessMap, brickAOMap] = useLoader(TextureLoader, [
    '/textures/bricks/Bricks097_1K-JPG_Color.jpg',
    '/textures/bricks/Bricks097_1K-JPG_NormalGL.jpg',
    '/textures/bricks/Bricks097_1K-JPG_Roughness.jpg',
    '/textures/bricks/Bricks097_1K-JPG_AmbientOcclusion.jpg' // Added AO map for bricks
  ]);

  // Apply texture settings once loaded
  useEffect(() => {
    // Ground textures settings (Paving Stones)
    [groundColorMap, groundNormalMap, groundRoughnessMap, groundAOMap].forEach(texture => {
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(25, 25); // Increased repeat for larger 100x100 plane
        texture.needsUpdate = true;
    });

    // Grass textures settings
    [grassColorMap, grassNormalMap, grassRoughnessMap, grassAOMap].forEach(texture => {
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(50, 50); // Keep grass repeat the same
        texture.needsUpdate = true;
    });

    // Wall (Brick) textures settings
    [brickColorMap, brickNormalMap, brickRoughnessMap, brickAOMap].forEach(texture => {
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(5, 1); // Keep repetition for walls
        texture.needsUpdate = true;
    });

  }, [groundColorMap, groundNormalMap, groundRoughnessMap, groundAOMap, 
      grassColorMap, grassNormalMap, grassRoughnessMap, grassAOMap, 
      brickColorMap, brickNormalMap, brickRoughnessMap, brickAOMap]);

  // Create wall material (now brick)
  const wallMaterial = new THREE.MeshStandardMaterial({
      map: brickColorMap,
      normalMap: brickNormalMap,
      roughnessMap: brickRoughnessMap,
      aoMap: brickAOMap, // Use AO map
      metalness: 0, // Bricks aren't metallic
      roughness: 1, // Modulated by map
  });

  return (
    <>
      {/* Dark Fog */}
      <fog attach="fog" args={['#1a0a0a', 15, 80]} /> {/* Dark reddish fog, starts at 15, full density at 80 */}
      
      {/* Lighting */}
      <Environment files="/hdri/NightEnvironmentHDRI008_1K-HDR.exr" background />
      <ambientLight intensity={0.15} /> {/* Slightly reduced ambient */}
      <directionalLight
        position={[10, 15, 10]} 
        intensity={0.6} // Slightly reduced directional
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-far={50} 
        shadow-camera-left={-25}
        shadow-camera-right={25}
        shadow-camera-top={25}
        shadow-camera-bottom={-25}
      />
      {/* Red Accent Lights */}
      <pointLight color="#ff2200" intensity={5} distance={50} position={[-60, 5, -60]} />
      <pointLight color="#ff2200" intensity={4} distance={40} position={[65, 4, 65]} />
      <pointLight color="#ff0000" intensity={6} distance={60} position={[0, 6, 80]} />

      {/* Central Ground plane (Paving Stones) - Larger */}
      <RigidBody type="fixed" restitution={0.2} friction={1} colliders={false}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, 0, 0]}>
          <planeGeometry args={[100, 100]} /> {/* Extend to walls */}
          <meshStandardMaterial 
            map={groundColorMap}
            normalMap={groundNormalMap}
            roughnessMap={groundRoughnessMap}
            aoMap={groundAOMap}
            roughness={1} 
            metalness={0} 
          />
        </mesh>
        {/* Add explicit thin cuboid collider for the ground */}
        <CuboidCollider args={[50, 0.1, 50]} position={[0, -0.1, 0]} /> 
      </RigidBody>

      {/* Outer Ground plane (Grass) - Larger, slightly lower */}
      <RigidBody type="fixed" restitution={0.2} friction={1} colliders={false}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, -0.05, 0]}> {/* Slightly lower */}
          <planeGeometry args={[300, 300]} /> {/* Larger size */}
          <meshStandardMaterial 
            map={grassColorMap}
            normalMap={grassNormalMap}
            roughnessMap={grassRoughnessMap}
            aoMap={grassAOMap}
            roughness={1} 
            metalness={0} 
          />
        </mesh>
         {/* Add explicit thin cuboid collider for the grass ground */}
        <CuboidCollider args={[150, 0.1, 150]} position={[0, -0.15, 0]} /> {/* Adjust position to match visual offset */}
      </RigidBody>

      {/* Surrounding walls - Broken into segments with openings (More Decay) */}
      {/* Back Wall (Z = -50) */}
      <RigidBody type="fixed" colliders="cuboid">
        {/* Left Section - Slightly shorter */}
        <mesh position={[-30, 4.5, -50]} castShadow receiveShadow rotation={[0, 0, 0.02]}> 
          <boxGeometry args={[40, 9, 1]} /> 
          <primitive object={wallMaterial} attach="material" />
        </mesh>
        {/* Player Doorway Opening (Gap: x=-10 to x=10) */}
        {/* Right Section - Different height/width */}
        <mesh position={[35, 4, -50]} castShadow receiveShadow rotation={[0, 0, -0.01]}>
          <boxGeometry args={[30, 8, 1]} />
          <primitive object={wallMaterial} attach="material" />
        </mesh>
        {/* Crumbling Top Section (Jagged) */}
        <mesh position={[-5, 9, -50]} castShadow receiveShadow rotation={[0, 0, -0.05]}>
          <boxGeometry args={[8, 2, 1]} /> 
          <primitive object={wallMaterial} attach="material" />
        </mesh>
         <mesh position={[5, 8.5, -50]} castShadow receiveShadow rotation={[0, 0, 0.08]}>
          <boxGeometry args={[10, 3, 1]} /> 
          <primitive object={wallMaterial} attach="material" />
        </mesh>
         {/* Small Crumbling Hole - Adjusted */}
        <mesh position={[-42, 1.5, -50]} castShadow receiveShadow rotation={[0, 0, 0.1]}>
          <boxGeometry args={[6, 3, 1]} /> 
          <primitive object={wallMaterial} attach="material" />
        </mesh>
      </RigidBody>

      {/* Front Wall (Z = 50) - Adjusted */}
       <RigidBody type="fixed" colliders="cuboid">
        {/* Left Section - Wider gap */}
        <mesh position={[-28, 5, 50]} castShadow receiveShadow rotation={[0,0, 0.01]}>
          <boxGeometry args={[44, 10, 1]} /> 
          <primitive object={wallMaterial} attach="material" />
        </mesh>
        {/* Right Section - Smaller */}
         <mesh position={[40, 4, 50]} castShadow receiveShadow rotation={[0,0,-0.03]}>
          <boxGeometry args={[20, 8, 1]} />
          <primitive object={wallMaterial} attach="material" />
        </mesh>
         {/* Lower Crumbling Piece */}
         <mesh position={[10, 1.5, 50]} castShadow receiveShadow rotation={[0,0, 0.05]}> 
          <boxGeometry args={[8, 3, 1]} />
          <primitive object={wallMaterial} attach="material" />
        </mesh>
      </RigidBody>

      {/* Left Wall (X = -50) - Adjusted */}
       <RigidBody type="fixed" colliders="cuboid">
         <mesh position={[-50, 5, -30]} castShadow receiveShadow rotation={[0.02, 0, 0]}>
          <boxGeometry args={[1, 10, 40]} />
          <primitive object={wallMaterial} attach="material" />
        </mesh>
         <mesh position={[-50, 4.5, 35]} castShadow receiveShadow rotation={[-0.01, 0, 0]}>
          <boxGeometry args={[1, 9, 30]} />
          <primitive object={wallMaterial} attach="material" />
        </mesh>
        {/* Player Doorway - Wider and lower top */}
        <mesh position={[-50, 7.5, 0]} castShadow receiveShadow rotation={[0.05,0,0]}> 
            <boxGeometry args={[1, 5, 22]} /> 
             <primitive object={wallMaterial} attach="material" />
         </mesh>
      </RigidBody>

       {/* Right Wall (X = 50) - Adjusted */}
       <RigidBody type="fixed" colliders="cuboid">
         {/* Lower Section */}
         <mesh position={[50, 3, -20]} castShadow receiveShadow rotation={[-0.02, 0, 0]}>
          <boxGeometry args={[1, 6, 60]} />
          <primitive object={wallMaterial} attach="material" />
        </mesh>
         {/* Higher Section - Gap */}
         <mesh position={[50, 7, 30]} castShadow receiveShadow rotation={[0.03, 0 ,0]}>
          <boxGeometry args={[1, 6, 40]} />
          <primitive object={wallMaterial} attach="material" />
        </mesh>
         {/* Floating debris? */}
          <mesh position={[50, 8.5, 5]} castShadow receiveShadow rotation={[0.1, 0.1, 0]}> 
            <boxGeometry args={[1, 2, 3]} />
             <primitive object={wallMaterial} attach="material" />
        </mesh>
      </RigidBody>

      {/* NEW: Impassable Perimeter Fence (Moved to outer edge) */}
      {[[-149.5, 0, 0], [149.5, 0, 0], [0, 0, -149.5], [0, 0, 149.5]].map((pos, i) => (
        <RigidBody 
          key={`fence-${i}`} 
          type="fixed" 
          colliders={false}
          position={[pos[0], 7.5, pos[2]]} // Positioned at ground, height centered
        >
          <CuboidCollider 
            args={i < 2 ? [0.5, 7.5, 150] : [150, 7.5, 0.5]} // Full length for 300x300 area
          />
          <group>
            {(() => {
              const slats = [];
              const fenceLength = 300;
              const slatThickness = 0.2;
              const gapSize = 0.8;
              const slatPlusGap = slatThickness + gapSize; // Should be 1.0
              const numberOfSlats = Math.floor(fenceLength / slatPlusGap);
              const slatHeight = 15;
              const fenceVisualThickness = 1;

              for (let j = 0; j < numberOfSlats; j++) {
                const slatPositionOffset = -fenceLength / 2 + slatThickness / 2 + j * slatPlusGap;
                
                slats.push(
                  <mesh 
                    key={`slat-${i}-${j}`} 
                    castShadow 
                    receiveShadow
                    position={i < 2 ? [0, 0, slatPositionOffset] : [slatPositionOffset, 0, 0]}
                  >
                    <boxGeometry 
                      args={i < 2 
                        ? [fenceVisualThickness, slatHeight, slatThickness] 
                        : [slatThickness, slatHeight, fenceVisualThickness] 
                      }
                    />
                    <meshStandardMaterial color="#222222" emissive="#111111" flatShading={true} />
                  </mesh>
                );
              }
              return slats;
            })()}
          </group>
        </RigidBody>
      ))}
    </>
  )
}
