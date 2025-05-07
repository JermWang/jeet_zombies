"use client";

import { useEffect, useRef } from 'react';
import { Howl } from 'howler';
// import useGameStore from '@/hooks/useGameStore'; // No longer needed if always active

const AMBIENT_SOUND_FILE = '/sounds/ambientmapnoise.mp3';
const PLAY_INTERVAL_SECONDS = 120; // Every 2 minutes

const AmbientSoundManager = () => {
  // const { gameStarted } = useGameStore(); // No longer needed
  const soundRef = useRef<Howl | null>(null);
  const intervalIdRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Initialize sound - This will now run as soon as the component mounts
    console.log("[AmbientSoundManager] Initializing ambient sound...");
    soundRef.current = new Howl({
      src: [AMBIENT_SOUND_FILE],
      volume: 0.3, 
      html5: true, 
    });

    const playSound = () => {
      if (soundRef.current) {
        console.log("[AmbientSoundManager] Playing ambientmapnoise.mp3");
        soundRef.current.play();
      }
    };

    playSound(); 
    intervalIdRef.current = setInterval(playSound, PLAY_INTERVAL_SECONDS * 1000);

    return () => {
      console.log("[AmbientSoundManager] Cleaning up ambient sound.");
      if (intervalIdRef.current) {
        clearInterval(intervalIdRef.current);
      }
      if (soundRef.current) {
        soundRef.current.stop();
        soundRef.current.unload();
        soundRef.current = null;
      }
    };
  }, []); // Empty dependency array means this runs once on mount and cleans up on unmount

  return null; 
};

export default AmbientSoundManager; 