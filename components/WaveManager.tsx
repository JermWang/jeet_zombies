"use client";

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import useGameStore from '@/hooks/useGameStore';
import { Vector3 } from 'three';
import { useSoundEffects } from '@/hooks/useSoundEffects';

// Constants for wave logic
const START_DELAY = 3; // Seconds before first wave starts
const SPAWN_INTERVAL = 0.5; // Seconds between each zombie spawn within a wave
const MAP_RADIUS = 20; // Example radius to spawn zombies around

// --- Updated Delays for 30s Break --- 
const INITIAL_DELAY = 3000;               // Delay before first wave starts (ms)
const WAVE_CLEARED_DISPLAY_TIME = 5000;   // How long "Wave Cleared" shows (ms)
const COUNTDOWN_TIME = 3000;            // Duration of 3,2,1 countdown (ms)
const TOTAL_BETWEEN_WAVE_DELAY = 30000; // Total pause between waves (ms)

// --- Wave Configuration --- 
interface WaveConfig {
    zombieCount: number;
    spawnDelay: number; // Milliseconds between spawns
    types: { type: string; weight: number }[]; // Array of possible types and their spawn weight
}

const WAVES: WaveConfig[] = [
    // Wave 1: Only standard zombies, slow spawn
    { zombieCount: 5, spawnDelay: 1500, types: [{ type: 'zombie_standard_shirt', weight: 1 }] },  
    // Wave 2: More standard, slightly faster
    { zombieCount: 8, spawnDelay: 1200, types: [{ type: 'zombie_standard_shirt', weight: 1 }] },  
    // Wave 3: Introduce first brute, faster spawn
    { zombieCount: 12, spawnDelay: 1000, types: [
        { type: 'zombie_standard_shirt', weight: 5 }, 
        { type: 'zombie_brute', weight: 1 }
    ] }, 
    // Wave 4: More brutes, standard faster spawn
     { zombieCount: 15, spawnDelay: 900, types: [
        { type: 'zombie_standard_shirt', weight: 3 }, 
        { type: 'zombie_brute', weight: 2 } 
    ] },
    // Wave 5: Mostly brutes, very fast spawn
    { zombieCount: 18, spawnDelay: 700, types: [
        { type: 'zombie_standard_shirt', weight: 2 }, 
        { type: 'zombie_brute', weight: 3 } 
    ] },
    // Wave 6: Even more, very fast
    { zombieCount: 25, spawnDelay: 500, types: [
        { type: 'zombie_standard_shirt', weight: 1 }, 
        { type: 'zombie_brute', weight: 1 } 
    ] }
    // Add more challenging waves...
];

const SPAWN_RADIUS_MIN = 45; // Min distance from center to spawn
const SPAWN_RADIUS_MAX = 55; // Max distance from center to spawn
const SPAWN_CHECK_HEIGHT = 10; // How high above candidate point to start downward raycast
const SAFE_SPAWN_Y_OFFSET = 0.1; // How far above the ground hit point to spawn
const MAX_SPAWN_ATTEMPTS = 10; // Max retries to find a safe spot
const OBSTACLE_CHECK_RADIUS = 0.5; // Radius of sphere cast to check for obstacles around spawn point

// Helper to select a zombie type based on weights
function selectZombieType(types: { type: string; weight: number }[]): string {
    const totalWeight = types.reduce((sum, t) => sum + t.weight, 0);
    let random = Math.random() * totalWeight;
    for (const typeInfo of types) {
        if (random < typeInfo.weight) {
            return typeInfo.type;
        }
        random -= typeInfo.weight;
    }
    // Fallback in case of issues (shouldn't happen with valid weights)
    return types[0]?.type || 'zombie_standard_shirt'; 
}

