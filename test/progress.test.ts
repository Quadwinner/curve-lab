import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { decodeProgress, PROGRESS_SLICE } from '@/lib/live/progress';

const pool = (name: string) => new Uint8Array(readFileSync(`test/fixtures/${name}.pool.bin`)).subarray(PROGRESS_SLICE.offset, PROGRESS_SLICE.offset + PROGRESS_SLICE.length);
const sdk = (name: string) => JSON.parse(readFileSync(`test/fixtures/${name}.pool.json`, 'utf8'));

it('reports a migrated pool as complete', () => {
  expect(decodeProgress(pool('grad'), 1n)).toEqual({ progress: 1, migrated: Number(sdk('grad').isMigrated) === 1 });
});
it('computes progress for an open pool', () => {
  const qr = BigInt(sdk('open').quoteReserve);
  expect(decodeProgress(pool('open'), qr * 4n).progress).toBeCloseTo(0.25);
  expect(decodeProgress(pool('open'), 0n).progress).toBe(0);
});
