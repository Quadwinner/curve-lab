import { createServer, type ServerResponse } from 'node:http';
import { CONFIG_SLICE, DBC_PROGRAM_ID, POOL_SIZE, POOL_SLICE } from '../src/lib/dbc/layout';
import { pubkey } from '../src/lib/dbc/bytes';
import { decodePoolSlice } from '../src/lib/dbc/pool';
import { presetIdOf } from '../src/lib/dbc/presetId';
import { kindFromLogs, pickDbcPool } from '../src/lib/live/dbcLogs';
import { normalizeBlur, type LiveEvent } from '../src/lib/live/normalize';
import { getAccountsData } from '../src/lib/rpc/accounts';
import { streamProgramAccounts } from '../src/lib/rpc/gpaStream';
import { rpcCall } from '../src/lib/rpc/http';

const PORT = Number(process.env.PORT ?? 8787);
const KEY = process.env.SOLAMI_API_KEY;
const RPC = process.env.RPC_URL ?? 'https://api.mainnet-beta.solana.com';
const RPC_WS = process.env.RPC_WS_URL ?? RPC.replace(/^http/, 'ws');
const BLUR_WS = process.env.SOLAMI_WS_URL ?? 'wss://ws.solami.dev/data/subscribe';
const SOURCE: 'solami' | 'rpc' | 'mock' = KEY ? 'solami' : process.env.RELAY_MOCK === '1' ? 'mock' : 'rpc';
const IDLE_MS = 5 * 60_000;
const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

const history: LiveEvent[] = [];
const clients = new Set<ServerResponse>();
const configPreset = new Map<string, string>();
const mintPreset = new Map<string, string>();
let upstream: 'connecting' | 'live' | 'down' | 'mock' = SOURCE === 'mock' ? 'mock' : 'connecting';
let lastMessageAt = Date.now();

const remember = <K, V>(m: Map<K, V>, k: K, v: V, cap: number) => {
  m.set(k, v);
  if (m.size > cap) m.delete(m.keys().next().value as K);
};

function broadcast(ev: LiveEvent) {
  history.push(ev);
  if (history.length > 50) history.shift();
  const line = `data: ${JSON.stringify(ev)}\n\n`;
  for (const c of clients) c.write(line);
}

async function presetForConfig(config: string): Promise<string | null> {
  const cached = configPreset.get(config);
  if (cached) return cached;
  const body = (await getAccountsData(RPC, [config], { slice: CONFIG_SLICE, attempts: 3 })).get(config);
  if (!body) return null;
  const id = presetIdOf(body);
  remember(configPreset, config, id, 5000);
  return id;
}

async function poolInfo(pool: string): Promise<{ mint: string; presetId: string | null } | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const d = (await getAccountsData(RPC, [pool], { slice: POOL_SLICE, attempts: 2 })).get(pool);
    if (d) {
      const row = decodePoolSlice(d);
      return { mint: pubkey(row.baseMintBytes, 0), presetId: await presetForConfig(row.config) };
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  return null;
}

async function presetForMint(mint: string): Promise<string | null> {
  if (!BASE58.test(mint)) return null;
  const cached = mintPreset.get(mint);
  if (cached) return cached;
  let config: string | null = null;
  await streamProgramAccounts({
    rpcUrl: RPC,
    programId: DBC_PROGRAM_ID,
    dataSize: POOL_SIZE,
    slice: POOL_SLICE,
    memcmp: [{ offset: 136, bytes: mint }],
    timeoutMs: 30_000,
    onAccount: (_k, d) => {
      config ??= decodePoolSlice(d).config;
    },
  });
  return config ? presetForConfig(config) : null;
}

function emit(ev: Omit<LiveEvent, 'presetId'>, presetId: string | null) {
  if (presetId) remember(mintPreset, ev.mint, presetId, 20_000);
  broadcast({ ...ev, presetId });
}

async function handleBlur(raw: unknown) {
  const ev = normalizeBlur(raw);
  if (!ev) return;
  let presetId: string | null = null;
  try {
    if (ev.kind === 'launch' && ev.pool && BASE58.test(ev.pool)) presetId = (await poolInfo(ev.pool))?.presetId ?? null;
    else presetId = await presetForMint(ev.mint);
  } catch (e) {
    console.warn(`[relay] preset lookup failed: ${(e as Error).message}`);
  }
  emit(ev, presetId);
}

