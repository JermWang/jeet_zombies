"use client"

import { create } from "zustand"
import { Howl } from "howler"
import { useEffect, useRef, useState, useCallback } from "react"

// Define the structure for our sound effects state
interface SoundEffectsState {
  audioContextStarted: boolean
  setAudioContextStarted: (started: boolean) => void

  // Sound Buffers using Howler
  pistolBuffer: Howl | null
  shotgunBuffer: Howl | null
  smgBuffer: Howl | null
  rifleBuffer: Howl | null
  reloadBuffer: Howl | null
  weaponSwitchBuffer: Howl | null
  jumpBuffer: Howl | null
  landBuffer: Howl | null
  zombieBiteBuffer: Howl | null
  zombieDeathBuffer: Howl | null
  gameStartBuffer: Howl | null
  ambientMapNoiseBuffer: Howl | null
  zombieAmbientBuffer: Howl | null, // New zombie ambient sound
  bulletImpactBuffer: Howl | null
  ambientMusicBuffer: Howl | null // Background music
  batBuffer: Howl | null          // Bat sound effect

  // NEW: Game Over sounds
  transitionBuffer: Howl | null
  outtaControlVOBuffer: Howl | null

  // NEW: Item Pickup sound
  itemPickupBuffer: Howl | null;

  // --- Add Wave VO Buffers ---
  waveClearedVOBuffer: Howl | null;
  waveIncomingVOBuffer: Howl | null;
  countdown3VOBuffer: Howl | null; // Assuming separate files or sprite logic later
  countdown2VOBuffer: Howl | null; // Assuming separate files or sprite logic later
  countdown1VOBuffer: Howl | null; // Assuming separate files or sprite logic later

  // Load function
  loadSounds: (soundPaths: { [key: string]: string }) => void

  // Playback functions
  playPistolSound: () => void
  playShotgunSound: () => void
  playSmgSound: () => void
  playRifleSound: () => void
  playReloadSound: () => void
  playWeaponSwitchSound: () => void
  playJumpSound: () => void
  playLandSound: () => void
  playZombieBiteSound: () => void
  playZombieDeathSound: () => void
  playGameStartSound: () => void
  playAmbientMapNoiseSound: () => void // Plays periodically
  playZombieAmbientSound: () => void, // New zombie ambient sound playback
  playBulletImpactSound: (position?: { x: number; y: number; z: number }) => void // Position optional for now
  playAmbientMusic: () => void // Plays looped background music
  playBatSound: () => void // Plays bat sound effect (with cooldown)

  // NEW: Game Over sound playback functions
  playTransitionSound: () => void
  playOuttaControlSound: () => void

  // NEW: Item Pickup sound playback function
  playItemPickupSound: () => void;

  // --- Add Wave VO Functions ---
  playWaveClearedVO: () => void;
  playWaveIncomingVO: () => void;
  playCountdownVO: (count: number) => void;

  // Internal state for map noise timing
  lastMapNoisePlayTime: number
  setLastMapNoisePlayTime: (time: number) => void
  // Internal state for bat sound timing
  lastBatSoundPlayTime: number
  setLastBatSoundPlayTime: (time: number) => void
  // Internal state for zombie ambient sound timing
  lastZombieAmbientPlayTime: number
  setLastZombieAmbientPlayTime: (time: number) => void
}

// Configuration
const MAP_NOISE_INTERVAL = 2 * 60 * 1000 // 2 minutes in milliseconds
const ZOMBIE_AMBIENT_INTERVAL = 90 * 1000 // 1.5 minutes in milliseconds
const BAT_SOUND_COOLDOWN = 7 * 60 * 1000 // 7 minutes in milliseconds (adjustable)

