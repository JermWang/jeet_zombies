import React from 'react';
import * as THREE from 'three';
import { useTexture } from '@react-three/drei';

interface SpawnHoleProps {
  position: THREE.Vector3Tuple;
  size?: number; // Diameter of the hole
  // Add textureUrl prop once we have a texture
  // textureUrl: string;
}

const SpawnHole: React.FC<SpawnHoleProps> = ({
  position = [0, 0, 0],
  size = 2,
  // textureUrl,
}) => {
  // TODO: Replace placeholder material with a texture once available
  // const texture = useTexture(textureUrl);
  // texture.wrapS = texture.wrapT = THREE.RepeatWrapping;

  // Position slightly below ground (assuming ground is at y=0) to avoid z-fighting
  const holePosition: THREE.Vector3Tuple = [position[0], position[1] - 0.01, position[2]];

  return (
    <mesh position={holePosition} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[size, size]} />
      {/* Placeholder Material */}
      <meshStandardMaterial color="#222222" transparent opacity={0.8} />
      {/* 
      // TODO: Use this material when texture is ready
      <meshStandardMaterial 
        map={texture} 
        transparent // Needed if texture has alpha
        opacity={0.9} // Adjust as needed
        roughness={1}
        metalness={0}
      /> 
      */}
    </mesh>
  );
};

export default SpawnHole; 