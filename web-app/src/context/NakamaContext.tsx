import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { Session, type Socket } from "@heroiclabs/nakama-js";
import { nakamaClient, nakamaHttpRpc } from '../nakama/client';

interface NakamaContextType {
  client: typeof nakamaClient;
  session: Session | null;
  socket: Socket | null;
  login: (email: string, password: string, username: string) => Promise<void>;
  loginWithUsername: (username: string, password: string) => Promise<void>;
  quickPlay: (username: string) => Promise<void>;
  logout: () => void;
}

const NakamaContext = createContext<NakamaContextType | null>(null);

export function NakamaProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);

  const connectSocket = useCallback(async (sess: Session) => {
    const sock = nakamaClient.createSocket(
      import.meta.env.VITE_NAKAMA_USE_SSL === "true",
      false
    );
    await sock.connect(sess, true);
    setSocket(sock);
    return sock;
  }, []);

  const login = useCallback(async (email: string, password: string, username: string) => {
    const sess = await nakamaClient.authenticateEmail(email, password, true, username);
    setSession(sess);
    await connectSocket(sess);
  }, [connectSocket]);

  const loginWithUsername = useCallback(async (username: string, password: string) => {
    const payload = await nakamaHttpRpc('login_with_username', { username, password });
    const sess = Session.restore(payload.token, '');
    setSession(sess);
    await connectSocket(sess);
  }, [connectSocket]);

  const quickPlay = useCallback(async (username: string) => {
    const storageKey = `ttt_device_${username}`;
    const deterministicId = `ttt_quick_${username}`;

    const storedId = localStorage.getItem(storageKey);
    if (storedId) {
      try {
        const sess = await nakamaClient.authenticateDevice(storedId, false, username);
        setSession(sess);
        await connectSocket(sess);
        return;
      } catch (_) {}
    }

    try {
      const sess = await nakamaClient.authenticateDevice(deterministicId, true, username);
      localStorage.setItem(storageKey, deterministicId);
      setSession(sess);
      await connectSocket(sess);
    } catch (err: any) {
      const msg = err?.message || err?.statusText || String(err);
      if (err?.status === 409 || msg.includes('409') || msg.toLowerCase().includes('conflict')) {
        throw new Error(`Username "${username}" is registered with email. Use the Account Login tab.`);
      }
      throw err;
    }
  }, [connectSocket]);

  const logout = useCallback(() => {
    socket?.disconnect(false);
    setSocket(null);
    setSession(null);
  }, [socket]);

  return (
    <NakamaContext.Provider value={{
      client: nakamaClient,
      session,
      socket,
      login,
      loginWithUsername,
      quickPlay,
      logout,
    }}>
      {children}
    </NakamaContext.Provider>
  );
}

export function useNakama() {
  const ctx = useContext(NakamaContext);
  if (!ctx) throw new Error("useNakama must be used within NakamaProvider");
  return ctx;
}
