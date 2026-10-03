import type { QuoteInfo } from '../lib/data/types';
import { getAccountsData } from '../lib/rpc/accounts';

export const KNOWN_QUOTES: Record<string, QuoteInfo> = {
  So11111111111111111111111111111111111111112: { symbol: 'SOL', decimals: 9 },
  EPjFWdd5AufqSSqeM2qtpgu5ZtFwfrmrBp8eXn4UtLGU: { symbol: 'USDC', decimals: 6 },
  USD1ttGY1N17NEEHLmELoaybftRBUSErhqYiQzvEmuB: { symbol: 'USD1', decimals: 6 },
  Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: { symbol: 'USDT', decimals: 6 },
};

export async function resolveQuotes(rpcUrl: string, mints: string[]): Promise<Map<string, QuoteInfo>> {
  const out = new Map<string, QuoteInfo>();
  const unknown = mints.filter((m) => !KNOWN_QUOTES[m]);
  for (const m of mints) if (KNOWN_QUOTES[m]) out.set(m, KNOWN_QUOTES[m]);
  let fetched = new Map<string, Uint8Array | null>();
  try {
    if (unknown.length) fetched = await getAccountsData(rpcUrl, unknown, { slice: { offset: 44, length: 1 } });
  } catch (e) {
    console.warn(`[quotes] mint fetch failed: ${(e as Error).message}`);
  }
  for (const m of unknown) {
    const d = fetched.get(m);
    out.set(m, d && d.length === 1 ? { symbol: `${m.slice(0, 4)}…`, decimals: d[0] } : { symbol: '?', decimals: 9 });
  }
  return out;
}
