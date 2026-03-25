import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { TicTacToeScene } from './TicTacToeScene';

interface Props {
  board: number[];
  myMark: number;
  isMyTurn: boolean;
  winningLine: number[] | null;
  onCellClick: (position: number) => void;
  gameOver: boolean;
  onSceneReady?: (scene: TicTacToeScene) => void;
}

export default function PhaserGame({
  board, myMark, isMyTurn, winningLine, onCellClick, gameOver, onSceneReady,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const sceneRef = useRef<TicTacToeScene | null>(null);

  useEffect(() => {
    if (!containerRef.current || gameRef.current) return;

    const scene = new TicTacToeScene();
    sceneRef.current = scene;
    onSceneReady?.(scene);

    gameRef.current = new Phaser.Game({
      type: Phaser.AUTO,
      width: 400,
      height: 400,
      parent: containerRef.current,
      backgroundColor: '#1a1a3e',
      scene,
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
    });

    return () => {
      gameRef.current?.destroy(true);
      gameRef.current = null;
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    sceneRef.current?.setCellClickCallback(onCellClick);
  }, [onCellClick]);

  useEffect(() => {
    sceneRef.current?.updateGameState({
      board, myMark, isMyTurn, winningLine, gameOver,
    });
  }, [board, myMark, isMyTurn, winningLine, gameOver]);

  return <div ref={containerRef} className="phaser-container" />;
}
