"use client";

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import useGameStore from '@/hooks/useGameStore';
import { Vector3 } from 'three';
import { useSoundEffects } from '@/hooks/useSoundEffects';

// Constants for wave logic
// const START_DELAY = 3; // Seconds before first wave starts - Original, replaced by INITIAL_DELAY
// const SPAWN_INTERVAL = 0.5; // Seconds between each zombie spawn within a wave - Original, replaced by waveConfig.spawnDelay
// const MAP_RADIUS = 20; // Example radius to spawn zombies around - Not directly used, findSafeSpawnPoint handles logic

// Delays
const INITIAL_DELAY = 3000;               // Delay before first wave starts (ms)
// const WAVE_CLEARED_DISPLAY_TIME = 5000;   // How long "Wave Cleared" shows (ms) - Handled by WaveUI or BetweenWaves state duration
// const COUNTDOWN_TIME = 3000;            // Duration of 3,2,1 countdown (ms) - Handled by WaveUI or a dedicated Countdown state if implemented
const TOTAL_BETWEEN_WAVE_DELAY = 30000; // Total pause between waves (ms)

// Wave Configuration
interface WaveConfig {
    zombieCount: number;
    spawnDelay: number; // Milliseconds between spawns
    types: { type: string; weight: number }[];
}

const WAVES: WaveConfig[] = [
    { zombieCount: 5, spawnDelay: 1500, types: [{ type: 'zombie_standard_shirt', weight: 1 }] },  
    { zombieCount: 8, spawnDelay: 1200, types: [{ type: 'zombie_standard_shirt', weight: 1 }] },  
    { zombieCount: 12, spawnDelay: 1000, types: [{ type: 'zombie_standard_shirt', weight: 5 }, { type: 'zombie_brute', weight: 1 }] }, 
    { zombieCount: 15, spawnDelay: 900, types: [{ type: 'zombie_standard_shirt', weight: 3 }, { type: 'zombie_brute', weight: 2 } ] },
    { zombieCount: 18, spawnDelay: 700, types: [{ type: 'zombie_standard_shirt', weight: 2 }, { type: 'zombie_brute', weight: 3 } ] },
    { zombieCount: 25, spawnDelay: 500, types: [{ type: 'zombie_standard_shirt', weight: 1 }, { type: 'zombie_brute', weight: 1 } ] },
    // NEW Placeholder Waves 7-9
    { zombieCount: 30, spawnDelay: 450, types: [{ type: 'zombie_standard_shirt', weight: 1 }, { type: 'zombie_brute', weight: 2 } ] }, // More brutes
    { zombieCount: 35, spawnDelay: 400, types: [{ type: 'zombie_standard_shirt', weight: 1 }, { type: 'zombie_brute', weight: 3 } ] }, // Even more brutes
    { zombieCount: 40, spawnDelay: 350, types: [{ type: 'zombie_brute', weight: 1 } ] }, // All brutes, fast spawn
    // NEW Wave 10: Boss Wave
    { zombieCount: 1, spawnDelay: 1000, types: [{ type: 'zombie_boss', weight: 1 }] } 
];

// Spawn parameters (findSafeSpawnPoint in store might use its own constants)
// const SPAWN_RADIUS_MIN = 45;
// const SPAWN_RADIUS_MAX = 55;
// const SPAWN_CHECK_HEIGHT = 10;
// const SAFE_SPAWN_Y_OFFSET = 0.1;
// const MAX_SPAWN_ATTEMPTS = 10;
// const OBSTACLE_CHECK_RADIUS = 0.5;

function selectZombieType(types: { type: string; weight: number }[]): string {
    const totalWeight = types.reduce((sum, t) => sum + t.weight, 0);
    let random = Math.random() * totalWeight;
    for (const typeInfo of types) {
        if (random < typeInfo.weight) {
            return typeInfo.type;
        }
        random -= typeInfo.weight;
    }
    return types[0]?.type || 'zombie_standard_shirt'; 
}

