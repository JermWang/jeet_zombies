"use client";

import * as THREE from 'three';
import { CuboidCollider, CylinderCollider, RigidBody, BallCollider } from '@react-three/rapier';
import { useMemo } from 'react';
import { Instances, Instance, useGLTF } from '@react-three/drei'; // Import for instancing and useGLTF

// Darker, stylized materials
const stoneMaterial = new THREE.MeshStandardMaterial({
  color: '#282828', 
  roughness: 0.8, 
  emissive: '#1a0000', // Subtle red glow for "haunted"
  emissiveIntensity: 0.4
});
const woodMaterial = new THREE.MeshStandardMaterial({ color: '#21170f', roughness: 0.9 }); 
const foliageMaterial = new THREE.MeshStandardMaterial({ color: '#183418', roughness: 0.7 });
const rockMaterial = new THREE.MeshStandardMaterial({ color: '#4a4a4a', roughness: 0.9 }); // Rock material
const poleMaterial = new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.8, metalness: 0.5 }); // Dark metallic pole
const lightOrbMaterial = new THREE.MeshStandardMaterial({ color: '#ff2200', emissive: '#ff2200', emissiveIntensity: 5, toneMapped: false }); // INCREASED emissiveIntensity

// Define geometries once
const gravestoneVertGeo = new THREE.BoxGeometry(0.2, 1.2, 0.15);
const gravestoneHorzGeo = new THREE.BoxGeometry(0.6, 0.2, 0.15);
const treeTrunkGeo = new THREE.CylinderGeometry(0.15, 0.15, 1.2, 6);
const foliageGeo1 = new THREE.ConeGeometry(0.9, 1.0, 8); 
const foliageGeo2 = new THREE.ConeGeometry(0.7, 1.0, 8);
const foliageGeo3 = new THREE.ConeGeometry(0.5, 1.0, 8);
const rockGeo = new THREE.IcosahedronGeometry(0.4, 0);
// Enhanced Pole Geometries
const poleBaseGeo = new THREE.CylinderGeometry(0.3, 0.4, 0.8, 8); // Wider, shorter base
const poleShaftGeo = new THREE.CylinderGeometry(0.1, 0.1, 5.2, 8); // Main shaft (height adjusted)
const lampHeadBaseGeo = new THREE.CylinderGeometry(0.2, 0.15, 0.3, 6); // Small base for the lamp head
const lampHeadGeo = new THREE.SphereGeometry(0.3, 8, 6); // Simple sphere for lamp head placeholder
const lightOrbGeo = new THREE.SphereGeometry(0.15, 16, 8); // INCREASED radius for the visible light source

// --- Instanced Components --- 

function Gravestones({ data }: { data: { position: [number, number, number], rotation: [number, number, number] }[] }) {
  return (
    <group>
      {data.map(({ position, rotation }, i) => (
        <RigidBody key={i} type="fixed" colliders={false} position={position} rotation={rotation}> 
           {/* Vertical Part */}
          <mesh castShadow receiveShadow geometry={gravestoneVertGeo} material={stoneMaterial} position={[0, 0.6, 0]} />
          {/* Horizontal Part */}
          <mesh castShadow receiveShadow geometry={gravestoneHorzGeo} material={stoneMaterial} position={[0, 0.8, 0]} />
          {/* Combined Collider (approximate) */}
          <CuboidCollider args={[0.3, 0.7, 0.1]} position={[0, 0.7, 0]} />
        </RigidBody>
      ))}
    </group>
  );
}

// Updated Trees component using GLTF model
function Trees({ data }: { data: { position: [number, number, number], rotation: [number, number, number], scale: number }[] }) {
  const { scene: treeModel } = useGLTF('/models/stylised_tree.glb');

  // Clone the scene for each instance to avoid sharing transformations
  const clones = useMemo(() => data.map(() => treeModel.clone()), [data, treeModel]);

  // Define desired collider size (10x smaller than visual scale implies)
  const colliderArgs: [number, number] = [10, 2]; // height/2, radius
  const colliderPosition: [number, number, number] = [0, 10, 0]; // center Y at half-height

  return (
    <group>
      {data.map(({ position, rotation, scale }, i) => (
        <RigidBody 
          key={`tree-${i}`} 
          type="fixed" 
          colliders={false} 
          position={position} 
          rotation={rotation} 
        >
          {/* Apply visual scale directly to the primitive */}
          <primitive object={clones[i]} dispose={null} scale={scale} /> 
          {/* Use the pre-calculated smaller collider args/position */}
          <CylinderCollider args={colliderArgs} position={colliderPosition} /> 
        </RigidBody>
      ))}
    </group>
  );
}

