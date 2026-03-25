import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useNakama } from '../context/NakamaContext';
import GameBoard from './GameBoard';
import { Colors, Radius } from '../styles/theme';
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
  const [board, setBoard] = useState<number[]>(new Array(9).fill(0));
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

  const userId = session?.user_id ?? '';

  useEffect(() => {
    if (!socket || !matchId) return;

    socket.onmatchdata = (msg) => {
      let data: any;
      try {
        const raw = msg.data instanceof Uint8Array
          ? new TextDecoder().decode(msg.data)
          : typeof msg.data === 'string'
            ? msg.data
            : JSON.stringify(msg.data);
        data = JSON.parse(raw);
      } catch { return; }

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

    socket.joinMatch(matchId).catch(() => setStatus('Failed to join match'));
    return () => { socket.onmatchdata = () => {}; };
  }, [socket, userId, matchId]);

  const handleCellClick = useCallback((pos: number) => {
    if (!socket || phase !== 'playing' || currentTurn !== userId || board[pos] !== 0) return;
    const optimistic = [...board];
    optimistic[pos] = myMark;
    setBoard(optimistic);
    setCurrentTurn('');
    setStatus("Opponent's turn");
    socket.sendMatchState(matchId, OpCode.MOVE, JSON.stringify({ position: pos }));
  }, [socket, matchId, phase, currentTurn, userId, board, myMark]);

  const leaveMatch = () => {
    try { socket?.leaveMatch(matchId); } catch {}
    onBack();
  };

  const isMyTurn = currentTurn === userId;
  const myInfo = players[userId];
  const opponentEntry = Object.entries(players).find(([id]) => id !== userId);
  const opponentInfo = opponentEntry?.[1] ?? null;

  const reasonText = (r: string) => {
    if (r === 'win') return 'Three in a row!';
    if (r === 'draw') return 'Board is full - nobody wins.';
    if (r === 'timeout') return 'Time ran out!';
    if (r === 'opponent_left') return 'Your opponent disconnected.';
    return '';
  };

  return (
    <View style={s.container}>
      <ScrollView contentContainerStyle={s.scroll}>
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={leaveMatch} style={s.backBtn}>
            <Text style={s.backBtnText}>Leave</Text>
          </TouchableOpacity>
          <Text style={s.headerTitle}>Tic Tac Toe</Text>
          <View style={s.modeBadge}><Text style={s.modeBadgeText}>{mode}</Text></View>
        </View>

        {/* Players */}
        <View style={s.playersBar}>
          <View style={[s.playerCard, isMyTurn && phase === 'playing' && s.activeCard]}>
            <Text style={[s.mark, myInfo?.mark === 1 ? s.xColor : s.oColor]}>
              {myInfo?.mark === 1 ? 'X' : myInfo?.mark === 2 ? 'O' : '?'}
            </Text>
            <Text style={s.pname} numberOfLines={1}>{myInfo?.displayName ?? 'You'}</Text>
          </View>
          <Text style={s.vs}>VS</Text>
          <View style={[s.playerCard, !isMyTurn && phase === 'playing' && s.activeCard]}>
            <Text style={[s.mark, opponentInfo?.mark === 1 ? s.xColor : s.oColor]}>
              {opponentInfo?.mark === 1 ? 'X' : opponentInfo?.mark === 2 ? 'O' : '?'}
            </Text>
            <Text style={s.pname} numberOfLines={1}>{opponentInfo?.displayName ?? '...'}</Text>
          </View>
        </View>

        {/* Timer */}
        {mode === 'timed' && phase === 'playing' && (
          <Text style={[s.timerDisplay, timer <= 10 && s.timerWarning]}>
            {timer}s <Text style={s.timerTotal}>/ {turnDuration}s</Text>
          </Text>
        )}

        {/* Status */}
        <View style={[s.statusBar, phase === 'waiting' && s.statusWaiting, phase === 'playing' && s.statusPlaying, phase === 'finished' && s.statusFinished]}>
          <Text style={[s.statusText, phase === 'waiting' && { color: Colors.yellow }, phase === 'playing' && { color: Colors.green }, phase === 'finished' && { color: Colors.cyan }]}>
            {status}
          </Text>
        </View>

        {/* Board */}
        <GameBoard
          board={board}
          myMark={myMark}
          isMyTurn={isMyTurn}
          winningLine={winLine}
          gameOver={phase === 'finished'}
          onCellClick={handleCellClick}
        />
      </ScrollView>

      {/* Result Overlay */}
      {phase === 'finished' && result && (
        <View style={s.overlay}>
          <View style={s.resultCard}>
            <Text style={[
              s.resultTitle,
              result.winner === userId && { color: Colors.green },
              result.winner === null && { color: Colors.yellow },
              result.winner !== null && result.winner !== userId && { color: Colors.red },
            ]}>
              {status}
            </Text>
            <Text style={s.resultReason}>{reasonText(result.reason)}</Text>
            <TouchableOpacity style={s.btnPrimary} onPress={leaveMatch}>
              <Text style={s.btnPrimaryText}>Back to Lobby</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: 16, alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border, marginBottom: 16 },
  backBtn: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.sm, paddingVertical: 8, paddingHorizontal: 16 },
  backBtnText: { color: Colors.text, fontSize: 14 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },
  modeBadge: { backgroundColor: 'rgba(0,229,255,0.15)', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 4 },
  modeBadgeText: { fontSize: 11, color: Colors.cyan, fontWeight: '600', textTransform: 'uppercase' },
  playersBar: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12, width: '100%', justifyContent: 'center' },
  playerCard: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 16, backgroundColor: Colors.card, borderRadius: Radius.sm, borderWidth: 2, borderColor: 'transparent', minWidth: 120 },
  activeCard: { borderColor: Colors.green },
  mark: { fontSize: 22, fontWeight: '900' },
  xColor: { color: Colors.cyan },
  oColor: { color: Colors.pink },
  pname: { fontSize: 13, color: Colors.text2, maxWidth: 80 },
  vs: { fontWeight: '700', color: Colors.text2, fontSize: 14 },
  timerDisplay: { fontSize: 28, fontWeight: '700', color: Colors.cyan, marginBottom: 8, textAlign: 'center' },
  timerWarning: { color: Colors.red },
  timerTotal: { fontSize: 14, color: Colors.text2, fontWeight: '400' },
  statusBar: { paddingVertical: 6, paddingHorizontal: 16, borderRadius: 20, marginBottom: 12 },
  statusWaiting: {},
  statusPlaying: {},
  statusFinished: {},
  statusText: { fontSize: 15, fontWeight: '600', textAlign: 'center' },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  resultCard: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, padding: 32, alignItems: 'center', width: '100%', maxWidth: 340 },
  resultTitle: { fontSize: 28, fontWeight: '700', marginBottom: 8 },
  resultReason: { color: Colors.text2, marginBottom: 24, textAlign: 'center' },
  btnPrimary: { paddingVertical: 14, paddingHorizontal: 32, borderRadius: Radius.sm, backgroundColor: Colors.cyan },
  btnPrimaryText: { fontSize: 16, fontWeight: '700', color: '#000' },
});
