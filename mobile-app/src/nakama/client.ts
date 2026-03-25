import { Client } from '@heroiclabs/nakama-js';

const NAKAMA_SERVER_KEY = process.env.EXPO_PUBLIC_NAKAMA_SERVER_KEY || 'defaultkey';
const NAKAMA_HOST = process.env.EXPO_PUBLIC_NAKAMA_HOST || '10.0.2.2';
const NAKAMA_PORT = process.env.EXPO_PUBLIC_NAKAMA_PORT || '7350';
const NAKAMA_USE_SSL = process.env.EXPO_PUBLIC_NAKAMA_USE_SSL === 'true';
const NAKAMA_HTTP_KEY = process.env.EXPO_PUBLIC_NAKAMA_HTTP_KEY || 'defaulthttpkey';

export const nakamaClient = new Client(
  NAKAMA_SERVER_KEY,
  NAKAMA_HOST,
  NAKAMA_PORT,
  NAKAMA_USE_SSL,
);

export async function nakamaHttpRpc(rpcId: string, payload: object): Promise<any> {
  const proto = NAKAMA_USE_SSL ? 'https' : 'http';
  const url = `${proto}://${NAKAMA_HOST}:${NAKAMA_PORT}/v2/rpc/${rpcId}?http_key=${encodeURIComponent(NAKAMA_HTTP_KEY)}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(JSON.stringify(payload)),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `RPC ${rpcId} failed (${res.status})`);
  }

  const data = await res.json();
  return JSON.parse(data.payload);
}
