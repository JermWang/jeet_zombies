import React, { useMemo, forwardRef } from 'react';
import * as THREE from 'three';

// Define the props, including refs for animation targeting
interface StandardZombieModelProps {
  leftArmRef?: React.Ref<THREE.Mesh>;
  rightArmRef?: React.Ref<THREE.Mesh>;
  leftLegRef?: React.Ref<THREE.Mesh>;
  rightLegRef?: React.Ref<THREE.Mesh>;
  // Add any other props needed, e.g., custom materials if they shouldn't be defined here
}

// Create materials within the component using useMemo for efficiency
const StandardZombieModel = forwardRef<THREE.Group, StandardZombieModelProps>(
  ({ leftArmRef, rightArmRef, leftLegRef, rightLegRef }, ref) => {
    const greenSkinMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: '#5a8a58', roughness: 0.8 }), []);
    const redEyeMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: '#ff0000', emissive: '#ff0000', emissiveIntensity: 2 }), []);
    const redShirtMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: '#a13a3a', roughness: 0.7 }), []);
    const brownPantsMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: '#6b4d3b', roughness: 0.7 }), []);
    const mouthMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: '#400000', roughness: 0.9 }), []); // Dark red/black

    return (
      // Voxel build for standard zombie with shirt - Use the forwarded ref for the group
      <group ref={ref}>
        {/* Head */}
        <mesh castShadow position={[0, 0.7, 0]} material={greenSkinMaterial}>
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
        <mesh castShadow position={[0, 0.05, 0]} material={redShirtMaterial}>
          <boxGeometry args={[0.7, 0.7, 0.45]} />
        </mesh>
        {/* Shirt Tear Detail (Green Skin showing) */}
        <mesh position={[0.15, 0.1, 0.23]} material={greenSkinMaterial}> {/* Offset slightly forward */}
          <boxGeometry args={[0.2, 0.15, 0.02]} />
        </mesh>
        {/* Arms - Apply Mesh ref from props */}
        <mesh ref={leftArmRef} castShadow position={[-0.5, 0.1, 0.3]} rotation={[ -Math.PI / 2, 0, 0 ]} material={greenSkinMaterial}>
          <boxGeometry args={[0.25, 0.8, 0.25]} />
        </mesh>
        <mesh ref={rightArmRef} castShadow position={[0.5, 0.1, 0.3]} rotation={[ -Math.PI / 2, 0, 0 ]} material={greenSkinMaterial}>
          <boxGeometry args={[0.25, 0.8, 0.25]} />
        </mesh>
        {/* Legs - Apply Mesh ref from props */}
        <mesh ref={leftLegRef} castShadow position={[-0.15, -0.65, 0]} material={brownPantsMaterial}>
          <boxGeometry args={[0.25, 0.7, 0.25]} />
        </mesh>
        <mesh ref={rightLegRef} castShadow position={[0.15, -0.65, 0]} material={brownPantsMaterial}>
          <boxGeometry args={[0.25, 0.7, 0.25]} />
        </mesh>
      </group>
    );
  }
);

StandardZombieModel.displayName = 'StandardZombieModel'; // Add display name for DevTools

export default StandardZombieModel; 