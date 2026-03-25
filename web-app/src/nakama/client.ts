import { Client } from "@heroiclabs/nakama-js";

const NAKAMA_SERVER_KEY = import.meta.env.VITE_NAKAMA_SERVER_KEY || "defaultkey";
const NAKAMA_HOST = import.meta.env.VITE_NAKAMA_HOST || "127.0.0.1";
const NAKAMA_PORT = import.meta.env.VITE_NAKAMA_PORT || "7350";
const NAKAMA_USE_SSL = import.meta.env.VITE_NAKAMA_USE_SSL === "true";
const NAKAMA_HTTP_KEY = import.meta.env.VITE_NAKAMA_HTTP_KEY || "defaulthttpkey";

// When served via nginx proxy, use same host/port as the page (port 80)
const useProxy = import.meta.env.VITE_NAKAMA_USE_PROXY === "true";
const clientHost = useProxy ? window.location.hostname : NAKAMA_HOST;
const clientPort = useProxy ? window.location.port || "80" : NAKAMA_PORT;
const clientSSL = useProxy ? window.location.protocol === "https:" : NAKAMA_USE_SSL;

export const nakamaClient = new Client(
  NAKAMA_SERVER_KEY,
  clientHost,
  clientPort,
  clientSSL
);

export async function nakamaHttpRpc(rpcId: string, payload: object): Promise<any> {
  const proto = clientSSL ? 'https' : 'http';
  const url = `${proto}://${clientHost}:${clientPort}/v2/rpc/${rpcId}?http_key=${encodeURIComponent(NAKAMA_HTTP_KEY)}`;

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
