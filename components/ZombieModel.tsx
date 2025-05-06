import React, { useMemo, forwardRef } from 'react';
import * as THREE from 'three';

// Define the props, including refs for animation targeting and type
interface ZombieModelProps {
  type: string; // 'zombie_standard_shirt' | 'zombie_brute' | etc.
  leftArmRef?: React.Ref<THREE.Object3D>; // Use Object3D for groups/meshes
  rightArmRef?: React.Ref<THREE.Object3D>;
  leftLegRef?: React.Ref<THREE.Object3D>;
  rightLegRef?: React.Ref<THREE.Object3D>;
  isFlashing?: boolean; // Prop to control flash effect
}

// Create materials (can be shared or made conditional if types differ drastically)
const ZombieModel = forwardRef<THREE.Group, ZombieModelProps>(
  ({ type, leftArmRef, rightArmRef, leftLegRef, rightLegRef, isFlashing }, ref) => {
    // Shared materials
    const greenSkinMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: '#5a8a58', roughness: 0.8 }), []);
    const redEyeMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: '#ff0000', emissive: '#ff0000', emissiveIntensity: 2 }), []);
    const brownPantsMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: '#6b4d3b', roughness: 0.7 }), []);
    const mouthMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: '#400000', roughness: 0.9 }), []);
    // Standard specific
    const redShirtMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: '#a13a3a', roughness: 0.7 }), []);
    
    // Note: Brute uses greenSkinMaterial for torso and brownPantsMaterial for shorts

    // Simple red flash material
    const flashMaterial = useMemo(() => new THREE.MeshStandardMaterial({ 
        color: '#FF0000', 
        emissive: '#FF0000', 
        emissiveIntensity: 1, 
        roughness: 1, 
        metalness: 0
    }), []);

    // Conditionally return JSX based on type
    return (
      <group ref={ref}>
        {/* --- Standard Zombie --- */}
        {type === 'zombie_standard_shirt' && (
            <group>
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