"use client";

import { useEffect } from 'react';
import useGameStore from '@/hooks/useGameStore';

/**
 * This component listens for global game events and interacts with the game store.
 */
export default function GameEventManager() {
  const damageEnemy = useGameStore((state) => state.damageEnemy);

  useEffect(() => {
    const handleEnemyHit = (event: Event) => {
      // Type assertion for CustomEvent
      const customEvent = event as CustomEvent;
      const { enemyId, damage } = customEvent.detail;

      if (typeof enemyId === 'number' && typeof damage === 'number') {
        console.log(`GameEventManager received enemyHit for ID: ${enemyId}, Damage: ${damage}`);
        damageEnemy(enemyId, damage);
      } else {
        console.warn('GameEventManager received enemyHit event with invalid detail:', customEvent.detail);
      }
    };

    window.addEventListener('enemyHit', handleEnemyHit);

    // Cleanup listener on unmount
    return () => {
      window.removeEventListener('enemyHit', handleEnemyHit);
    };
  }, [damageEnemy]); // Re-run effect if damageEnemy function reference changes (shouldn't often with zustand)

  // This component doesn't render anything visual
  return null;
} 