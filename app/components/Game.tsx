import React, { useEffect, useState } from 'react';
import { useGameStore } from '../stores/gameStore';

const Game: React.FC = () => {
  const { gameStarted, previewFadeOpacity, isInitialPreviewReady } = useGameStore(
    (state) => state
  );
  // console.log(`[Game.tsx] Rendering. gameStarted: ${gameStarted} previewFadeOpacity: ${previewFadeOpacity} isInitialPreviewReady: ${isInitialPreviewReady}`);

  const [localGameStarted, setLocalGameStarted] = useState(gameStarted);
  const [localPreviewFadeOpacity, setLocalPreviewFadeOpacity] = useState(previewFadeOpacity);
  const [localIsInitialPreviewReady, setLocalIsInitialPreviewReady] = useState(isInitialPreviewReady);

  useEffect(() => {
    setLocalGameStarted(gameStarted);
    setLocalPreviewFadeOpacity(previewFadeOpacity);
    setLocalIsInitialPreviewReady(isInitialPreviewReady);
  }, [gameStarted, previewFadeOpacity, isInitialPreviewReady]);

  return (
 