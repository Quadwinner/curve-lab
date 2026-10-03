import type { Clock } from '../metrics/classify';
import { rpcCall } from './http';

export async function getRefClock(rpcUrl: string): Promise<Clock> {
  const slot = await rpcCall<number>(rpcUrl, 'getSlot', [{ commitment: 'finalized' }]);
  for (let back = 0; back < 20; back++) {
    try {
      const time = await rpcCall<number | null>(rpcUrl, 'getBlockTime', [slot - back]);
      if (time) return { refSlot: slot - back, refTime: time };
    } catch {
      continue;
    }
  }
  throw new Error('could not resolve a block time near the current slot');
}
