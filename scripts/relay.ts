import { createServer, type ServerResponse } from 'node:http';
import { CONFIG_SLICE, POOL_SLICE } from '../src/lib/dbc/layout';
import { decodePoolSlice } from '../src/lib/dbc/pool';
import { presetIdOf } from '../src/lib/dbc/presetId';
import { normalizeBlur, type LiveEvent } from '../src/lib/live/normalize';
import { getAccountsData } from '../src/lib/rpc/accounts';

const PORT = Number(process.env.PORT ?? 8787);
const KEY = process.env.SOLAMI_API_KEY;
const RPC = process.env.RPC_URL ?? 'https://api.mainnet-beta.solana.com';
const WS_URL = process.env.SOLAMI_WS_URL ?? 'wss://ws.solami.dev/data/subscribe';

const history: LiveEvent[] = [];
const clients = new Set<ServerResponse>();
const configPreset = new Map<string, string>();
const mintPreset = new Map<string, string>();
let upstream: 'connecting' | 'live' | 'down' | 'mock' = KEY ? 'connecting' : 'mock';

function broadcast(ev: LiveEvent) {
  history.push(ev);
  if (history.length > 50) history.shift();
  const line = `data: ${JSON.stringify(ev)}\n\n`;
  for (const c of clients) c.write(line);
}

async function presetForPool(pool: string): Promise<string | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const d = (await getAccountsData(RPC, [pool], { slice: POOL_SLICE })).get(pool);
    if (d) {
      const config = decodePoolSlice(d).config;
      const cached = configPreset.get(config);
      if (cached) return cached;
      const body = (await getAccountsData(RPC, [config], { slice: CONFIG_SLICE })).get(config);
      if (!body) return null;
      const id = presetIdOf(body);
      configPreset.set(config, id);
      if (configPreset.size > 5000) configPreset.delete(configPreset.keys().next().value!);
      return id;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  return null;
}

async function handle(raw: unknown) {
  const ev = normalizeBlur(raw);
  if (!ev) return;
  let presetId: string | null = null;
  try {
    if (ev.kind === 'launch' && ev.pool) presetId = await presetForPool(ev.pool);
    else presetId = mintPreset.get(ev.mint) ?? null;
  } catch (e) {
    console.warn(`[relay] preset lookup failed: ${(e as Error).message}`);
  }
  if (presetId) {
    mintPreset.set(ev.mint, presetId);
    if (mintPreset.size > 20_000) mintPreset.delete(mintPreset.keys().next().value!);
  }
  broadcast({ ...ev, presetId });
}

function connect(attempt = 0) {
  const ws = new WebSocket(`${WS_URL}?chain=solana&api_key=${KEY}&type=token_create,graduation`);
  ws.onopen = () => {
    upstream = 'live';
    attempt = 0;
    console.log('[relay] upstream connected');
  };
  ws.onmessage = (m) => {
    let raw: unknown;
    try {
      raw = JSON.parse(String(m.data));
    } catch {
      return;
    }
    for (const r of Array.isArray(raw) ? raw : [raw]) void handle(r);
  };
  ws.onerror = () => ws.close();
  ws.onclose = (e) => {
    upstream = 'down';
    const delay = Math.min(60_000, 1000 * 2 ** attempt);
    console.warn(`[relay] upstream closed (${e.code}); reconnecting in ${delay} ms`);
    setTimeout(() => connect(attempt + 1), delay);
  };
}

createServer((req, res) => {
  const cors = { 'Access-Control-Allow-Origin': '*' };
  if (req.url?.startsWith('/events')) {
    res.writeHead(200, { ...cors, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    for (const ev of history) res.write(`data: ${JSON.stringify(ev)}\n\n`);
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }
  if (req.url === '/health') {
    res.writeHead(200, { ...cors, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, upstream, clients: clients.size, events: history.length }));
    return;
  }
  res.writeHead(404, cors).end();
}).listen(PORT, () => console.log(`[relay] listening on :${PORT} (${upstream})`));

setInterval(() => {
  for (const c of clients) c.write(': ping\n\n');
}, 15_000);

if (KEY) connect();
else {
  console.warn('[relay] SOLAMI_API_KEY not set: emitting mock events every 5 s (development only)');
  let n = 0;
  setInterval(() => broadcast({ kind: n % 4 ? 'launch' : 'graduation', mint: `Mock${n}`, pool: null, symbol: `MOCK${n}`, name: 'mock event', time: Math.floor(Date.now() / 1000), signature: null, presetId: null }), 5000).unref?.();
  setInterval(() => n++, 5000);
}
