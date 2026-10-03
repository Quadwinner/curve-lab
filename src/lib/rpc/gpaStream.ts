import bs58 from 'bs58';
import { withRetry } from './http';

// Responses for all DBC pools are ~800 MB of JSON, above V8's max string length, so they are parsed incrementally.
// RPC providers differ in key order: public mainnet sends "pubkey" before "account", others after.
const ACCOUNT_RE =
  /"pubkey":"([1-9A-HJ-NP-Za-km-z]+)","account":\{[^{}]*?"data":\["([A-Za-z0-9+/=]*)","base64"\][^{}]*\}|"account":\{[^{}]*?"data":\["([A-Za-z0-9+/=]*)","base64"\][^{}]*\},"pubkey":"([1-9A-HJ-NP-Za-km-z]+)"/g;
const COMPLETE_TAIL_RE = /\]\s*,\s*"id"\s*:\s*\d+\s*\}\s*$/;

export function parseAccounts(buf: string, onAccount: (pubkey: string, data: Uint8Array) => void): { consumed: number; count: number } {
  ACCOUNT_RE.lastIndex = 0;
  let consumed = 0;
  let count = 0;
  for (let m = ACCOUNT_RE.exec(buf); m; m = ACCOUNT_RE.exec(buf)) {
    const [key, data] = m[1] ? [m[1], m[2]] : [m[4], m[3]];
    onAccount(key, Buffer.from(data, 'base64'));
    consumed = ACCOUNT_RE.lastIndex;
    count++;
  }
  return { consumed, count };
}

export async function streamProgramAccounts(o: {
  rpcUrl: string;
  programId: string;
  dataSize: number;
  slice?: { offset: number; length: number };
  memcmp?: { offset: number; bytes: string }[];
  limit?: number;
  timeoutMs?: number;
  onAccount: (pubkey: string, data: Uint8Array) => void;
}): Promise<{ count: number; bytes: number; truncatedByLimit: boolean }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('getProgramAccounts timed out')), o.timeoutMs ?? 30 * 60_000);
  const filters = [{ dataSize: o.dataSize }, ...(o.memcmp ?? []).map((m) => ({ memcmp: m }))];
  const config = { encoding: 'base64', filters, ...(o.slice ? { dataSlice: o.slice } : {}) };
  try {
    const res = await fetch(o.rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getProgramAccounts', params: [o.programId, config] }),
      signal: controller.signal,
    });
    if (!res.ok || !res.body) throw new Error(`getProgramAccounts: HTTP ${res.status}`);
    const decoder = new TextDecoder();
    let buf = '';
    let count = 0;
    let bytes = 0;
    for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
      bytes += chunk.length;
      buf += decoder.decode(chunk, { stream: true });
      const r = parseAccounts(buf, (k, d) => {
        if (o.limit === undefined || count < o.limit) o.onAccount(k, d);
        count++;
      });
      buf = buf.slice(r.consumed);
      if (o.limit !== undefined && count >= o.limit) {
        controller.abort();
        return { count: o.limit, bytes, truncatedByLimit: true };
      }
    }
    buf += decoder.decode();
    if (/"error"\s*:/.test(buf) && count === 0) throw new Error(`getProgramAccounts: ${buf.slice(0, 300)}`);
    if (!COMPLETE_TAIL_RE.test(buf)) throw new Error(`getProgramAccounts: truncated response after ${count} accounts`);
    return { count, bytes, truncatedByLimit: false };
  } finally {
    clearTimeout(timer);
  }
}

type StreamOptions = Parameters<typeof streamProgramAccounts>[0];

// Public RPC stalls on single responses of several hundred MB; 256 memcmp partitions on one byte keep each response a few MB.
export async function streamPartitioned(
  o: StreamOptions & { partitionOffset: number; partitions?: number[]; concurrency?: number; retryBaseMs?: number },
): Promise<{ count: number; bytes: number }> {
  const parts = o.partitions ?? Array.from({ length: 256 }, (_, i) => i);
  let next = 0;
  let count = 0;
  let bytes = 0;
  const worker = async () => {
    while (next < parts.length) {
      const p = parts[next++];
      const buffered: [string, Uint8Array][] = [];
      const r = await withRetry(
        () => {
          buffered.length = 0;
          return streamProgramAccounts({
            ...o,
            memcmp: [...(o.memcmp ?? []), { offset: o.partitionOffset, bytes: bs58.encode([p]) }],
            onAccount: (k, d) => buffered.push([k, d]),
          });
        },
        { label: `partition ${p}`, attempts: 6, baseMs: o.retryBaseMs ?? 3000 },
      );
      for (const [k, d] of buffered) o.onAccount(k, d);
      count += r.count;
      bytes += r.bytes;
    }
  };
  await Promise.all(Array.from({ length: Math.min(o.concurrency ?? 4, parts.length) }, worker));
  return { count, bytes };
}
