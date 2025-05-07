"use client";

import React from 'react';
import useGameStore from '@/hooks/useGameStore';
import IndividualBoss from './IndividualBoss'; // We'll create this next

export default function BossManager() {
    const bossFightActive = useGameStore((state) => state.bossFightActive);
    const enemies = useGameStore((state) => state.enemies);

    if (!bossFightActive) {
        return null; // Don't render if boss fight is not active
    }

    // Find the active boss in the enemies array
    const activeBoss = enemies.find(enemy => enemy.type === 'zombie_boss' && !enemy.isDead);

    if (!activeBoss) {
        console.log("[BossManager] Boss fight active, but no living boss found in enemy pool.");
        return null; // No living boss found
    }

    console.log(`[BossManager] Rendering IndividualBoss for ID: ${activeBoss.id}`);
    return (
        <>
            <IndividualBoss 
                id={activeBoss.id} 
                initialPosition={activeBoss.position} 
                type={activeBoss.type} 
            />
        </>
    );
} 