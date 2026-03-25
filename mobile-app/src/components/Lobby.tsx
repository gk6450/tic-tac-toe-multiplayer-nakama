import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Platform,
} from 'react-native';
import { useNakama } from '../context/NakamaContext';
import { Colors, Radius } from '../styles/theme';
import type { GameMode, MatchInfo, PlayerStats } from '../types/game';

interface Props {
  onJoinGame: (matchId: string) => void;
  onViewLeaderboard: () => void;
}

export default function Lobby({ onJoinGame, onViewLeaderboard }: Props) {
  const { client, session, socket, logout } = useNakama();
  const [gameMode, setGameMode] = useState<GameMode>('classic');
  const [turnDuration, setTurnDuration] = useState(30);
  const [openMatches, setOpenMatches] = useState<MatchInfo[]>([]);
  const [showMatches, setShowMatches] = useState(false);
  const [searching, setSearching] = useState(false);
  const [matchmakerTicket, setMatchmakerTicket] = useState('');
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { loadStats(); }, []);

  useEffect(() => {
    if (!socket) return;
    socket.onmatchmakermatched = async (matched) => {
      setSearching(false);
      setMatchmakerTicket('');
      if (matched.match_id) onJoinGame(matched.match_id);
    };
    return () => { socket.onmatchmakermatched = () => {}; };
  }, [socket, onJoinGame]);

  const loadStats = async () => {
    try {
      const res = await client.rpc(session!, 'get_player_stats', {});
      const data = res.payload as any;
      setStats(data?.stats);
    } catch {}
  };

  const createMatch = async () => {
    setLoading(true); setError('');
    try {
      const payload: any = { mode: gameMode };
      if (gameMode === 'timed') payload.turnDuration = turnDuration;
      const res = await client.rpc(session!, 'create_match', payload);
      const data = res.payload as any;
      onJoinGame(data.matchId);
    } catch { setError('Failed to create match'); }
    setLoading(false);
  };

  const findMatches = async () => {
    setLoading(true); setError('');
    try {
      const res = await client.rpc(session!, 'find_match', { mode: gameMode });
      const data = res.payload as any;
      setOpenMatches(data?.matches || []);
      setShowMatches(true);
    } catch { setError('Failed to search'); }
    setLoading(false);
  };

  const startMatchmaking = async () => {
    setSearching(true); setError('');
    try {
      const numProps: Record<string, number> = {};
      if (gameMode === 'timed') numProps.turnDuration = turnDuration;
      const ticket = await socket!.addMatchmaker('+properties.mode:' + gameMode, 2, 2, { mode: gameMode }, numProps);
      setMatchmakerTicket(ticket.ticket);
    } catch { setError('Matchmaking failed'); setSearching(false); }
  };

  const cancelMatchmaking = useCallback(async () => {
    if (matchmakerTicket) { try { await socket!.removeMatchmaker(matchmakerTicket); } catch {} }
    setSearching(false);
    setMatchmakerTicket('');
  }, [socket, matchmakerTicket]);

  const displayName = session?.username || 'Player';

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <View style={s.header}>
        <Text style={s.headerTitle}>Tic Tac Toe</Text>
        <View style={s.userRow}>
          <Text style={s.username}>{displayName}</Text>
          <TouchableOpacity onPress={logout}><Text style={s.logoutText}>Logout</Text></TouchableOpacity>
        </View>
      </View>

      {/* Mode Selection */}
      <View style={s.card}>
        <Text style={s.cardTitle}>Game Mode</Text>
        <View style={s.modeRow}>
          <TouchableOpacity style={[s.modeBtn, gameMode === 'classic' && s.modeBtnActive]} onPress={() => setGameMode('classic')}>
            <Text style={[s.modeBtnText, gameMode === 'classic' && s.modeBtnTextActive]}>Classic</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.modeBtn, gameMode === 'timed' && s.modeBtnActive]} onPress={() => setGameMode('timed')}>
            <Text style={[s.modeBtnText, gameMode === 'timed' && s.modeBtnTextActive]}>Timed</Text>
          </TouchableOpacity>
        </View>
        {gameMode === 'timed' && (
          <View style={s.timerSelector}>
            <Text style={s.timerLabel}>Turn Duration</Text>
            <View style={s.timerRow}>
              {[10, 15, 20, 30, 45, 60].map(sec => (
                <TouchableOpacity key={sec} style={[s.timerBtn, turnDuration === sec && s.timerBtnActive]} onPress={() => setTurnDuration(sec)}>
                  <Text style={[s.timerBtnText, turnDuration === sec && s.timerBtnTextActive]}>{sec}s</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </View>

      {/* Actions */}
      <View style={s.card}>
        <Text style={s.cardTitle}>Play</Text>
        {!!error && <View style={s.errorBox}><Text style={s.errorText}>{error}</Text></View>}
        {!searching ? (
          <View style={s.actionCol}>
            <TouchableOpacity style={[s.btnPrimary, loading && s.disabled]} onPress={createMatch} disabled={loading}>
              <Text style={s.btnPrimaryText}>{loading ? 'Creating...' : 'Create Match'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.btnSecondary, loading && s.disabled]} onPress={findMatches} disabled={loading}>
              <Text style={s.btnSecondaryText}>Find Match</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.btnAccent, loading && s.disabled]} onPress={startMatchmaking} disabled={loading}>
              <Text style={s.btnAccentText}>Auto Match</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={s.searchingCol}>
            <ActivityIndicator color={Colors.cyan} size="large" />
            <Text style={s.searchingText}>Searching for opponent...</Text>
            <TouchableOpacity onPress={cancelMatchmaking}><Text style={s.logoutText}>Cancel</Text></TouchableOpacity>
          </View>
        )}
      </View>

      {/* Open Matches */}
      {showMatches && (
        <View style={s.card}>
          <View style={s.matchHeader}>
            <Text style={s.cardTitle}>Open Matches ({openMatches.length})</Text>
            <TouchableOpacity onPress={() => setShowMatches(false)}><Text style={s.logoutText}>Close</Text></TouchableOpacity>
          </View>
          {openMatches.length === 0 ? (
            <Text style={s.emptyText}>No open matches found. Create one!</Text>
          ) : (
            openMatches.map(m => (
              <View key={m.matchId} style={s.matchItem}>
                <View>
                  <Text style={s.matchId}>{m.matchId.slice(0, 8)}...</Text>
                  <Text style={s.matchMode}>{m.label?.mode || 'classic'}</Text>
                </View>
                <TouchableOpacity style={s.btnSmall} onPress={() => onJoinGame(m.matchId)}>
                  <Text style={s.btnSmallText}>Join</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>
      )}

      {/* Stats */}
      {stats && (
        <View style={s.card}>
          <Text style={s.cardTitle}>Your Stats</Text>
          <View style={s.statsGrid}>
            <View style={s.stat}><Text style={[s.statVal, { color: Colors.green }]}>{stats.wins}</Text><Text style={s.statLbl}>Wins</Text></View>
            <View style={s.stat}><Text style={[s.statVal, { color: Colors.red }]}>{stats.losses}</Text><Text style={s.statLbl}>Losses</Text></View>
            <View style={s.stat}><Text style={[s.statVal, { color: Colors.yellow }]}>{stats.draws}</Text><Text style={s.statLbl}>Draws</Text></View>
            <View style={s.stat}><Text style={[s.statVal, { color: Colors.cyan }]}>{stats.bestStreak}</Text><Text style={s.statLbl}>Best Streak</Text></View>
          </View>
        </View>
      )}

      <TouchableOpacity style={s.btnSecondary} onPress={onViewLeaderboard}>
        <Text style={s.btnSecondaryText}>View Leaderboard</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: 16, paddingBottom: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: Colors.border, marginBottom: 16 },
  headerTitle: { fontSize: 22, fontWeight: '700', color: Colors.cyan },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  username: { fontSize: 14, color: Colors.text2 },
  logoutText: { fontSize: 14, color: Colors.text2 },
  card: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, padding: 20, marginBottom: 16 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: Colors.text, marginBottom: 12 },
  modeRow: { flexDirection: 'row', gap: 8 },
  modeBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', backgroundColor: Colors.bg2, borderRadius: Radius.sm, borderWidth: 2, borderColor: 'transparent' },
  modeBtnActive: { borderColor: Colors.cyan, backgroundColor: 'rgba(0,229,255,0.08)' },
  modeBtnText: { fontSize: 14, fontWeight: '600', color: Colors.text2 },
  modeBtnTextActive: { color: Colors.cyan },
  timerSelector: { marginTop: 14 },
  timerLabel: { fontSize: 13, color: Colors.text2, marginBottom: 8 },
  timerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  timerBtn: { paddingVertical: 8, paddingHorizontal: 14, backgroundColor: Colors.bg2, borderRadius: Radius.sm, borderWidth: 2, borderColor: 'transparent' },
  timerBtnActive: { borderColor: Colors.pink, backgroundColor: 'rgba(255,64,129,0.1)' },
  timerBtnText: { fontSize: 13, fontWeight: '600', color: Colors.text2 },
  timerBtnTextActive: { color: Colors.pink },
  actionCol: { gap: 10 },
  btnPrimary: { paddingVertical: 14, borderRadius: Radius.sm, alignItems: 'center', backgroundColor: Colors.cyan },
  btnPrimaryText: { fontSize: 16, fontWeight: '700', color: '#000' },
  btnSecondary: { paddingVertical: 14, borderRadius: Radius.sm, alignItems: 'center', borderWidth: 2, borderColor: Colors.cyan, marginBottom: 16 },
  btnSecondaryText: { fontSize: 16, fontWeight: '600', color: Colors.cyan },
  btnAccent: { paddingVertical: 14, borderRadius: Radius.sm, alignItems: 'center', backgroundColor: Colors.pink },
  btnAccentText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  disabled: { opacity: 0.5 },
  searchingCol: { alignItems: 'center', paddingVertical: 16, gap: 12 },
  searchingText: { color: Colors.text2 },
  errorBox: { backgroundColor: 'rgba(255,82,82,0.15)', borderWidth: 1, borderColor: 'rgba(255,82,82,0.3)', borderRadius: Radius.sm, padding: 12, marginBottom: 12 },
  errorText: { color: Colors.red, fontSize: 14, textAlign: 'center' },
  matchHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  matchItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Colors.bg2, borderRadius: Radius.sm, padding: 12, marginBottom: 8 },
  matchId: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 13, color: Colors.text2 },
  matchMode: { fontSize: 11, color: Colors.cyan, textTransform: 'uppercase', marginTop: 2 },
  emptyText: { color: Colors.text2, textAlign: 'center', paddingVertical: 16 },
  btnSmall: { paddingVertical: 6, paddingHorizontal: 16, backgroundColor: Colors.cyan, borderRadius: Radius.sm },
  btnSmallText: { fontSize: 13, fontWeight: '600', color: '#000' },
  statsGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  stat: { alignItems: 'center', flex: 1 },
  statVal: { fontSize: 24, fontWeight: '700' },
  statLbl: { fontSize: 11, color: Colors.text2, textTransform: 'uppercase', marginTop: 4 },
});
