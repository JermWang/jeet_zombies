"use client";

/**
 * Ambient audio is now owned entirely by the useSoundEffects store:
 *   - looping background music  -> started in AudioInitializer when audio unlocks
 *   - periodic map noise         -> useSoundEffects.playAmbientMapNoiseSound()
 *
 * This component previously created its OWN Howl instances which caused:
 *   - double background music (it looped ambient.mp3 alongside the store buffer)
 *   - a 404 on Vercel/Linux from a case-mismatched '/sounds/ambientmapnoise.mp3'
 *   - playback attempts before the user gesture (blocked by autoplay policy)
 * It is intentionally inert now to keep a single source of truth.
 */
const AmbientSoundManager = () => null;

export default AmbientSoundManager;
