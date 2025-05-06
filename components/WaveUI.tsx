"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import useGameStore from '@/hooks/useGameStore';
import { useSoundEffects } from '@/hooks/useSoundEffects';

// Constants for delays
const WAVE_CLEARED_DURATION = 5; // Seconds to show "Wave Cleared"
const COUNTDOWN_START_VALUE = 3; // Start countdown from 3
const TITLE_TO_COUNTDOWN_DELAY = 3000; // INCREASED to 3 seconds (was 1500)

const WaveUI = () => {
    const { 
        currentWave, 
        waveStatus, 
        zombiesRemainingInWave, 
        totalZombiesInWave // Fetch new state
    } = useGameStore(state => ({
        currentWave: state.currentWave,
        waveStatus: state.waveStatus,
        zombiesRemainingInWave: state.zombiesRemainingInWave,
        totalZombiesInWave: state.totalZombiesInWave, // Fetch new state
    }));
    // Get sound playback function
    const { playWaveClearedVO, playCountdownVO, playWaveIncomingVO } = useSoundEffects(state => ({
        playWaveClearedVO: state.playWaveClearedVO,
        playCountdownVO: state.playCountdownVO,
        playWaveIncomingVO: state.playWaveIncomingVO, // ADD this function
    }));

    // State for the UI display phase
    type DisplayStatus = 'Hidden' | 'Cleared' | 'Spawning'; // Removed Countdown state here
    const [displayStatus, setDisplayStatus] = useState<DisplayStatus>('Hidden');
    const [countdown, setCountdown] = useState(0); // Numeric countdown value (3,2,1)
    const [showCountdown, setShowCountdown] = useState(false); // Flag if countdown numbers should show
    const [countdownCompleted, setCountdownCompleted] = useState(false); // Keep this flag

    // Refs for timers to manage cleanup
    const clearedDisplayTimerRef = useRef<NodeJS.Timeout | null>(null);
    const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null); // Use this for the 3,2,1 during Spawning
    const initialTitleTimerRef = useRef<NodeJS.Timeout | null>(null); // NEW: Timer for delay before countdown

    // --- Effect to Handle "Spawning" State: Show "Initial Title", wait, then Countdown ---
    useEffect(() => {
        // --- LOGGING ---
        console.log(`%c[WaveUI Render Check] waveStatus: ${waveStatus}, displayStatus: ${displayStatus}, showCountdown: ${showCountdown}, countdown: ${countdown}`, "color: gray");
        // ---------------

        const cleanupSpawningTimers = () => {
            console.log("%c[WaveUI Spawning Cleanup]", "color: orange");
            if (initialTitleTimerRef.current) clearTimeout(initialTitleTimerRef.current);
            if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
            initialTitleTimerRef.current = null;
            countdownIntervalRef.current = null;
            setShowCountdown(false); 
            setCountdown(0);
            setCountdownCompleted(false); 
        };

        if (waveStatus === 'Spawning') {
            console.log("%c[WaveUI Spawning Effect] Starting. Showing initial title.", "color: blue; font-weight: bold");
            // Ensure previous timers are cleared before starting new ones
            cleanupSpawningTimers(); 
            
            // Reset flags for this spawning phase
            setShowCountdown(false);      
            setCountdownCompleted(false); 

            // Play Wave Incoming sound when initial title shows
            console.log("%c[WaveUI Spawning Effect] Calling playWaveIncomingVO()", "color: cyan");
            playWaveIncomingVO(); 

            // --- Show Initial Title & Start Delay Timer for Countdown --- 
            console.log(`%c[WaveUI Spawning Effect] Setting ${TITLE_TO_COUNTDOWN_DELAY}ms delay timer for numerical countdown.`, "color: blue");
            initialTitleTimerRef.current = setTimeout(() => {
                console.log("%c[WaveUI Spawning Effect] Initial title delay finished. Starting numerical countdown.", "color: blue; font-weight: bold");
                setCountdown(COUNTDOWN_START_VALUE); 
                setShowCountdown(true); // Switch to showing the countdown number
                console.log("%c[WaveUI Spawning Effect] Calling playCountdownVO(3)", "color: cyan");
                playCountdownVO(COUNTDOWN_START_VALUE); // Play "3"

                // Start 1-second interval for 2, 1
                console.log("%c[WaveUI Spawning Countdown] Starting 1s interval for 2, 1.", "color: green");
                if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current); // Clear just in case
                countdownIntervalRef.current = setInterval(() => {
                    setCountdown(prev => {
                        const nextVal = prev - 1;
                        if (nextVal > 0) {
                            console.log(`%c[WaveUI Spawning Countdown] Tick: ${nextVal}`, "color: green");
                            console.log(`%c[WaveUI Spawning Countdown] Calling playCountdownVO(${nextVal})`, "color: cyan");
                            playCountdownVO(nextVal); // Play 2, 1
                            return nextVal;
                        } else {
                            // Countdown finished (reached 0)
                            console.log("%c[WaveUI Spawning Countdown] Finished.", "color: green; font-weight: bold");
                            if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
                            countdownIntervalRef.current = null;
                            setShowCountdown(false); // Stop showing the countdown number
                            setCountdownCompleted(true); // Flag that countdown sequence is done
                            return 0;
                        }
                    });
                }, 1000);
            }, TITLE_TO_COUNTDOWN_DELAY); // Use the new delay constant

        } else {
            // If status is NOT Spawning, ensure all spawning-related timers/state are cleared
            cleanupSpawningTimers();
        }

        // Cleanup timers on unmount or if waveStatus changes
        return cleanupSpawningTimers;

    }, [waveStatus, playCountdownVO]); // Effect runs when waveStatus changes


    // --- Handle Between Wave Sequence (Cleared Display) ---
    useEffect(() => {
        console.log(`%c[WaveUI Between Effect] Running. waveStatus: ${waveStatus}`, "color: purple"); // Removed displayStatus log
        
        const cleanupTimer = () => {
            console.log("%c[WaveUI Between Cleanup] Running cleanup timer function.", "color: darkorange");
            if (clearedDisplayTimerRef.current) {
                clearTimeout(clearedDisplayTimerRef.current);
                clearedDisplayTimerRef.current = null;
            }
        };

        if (waveStatus === 'BetweenWaves') {
            console.log("%c[WaveUI Between Effect] Status is BetweenWaves. Showing Cleared title.", "color: purple; font-weight: bold"); // Simplified log
            // Don't need setDisplayStatus anymore if controlled by waveStatus
            console.log("%c[WaveUI Between Effect] Calling playWaveClearedVO()", "color: cyan");
            playWaveClearedVO();
            cleanupTimer(); // Clear previous timer just in case

            console.log(`%c[WaveUI Between Effect] Setting ${WAVE_CLEARED_DURATION}s timer to hide Cleared display.`, "color: purple");
            clearedDisplayTimerRef.current = setTimeout(() => {
                console.log("%c[WaveUI Between Effect] 'Cleared' display timer fired. Hiding UI (via status change).", "color: purple; font-weight: bold"); // Updated log
                // No need to setDisplayStatus('Hidden'); UI will hide when waveStatus changes
                clearedDisplayTimerRef.current = null;
            }, WAVE_CLEARED_DURATION * 1000); 
        } else {
            // If status is not BetweenWaves, ensure timer cleared
            cleanupTimer(); 
            // No need to check displayStatus or set to Hidden
        }

        return cleanupTimer; // Cleanup on unmount / status change

    }, [waveStatus, playWaveClearedVO]); // Removed displayStatus dependency

    // Determine the text based on the primary waveStatus and the internal displayStatus
    const getWaveTitle = () => {
        // Returns the main part of the title (Wave #, Countdown, or Cleared)
        if (waveStatus === 'BetweenWaves') return `WAVE ${currentWave}`;
        if (waveStatus === 'Spawning' && showCountdown) return `${countdown}`;
        if (waveStatus === 'Spawning' && !showCountdown && !countdownCompleted) return `WAVE ${currentWave}`;
        return ''; // No title during Active
    };

    const getWaveSubtitle = () => {
        // Returns the secondary part (Total, Cleared status)
        if (waveStatus === 'BetweenWaves') return 'CLEARED';
        if (waveStatus === 'Spawning' && !showCountdown && !countdownCompleted) return `TOTAL: ${totalZombiesInWave}`;
        // No subtitle during countdown or active
        return '';
    };

    // --- Visibility Check --- 
    const isVisible = useMemo(() => { 
        // REVISED: Show whenever spawning or between waves
        const visible = waveStatus === 'Spawning' || waveStatus === 'BetweenWaves';
        // console.log(`%c[WaveUI Visibility Check] isVisible: ${visible} (waveStatus: ${waveStatus})`, "color: gray"); // TEMP DISABLED
        return visible;
    }, [waveStatus]); // Dependency only on waveStatus now

    // --- Log Rendering (Moved Before Early Return) --- 
    useEffect(() => {
        // console.log("%c[WaveUI Render] Rendering UI.", "color: gray"); // TEMP DISABLED
    }); // Run on every render

    if (!isVisible) {
        // console.log("[WaveUI Render] Not visible."); // Optional debug log
         return null;
    }
    
    // --- REMOVED DUPLICATE LOGGING EFFECT ---

    // NEW: Conditionally apply pulse animation to the container
    const containerAnimation = waveStatus === 'Spawning' && !showCountdown ? 'animate-pulse-slow' : 'animate-fade-in';

    return (
        // Apply animation and flex layout directly to the main container
        <div className={`absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10 p-4 ${containerAnimation}`}>
             {/* Removed Background Panel Wrapper */}
            {/* Big centered text (Title) */}
            <h1 
                key={`${getWaveTitle()}-title`}
                className={`font-pixel text-6xl md:text-8xl lg:text-9xl font-bold text-red-500 text-center drop-shadow-[0_5px_3px_rgba(0,0,0,0.7)]`}
                style={{ textShadow: '4px 4px 0px rgba(0,0,0,0.9)' }}
            >
                {getWaveTitle()}
            </h1>
            {/* Slightly Smaller Subtitle */}
            {getWaveSubtitle() && (
                <h2 
                    key={`${getWaveSubtitle()}-subtitle`}
                    className="font-pixel text-4xl md:text-5xl text-yellow-400 text-center mt-2"
                    style={{ textShadow: '3px 3px 0px rgba(0,0,0,0.8)' }}
                 >
                    {getWaveSubtitle()}
                 </h2>
            )}
        </div>
    );
};

export default WaveUI;

// Add simple animations to tailwind config if not already present
// In tailwind.config.ts extend theme.extend.animation:
/*
animation: {
  'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
  'fade-in': 'fadeIn 1s ease-out forwards',
}
keyframes: {
  fadeIn: {
      '0%': { opacity: '0' },
      '100%': { opacity: '1' },
    }
}
*/ 