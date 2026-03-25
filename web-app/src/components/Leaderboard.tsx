import { useState, useEffect } from 'react';
import { useNakama } from '../context/NakamaContext';
import type { LeaderboardRecord } from '../types/game';

interface Props {
  onBack: () => void;
}

export default function Leaderboard({ onBack }: Props) {
  const { client, session } = useNakama();
  const [records, setRecords] = useState<LeaderboardRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    try {
      const res = await client.rpc(session!, "get_leaderboard", { limit: 20 });
      const data = res.payload as any;
      setRecords(data.records || []);
    } catch (e) {
      console.error('Failed to load leaderboard', e);
    }
    setLoading(false);
  };

  return (
    <div className="leaderboard-page">
      <header className="lb-header">
        <button onClick={onBack} className="btn-back">Back</button>
        <h2>Leaderboard</h2>
        <button onClick={fetchLeaderboard} className="btn-text">Refresh</button>
      </header>

      {loading ? (
        <div className="center-msg"><div className="spinner" /></div>
      ) : records.length === 0 ? (
        <div className="center-msg">
          <p>No records yet. Play some games!</p>
        </div>
      ) : (
        <div className="lb-table-wrap">
          <table className="lb-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Player</th>
                <th>Score</th>
                <th>W</th>
                <th>L</th>
                <th>D</th>
                <th>Streak</th>
              </tr>
            </thead>
            <tbody>
              {records.map(r => (
                <tr key={r.userId} className={r.userId === session?.user_id ? 'highlight-row' : ''}>
                  <td className="rank">{r.rank}</td>
                  <td>{r.username || r.userId.slice(0, 8)}</td>
                  <td className="score">{r.score}</td>
                  <td className="win">{r.stats?.wins ?? '-'}</td>
                  <td className="loss">{r.stats?.losses ?? '-'}</td>
                  <td>{r.stats?.draws ?? '-'}</td>
                  <td className="streak">{r.stats?.bestStreak ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
