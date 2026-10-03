import type { RecentLaunch } from '../data/types';
import { getAccountsData } from '../rpc/accounts';
import { decodeProgress, PROGRESS_SLICE } from './progress';

export const openPools = (recent: Pick<RecentLaunch, 'pool' | 'cls'>[]) => recent.filter((r) => r.cls === 'open').map((r) => r.pool);

export async function progressFor(rpcUrl: string, pools: string[], threshold: bigint): Promise<Record<string, number>> {
  const data = await getAccountsData(rpcUrl, pools, { slice: PROGRESS_SLICE, attempts: 2, timeoutMs: 8000 });
  const out: Record<string, number> = {};
  for (const [pool, d] of data) {
    if (!d || d.length < PROGRESS_SLICE.length) continue;
    out[pool] = decodeProgress(d, threshold).progress;
  }
  return out;
}