// Create the Zustand store
export const useSoundEffects = create<SoundEffectsState>((set, get) => ({
  audioContextStarted: false,
  setAudioContextStarted: (started) => set({ audioContextStarted: started }),

  // Initialize all buffers to null
  pistolBuffer: null,
  shotgunBuffer: null,
  smgBuffer: null,
  rifleBuffer: null,
  reloadBuffer: null,
  weaponSwitchBuffer: null,
  jumpBuffer: null,
  landBuffer: null,
  zombieBiteBuffer: null,
  zombieDeathBuffer: null,
  gameStartBuffer: null,
  ambientMapNoiseBuffer: null,
  zombieAmbientBuffer: null,
  bulletImpactBuffer: null,
  ambientMusicBuffer: null,
  batBuffer: null,

  // NEW: Game Over sounds
  transitionBuffer: null,
  outtaControlVOBuffer: null,

  // NEW: Item Pickup sound
  itemPickupBuffer: null,

  // --- Initialize Wave VO Buffers ---
  waveClearedVOBuffer: null,
  waveIncomingVOBuffer: null,
  countdown3VOBuffer: null,
  countdown2VOBuffer: null,
  countdown1VOBuffer: null,

  // Function to load all sounds
  loadSounds: (soundPaths) => {
    const loadSound = (
      key: keyof SoundEffectsState,
      path: string,
      loop = false,
      volume = 1.0,
    ) => {
      // Prevent reloading if buffer already exists
      if (get()[key as keyof SoundEffectsState] instanceof Howl) {
        console.log(`${String(key)} already loaded.`);
        return;
      }
      const sound = new Howl({
        src: [path],
        autoplay: false,
        loop: loop,
        volume: volume,
        // html5: true, // Removed for testing
        onload: () => {
          console.log(`${String(key)} loaded successfully from ${path}`)
          // Use functional update form of set for safety
          set((state) => ({ ...state, [key]: sound }))
        },
        onloaderror: (id, error) => {
          console.error(`Error loading ${String(key)} from ${path}:`, error)
        },
        onplayerror: (id, error) => {
           console.error(`Error playing ${String(key)} (ID: ${id}):`, error);
        },
      })
    }

    // Define sound configurations
    const soundsToLoad = [
      { key: "pistolBuffer", path: soundPaths.pistol, volume: 0.6 },
      { key: "shotgunBuffer", path: soundPaths.shotgun, volume: 0.7 },
      { key: "smgBuffer", path: soundPaths.smg, volume: 0.5 },
      { key: "rifleBuffer", path: soundPaths.rifle, volume: 0.8 },
      { key: "reloadBuffer", path: soundPaths.reload, volume: 0.5 },
      { key: "weaponSwitchBuffer", path: soundPaths.weaponSwitch, volume: 0.4 },
      { key: "jumpBuffer", path: soundPaths.jump, volume: 0.5 },
      { key: "landBuffer", path: soundPaths.land, volume: 0.6 },
      { key: "zombieBiteBuffer", path: soundPaths.zombieBite, volume: 0.8 },
      { key: "zombieDeathBuffer", path: soundPaths.zombieDeath, volume: 0.7 },
      { key: "gameStartBuffer", path: soundPaths.gameStart, volume: 0.9 },
      { key: "ambientMapNoiseBuffer", path: soundPaths.ambientMapNoise, volume: 0.3 },
      { key: "zombieAmbientBuffer", path: soundPaths.zombieAmbient, volume: 0.25 },
      { key: "bulletImpactBuffer", path: soundPaths.bulletImpact, volume: 0.4 },
      { key: "ambientMusicBuffer", path: soundPaths.ambientMusic, loop: true, volume: 0.25 },
      { key: "batBuffer", path: soundPaths.bats, volume: 0.6 },
      // NEW: Game Over sounds
      { key: "transitionBuffer", path: soundPaths.gameOverTransition, volume: 0.7 },
      { key: "outtaControlVOBuffer", path: soundPaths.outtaControlVO, volume: 1.0 },
      // NEW: Item Pickup sound
      { key: "itemPickupBuffer", path: soundPaths.weaponSwitch, volume: 0.6 }, // Using weaponSwitch as placeholder
      // --- Add VO Sound Definitions ---
      // Using actual filenames found earlier. Assumes soundPaths object will have corresponding keys.
      { key: "waveClearedVOBuffer", path: soundPaths.waveClearedVO, volume: 1.0 }, // e.g., '/sounds/AI VOICE/holy shit thats alot.mp3'
      { key: "waveIncomingVOBuffer", path: soundPaths.waveIncomingVO, volume: 1.0 }, // e.g., '/sounds/AI VOICE/wave starting.mp3'
      { key: "countdown3VOBuffer", path: soundPaths.countdown3VO, volume: 1.0 },    // e.g., '/sounds/AI VOICE/three two one.mp3' or 'countdown_3.mp3'
      // Add countdown 2 and 1 if separate files exist or using sprites later
      // { key: "countdown2VOBuffer", path: soundPaths.countdown2VO, volume: 1.0 },
      // { key: "countdown1VOBuffer", path: soundPaths.countdown1VO, volume: 1.0 },
    ]

    // Load each sound
    soundsToLoad.forEach(({ key, path, loop, volume }) => {
      if (path) {
        loadSound(key as keyof SoundEffectsState, path, loop, volume)
      } else {
         console.warn(`Path missing for sound key: ${key}`);
      }
    })
  },

  // Internal state and setter for map noise timing
  lastMapNoisePlayTime: 0,
  setLastMapNoisePlayTime: (time) => set({ lastMapNoisePlayTime: time }),
  // Internal state and setter for bat sound timing
  lastBatSoundPlayTime: 0,
  setLastBatSoundPlayTime: (time) => set({ lastBatSoundPlayTime: time }),
  // Internal state and setter for zombie ambient sound timing
  lastZombieAmbientPlayTime: 0,
  setLastZombieAmbientPlayTime: (time) => set({ lastZombieAmbientPlayTime: time }),

  // --- Playback Functions ---
  playPistolSound: () => {
    const buffer = get().pistolBuffer;
    console.log("Attempting playPistolSound. Buffer exists:", !!buffer);
    buffer?.play();
  },
  playShotgunSound: () => get().shotgunBuffer?.play(),
  playSmgSound: () => get().smgBuffer?.play(),
  playRifleSound: () => get().rifleBuffer?.play(),
  playReloadSound: () => get().reloadBuffer?.play(),
  playWeaponSwitchSound: () => get().weaponSwitchBuffer?.play(),
  playJumpSound: () => {
    const buffer = get().jumpBuffer;
    console.log("Attempting playJumpSound. Buffer exists:", !!buffer);
    buffer?.play();
  },
  playLandSound: () => {
    const buffer = get().landBuffer;
    console.log("Attempting playLandSound. Buffer exists:", !!buffer);
    buffer?.play();
  },
  playZombieBiteSound: () => get().zombieBiteBuffer?.play(),
  playZombieDeathSound: () => get().zombieDeathBuffer?.play(),
  playGameStartSound: () => get().gameStartBuffer?.play(),

  // NEW: Game Over sound playback
  playTransitionSound: () => get().transitionBuffer?.play(),
  playOuttaControlSound: () => {
    const buffer = get().outtaControlVOBuffer;
    console.log("[SoundEffects] Attempting to play outtaControlVO. Buffer exists:", !!buffer);
    buffer?.play();
  },

  // NEW: Implement Item Pickup Sound Playback
  playItemPickupSound: () => {
    get().itemPickupBuffer?.play();
  },

  // Play ambient map noise only if the interval has passed
  playAmbientMapNoiseSound: () => {
    if (!get().audioContextStarted) return;
    const now = Date.now();
    const lastPlayed = get().lastMapNoisePlayTime;
    if (now - lastPlayed > MAP_NOISE_INTERVAL) {
      const buffer = get().ambientMapNoiseBuffer;
      if (buffer && !buffer.playing()) {
        buffer.play();
        get().setLastMapNoisePlayTime(now);
        console.log("Playing ambient map noise");
      }
    }
  },

  playZombieAmbientSound: () => {
    if (!get().audioContextStarted) return;
    const now = Date.now();
    const lastPlayed = get().lastZombieAmbientPlayTime;
    if (now - lastPlayed > ZOMBIE_AMBIENT_INTERVAL) {
      const buffer = get().zombieAmbientBuffer;
      if (buffer && !buffer.playing()) {
        buffer.play();
        get().setLastZombieAmbientPlayTime(now);
        console.log("Playing zombie ambient sound");
      }
    }
  },

  playBulletImpactSound: (position) => {
    get().bulletImpactBuffer?.play()
  },

  // Play ambient music (looping)
  playAmbientMusic: () => {
    const sound = get().ambientMusicBuffer
    if (sound && !sound.playing()) {
      const soundId = sound.play()
       if (soundId) {
          console.log("Playing ambient music.");
       } else {
           console.warn("Howler returned invalid soundId for ambient music.");
       }
    } else if (!sound) {
      // console.warn("Ambient music buffer not loaded yet.") // Reduce noise
    }
  },

  // Play bat sound (one-shot, with cooldown)
  playBatSound: () => {
    const { batBuffer, lastBatSoundPlayTime, setLastBatSoundPlayTime } = get();
    const now = Date.now();

    // console.log("Checking bat sound playback:", { now, lastBatSoundPlayTime, cooldown: BAT_SOUND_COOLDOWN }); // Keep for debugging if needed

    if (batBuffer && now - lastBatSoundPlayTime > BAT_SOUND_COOLDOWN) {
        console.log("Attempting to play bat sound...");
        const soundId = batBuffer.play();
        if (soundId) {
           console.log("Playing bat sound.");
           setLastBatSoundPlayTime(now); // Update timestamp after successful play attempt
        } else {
           console.warn("Howler returned invalid soundId for bat sound.");
        }
    } else if (!batBuffer) {
      console.warn("Bat sound buffer not loaded yet.");
    } else {
      // console.log("Bat sound cooldown active."); // Reduce noise
    }
  },

  // --- Add Wave VO Playback Functions ---
  playWaveClearedVO: () => {
    console.log(`%c[Sounds][Howler] playWaveClearedVO called. Buffer exists: ${!!get().waveClearedVOBuffer}`, "color: magenta");
    get().waveClearedVOBuffer?.play();
  },
  playWaveIncomingVO: () => {
    console.log(`%c[Sounds][Howler] playWaveIncomingVO called. Buffer exists: ${!!get().waveIncomingVOBuffer}`, "color: magenta");
    get().waveIncomingVOBuffer?.play();
  },
  playCountdownVO: (count: number) => {
    // Log existence based on the switch logic below
    const bufferExists = (count === 3 && !!get().countdown3VOBuffer) || (count === 2 && !!get().countdown2VOBuffer) || (count === 1 && !!get().countdown1VOBuffer);
    console.log(`%c[Sounds][Howler] playCountdownVO called with count: ${count}. Specific buffer exists: ${bufferExists}`, "color: magenta");
    let bufferToPlay: Howl | null = null;
    if (count === 3) bufferToPlay = get().countdown3VOBuffer;
    if (count === 2) bufferToPlay = get().countdown2VOBuffer;
    if (count === 1) bufferToPlay = get().countdown1VOBuffer;
    bufferToPlay?.play();
  },
}))

