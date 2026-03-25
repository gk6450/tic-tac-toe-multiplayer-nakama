import { useState } from 'react';
import { useNakama } from '../context/NakamaContext';

export default function Login() {
  const { login, loginWithUsername, quickPlay } = useNakama();
  const [mode, setMode] = useState<'quick' | 'account'>('quick');

  const [quickUsername, setQuickUsername] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [regUsername, setRegUsername] = useState('');

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isEmail = identifier.includes('@');

  const handleQuickPlay = async () => {
    const name = quickUsername.trim();
    if (!name) { setError('Please enter a username'); return; }
    setLoading(true);
    setError('');
    try {
      await quickPlay(name);
    } catch (err: any) {
      setError(err?.message || 'Connection failed. Is the server running?');
    }
    setLoading(false);
  };

  const handleAccountLogin = async () => {
    const id = identifier.trim();
    if (!id || !password.trim()) {
      setError('Email/username and password required');
      return;
    }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }

    setLoading(true);
    setError('');
    try {
      if (isEmail) {
        await login(id, password, regUsername.trim() || id.split('@')[0]);
      } else {
        await loginWithUsername(id, password);
      }
    } catch (err: any) {
      const msg = err?.message || String(err);
      if (msg.toLowerCase().includes('not found')) {
        setError('User not found. Register with email first, or use Quick Play.');
      } else if (msg.toLowerCase().includes('invalid password') || msg.includes('401') || msg.toLowerCase().includes('unauthorized')) {
        setError('Wrong password. Try again.');
      } else if (msg.includes('409') || msg.toLowerCase().includes('conflict')) {
        setError('Username already taken. Pick a different one.');
      } else if (msg.toLowerCase().includes('not registered with email')) {
        setError('This account uses Quick Play (no password). Use the Quick Play tab.');
      } else {
        setError(msg || 'Login failed.');
      }
    }
    setLoading(false);
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <h1>Tic Tac Toe</h1>
          <p className="subtitle">Real-time Multiplayer</p>
        </div>

        <div className="tab-bar">
          <button
            className={mode === 'quick' ? 'tab active' : 'tab'}
            onClick={() => { setMode('quick'); setError(''); }}
          >
            Quick Play
          </button>
          <button
            className={mode === 'account' ? 'tab active' : 'tab'}
            onClick={() => { setMode('account'); setError(''); }}
          >
            Account Login
          </button>
        </div>

        {error && <div className="error-msg">{error}</div>}

        {mode === 'quick' ? (
          <form onSubmit={e => { e.preventDefault(); handleQuickPlay(); }} className="login-form">
            <input
              type="text"
              placeholder="Enter a username"
              value={quickUsername}
              onChange={e => { setQuickUsername(e.target.value); setError(''); }}
              maxLength={20}
              autoFocus
            />
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Connecting...' : 'Play Now'}
            </button>
          </form>
        ) : (
          <form onSubmit={e => { e.preventDefault(); handleAccountLogin(); }} className="login-form">
            <input
              type="text"
              placeholder="Email or Username"
              value={identifier}
              onChange={e => { setIdentifier(e.target.value); setError(''); }}
              autoFocus
            />
            <input
              type="password"
              placeholder="Password (min 8 chars)"
              value={password}
              onChange={e => { setPassword(e.target.value); setError(''); }}
            />
            {isEmail && (
              <input
                type="text"
                placeholder="Username (optional, for new accounts)"
                value={regUsername}
                onChange={e => setRegUsername(e.target.value)}
                maxLength={20}
              />
            )}
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Connecting...' : isEmail ? 'Login / Register' : 'Login'}
            </button>
          </form>
        )}

        <p className="hint">
          {mode === 'quick'
            ? 'No password needed -new or returning, just enter your username'
            : isEmail
              ? 'Account is created automatically on first email login'
              : 'Log in with your username + password'}
        </p>
      </div>
    </div>
  );
}
