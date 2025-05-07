import React, { useEffect, useMemo } from 'react';
import { useGameStore } from '../stores/gameStore';

const GameScene: React.FC = () => {
  const gameStarted = useGameStore((state) => state.gameStarted);
  // console.log(`[GameScene] Rendering. gameStarted: ${gameStarted}`);

  // Memoize heavy components

  return (
    <div>GameScene Component</div>
  );
};

export default GameScene; 