import React, { forwardRef } from 'react';
import * as THREE from 'three';

// Define the props, including refs for animation targeting and type
interface ZombieModelProps {
  type: string; // 'zombie_standard_shirt' | 'zombie_brute' | archetypes
  leftArmRef?: React.Ref<THREE.Object3D>; // Use Object3D for groups/meshes
  rightArmRef?: React.Ref<THREE.Object3D>;
  leftLegRef?: React.Ref<THREE.Object3D>;
  rightLegRef?: React.Ref<THREE.Object3D>;
  isFlashing?: boolean; // Prop to control flash effect
  tint?: string;        // NEW: archetype skin tint (Runner/Tank/Spitter/Exploder)
  scale?: number;       // NEW: archetype visual scale
}

// --- Module-level SHARED materials (one set per app, reused by every zombie) ---
// Previously each zombie instance allocated ~6 materials (240+ for a full horde),
// thrashing memory + GPU state. These are shared; tinted skin/shirt are cached
// per tint so all zombies of the same archetype share two materials.
const redEyeMaterial = new THREE.MeshStandardMaterial({ color: '#ff0000', emissive: '#ff0000', emissiveIntensity: 2 });
const brownPantsMaterial = new THREE.MeshStandardMaterial({ color: '#6b4d3b', roughness: 0.7 });
const mouthMaterial = new THREE.MeshStandardMaterial({ color: '#400000', roughness: 0.9 });
const flashMaterial = new THREE.MeshStandardMaterial({ color: '#FF0000', emissive: '#FF0000', emissiveIntensity: 1, roughness: 1, metalness: 0 });

const tintCache = new Map<string, { skin: THREE.MeshStandardMaterial; shirt: THREE.MeshStandardMaterial }>();
function getTintMaterials(tint?: string) {
  const key = tint || 'default';
  let m = tintCache.get(key);
  if (!m) {
    const shirt = new THREE.Color(tint || '#a13a3a');
    if (tint) shirt.multiplyScalar(0.7);
    m = {
      skin: new THREE.MeshStandardMaterial({ color: tint || '#5a8a58', roughness: 0.8 }),
      shirt: new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.7 }),
    };
    tintCache.set(key, m);
  }
  return m;
}

