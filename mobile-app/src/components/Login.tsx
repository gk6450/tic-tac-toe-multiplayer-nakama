import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useNakama } from '../context/NakamaContext';
import { Colors, Radius } from '../styles/theme';

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
    if (!id || !password.trim()) { setError('Email/username and password required'); return; }
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
      } else if (msg.toLowerCase().includes('invalid password') || msg.includes('401')) {
        setError('Wrong password. Try again.');
      } else if (msg.includes('409') || msg.toLowerCase().includes('conflict')) {
        setError('Username already taken.');
      } else if (msg.toLowerCase().includes('not registered with email')) {
        setError('This account uses Quick Play. Use the Quick Play tab.');
      } else {
        setError(msg || 'Login failed.');
      }
    }
    setLoading(false);
  };

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <View style={s.card}>
          <Text style={s.title}>Tic Tac Toe</Text>
          <Text style={s.subtitle}>Real-time Multiplayer</Text>

          <View style={s.tabBar}>
            <TouchableOpacity
              style={[s.tab, mode === 'quick' && s.tabActive]}
              onPress={() => { setMode('quick'); setError(''); }}
            >
              <Text style={[s.tabText, mode === 'quick' && s.tabTextActive]}>Quick Play</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.tab, mode === 'account' && s.tabActive]}
              onPress={() => { setMode('account'); setError(''); }}
            >
              <Text style={[s.tabText, mode === 'account' && s.tabTextActive]}>Account Login</Text>
            </TouchableOpacity>
          </View>

          {!!error && <View style={s.errorBox}><Text style={s.errorText}>{error}</Text></View>}

          {mode === 'quick' ? (
            <View style={s.form}>
              <TextInput
                style={s.input}
                placeholder="Enter a username"
                placeholderTextColor={Colors.text2}
                value={quickUsername}
                onChangeText={t => { setQuickUsername(t); setError(''); }}
                maxLength={20}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity style={[s.btnPrimary, loading && s.disabled]} onPress={handleQuickPlay} disabled={loading}>
                <Text style={s.btnPrimaryText}>{loading ? 'Connecting...' : 'Play Now'}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={s.form}>
              <TextInput
                style={s.input}
                placeholder="Email or Username"
                placeholderTextColor={Colors.text2}
                value={identifier}
                onChangeText={t => { setIdentifier(t); setError(''); }}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType={isEmail ? 'email-address' : 'default'}
              />
              <TextInput
                style={s.input}
                placeholder="Password (min 8 chars)"
                placeholderTextColor={Colors.text2}
                value={password}
                onChangeText={t => { setPassword(t); setError(''); }}
                secureTextEntry
              />
              {isEmail && (
                <TextInput
                  style={s.input}
                  placeholder="Username (optional, for new accounts)"
                  placeholderTextColor={Colors.text2}
                  value={regUsername}
                  onChangeText={setRegUsername}
                  maxLength={20}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              )}
              <TouchableOpacity style={[s.btnPrimary, loading && s.disabled]} onPress={handleAccountLogin} disabled={loading}>
                <Text style={s.btnPrimaryText}>
                  {loading ? 'Connecting...' : isEmail ? 'Login / Register' : 'Login'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          <Text style={s.hint}>
            {mode === 'quick'
              ? 'No password needed - new or returning, just enter your username'
              : isEmail
                ? 'Account is created automatically on first email login'
                : 'Log in with your username + password'}
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  card: { backgroundColor: Colors.card, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, padding: 28 },
  title: { fontSize: 32, fontWeight: '700', color: Colors.cyan, textAlign: 'center', marginBottom: 4 },
  subtitle: { fontSize: 14, color: Colors.text2, textAlign: 'center', marginBottom: 24 },
  tabBar: { flexDirection: 'row', backgroundColor: Colors.bg2, borderRadius: Radius.sm, padding: 4, marginBottom: 20, gap: 4 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 6, alignItems: 'center' },
  tabActive: { backgroundColor: Colors.card },
  tabText: { fontSize: 14, fontWeight: '600', color: Colors.text2 },
  tabTextActive: { color: Colors.text },
  form: { gap: 12 },
  input: { backgroundColor: Colors.bg2, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.sm, paddingHorizontal: 16, paddingVertical: 14, color: Colors.text, fontSize: 15 },
  btnPrimary: { paddingVertical: 14, borderRadius: Radius.sm, alignItems: 'center', backgroundColor: Colors.cyan },
  btnPrimaryText: { fontSize: 16, fontWeight: '700', color: '#000' },
  disabled: { opacity: 0.5 },
  errorBox: { backgroundColor: 'rgba(255,82,82,0.15)', borderWidth: 1, borderColor: 'rgba(255,82,82,0.3)', borderRadius: Radius.sm, padding: 12, marginBottom: 12 },
  errorText: { color: Colors.red, fontSize: 14, textAlign: 'center' },
  hint: { color: Colors.text2, fontSize: 12, textAlign: 'center', marginTop: 16 },
});
