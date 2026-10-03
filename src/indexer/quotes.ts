import type { QuoteInfo } from '../lib/data/types';
import { getAccountsData } from '../lib/rpc/accounts';

export const KNOWN_QUOTES: Record<string, QuoteInfo> = {
  So11111111111111111111111111111111111111112: { symbol: 'SOL', decimals: 9 },
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: { symbol: 'USDC', decimals: 6 },
  USD1ttGY1N17NEEHLmELoaybftRBUSErhqYiQzvEmuB: { symbol: 'USD1', decimals: 6 },
  Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: { symbol: 'USDT', decimals: 6 },
};

const JUPITER_SEARCH = 'https://lite-api.jup.ag/tokens/v2/search?query=';

async function jupiterTokens(mints: string[]): Promise<Map<string, QuoteInfo>> {
  const out = new Map<string, QuoteInfo>();
  for (let i = 0; i < mints.length; i += 50) {
    try {
      const res = await fetch(JUPITER_SEARCH + mints.slice(i, i + 50).join(','), { signal: AbortSignal.timeout(20_000) });
      const list = (await res.json()) as unknown;
      if (!Array.isArray(list)) continue;
      for (const t of list as { id?: string; symbol?: string; decimals?: number }[]) {
        if (t.id && t.symbol && typeof t.decimals === 'number') out.set(t.id, { symbol: t.symbol, decimals: t.decimals });
      }
    } catch (e) {
      console.warn(`[quotes] token list lookup failed: ${(e as Error).message}`);
    }
  }
  return out;
}

export async function resolveQuotes(rpcUrl: string, mints: string[]): Promise<Map<string, QuoteInfo>> {
  const out = new Map<string, QuoteInfo>();
  for (const m of mints) if (KNOWN_QUOTES[m]) out.set(m, KNOWN_QUOTES[m]);
  const unknown = mints.filter((m) => !KNOWN_QUOTES[m]);
  if (!unknown.length) return out;
  const named = await jupiterTokens(unknown);
  for (const [m, info] of named) out.set(m, info);
  const rest = unknown.filter((m) => !named.has(m));
  let fetched = new Map<string, Uint8Array | null>();
  try {
    if (rest.length) fetched = await getAccountsData(rpcUrl, rest, { slice: { offset: 44, length: 1 } });
  } catch (e) {
    console.warn(`[quotes] mint fetch failed: ${(e as Error).message}`);
  }
  for (const m of rest) {
    const d = fetched.get(m);
    out.set(m, d && d.length === 1 ? { symbol: `${m.slice(0, 4)}…`, decimals: d[0] } : { symbol: '?', decimals: 9 });
  }
  return out;
}