const ZombieModel = forwardRef<THREE.Group, ZombieModelProps>(
  ({ type, leftArmRef, rightArmRef, leftLegRef, rightLegRef, isFlashing, tint, scale }, ref) => {
    const { skin: greenSkinMaterial, shirt: redShirtMaterial } = getTintMaterials(tint);

    // Any non-brute type uses the rigged humanoid body so archetypes inherit the
    // walk/arm animation. Brute keeps its bespoke bulkier build below.
    const isHumanoid = type !== 'zombie_brute';

    // Conditionally return JSX based on type
    return (
      <group ref={ref}>
        {/* --- Standard / archetype humanoid (tinted + scaled) --- */}
        {isHumanoid && (
            <group scale={scale ?? 1}>
                {/* Head */} 
                <mesh castShadow position={[0, 0.7, 0]} material={isFlashing ? flashMaterial : greenSkinMaterial}> 
                    <boxGeometry args={[0.6, 0.6, 0.6]} />
                </mesh>
                {/* Eyes */}
                <mesh position={[0.15, 0.75, 0.3]} material={redEyeMaterial}> 
                    <boxGeometry args={[0.1, 0.1, 0.05]} />
                </mesh>
                 <mesh position={[-0.15, 0.75, 0.3]} material={redEyeMaterial}> 
                    <boxGeometry args={[0.1, 0.1, 0.05]} />
                </mesh>
                {/* Mouth */}
                <mesh position={[0, 0.6, 0.3]} material={mouthMaterial}> 
                    <boxGeometry args={[0.2, 0.15, 0.05]} />
                </mesh>
                {/* Torso (Red Shirt) */} 
                <mesh castShadow position={[0, 0.05, 0]} material={isFlashing ? flashMaterial : redShirtMaterial}> 
                    <boxGeometry args={[0.7, 0.7, 0.45]} /> 
                </mesh>
                {/* Shirt Tear Detail */}
                <mesh position={[0.15, 0.1, 0.23]} material={isFlashing ? flashMaterial : greenSkinMaterial}> 
                    <boxGeometry args={[0.2, 0.15, 0.02]} />
                </mesh>
                {/* REMADE Arms */} 
                <mesh ref={leftArmRef as React.Ref<THREE.Mesh>} castShadow position={[-0.475, 0.2, 0.3]} rotation={[-Math.PI / 2, 0, 0]} material={isFlashing ? flashMaterial : greenSkinMaterial}> 
                    <boxGeometry args={[0.15, 0.8, 0.25]} /> 
                </mesh>
                 <mesh ref={rightArmRef as React.Ref<THREE.Mesh>} castShadow position={[0.475, 0.2, 0.3]} rotation={[-Math.PI / 2, 0, 0]} material={isFlashing ? flashMaterial : greenSkinMaterial}> 
                    <boxGeometry args={[0.15, 0.8, 0.25]} />
                </mesh>
                {/* Legs */} 
                 <mesh ref={leftLegRef as React.Ref<THREE.Mesh>} castShadow position={[-0.15, -0.65, 0]} material={isFlashing ? flashMaterial : brownPantsMaterial}> 
                    <boxGeometry args={[0.25, 0.7, 0.25]} /> 
                </mesh>
                 <mesh ref={rightLegRef as React.Ref<THREE.Mesh>} castShadow position={[0.15, -0.65, 0]} material={isFlashing ? flashMaterial : brownPantsMaterial}> 
                    <boxGeometry args={[0.25, 0.7, 0.25]} /> 
                </mesh>
            </group>
        )}

        {/* --- Brute Zombie (Keep As Is for now) --- */}
        {type === 'zombie_brute' && (
             // Voxel build for brute zombie - Scale the visual group
            <group scale={1.5}> {/* Apply scale here, adjust if needed */}
                {/* Head - Square, Flat Top */}
                <mesh castShadow position={[0, 0.95, 0]} material={isFlashing ? flashMaterial : greenSkinMaterial}> {/* Main head block */}
                    <boxGeometry args={[0.7, 0.6, 0.7]} /> 
                </mesh>
                <mesh castShadow position={[0, 1.25, 0]} material={isFlashing ? flashMaterial : greenSkinMaterial}> {/* Flat top */}
                    <boxGeometry args={[0.75, 0.1, 0.75]} /> 
                </mesh>
                {/* Eyes (adjusted position) */}
                <mesh position={[0.2, 0.95, 0.35]} material={redEyeMaterial}> 
                    <boxGeometry args={[0.12, 0.12, 0.05]} />
                </mesh>
                 <mesh position={[-0.2, 0.95, 0.35]} material={redEyeMaterial}> 
                    <boxGeometry args={[0.12, 0.12, 0.05]} />
                </mesh>
                {/* Mouth */}
                <mesh position={[0, 0.8, 0.35]} material={mouthMaterial}> 
                    <boxGeometry args={[0.25, 0.18, 0.05]} />
                </mesh>
                {/* Torso (Green Skin) - Bulkier */}
                <mesh castShadow position={[0, 0.15, 0]} material={isFlashing ? flashMaterial : greenSkinMaterial}> {/* Main Torso */}
                    <boxGeometry args={[0.8, 0.9, 0.5]} /> 
                </mesh>
                <mesh castShadow position={[0.55, 0.4, 0]} material={isFlashing ? flashMaterial : greenSkinMaterial}> {/* Right Shoulder */}
                    <boxGeometry args={[0.3, 0.4, 0.5]} /> 
                </mesh>
                 <mesh castShadow position={[-0.55, 0.4, 0]} material={isFlashing ? flashMaterial : greenSkinMaterial}> {/* Left Shoulder */}
                    <boxGeometry args={[0.3, 0.4, 0.5]} /> 
                </mesh>
                {/* REMADE Arms - Apply Group ref */} 
                <group ref={leftArmRef as React.Ref<THREE.Group>} position={[-0.55, 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}> {/* Positioned relative to shoulder/torso, Added X rotation */} 
                    <mesh castShadow material={isFlashing ? flashMaterial : greenSkinMaterial} position={[0, 0, 0]}> {/* Bicep */} 
                         <boxGeometry args={[0.35, 0.6, 0.35]} /> {/* Adjusted length */} 
                    </mesh>
                    <mesh castShadow material={isFlashing ? flashMaterial : greenSkinMaterial} position={[0, -0.6, 0]}> {/* Forearm, positioned below bicep */} 
                         <boxGeometry args={[0.3, 0.6, 0.3]} /> {/* Adjusted length */} 
                    </mesh>
                </group>
                 <group ref={rightArmRef as React.Ref<THREE.Group>} position={[0.55, 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}> {/* Positioned relative to shoulder/torso, Added X rotation */} 
                     <mesh castShadow material={isFlashing ? flashMaterial : greenSkinMaterial} position={[0, 0, 0]}> {/* Bicep */} 
                         <boxGeometry args={[0.35, 0.6, 0.35]} /> {/* Adjusted length */} 
                    </mesh>
                    <mesh castShadow material={isFlashing ? flashMaterial : greenSkinMaterial} position={[0, -0.6, 0]}> {/* Forearm, positioned below bicep */} 
                         <boxGeometry args={[0.3, 0.6, 0.3]} /> {/* Adjusted length */} 
                    </mesh>
                </group>
                {/* Legs (Brown Shorts) - Thicker */}
                {/* Left Leg - Apply ref to group */} 
                 <group ref={leftLegRef as React.Ref<THREE.Group>} position={[-0.2, -0.8, 0]}> 
                     <mesh castShadow material={isFlashing ? flashMaterial : brownPantsMaterial} position={[0, 0.25, 0]}> {/* Thigh */}
                         <boxGeometry args={[0.4, 0.5, 0.4]} /> 
                     </mesh>
                     <mesh castShadow material={isFlashing ? flashMaterial : greenSkinMaterial} position={[0, -0.3, 0]}> {/* Shin */}
                         <boxGeometry args={[0.35, 0.6, 0.35]} /> 
                     </mesh>
                     {/* Torn Short Detail */}
                     <mesh material={brownPantsMaterial} position={[0.1, 0.05, 0.21]} rotation={[0,0,0.2]}><boxGeometry args={[0.1, 0.15, 0.02]} /></mesh>
                     <mesh material={brownPantsMaterial} position={[-0.1, 0.05, 0.21]} rotation={[0,0,-0.2]}><boxGeometry args={[0.1, 0.15, 0.02]} /></mesh>
                 </group>
                {/* Right Leg - Apply ref to group */} 
                 <group ref={rightLegRef as React.Ref<THREE.Group>} position={[0.2, -0.8, 0]}> 
                      <mesh castShadow material={isFlashing ? flashMaterial : brownPantsMaterial} position={[0, 0.25, 0]}> {/* Thigh */}
                         <boxGeometry args={[0.4, 0.5, 0.4]} /> 
                     </mesh>
                     <mesh castShadow material={isFlashing ? flashMaterial : greenSkinMaterial} position={[0, -0.3, 0]}> {/* Shin */} 
                         <boxGeometry args={[0.35, 0.6, 0.35]} /> 
                     </mesh>
                     {/* Torn Short Detail */}
                     <mesh material={brownPantsMaterial} position={[0.1, 0.05, 0.21]} rotation={[0,0,0.2]}><boxGeometry args={[0.1, 0.15, 0.02]} /></mesh>
                     <mesh material={brownPantsMaterial} position={[-0.1, 0.05, 0.21]} rotation={[0,0,-0.2]}><boxGeometry args={[0.1, 0.15, 0.02]} /></mesh>
                 </group>
            </group>
        )}

        {/* Add other types here if needed, e.g.:
        {type === 'some_other_zombie' && (
          <group>
            // ... geometry ...
          </group>
        )}
        */}

         {/* Fallback (Remove or comment out for testing) */}
         {/* 
         {!['zombie_standard_shirt', 'zombie_brute'].includes(type) && (
            <mesh material={greenSkinMaterial}>
                <boxGeometry args={[0.5, 1.5, 0.5]} /> 
                <meshBasicMaterial color="purple" wireframe />
            </mesh>
         )}
         */}
      </group>
    );
  }
);

ZombieModel.displayName = 'ZombieModel'; // Update display name

export default ZombieModel; 