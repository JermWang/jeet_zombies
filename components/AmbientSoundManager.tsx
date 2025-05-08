"use client";

import { useEffect, useRef } from 'react';
import { Howl } from 'howler';
// import useGameStore from '@/hooks/useGameStore'; // No longer needed if always active

const AMBIENT_SOUND_FILE_MAPNOISE = '/sounds/ambientmapnoise.mp3';
const AMBIENT_SOUND_FILE_MAIN = '/sounds/ambient.mp3'; // New sound file
const PLAY_INTERVAL_SECONDS_MAPNOISE = 120; // Every 2 minutes for map noise

const AmbientSoundManager = () => {
  // const { gameStarted } = useGameStore(); // No longer needed
  const mapNoiseSoundRef = useRef<Howl | null>(null);
  const mainAmbientSoundRef = useRef<Howl | null>(null); // Ref for the new ambient sound
  const intervalIdRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Initialize map noise sound
    console.log("[AmbientSoundManager] Initializing map noise ambient sound...");
    mapNoiseSoundRef.current = new Howl({
      src: [AMBIENT_SOUND_FILE_MAPNOISE],
      volume: 0.3, 
      html5: true, 
    });

    const playMapNoiseSound = () => {
      if (mapNoiseSoundRef.current) {
        console.log("[AmbientSoundManager] Playing ambientmapnoise.mp3");
        mapNoiseSoundRef.current.play();
      }
    };

    playMapNoiseSound(); 
    intervalIdRef.current = setInterval(playMapNoiseSound, PLAY_INTERVAL_SECONDS_MAPNOISE * 1000);

    // Initialize main ambient sound (looping)
    console.log("[AmbientSoundManager] Initializing main ambient sound (ambient.mp3)...");
    mainAmbientSoundRef.current = new Howl({
      src: [AMBIENT_SOUND_FILE_MAIN],
      volume: 0.26, // Volume increased by 30% from 0.2 to 0.26
      html5: true,
      loop: true, // Set to loop
    });

    if (mainAmbientSoundRef.current) {
      console.log("[AmbientSoundManager] Playing ambient.mp3 (looping)");
      mainAmbientSoundRef.current.play();
    }

    return () => {
      console.log("[AmbientSoundManager] Cleaning up ambient sounds.");
      if (intervalIdRef.current) {
        clearInterval(intervalIdRef.current);
      }
      if (mapNoiseSoundRef.current) {
        mapNoiseSoundRef.current.stop();
        mapNoiseSoundRef.current.unload();
        mapNoiseSoundRef.current = null;
      }
      if (mainAmbientSoundRef.current) { // Cleanup for the new sound
        mainAmbientSoundRef.current.stop();
        mainAmbientSoundRef.current.unload();
        mainAmbientSoundRef.current = null;
      }
    };
  }, []); // Empty dependency array means this runs once on mount and cleans up on unmount

  return null; 
};

export default AmbientSoundManager; 