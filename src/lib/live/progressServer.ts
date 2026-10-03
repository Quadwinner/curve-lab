import { getAccountsData } from '../rpc/accounts';
import { decodeProgress, PROGRESS_SLICE } from './progress';

const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const MAX_POOLS = 20;

export function parseProgressRequest(body: unknown): { pools: string[]; threshold: bigint } | null {
  if (!body || typeof body !== 'object') return null;
  const { pools, threshold } = body as { pools?: unknown; threshold?: unknown };
  if (!Array.isArray(pools) || pools.length > MAX_POOLS || !pools.every((p) => typeof p === 'string' && BASE58.test(p))) return null;
  if (typeof threshold !== 'string' || !/^\d{1,20}$/.test(threshold)) return null;
  return { pools, threshold: BigInt(threshold) };
}

export async function progressFor(rpcUrl: string, pools: string[], threshold: bigint): Promise<Record<string, number>> {
  const data = await getAccountsData(rpcUrl, pools, { slice: PROGRESS_SLICE });
  const out: Record<string, number> = {};
  for (const [pool, d] of data) if (d) out[pool] = decodeProgress(d, threshold).progress;
  return out;
}