// New Barrels component using GLTF model
function Barrels({ data }: { data: { position: [number, number, number], rotation: [number, number, number], scale: number }[] }) {
  const { scene: barrelModel } = useGLTF('/models/industrial_barrel.glb');
  const clones = useMemo(() => data.map(() => barrelModel.clone()), [data, barrelModel]);
  
  return (
    <group>
      {data.map(({ position, rotation, scale }, i) => (
        <RigidBody key={`barrel-${i}`} type="fixed" colliders={false} position={position} rotation={rotation} scale={scale}>
          <primitive object={clones[i]} dispose={null} />
          {/* Adjust collider based on barrel model */}
          <CylinderCollider args={[0.6 * scale, 0.4 * scale]} position={[0, 0.6 * scale, 0]} /> 
        </RigidBody>
      ))}
    </group>
  );
}

// New Rocks Component
function Rocks({ data }: { data: { position: [number, number, number], rotation: [number, number, number], scale: number }[] }) {
  return (
    <group>
      {data.map(({ position, rotation, scale }, i) => (
        <RigidBody key={`rock-${i}`} type="fixed" colliders={false} position={position} rotation={rotation} scale={scale}>
          <mesh castShadow receiveShadow geometry={rockGeo} material={rockMaterial} />
          {/* Simple sphere collider for rocks */}
          <BallCollider args={[0.4 * scale]} /> 
        </RigidBody>
      ))}
    </group>
  );
}

// --- NEW Light Pole Component ---
function LightPoles({ data }: { data: { position: [number, number, number] }[] }) {
  const lightColor = "#ff2200"; // Red light
  const lightIntensity = 30; // Increased intensity significantly
  const lightDistance = 40;  // Increased falloff distance
  const poleBaseHeight = 0.8;
  const poleShaftHeight = 5.2;
  const lampHeadBaseHeight = 0.3;
  const lightOffsetY = poleBaseHeight + poleShaftHeight + lampHeadBaseHeight - 0.1; // Position light inside lamp head
  const lampHeadY = poleBaseHeight + poleShaftHeight; // Position lamp head base above shaft

  return (
    <group>
      {data.map(({ position }, i) => (
        <RigidBody 
          key={`pole-${i}`} 
          type="fixed" 
          colliders={false} // Use explicit collider
          position={position}
        >
          {/* Enhanced Pole Meshes */}
          {/* Base */}
          <mesh castShadow geometry={poleBaseGeo} material={poleMaterial} position={[0, poleBaseHeight / 2, 0]} />
          {/* Shaft */}
          <mesh castShadow geometry={poleShaftGeo} material={poleMaterial} position={[0, poleBaseHeight + poleShaftHeight / 2, 0]} />
          {/* Lamp Head Base */}
          <mesh castShadow geometry={lampHeadBaseGeo} material={poleMaterial} position={[0, lampHeadY + lampHeadBaseHeight / 2, 0]} />
          {/* Lamp Head Sphere (Placeholder) */}
          <mesh 
            castShadow 
            geometry={lampHeadGeo} 
            material={poleMaterial} 
            position={[0, lampHeadY + lampHeadBaseHeight + 0.15, 0]} // Position sphere slightly above base
          />
          {/* Explicit Cylinder Collider - Adjusted for new height */}
          <CylinderCollider args={[(poleBaseHeight + poleShaftHeight + lampHeadBaseHeight) / 2, 0.4]} position={[0, (poleBaseHeight + poleShaftHeight + lampHeadBaseHeight) / 2, 0]} /> 
          {/* Red Point Light */}
          <pointLight 
            color={lightColor} 
            intensity={lightIntensity} 
            distance={lightDistance} 
            position={[0, lightOffsetY, 0]} 
          />
          {/* Visible Light Orb */}
          <mesh 
            geometry={lightOrbGeo} 
            material={lightOrbMaterial} 
            position={[0, lightOffsetY, 0]} 
            castShadow={false} // Orb shouldn't cast shadows
          />
        </RigidBody>
      ))}
    </group>
  );
}