type TxAccounts = { transaction: { message: { accountKeys: string[] } }; meta: { loadedAddresses?: { writable: string[]; readonly: string[] } } | null; blockTime: number | null };

async function handleLogs(signature: string, logs: string[], failed: boolean) {
  const kind = kindFromLogs(logs, { failed });
  if (!kind) return;
  try {
    const tx = await rpcCall<TxAccounts | null>(RPC, 'getTransaction', [signature, { encoding: 'json', maxSupportedTransactionVersion: 0, commitment: 'confirmed' }], 20_000);
    if (!tx) return;
    const keys = [...tx.transaction.message.accountKeys, ...(tx.meta?.loadedAddresses?.writable ?? []), ...(tx.meta?.loadedAddresses?.readonly ?? [])];
    const accounts = await rpcCall<{ value: ({ owner: string; space: number } | null)[] }>(RPC, 'getMultipleAccounts', [keys, { encoding: 'base64', dataSlice: { offset: 0, length: 0 } }], 20_000);
    const pool = pickDbcPool(keys, accounts.value);
    if (!pool) return;
    const info = await poolInfo(pool);
    if (!info) return;
    emit({ kind, mint: info.mint, pool, symbol: null, name: null, time: tx.blockTime ?? Math.floor(Date.now() / 1000), signature }, info.presetId);
  } catch (e) {
    console.warn(`[relay] could not resolve ${kind} ${signature}: ${(e as Error).message}`);
  }
}

function connect(attempt = 0) {
  const url = SOURCE === 'solami' ? `${BLUR_WS}?chain=solana&api_key=${KEY}&type=token_create,graduation` : RPC_WS;
  const ws = new WebSocket(url);
  lastMessageAt = Date.now();
  ws.onopen = () => {
    upstream = 'live';
    attempt = 0;
    lastMessageAt = Date.now();
    if (SOURCE === 'rpc') ws.send(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'logsSubscribe', params: [{ mentions: [DBC_PROGRAM_ID] }, { commitment: 'confirmed' }] }));
    console.log(`[relay] upstream connected (${SOURCE})`);
  };
  ws.onmessage = (m) => {
    lastMessageAt = Date.now();
    let raw: unknown;
    try {
      raw = JSON.parse(String(m.data));
    } catch {
      return;
    }
    if (SOURCE === 'rpc') {
      const value = (raw as { params?: { result?: { value?: { signature: string; logs: string[]; err: unknown } } } }).params?.result?.value;
      if (value) void handleLogs(value.signature, value.logs ?? [], value.err !== null);
      return;
    }
    for (const r of Array.isArray(raw) ? raw : [raw]) void handleBlur(r);
  };
  ws.onerror = () => ws.close();
  ws.onclose = (e) => {
    upstream = 'down';
    clearInterval(watchdog);
    const delay = Math.min(60_000, 1000 * 2 ** attempt);
    console.warn(`[relay] upstream closed (${e.code}); reconnecting in ${delay} ms`);
    setTimeout(() => connect(attempt + 1), delay);
  };
  const watchdog = setInterval(() => {
    if (Date.now() - lastMessageAt > IDLE_MS) {
      console.warn('[relay] upstream silent for 5 min; reconnecting');
      ws.close();
    }
  }, 30_000);
}

createServer((req, res) => {
  const cors = { 'Access-Control-Allow-Origin': '*' };
  if (req.url?.startsWith('/events')) {
    res.writeHead(200, { ...cors, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    res.write(`event: source\ndata: ${JSON.stringify({ source: SOURCE })}\n\n`);
    for (const ev of history) res.write(`data: ${JSON.stringify(ev)}\n\n`);
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }
  if (req.url === '/health') {
    res.writeHead(200, { ...cors, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, source: SOURCE, upstream, clients: clients.size, events: history.length }));
    return;
  }
  res.writeHead(404, cors).end();
}).listen(PORT, () => console.log(`[relay] listening on :${PORT} (source: ${SOURCE})`));

setInterval(() => {
  for (const c of clients) c.write(': ping\n\n');
}, 15_000);

if (SOURCE === 'mock') {
  console.warn('[relay] RELAY_MOCK=1: emitting labelled mock events every 5 s (development only)');
  let n = 0;
  setInterval(() => broadcast({ kind: n++ % 4 ? 'launch' : 'graduation', mint: `Mock${n}`, pool: null, symbol: `MOCK${n}`, name: 'mock event', time: Math.floor(Date.now() / 1000), signature: null, presetId: null }), 5000);
} else {
  connect();
}
