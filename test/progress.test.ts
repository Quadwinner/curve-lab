import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { decodeProgress, PROGRESS_SLICE } from '@/lib/live/progress';
import { openPools, progressFor } from '@/lib/live/progressServer';

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

describe('progress API helpers', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('reads progress for each pool and skips accounts it cannot decode', async () => {
    const open = new Uint8Array(readFileSync('test/fixtures/open.pool.bin')).subarray(PROGRESS_SLICE.offset, PROGRESS_SLICE.offset + PROGRESS_SLICE.length);
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ jsonrpc: '2.0', id: 1, result: { value: [{ data: [Buffer.from(open).toString('base64'), 'base64'] }, { data: ['AQ==', 'base64'] }, null] } })));
    const qr = BigInt(sdk('open').quoteReserve);
    const r = await progressFor('http://rpc', ['A', 'B', 'C'], qr * 2n);
    expect(r.A).toBeCloseTo(0.5);
    expect(r.B).toBeUndefined();
    expect(r.C).toBeUndefined();
  });
  it('fails fast instead of retrying for minutes', async () => {
    const f = vi.fn(async () => Promise.reject(new Error('fetch failed')));
    vi.stubGlobal('fetch', f);
    await expect(progressFor('http://rpc', ['A'], 1n)).rejects.toThrow('fetch failed');
    expect(f).toHaveBeenCalledTimes(2);
  });
  it('picks the open launches of a preset', () => {
    expect(openPools([{ pool: 'A', cls: 'open' }, { pool: 'B', cls: 'organic' }, { pool: 'C', cls: 'open' }] as never)).toEqual(['A', 'C']);
  });
});
