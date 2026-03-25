import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useNakama } from '../context/NakamaContext';
import { Colors, Radius } from '../styles/theme';
import type { LeaderboardRecord } from '../types/game';

interface Props {
  onBack: () => void;
}

export default function Leaderboard({ onBack }: Props) {
  const { client, session } = useNakama();
  const [records, setRecords] = useState<LeaderboardRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchLeaderboard(); }, []);

  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
      const res = await client.rpc(session!, 'get_leaderboard', { limit: 20 });
      const data = res.payload as any;
      setRecords(data.records || []);
    } catch {}
    setLoading(false);
  };

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={onBack} style={s.backBtn}>
          <Text style={s.backBtnText}>Back</Text>
        </TouchableOpacity>
        <Text style={s.title}>Leaderboard</Text>
        <TouchableOpacity onPress={fetchLeaderboard}>
          <Text style={s.refreshText}>Refresh</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={Colors.cyan} size="large" /></View>
      ) : records.length === 0 ? (
        <View style={s.center}><Text style={s.emptyText}>No records yet. Play some games!</Text></View>
      ) : (
        <ScrollView contentContainerStyle={s.tableContent}>
          {/* Table Header */}
          <View style={s.tableRow}>
            <Text style={[s.cellHeader, s.colRank]}>#</Text>
            <Text style={[s.cellHeader, s.colName]}>Player</Text>
            <Text style={[s.cellHeader, s.colNum]}>Score</Text>
            <Text style={[s.cellHeader, s.colNum]}>W</Text>
            <Text style={[s.cellHeader, s.colNum]}>L</Text>
            <Text style={[s.cellHeader, s.colNum]}>Streak</Text>
          </View>
          {records.map(r => {
            const isMe = r.userId === session?.user_id;
            return (
              <View key={r.userId} style={[s.tableRow, isMe && s.highlightRow]}>
                <Text style={[s.cell, s.colRank, { color: Colors.cyan, fontWeight: '700' }]}>{r.rank}</Text>
                <Text style={[s.cell, s.colName]} numberOfLines={1}>{r.username || r.userId.slice(0, 8)}</Text>
                <Text style={[s.cell, s.colNum, { fontWeight: '700' }]}>{r.score}</Text>
                <Text style={[s.cell, s.colNum, { color: Colors.green }]}>{r.stats?.wins ?? '-'}</Text>
                <Text style={[s.cell, s.colNum, { color: Colors.red }]}>{r.stats?.losses ?? '-'}</Text>
                <Text style={[s.cell, s.colNum, { color: Colors.cyan }]}>{r.stats?.bestStreak ?? '-'}</Text>
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backBtn: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.sm, paddingVertical: 8, paddingHorizontal: 16 },
  backBtnText: { color: Colors.text, fontSize: 14 },
  title: { fontSize: 20, fontWeight: '700', color: Colors.text },
  refreshText: { fontSize: 14, color: Colors.text2 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: Colors.text2, fontSize: 16 },
  tableContent: { padding: 16 },
  tableRow: { flexDirection: 'row', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(42,42,90,0.4)' },
  highlightRow: { backgroundColor: 'rgba(0,229,255,0.06)' },
  cellHeader: { fontSize: 12, color: Colors.text2, textTransform: 'uppercase', fontWeight: '600' },
  cell: { fontSize: 14, color: Colors.text },
  colRank: { width: 32, textAlign: 'center' },
  colName: { flex: 1, paddingHorizontal: 8 },
  colNum: { width: 50, textAlign: 'center' },
});
