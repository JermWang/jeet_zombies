"use client";

import { useEffect } from "react"
import { useInitializeSounds } from "@/hooks/useSoundEffects"

/**
 * Initializes the audio system by creating an AudioListener,
 * adding it to the camera, initializing the sound effects store,
 * and loading the necessary audio buffers.
 */
export default function AudioInitializer() {
  // Use the hook to get loading state and the resume function
  const { isLoading, resumeAudioContext, audioContextStarted } = useInitializeSounds()

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