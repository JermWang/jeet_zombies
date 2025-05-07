"use client";

import { useEffect, useState, useRef, Dispatch, SetStateAction } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const VIEWPOINTS = [
  // Revised viewpoints to focus on outskirts
  { position: new THREE.Vector3(60, 5, 50), target: new THREE.Vector3(30, 2, 20) },    // Distant Low Angle - Grassy Outskirt (Positive X, Positive Z Quadrant)
  { position: new THREE.Vector3(-50, 10, 40), target: new THREE.Vector3(0, 3, -20) },  // Forest Outskirt - Looking Across (Negative X, Positive Z Quadrant)
  { position: new THREE.Vector3(40, 30, -60), target: new THREE.Vector3(0, 5, -30) }, // High Aerial - Edge View (Positive X, Negative Z Quadrant)
  { position: new THREE.Vector3(-55, 8, -45), target: new THREE.Vector3(-20, 2, 0) }   // Reverse Distant Outskirt (Negative X, Negative Z Quadrant)
];

const VIEW_DURATION = 5000; // 5 seconds viewable time
const FADE_DURATION = 300; // VERY FAST FADE: 0.3 seconds fade time for a near cross-fade illusion
const SLOW_PAN_STRENGTH = 0.5; // How much the camera target subtly shifts
const SLOW_PAN_SPEED = 0.05; // Speed of the subtle pan

interface PreviewCycleCameraProps {
  onFadeOpacityChange: Dispatch<SetStateAction<number>>;
  onInitialFadeComplete?: () => void;
}

const PreviewCycleCamera = ({ onFadeOpacityChange, onInitialFadeComplete }: PreviewCycleCameraProps) => {
  const { camera } = useThree();
  const [currentViewpointIndex, setCurrentViewpointIndex] = useState(0);
  const [internalFadeOpacity, setInternalFadeOpacity] = useState(1); // Local state for calculation
  const [phase, setPhase] = useState('fadingIn'); // 'fadingIn', 'visible', 'fadingOut'
  
  const timeoutIdRef = useRef<NodeJS.Timeout | null>(null);
  const currentTarget = useRef(new THREE.Vector3()); // For slow pan target
  const baseTarget = useRef(new THREE.Vector3()); // Base target for current viewpoint
  const initialFadeReportedRef = useRef(false); // To ensure onInitialFadeComplete is called only once

  useEffect(() => {
    // Initialize camera to the first viewpoint immediately
    const initialViewpoint = VIEWPOINTS[currentViewpointIndex];
    camera.position.copy(initialViewpoint.position);
    baseTarget.current.copy(initialViewpoint.target);
    currentTarget.current.copy(initialViewpoint.target);
    camera.lookAt(currentTarget.current);
    setInternalFadeOpacity(1); // Ensure starts black
    onFadeOpacityChange(1); // Propagate initial opacity
    setPhase('fadingIn');
    initialFadeReportedRef.current = false; // Reset for potential re-mounts, though unlikely here
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Initial setup

  useEffect(() => {
    onFadeOpacityChange(internalFadeOpacity); // Keep parent updated
  }, [internalFadeOpacity, onFadeOpacityChange]);

  useEffect(() => {
    if (timeoutIdRef.current) clearTimeout(timeoutIdRef.current);

    if (phase === 'visible') {
      timeoutIdRef.current = setTimeout(() => {
        setPhase('fadingOut');
      }, VIEW_DURATION);
    } else if (phase === 'fadingOutComplete') {
      const nextIndex = (currentViewpointIndex + 1) % VIEWPOINTS.length;
      setCurrentViewpointIndex(nextIndex);
      const nextViewpoint = VIEWPOINTS[nextIndex];
      camera.position.copy(nextViewpoint.position);
      baseTarget.current.copy(nextViewpoint.target);
      currentTarget.current.copy(nextViewpoint.target); // Reset pan target
      camera.lookAt(currentTarget.current);
      camera.updateProjectionMatrix();
      setPhase('fadingIn');
    }

    return () => {
      if (timeoutIdRef.current) clearTimeout(timeoutIdRef.current);
    };
  }, [phase, currentViewpointIndex, camera]);

  useFrame((state, delta) => {
    let newOpacity = internalFadeOpacity;
    if (phase === 'fadingIn') {
      newOpacity = Math.max(0, internalFadeOpacity - delta * (1 / (FADE_DURATION / 1000)));
      if (newOpacity <= 0) {
        setPhase('visible');
        newOpacity = 0;
        if (onInitialFadeComplete && !initialFadeReportedRef.current) {
          onInitialFadeComplete();
          initialFadeReportedRef.current = true;
        }
      }
    } else if (phase === 'fadingOut') {
      newOpacity = Math.min(1, internalFadeOpacity + delta * (1 / (FADE_DURATION / 1000)));
      if (newOpacity >= 1) {
        setPhase('fadingOutComplete');
        newOpacity = 1;
      }
    }
    setInternalFadeOpacity(newOpacity);

    if (phase === 'visible') {
      // Slow eerie pan
      const time = state.clock.elapsedTime;
      const panOffsetX = Math.sin(time * SLOW_PAN_SPEED) * SLOW_PAN_STRENGTH;
      const panOffsetZ = Math.cos(time * SLOW_PAN_SPEED * 0.7) * SLOW_PAN_STRENGTH; // Slightly different speed for Z
      
      currentTarget.current.lerp(baseTarget.current.clone().add(new THREE.Vector3(panOffsetX, 0, panOffsetZ)), 0.05);
      camera.lookAt(currentTarget.current);
    }
    camera.updateProjectionMatrix(); 
  });

  return null; // No longer renders the div
};

export default PreviewCycleCamera; 