const WaveManager = () => {
    const gameStarted = useGameStore(state => state.gameStarted);
    const currentWave = useGameStore(state => state.currentWave);
    const waveStatus = useGameStore(state => state.waveStatus);
    const zombiesRemainingInWave = useGameStore(state => state.zombiesRemainingInWave);
    const isGameOver = useGameStore(state => state.isGameOver);
    
    const _spawnEnemyFromStore = useGameStore(state => state.spawnEnemy);
    const _startWaveSpawningFromStore = useGameStore(state => state.startWaveSpawning);
    const _setWaveActiveFromStore = useGameStore(state => state.setWaveActive);
    const _setWaveBetweenFromStore = useGameStore(state => state.setWaveBetween);
    const _findSafeSpawnPointFromStore = useGameStore(state => state.findSafeSpawnPoint);
    const _setBossFightActiveFromStore = useGameStore(state => state.setBossFightActive);
    
    const _playWaveIncomingVO_fromHook = useSoundEffects(state => state.playWaveIncomingVO);
    const _playWaveClearedVO_fromHook = useSoundEffects(state => state.playWaveClearedVO);

    const playWaveIncomingVORef = useRef(_playWaveIncomingVO_fromHook);
    const playWaveClearedVORef = useRef(_playWaveClearedVO_fromHook);

    const spawnEnemyRef = useRef(_spawnEnemyFromStore);
    const startWaveSpawningRef = useRef(_startWaveSpawningFromStore);
    const setWaveActiveRef = useRef(_setWaveActiveFromStore);
    const setWaveBetweenRef = useRef(_setWaveBetweenFromStore);
    const findSafeSpawnPointRef = useRef(_findSafeSpawnPointFromStore);
    const setBossFightActiveRef = useRef(_setBossFightActiveFromStore);

    useEffect(() => { playWaveIncomingVORef.current = _playWaveIncomingVO_fromHook; }, [_playWaveIncomingVO_fromHook]);
    useEffect(() => { playWaveClearedVORef.current = _playWaveClearedVO_fromHook; }, [_playWaveClearedVO_fromHook]);

    useEffect(() => { spawnEnemyRef.current = _spawnEnemyFromStore; }, [_spawnEnemyFromStore]);
    useEffect(() => { startWaveSpawningRef.current = _startWaveSpawningFromStore; }, [_startWaveSpawningFromStore]);
    useEffect(() => { setWaveActiveRef.current = _setWaveActiveFromStore; }, [_setWaveActiveFromStore]);
    useEffect(() => { setWaveBetweenRef.current = _setWaveBetweenFromStore; }, [_setWaveBetweenFromStore]);
    useEffect(() => { findSafeSpawnPointRef.current = _findSafeSpawnPointFromStore; }, [_findSafeSpawnPointFromStore]);
    useEffect(() => { setBossFightActiveRef.current = _setBossFightActiveFromStore; }, [_setBossFightActiveFromStore]);

    const spawnIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const initialDelayTimerRef = useRef<NodeJS.Timeout | null>(null);
    const nextWaveStartTimerRef = useRef<NodeJS.Timeout | null>(null);
    const zombiesSpawnedThisWave = useRef(0);
    const initialStartAttempted = useRef(false);

    useEffect(() => {
        if (isGameOver || !gameStarted) {
            console.log("%c[WaveManager Cleanup] Game over or not started. Clearing all timers and resetting internal state.", "color: red; font-weight: bold");
            if (initialDelayTimerRef.current) clearTimeout(initialDelayTimerRef.current);
            if (spawnIntervalRef.current) clearInterval(spawnIntervalRef.current);
            if (nextWaveStartTimerRef.current) clearTimeout(nextWaveStartTimerRef.current);
            initialDelayTimerRef.current = null;
            spawnIntervalRef.current = null;
            nextWaveStartTimerRef.current = null;
            zombiesSpawnedThisWave.current = 0;
            initialStartAttempted.current = false;
        }
    }, [isGameOver, gameStarted]);

    useEffect(() => {
        if (isGameOver || !gameStarted) return;

        if (waveStatus === 'Idle' && !initialStartAttempted.current) {
            initialStartAttempted.current = true;
            console.log("%c[WaveManager Initial Start] Game started, setting timer for first wave spawning.", "color: green; font-weight: bold");
            if (initialDelayTimerRef.current) clearTimeout(initialDelayTimerRef.current);
            initialDelayTimerRef.current = setTimeout(() => {
                const waveIndex = 0;
                if (waveIndex < WAVES.length) {
                    console.log(`%c[WaveManager Initial Start] Timer finished. Triggering Spawning for Wave ${waveIndex + 1}.`, "color: green; font-weight: bold");
                    if (waveIndex + 1 === 10) {
                        console.log("%c[WaveManager] Initial wave is Wave 10 (Boss Wave). Activating boss fight.", "color: magenta; font-weight: bold;");
                        setBossFightActiveRef.current(true);
                    }
                    startWaveSpawningRef.current(waveIndex + 1, WAVES[waveIndex].zombieCount);
                    zombiesSpawnedThisWave.current = 0;
                } else {
                    console.log("%c[WaveManager Initial Start] No waves defined!", "color: orange");
                }
            }, INITIAL_DELAY);
        }
        return () => {
             if (initialDelayTimerRef.current) clearTimeout(initialDelayTimerRef.current);
        }
    }, [waveStatus, gameStarted]);

    useEffect(() => {
        const findSafeSpawnPoint = findSafeSpawnPointRef.current;
        const spawnEnemy = spawnEnemyRef.current;
        const setWaveActive = setWaveActiveRef.current;

        if (isGameOver || !gameStarted) return;

        if (waveStatus === 'Spawning') {
            const waveIndex = currentWave - 1;
            if (waveIndex < 0 || waveIndex >= WAVES.length) {
                console.warn(`[WaveManager Spawning] Invalid waveIndex: ${waveIndex} for currentWave: ${currentWave}. Stopping spawn.`);
                if (spawnIntervalRef.current) clearInterval(spawnIntervalRef.current);
                spawnIntervalRef.current = null;
                return;
            }
            const config = WAVES[waveIndex];
            let spawnedCount = zombiesSpawnedThisWave.current;

            console.log(`%c[WaveManager Spawning] State active for Wave ${currentWave}. Need ${config.zombieCount}, spawned ${spawnedCount}. Starting interval.`, "color: blue");

            if (spawnIntervalRef.current) clearInterval(spawnIntervalRef.current);

            spawnIntervalRef.current = setInterval(() => {
                console.log(`[WaveManager Spawning Interval Tick] Wave: ${currentWave}, Spawned: ${spawnedCount}, Needed: ${config.zombieCount}`);
                if (spawnedCount < config.zombieCount) {
                    if (!findSafeSpawnPoint) {
                         console.error("[WaveManager Spawning] findSafeSpawnPoint function (ref) not available in store AT TICK TIME!");
                         if (spawnIntervalRef.current) clearInterval(spawnIntervalRef.current);
                         spawnIntervalRef.current = null;
                         return;
                    }
                    const spawnPos = findSafeSpawnPoint();
                    if (spawnPos) {
                        const enemyType = selectZombieType(config.types);
                        const spawnedId = spawnEnemy(enemyType, spawnPos);
                        console.log(`%c[WaveManager Spawning Attempt] Wave: ${currentWave}, Spawn #: ${spawnedCount + 1}/${config.zombieCount}, Type: ${enemyType}, Pos: ${JSON.stringify(spawnPos)}, Spawned ID: ${spawnedId}`, "color: #FFD700"); // Gold color for visibility
                        if (spawnedId !== null) {
                            spawnedCount++;
                            zombiesSpawnedThisWave.current = spawnedCount;
                        } else {
                            console.warn("[WaveManager Spawning] spawnEnemy returned null (pool full or other issue?). Pausing spawn interval for this wave.");
                            if (spawnIntervalRef.current) clearInterval(spawnIntervalRef.current);
                            // Do not set to null, might want to allow a resume or other handling for this wave
                        }
                    } else {
                        console.error("[WaveManager Spawning] Could not find safe spawn position. Stopping wave spawn.");
                        if (spawnIntervalRef.current) clearInterval(spawnIntervalRef.current);
                        spawnIntervalRef.current = null;
                    }
                } else {
                    if (spawnIntervalRef.current) clearInterval(spawnIntervalRef.current);
                    spawnIntervalRef.current = null;
                    console.log(`%c[WaveManager Spawning] Finished spawning Wave ${currentWave}. Transitioning to Active.`, "color: blue; font-weight: bold");
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
                console.log("%c[WaveManager Spawning] Cleaning up spawn interval effect cleanup.", "color: orange");
                clearInterval(spawnIntervalRef.current);
                // spawnIntervalRef.current = null; // Avoid race condition if effect re-runs quickly
             }
        };
    }, [waveStatus, currentWave, gameStarted]); 

    useEffect(() => {
        const setWaveBetween = setWaveBetweenRef.current;

        if (isGameOver || !gameStarted) return;

        if (waveStatus === 'Active') {
            if (zombiesRemainingInWave <= 0) {
                console.log(`%c[WaveManager Active] Wave ${currentWave} cleared! Transitioning to BetweenWaves.`, "color: purple; font-weight: bold");
                if (typeof playWaveClearedVORef.current === 'function') {
                    playWaveClearedVORef.current();
                } else {
                    console.error("%c[WaveManager Active] playWaveClearedVORef.current is NOT a function!", "color: red");
                }
                setWaveBetween();
            }
        }
    }, [waveStatus, zombiesRemainingInWave, currentWave, gameStarted]);

     useEffect(() => {
        const startWaveSpawning = startWaveSpawningRef.current;

        if (isGameOver || !gameStarted) return;

        if (waveStatus === 'BetweenWaves') {
             if (nextWaveStartTimerRef.current) clearTimeout(nextWaveStartTimerRef.current);
            const nextWaveNumber = currentWave + 1;
            const nextWaveIndex = nextWaveNumber - 1;
            
            console.log(`%c[WaveManager Between] State active. Setting timer for next wave (${nextWaveNumber}). Delay: ${TOTAL_BETWEEN_WAVE_DELAY}ms`, "color: purple");

            nextWaveStartTimerRef.current = setTimeout(() => {
                 if (nextWaveIndex < WAVES.length) {
                    console.log(`%c[WaveManager Between] Timer finished. Triggering Spawning for Wave ${nextWaveNumber}.`, "color: purple; font-weight: bold");
                    if (nextWaveNumber === 10) {
                        console.log("%c[WaveManager] Next wave is Wave 10 (Boss Wave). Activating boss fight.", "color: magenta; font-weight: bold;");
                        setBossFightActiveRef.current(true);
                    }
                    startWaveSpawning(nextWaveNumber, WAVES[nextWaveIndex].zombieCount);
                    zombiesSpawnedThisWave.current = 0;
                } else {
                    console.log("%c[WaveManager Between] All waves completed or no next wave defined!", "color: orange; font-weight: bold");
                    // Potentially transition to a game won state or similar
                }
            }, TOTAL_BETWEEN_WAVE_DELAY);
        }
        return () => {
            if (nextWaveStartTimerRef.current) clearTimeout(nextWaveStartTimerRef.current);
        };
    }, [waveStatus, currentWave, gameStarted]);

    return null;
};

export default WaveManager; 