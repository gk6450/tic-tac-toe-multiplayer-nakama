import { useState, useCallback } from 'react';
import { useNakama } from './context/NakamaContext';
import Login from './components/Login';
import Lobby from './components/Lobby';
import GameView from './components/GameView';
import Leaderboard from './components/Leaderboard';

type View = 'lobby' | 'game' | 'leaderboard';

export default function App() {
  const { session } = useNakama();
  const [view, setView] = useState<View>('lobby');
  const [matchId, setMatchId] = useState('');

  const joinGame = useCallback((id: string) => {
    setMatchId(id);
    setView('game');
  }, []);

  const backToLobby = useCallback(() => {
    setMatchId('');
    setView('lobby');
  }, []);

  if (!session) return <Login />;

  switch (view) {
    case 'game':
      return <GameView matchId={matchId} onBack={backToLobby} />;
    case 'leaderboard':
      return <Leaderboard onBack={backToLobby} />;
    default:
      return (
        <Lobby
          onJoinGame={joinGame}
          onViewLeaderboard={() => setView('leaderboard')}
        />
      );
  }
}
