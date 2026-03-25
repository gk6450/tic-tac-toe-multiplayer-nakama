import React, { useState, useCallback, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import * as ScreenOrientation from 'expo-screen-orientation';
import { NakamaProvider, useNakama } from './src/context/NakamaContext';
import Login from './src/components/Login';
import Lobby from './src/components/Lobby';
import GameView from './src/components/GameView';
import Leaderboard from './src/components/Leaderboard';
import { Colors } from './src/styles/theme';

type Screen = 'login' | 'lobby' | 'game' | 'leaderboard';

function AppContent() {
  const { session } = useNakama();
  const [screen, setScreen] = useState<Screen>('login');
  const [matchId, setMatchId] = useState('');

  useEffect(() => {
    if (!session) setScreen('login');
    else if (screen === 'login') setScreen('lobby');
  }, [session]);

  const joinGame = useCallback((id: string) => {
    setMatchId(id);
    setScreen('game');
  }, []);

  const backToLobby = useCallback(() => {
    setMatchId('');
    setScreen('lobby');
  }, []);

  if (!session) return <Login />;

  switch (screen) {
    case 'lobby':
      return <Lobby onJoinGame={joinGame} onViewLeaderboard={() => setScreen('leaderboard')} />;
    case 'game':
      return <GameView matchId={matchId} onBack={backToLobby} />;
    case 'leaderboard':
      return <Leaderboard onBack={() => setScreen('lobby')} />;
    default:
      return <Login />;
  }
}

export default function App() {
  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
  }, []);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.root}>
        <StatusBar style="light" />
        <NakamaProvider>
          <AppContent />
        </NakamaProvider>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
});
