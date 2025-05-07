"use client";

import { Sparkles } from '@react-three/drei';

// This component now creates a large, static volume of sparkles
// even though its filename is DriftingSparkles.tsx, to resolve build issues.
const DriftingSparkles = () => {
  // Significantly increased scale for an omnipresent feel
  const sparklesScaleVec: [number, number, number] = [150, 50, 150]; 
  // Adjusted count for better density
  const particleCount = 3000;

  return (
    <Sparkles
      count={particleCount}
      scale={sparklesScaleVec}
      size={2.5} // Slightly reduced size
      speed={0} 
      noise={0} 
      color="red"
    />
  );
};

export default DriftingSparkles; 