export default function EnvironmentAssets() {
  // Pre-calculate positions and random variations for gravestones
  const gravestoneData = useMemo(() => {
    const positions = [
      // Original corners
      [65, 0, 62], [68, 0, 65], [62, 0, 68],
      [-65, 0, -62], [-68, 0, -65], [-62, 0, -68],
      [65, 0, -62], [-65, 0, 62],
      // Add more scattered ones on grass
      [80, 0, 90], [-90, 0, 85], [85, 0, -95], [-95, 0, -80],
      [110, 0, 70], [-75, 0, 115], [70, 0, -120], [-125, 0, -65],
      [95, 0, 130], [-135, 0, 90], [140, 0, -80], [-85, 0, -140],
      // Some slightly closer clusters
      [55, 0, 75], [58, 0, 72], [-72, 0, -58], [-75, 0, -55],
      [70, 0, -60], [68, 0, -63], [-62, 0, 70], [-60, 0, 73],
    ];
    return positions.map(pos => ({
      position: pos as [number, number, number],
      rotation: [0, Math.random() * Math.PI, Math.random() * 0.1 - 0.05] as [number, number, number]
    }));
  }, []);

  // Pre-calculate positions and random variations for trees
  const treeData = useMemo(() => {
    const positions: [number, number, number][] = [];
    const treeCount = 50; // Increase tree count further
    const minRadius = 75; // Pushed further out
    const maxRadius = 145; // Push closer to the edge (150)
    const pavedHalfSize = 50; // Half the size of the central paved area
    for (let i = 0; i < treeCount; i++) {
        let x, z;
        do {
            const angle = Math.random() * Math.PI * 2;
            const radius = minRadius + Math.random() * (maxRadius - minRadius);
            x = Math.cos(angle) * radius;
            z = Math.sin(angle) * radius;
            // Check if the point is outside the paved area
        } while (Math.abs(x) <= pavedHalfSize && Math.abs(z) <= pavedHalfSize);
        positions.push([x, -1, z]); // Keep Y=-1 for this model
    }
    return positions.map(pos => ({
      position: pos as [number, number, number],
      rotation: [0, Math.random() * Math.PI, 0] as [number, number, number], 
      // Significantly increase scale for larger trees
      scale: 100 + Math.random() * 8 - 4 // Base scale 18, variation +/- 4 (Range: 14-22)
    }));
  }, []);

  // Data for Barrels (Scattered)
  const barrelData = useMemo(() => {
    const positions: [number, number, number][] = [];
    for (let i = 0; i < 15; i++) { // Keep 15 barrels
      const angle = Math.random() * Math.PI * 2;
      const radius = 55 + Math.random() * 25; 
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      positions.push([x, 0, z]); 
    }
    return positions.map(pos => ({
      position: pos as [number, number, number],
      rotation: [Math.random()*0.1-0.05, Math.random() * Math.PI, Math.random()*0.1-0.05] as [number, number, number], // Random tilt
      scale: 1.0 + Math.random() * 0.4 - 0.2 // Slight scale variation
    }));
  }, []);

  // Data for Rocks (Scattered)
  const rockData = useMemo(() => {
    const positions: [number, number, number][] = [];
    const pavedHalfSize = 50; // Define for rocks as well
    for (let i = 0; i < 120; i++) { // Increase to 120 rocks
        let x, z;
        do {
            const angle = Math.random() * Math.PI * 2;
            const minRockRadius = 70; // Pushed further out
            const maxRockRadius = 140; // Push closer to the edge (150)
            const radius = minRockRadius + Math.random() * (maxRockRadius - minRockRadius);
            x = Math.cos(angle) * radius;
            z = Math.sin(angle) * radius;
            // Check if the point is outside the paved area (same pavedHalfSize as trees)
        } while (Math.abs(x) <= pavedHalfSize && Math.abs(z) <= pavedHalfSize);
        
        positions.push([x, 0.2, z]); // Place slightly above ground
    }
    return positions.map(pos => ({
      position: pos as [number, number, number],
      rotation: [Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI] as [number, number, number],
      scale: 0.8 + Math.random() * 0.8 // Scale between 0.8 and 1.6
    }));
  }, []);

  // --- Data for Light Poles (Scattered) ---
  const lightPoleData = useMemo(() => {
    const positions: [number, number, number][] = [];
    const poleCount = 10; // Number of poles
    const minRadius = 55; // Start near barrels
    const maxRadius = 100; // Spread them out
    const pavedHalfSize = 50;
    for (let i = 0; i < poleCount; i++) {
        let x, z;
        do {
            const angle = Math.random() * Math.PI * 2;
            const radius = minRadius + Math.random() * (maxRadius - minRadius);
            x = Math.cos(angle) * radius;
            z = Math.sin(angle) * radius;
        } while (Math.abs(x) <= pavedHalfSize && Math.abs(z) <= pavedHalfSize); 
        positions.push([x, 0, z]); // Place base at Y=0
    }
    return positions.map(pos => ({ position: pos as [number, number, number] }));
  }, []);

  return (
    <group>
      <Gravestones data={gravestoneData} />
      <Trees data={treeData} />
      <Barrels data={barrelData} />
      <Rocks data={rockData} />
      <LightPoles data={lightPoleData} />
    </group>
  );
} 