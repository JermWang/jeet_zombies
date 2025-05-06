"use client";

import React from 'react';
import useGameStore from '@/hooks/useGameStore';
import IndividualBoss from './IndividualBoss'; // We'll create this next

export default function BossManager() {
    const boss = useGameStore((state) => state.enemies[0]); // Assuming boss is always ID 0

    if (!boss || boss.isDead) {
        return null; // Don't render if boss doesn't exist or is dead
    }

    return (
        <>
            {/* Commenting out IndividualBoss to test floor zombie visual */}
            {/* <IndividualBoss id={boss.id} initialPosition={boss.position} /> */}
        </>
    );
} 