const WaveManager = () => {
    const { 
        gameStarted,
        currentWave,
        waveStatus,
        zombiesRemainingInWave,
        spawnEnemy,
        startWaveSpawning,
        setWaveActive,
        setWaveBetween,
        findSafeSpawnPoint
    } = useGameStore();
    
    // Get the function directly from the hook
    const _playWaveIncomingVO_fromHook = useSoundEffects(state => state.playWaveIncomingVO);
    const _playWaveClearedVO_fromHook = useSoundEffects(state => state.playWaveClearedVO); // Get Cleared VO

    // --- Store the functions in a ref --- 
    const playWaveIncomingVORef = useRef<() => void>(_playWaveIncomingVO_fromHook);
    const playWaveClearedVORef = useRef<() => void>(_playWaveClearedVO_fromHook); // Ref for Cleared VO

    // --- Keep the refs updated --- 
    useEffect(() => {
        playWaveIncomingVORef.current = _playWaveIncomingVO_fromHook;
    }, [_playWaveIncomingVO_fromHook]);
    useEffect(() => { // Separate effect for Cleared VO
        playWaveClearedVORef.current = _playWaveClearedVO_fromHook;
    }, [_playWaveClearedVO_fromHook]);

    // Refs for managing state and timers
    const spawnIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const initialDelayTimerRef = useRef<NodeJS.Timeout | null>(null); // Renamed for initial start
    const nextWaveStartTimerRef = useRef<NodeJS.Timeout | null>(null); // Kept for between waves
    const zombiesSpawnedThisWave = useRef(0);
    const initialStartAttempted = useRef(false);

    // --- Start First Wave Spawning --- 
    useEffect(() => {
        // --- LOGGING --- 
        console.log(
            `%c[WaveManager Initial Start Effect Check] Running effect. gameStarted: ${gameStarted}, waveStatus: ${waveStatus}, initialStartAttempted: ${initialStartAttempted.current}`,
             "color: orange"
        );
        // --------------- 

        if (gameStarted && waveStatus === 'Idle' && !initialStartAttempted.current) {
            console.log("%c[WaveManager Initial Start Effect Check] CONDITIONS MET! Proceeding.", "color: lime; font-weight: bold"); // Added log
            initialStartAttempted.current = true;
            console.log("%c[WaveManager Initial Start] Game started, setting timer for first wave spawning.", "color: green; font-weight: bold");
            
            // Clear specific initial timer ref
            if (initialDelayTimerRef.current) clearTimeout(initialDelayTimerRef.current); 

            // Set specific initial timer ref
            initialDelayTimerRef.current = setTimeout(() => {
                const waveIndex = 0; // First wave
                if (waveIndex < WAVES.length) {
                    console.log(`%c[WaveManager Initial Start] Timer finished. Triggering Spawning for Wave ${waveIndex + 1}.`, "color: green; font-weight: bold");
                    
                    // Call action to set status to Spawning and store zombie count
                    console.log(`%c[WaveManager Initial Start] Calling startWaveSpawning(${waveIndex + 1}, ${WAVES[waveIndex].zombieCount})`, "color: green");
                    startWaveSpawning(waveIndex + 1, WAVES[waveIndex].zombieCount);
                    zombiesSpawnedThisWave.current = 0; // Reset spawn counter
                } else {
                    console.log("%c[WaveManager Initial Start] No waves defined!", "color: orange");
                }
            }, INITIAL_DELAY); 
        }
        // Cleanup timer if game stops or component unmounts during initial delay
        return () => {
             console.log("%c[WaveManager Initial Start Cleanup] Running cleanup. Clearing initial timer (if set).", "color: red; font-weight: bold"); // Updated log text
             // Clear specific initial timer ref
             if (initialDelayTimerRef.current) clearTimeout(initialDelayTimerRef.current);
        }

    }, [gameStarted, waveStatus, startWaveSpawning]);

    // --- Handle Spawning State --- 
    useEffect(() => {
        if (waveStatus === 'Spawning') {
            const waveIndex = currentWave - 1;
            if (waveIndex < 0 || waveIndex >= WAVES.length) return;
            const config = WAVES[waveIndex];
            let spawnedCount = zombiesSpawnedThisWave.current;

            console.log(`%c[WaveManager Spawning] State active for Wave ${currentWave}. Need ${config.zombieCount}, spawned ${spawnedCount}. Starting interval.`, "color: blue");

            if (spawnIntervalRef.current) clearInterval(spawnIntervalRef.current);

            spawnIntervalRef.current = setInterval(() => {
                if (spawnedCount < config.zombieCount) {
                    // *** Use the safe spawn function FROM THE STORE ***
                    if (!findSafeSpawnPoint) { // Check if function exists
                         console.error("[WaveManager Spawning] findSafeSpawnPoint function not available in store!");
                         if (spawnIntervalRef.current) clearInterval(spawnIntervalRef.current);
                         spawnIntervalRef.current = null;
                         return; // Stop interval if function is missing
                    }

                    const spawnPos = findSafeSpawnPoint(); // Call the function from the store
                    if (spawnPos) {
                        const enemyType = selectZombieType(config.types);
                        const spawnedId = spawnEnemy(enemyType, spawnPos);
                        if (spawnedId !== null) {
                            spawnedCount++;
                            zombiesSpawnedThisWave.current = spawnedCount;
                        } else {
                            console.warn("[WaveManager Spawning] spawnEnemy failed (pool full?), pausing spawn interval.");
                            if (spawnIntervalRef.current) clearInterval(spawnIntervalRef.current);
                        }
                    } else {
                        console.error("[WaveManager Spawning] Could not find safe spawn position via store function, stopping wave spawn.");
                        if (spawnIntervalRef.current) clearInterval(spawnIntervalRef.current);
                        spawnIntervalRef.current = null;
                    }
                } else {
                    if (spawnIntervalRef.current) clearInterval(spawnIntervalRef.current);
                    spawnIntervalRef.current = null;
                    console.log(`%c[WaveManager Spawning] Finished spawning Wave ${currentWave}. Transitioning to Active.`, "color: blue; font-weight: bold");
                    console.log(`%c[WaveManager Spawning] Calling setWaveActive()`, "color: green");
                    setWaveActive();
                }
            }, config.spawnDelay);
        } else {
             if (spawnIntervalRef.current) {
                console.log("%c[WaveManager Spawning] Clearing spawn interval as status is not Spawning.", "color: orange");
                clearInterval(spawnIntervalRef.current);
                spawnIntervalRef.current = null;
             }
        }
        return () => {
             if (spawnIntervalRef.current) {
                console.log("%c[WaveManager Spawning] Cleaning up spawn interval.", "color: orange");
                clearInterval(spawnIntervalRef.current);
             }
        };
    }, [waveStatus, currentWave, spawnEnemy, setWaveActive, findSafeSpawnPoint]);

    // --- Handle Active State --- 
    useEffect(() => {
        if (waveStatus === 'Active') {
            if (zombiesRemainingInWave <= 0) {
                console.log(`%c[WaveManager Active] Wave ${currentWave} cleared! Transitioning to BetweenWaves.`, "color: purple; font-weight: bold");
                
                 // Play VO sound for wave cleared
                if (typeof playWaveClearedVORef.current === 'function') {
                    console.log("%c[WaveManager Active] Calling playWaveClearedVO()", "color: cyan");
                    playWaveClearedVORef.current();
                } else {
                    console.error("%c[WaveManager Active] playWaveClearedVORef.current is NOT a function!", "color: red");
                }
                
                 console.log(`%c[WaveManager Active] Calling setWaveBetween()`, "color: green");
                setWaveBetween(); // Transition state
            }
        }
    }, [waveStatus, zombiesRemainingInWave, currentWave, setWaveBetween]);

    // --- Handle BetweenWaves State --- 
     useEffect(() => {
        if (waveStatus === 'BetweenWaves') {
            // Clear specific between-wave timer ref before setting a new one
             if (nextWaveStartTimerRef.current) clearTimeout(nextWaveStartTimerRef.current);

            const nextWaveNumber = currentWave + 1; // Wave number to start
            const nextWaveIndex = nextWaveNumber - 1; // Index for WAVES array
            
            console.log(`%c[WaveManager Between] State active. Setting timer for next wave (${nextWaveNumber}). Delay: ${TOTAL_BETWEEN_WAVE_DELAY}ms`, "color: purple");

            // Set specific between-wave timer ref
            nextWaveStartTimerRef.current = setTimeout(() => {
                 if (nextWaveIndex < WAVES.length) {
                    console.log(`%c[WaveManager Between] Timer finished. Triggering Spawning for Wave ${nextWaveNumber}.`, "color: purple; font-weight: bold");
                    
                    console.log(`%c[WaveManager Between] Calling startWaveSpawning(${nextWaveNumber}, ${WAVES[nextWaveIndex].zombieCount})`, "color: green");
                    startWaveSpawning(nextWaveNumber, WAVES[nextWaveIndex].zombieCount);
                    zombiesSpawnedThisWave.current = 0; // Reset spawn counter
                 } else {
                    console.log("%c[WaveManager Between] All waves completed!", "color: yellow");
                    // Handle game win condition?
                 }
            }, TOTAL_BETWEEN_WAVE_DELAY); // Use the combined delay
        } else {
            // Clear the timer if we leave the BetweenWaves state prematurely
            if (nextWaveStartTimerRef.current) {
                 console.log("%c[WaveManager Between] Clearing next wave timer as status is not BetweenWaves.", "color: orange");
                // Clear specific between-wave timer ref
                clearTimeout(nextWaveStartTimerRef.current);
                nextWaveStartTimerRef.current = null;
            }
        }

        // Cleanup timer on unmount
        return () => {
             if (nextWaveStartTimerRef.current) {
                 console.log("%c[WaveManager Between] Cleaning up next wave timer.", "color: orange");
                 // Clear specific between-wave timer ref
                clearTimeout(nextWaveStartTimerRef.current);
             }
        };
     }, [waveStatus, currentWave, startWaveSpawning]);

    return null;
} 

export default WaveManager; 