// --- Hook to Initialize Sounds and Handle Audio Context ---
export const useInitializeSounds = () => {
  const { loadSounds, audioContextStarted, setAudioContextStarted } = useSoundEffects(
    (state) => ({
      loadSounds: state.loadSounds,
      audioContextStarted: state.audioContextStarted,
      setAudioContextStarted: state.setAudioContextStarted,
    }),
  )
  const [isLoading, setIsLoading] = useState(true)
  const soundPathsLoaded = useRef(false); // Prevent multiple load calls

  useEffect(() => {
     // Make sure loading happens only once after context is started
    if (audioContextStarted && !soundPathsLoaded.current) {
      console.log("[useInitializeSounds] Audio context started, loading sounds via Howler...");
      // Define the paths to your sound files
      // IMPORTANT: Add the new VO sound paths here!
      const soundPaths = {
        pistol: '/sounds/pistol.mp3',
        shotgun: '/sounds/shotgun.mp3',
        smg: '/sounds/smg.mp3',
        rifle: '/sounds/rifle.mp3',
        reload: '/sounds/reload.mp3',
        weaponSwitch: '/sounds/weaponSwitch.mp3',
        jump: '/sounds/jump.mp3',
        land: '/sounds/land.mp3',
        zombieBite: '/sounds/zombieBite.mp3',
        zombieDeath: '/sounds/zombieDeath.mp3',
        gameStart: '/sounds/gameStart.mp3',
        ambientMapNoise: '/sounds/ambientMapNoise.mp3',
        zombieAmbient: '/sounds/zombieAmbient.mp3', // Path for the new sound
        bulletImpact: '/sounds/bulletImpact.mp3',
        ambientMusic: '/sounds/ambient.mp3', // Corrected path
        bats: '/sounds/bats.mp3',
        // --- Add VO Paths ---
        waveClearedVO: '/sounds/AI VOICE/holy shit thats alot.mp3',
        waveIncomingVO: '/sounds/AI VOICE/wave starting.mp3',
        countdown3VO: '/sounds/AI VOICE/three two one.mp3',
        // countdown2VO: '/sounds/AI VOICE/countdown_2.mp3', // Add path if you have separate file
        // countdown1VO: '/sounds/AI VOICE/countdown_1.mp3', // Add path if you have separate file
        gameOverTransition: '/sounds/transition.mp3',
        outtaControlVO: '/sounds/AI VOICE/outta_control.mp3',
      };

      loadSounds(soundPaths);
      soundPathsLoaded.current = true; // Mark as loaded
      setIsLoading(false); // Sounds are now loading/loaded
    }
  }, [audioContextStarted, loadSounds]); // Add loadSounds dependency

  // Function to resume audio context on user interaction
  const resumeAudioContext = useCallback(() => {
    if (!audioContextStarted) {
      console.log("Attempting to resume audio context via user interaction...");
      // Set started immediately, let Howler handle unlock
      setAudioContextStarted(true);
      Howler.autoUnlock = true;

      // Still attempt the resume, but don't rely on its promise for state update
      Howler.ctx?.resume().then(() => {
        console.log("Howler.ctx.resume() promise resolved successfully.");
      }).catch((e) => {
        console.error("Howler.ctx.resume() promise rejected:", e);
        // No need to set state here again
      });
    }
  }, [audioContextStarted, setAudioContextStarted]);


  // Attempt to resume context automatically if needed (e.g., after navigation)
  useEffect(() => {
    // Howler typically handles this automatically with autoUnlock,
    // but this is a fallback attempt if state is interrupted.
    // Also, set context started if it's already running (e.g., auto-resumed by browser)
    if (!audioContextStarted && Howler.ctx?.state === "running") {
       console.log("Audio Context already running, setting state.");
       setAudioContextStarted(true);
       Howler.autoUnlock = true;
    } else if (!audioContextStarted && (Howler.ctx?.state as string) === "interrupted") {
       // Check state as string to handle non-standard "interrupted" state
       console.log("Audio Context state is interrupted, attempting auto-resume...");
       // Still set started immediately here too for consistency
       setAudioContextStarted(true);
       Howler.autoUnlock = true;
    }
  }, [audioContextStarted, setAudioContextStarted]); // Add dependencies


  return { isLoading, resumeAudioContext, audioContextStarted } // Return context state
}
