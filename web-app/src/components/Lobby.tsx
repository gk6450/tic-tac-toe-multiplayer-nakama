import { useState, useEffect, useCallback } from 'react';
import { useNakama } from '../context/NakamaContext';
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

  useEffect(() => {
    loadStats();
  }, []);

  useEffect(() => {
    if (!socket) return;
    socket.onmatchmakermatched = async (matched) => {
      setSearching(false);
      setMatchmakerTicket('');
      if (matched.match_id) {
        onJoinGame(matched.match_id);
      }
    };
    return () => { socket.onmatchmakermatched = () => {}; };
  }, [socket, onJoinGame]);

  const loadStats = async () => {
    try {
      const res = await client.rpc(session!, "get_player_stats", {});
      const data = res.payload as any;
      setStats(data?.stats);
    } catch { /* stats load is non-critical */ }
  };

  const createMatch = async () => {
    setLoading(true);
    setError('');
    try {
      const payload: any = { mode: gameMode };
      if (gameMode === 'timed') payload.turnDuration = turnDuration;
      const res = await client.rpc(session!, "create_match", payload);
      const data = res.payload as any;
      onJoinGame(data.matchId);
    } catch {
      setError('Failed to create match');
    }
    setLoading(false);
  };

  const findMatches = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await client.rpc(session!, "find_match", { mode: gameMode });
      const data = res.payload as any;
      setOpenMatches(data?.matches || []);
      setShowMatches(true);
    } catch {
      setError('Failed to search for matches');
    }
    setLoading(false);
  };

  const joinExisting = (matchId: string) => {
    onJoinGame(matchId);
  };

  const startMatchmaking = async () => {
    setSearching(true);
    setError('');
    try {
      const numProps: Record<string, number> = {};
      if (gameMode === 'timed') numProps.turnDuration = turnDuration;
      const ticket = await socket!.addMatchmaker(
        "+properties.mode:" + gameMode,
        2, 2,
        { mode: gameMode },
        numProps,
      );
      setMatchmakerTicket(ticket.ticket);
    } catch {
      setError('Matchmaking failed');
      setSearching(false);
    }
  };

  const cancelMatchmaking = useCallback(async () => {
    if (matchmakerTicket) {
      try { await socket!.removeMatchmaker(matchmakerTicket); } catch { /* ok */ }
    }
    setSearching(false);
    setMatchmakerTicket('');
  }, [socket, matchmakerTicket]);

  const displayName = session?.username || 'Player';

  return (
    <div className="lobby-page">
      <header className="lobby-header">
        <h1>Tic Tac Toe</h1>
        <div className="user-info">
          <span className="username">{displayName}</span>
          <button onClick={logout} className="btn-text">Logout</button>
        </div>
      </header>

      <div className="lobby-content">
        {/* Mode Selection */}
        <section className="card">
          <h3>Game Mode</h3>
          <div className="mode-toggle">
            <button
              className={gameMode === 'classic' ? 'mode-btn active' : 'mode-btn'}
              onClick={() => setGameMode('classic')}
            >
              Classic
            </button>
            <button
              className={gameMode === 'timed' ? 'mode-btn active' : 'mode-btn'}
              onClick={() => setGameMode('timed')}
            >
              Timed
            </button>
          </div>
          {gameMode === 'timed' && (
            <div className="timer-selector">
              <label>Turn Duration</label>
              <div className="timer-options">
                {[10, 15, 20, 30, 45, 60].map(sec => (
                  <button
                    key={sec}
                    className={turnDuration === sec ? 'timer-btn active' : 'timer-btn'}
                    onClick={() => setTurnDuration(sec)}
                  >
                    {sec}s
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Actions */}
        <section className="card">
          <h3>Play</h3>
          {error && <div className="error-msg">{error}</div>}

          {!searching ? (
            <div className="action-buttons">
              <button onClick={createMatch} className="btn-primary" disabled={loading}>
                {loading ? 'Creating...' : 'Create Match'}
              </button>
              <button onClick={findMatches} className="btn-secondary" disabled={loading}>
                Find Match
              </button>
              <button onClick={startMatchmaking} className="btn-accent" disabled={loading}>
                Auto Match
              </button>
            </div>
          ) : (
            <div className="searching-state">
              <div className="spinner" />
              <p>Searching for opponent...</p>
              <button onClick={cancelMatchmaking} className="btn-text">Cancel</button>
            </div>
          )}
        </section>

        {/* Open Matches List */}
        {showMatches && (
          <section className="card">
            <div className="card-header-row">
              <h3>Open Matches ({openMatches.length})</h3>
              <button onClick={() => setShowMatches(false)} className="btn-text">Close</button>
            </div>
            {openMatches.length === 0 ? (
              <p className="empty-state">No open matches found. Create one!</p>
            ) : (
              <ul className="match-list">
                {openMatches.map(m => (
                  <li key={m.matchId} className="match-item">
                    <div>
                      <span className="match-id">{m.matchId.slice(0, 8)}...</span>
                      <span className="match-mode">{m.label?.mode || 'classic'}</span>
                    </div>
                    <button onClick={() => joinExisting(m.matchId)} className="btn-small">
                      Join
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {/* Player Stats */}
        {stats && (
          <section className="card stats-card">
            <h3>Your Stats</h3>
            <div className="stats-grid">
              <div className="stat">
                <span className="stat-value win">{stats.wins}</span>
                <span className="stat-label">Wins</span>
              </div>
              <div className="stat">
                <span className="stat-value loss">{stats.losses}</span>
                <span className="stat-label">Losses</span>
              </div>
              <div className="stat">
                <span className="stat-value draw">{stats.draws}</span>
                <span className="stat-label">Draws</span>
              </div>
              <div className="stat">
                <span className="stat-value streak">{stats.bestStreak}</span>
                <span className="stat-label">Best Streak</span>
              </div>
            </div>
          </section>
        )}

        <button onClick={onViewLeaderboard} className="btn-secondary full-width">
          View Leaderboard
        </button>
      </div>
    </div>
  );
}
