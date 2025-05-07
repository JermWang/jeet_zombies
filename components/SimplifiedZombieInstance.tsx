"use client";

import React, { useMemo } from 'react';
import * as THREE from 'three';

// Using one of the materials from StandardZombieModel for consistency
const SimplifiedZombieInstance = React.forwardRef<THREE.Mesh>((props, ref) => {
  const redShirtMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: '#a13a3a', roughness: 0.7 }), []);

  return (
    <mesh {...props} ref={ref} castShadow material={redShirtMaterial} position={[0, 0.35, 0]}> {/* Centering roughly where a torso would be */} 
      <boxGeometry args={[0.7, 0.7, 0.45]} /> {/* Torso dimensions from StandardZombieModel */}
    </mesh>
  );
});

SimplifiedZombieInstance.displayName = 'SimplifiedZombieInstance';

export default SimplifiedZombieInstance; 