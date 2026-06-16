"use client";

import { useEffect } from "react"
import { useInitializeSounds, useSoundEffects } from "@/hooks/useSoundEffects"

/**
 * Initializes the audio system by creating an AudioListener,
 * adding it to the camera, initializing the sound effects store,
 * and loading the necessary audio buffers.
 *
 * This component is mounted for the whole app lifecycle (menu + in-game), so it
 * is the single owner of the looping background music — that's why the music
 * now starts on the START SCREEN as soon as the user enables audio, instead of
 * only once the in-game Player mounted.
 */
export default function AudioInitializer() {
  // Use the hook to get loading state and the resume function
  const { isLoading, resumeAudioContext, audioContextStarted } = useInitializeSounds()

  // Single source of truth for background music: start it (looping) the moment
  // the audio context is unlocked AND the music buffer has finished loading.
  const ambientMusicBuffer = useSoundEffects((s) => s.ambientMusicBuffer)
  const playAmbientMusic = useSoundEffects((s) => s.playAmbientMusic)

  useEffect(() => {
    if (audioContextStarted && ambientMusicBuffer) {
      playAmbientMusic() // idempotent — guards against double-play internally
    }
  }, [audioContextStarted, ambientMusicBuffer, playAmbientMusic])

  // Effect to handle initial user interaction for audio context
  useEffect(() => {
    // console.log("Adding audio context resume listeners (click/keydown).");
    const resumeAudio = () => {
      if (Howler.ctx && Howler.ctx.state === "suspended") {
        resumeAudioContext();
        // Remove the listener after the first interaction
        window.removeEventListener("click", resumeAudio);
        window.removeEventListener("keydown", resumeAudio);
      }
    };

    // Add listeners if context hasn't started yet
    if (!audioContextStarted) {
      // console.log("Adding audio context resume listeners (click/keydown).");
      window.addEventListener("click", resumeAudio);
      window.addEventListener("keydown", resumeAudio);
    } else {
        console.log("Audio context already started, no listeners needed.");
    }

    // Cleanup function to remove listeners if the component unmounts
    return () => {
       console.log("Cleaning up audio context resume listeners.");
       window.removeEventListener("click", resumeAudio);
       window.removeEventListener("keydown", resumeAudio);
    };
  }, [resumeAudioContext, audioContextStarted]); // Dependencies

  // You might want to show a loading indicator or nothing while sounds load
  // For now, this component doesn't render anything visible
  return null;
} 