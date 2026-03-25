import { useState, useEffect, useCallback, useRef } from 'react';
import { useNakama } from '../context/NakamaContext';
import PhaserGame from '../game/PhaserGame';
import { TicTacToeScene } from '../game/TicTacToeScene';
import {
  OpCode,
  type PlayerAssignment,
  type GameOverMessage,
  type GameMode,
} from '../types/game';

interface Props {
  matchId: string;
  onBack: () => void;
}

export default function GameView({ matchId, onBack }: Props) {
  const { socket, session } = useNakama();

  const [board, setBoard] = useState<number[]>(Array(9).fill(0));
  const [players, setPlayers] = useState<Record<string, PlayerAssignment>>({});
  const [currentTurn, setCurrentTurn] = useState('');
  const [myMark, setMyMark] = useState(0);
  const [phase, setPhase] = useState<'waiting' | 'playing' | 'finished'>('waiting');
  const [result, setResult] = useState<GameOverMessage | null>(null);
  const [timer, setTimer] = useState(0);
  const [turnDuration, setTurnDuration] = useState(30);
  const [mode, setMode] = useState<GameMode>('classic');
  const [winLine, setWinLine] = useState<number[] | null>(null);
  const [status, setStatus] = useState('Waiting for opponent...');
  const sceneRef = useRef<TicTacToeScene | null>(null);

  const userId = session?.user_id ?? '';

  useEffect(() => {
    if (!socket || !matchId) return;

    // 1. Set up the handler FIRST
    socket.onmatchdata = (msg) => {
      let data: any;
      try {
        const raw = msg.data instanceof Uint8Array
          ? new TextDecoder().decode(msg.data)
          : typeof msg.data === 'string'
            ? msg.data
            : JSON.stringify(msg.data);
        data = JSON.parse(raw);
      } catch {
        return;
      }

      switch (msg.op_code) {
        case OpCode.START:
          setBoard(data.board);
          setCurrentTurn(data.currentTurn);
          setPlayers(data.players);
          setMode(data.gameMode);
          if (data.turnDuration) setTurnDuration(data.turnDuration);
          setMyMark(data.players[userId]?.mark ?? 0);
          setPhase('playing');
          setStatus(data.currentTurn === userId ? 'Your turn!' : "Opponent's turn");
          break;

        case OpCode.STATE_UPDATE:
          setBoard(data.board);
          setCurrentTurn(data.currentTurn);
          setStatus(data.currentTurn === userId ? 'Your turn!' : "Opponent's turn");
          break;

        case OpCode.GAME_OVER:
          setBoard(data.board);
          setResult(data);
          setWinLine(data.winningLine ?? null);
          setPhase('finished');
          if (data.winner === null) setStatus("It's a draw!");
          else if (data.winner === userId) setStatus('You win!');
          else setStatus('You lose!');
          break;

        case OpCode.TIMER_UPDATE:
          setTimer(data.remainingSeconds);
          break;

        case OpCode.OPPONENT_LEFT:
          setResult(data);
          setPhase('finished');
          setStatus('Opponent left - You win!');
          break;
      }
    };

    // 2. THEN join the match (handler is guaranteed to be ready)
    socket.joinMatch(matchId).catch(() => {
      setStatus('Failed to join match');
    });

    return () => { socket.onmatchdata = () => {}; };
  }, [socket, userId, matchId]);

  const handleCellClick = useCallback((pos: number) => {
    if (!socket || phase !== 'playing' || currentTurn !== userId || board[pos] !== 0) return;

    sceneRef.current?.placeOptimistic(pos, myMark);

    const optimisticBoard = [...board];
    optimisticBoard[pos] = myMark;
    setBoard(optimisticBoard);
    setCurrentTurn('');
    setStatus("Opponent's turn");

    socket.sendMatchState(matchId, OpCode.MOVE, JSON.stringify({ position: pos }));
  }, [socket, matchId, phase, currentTurn, userId, board, myMark]);

  const leaveMatch = () => {
    try { socket?.leaveMatch(matchId); } catch { /* ok */ }
    onBack();
  };

  const isMyTurn = currentTurn === userId;
  const myInfo = players[userId];
  const opponentEntry = Object.entries(players).find(([id]) => id !== userId);
  const opponentInfo = opponentEntry?.[1] ?? null;

  return (
    <div className="game-page">
      {/* Header */}
      <div className="game-header">
        <button onClick={leaveMatch} className="btn-back">Leave</button>
        <h2>Tic Tac Toe</h2>
        <span className="mode-badge">{mode}</span>
      </div>

      {/* Players bar */}
      <div className="players-bar">
        <div className={`player-card ${isMyTurn && phase === 'playing' ? 'active' : ''}`}>
          <span className={myInfo?.mark === 1 ? 'mark x-color' : 'mark o-color'}>
            {myInfo?.mark === 1 ? 'X' : myInfo?.mark === 2 ? 'O' : '?'}
          </span>
          <span className="pname">{myInfo?.displayName ?? 'You'}</span>
        </div>
        <span className="vs">VS</span>
        <div className={`player-card ${!isMyTurn && phase === 'playing' ? 'active' : ''}`}>
          <span className={opponentInfo?.mark === 1 ? 'mark x-color' : 'mark o-color'}>
            {opponentInfo?.mark === 1 ? 'X' : opponentInfo?.mark === 2 ? 'O' : '?'}
          </span>
          <span className="pname">{opponentInfo?.displayName ?? '...'}</span>
        </div>
      </div>

      {/* Timer */}
      {mode === 'timed' && phase === 'playing' && (
        <div className={`timer-display ${timer <= 10 ? 'warning' : ''}`}>
          {timer}s <span className="timer-total">/ {turnDuration}s</span>
        </div>
      )}

      {/* Status */}
      <div className={`status-bar ${phase}`}>{status}</div>

      {/* Phaser Board */}
      <PhaserGame
        board={board}
        myMark={myMark}
        isMyTurn={isMyTurn}
        winningLine={winLine}
        onCellClick={handleCellClick}
        gameOver={phase === 'finished'}
        onSceneReady={(scene) => { sceneRef.current = scene; }}
      />

      {/* Game Over overlay */}
      {phase === 'finished' && result && (
        <div className="result-overlay">
          <div className="result-card">
            <h3 className={result.winner === userId ? 'win' : result.winner === null ? 'draw' : 'loss'}>
              {status}
            </h3>
            <p className="result-reason">
              {result.reason === 'win' && 'Three in a row!'}
              {result.reason === 'draw' && 'Board is full - nobody wins.'}
              {result.reason === 'timeout' && 'Time ran out!'}
              {result.reason === 'opponent_left' && 'Your opponent disconnected.'}
            </p>
            <button onClick={leaveMatch} className="btn-primary">Back to Lobby</button>
          </div>
        </div>
      )}
    </div>
  );
}
