import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { decodeProgress, PROGRESS_SLICE } from '@/lib/live/progress';
import { parseProgressRequest, progressFor } from '@/lib/live/progressServer';

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
  it('accepts up to 20 base58 pool addresses and a numeric threshold', () => {
    expect(parseProgressRequest({ pools: ['8ENUPj41wQ8A6TzAeBUzHpaSXxyHYo3GkCF7tQXhpgLw'], threshold: '85000000000' })).toEqual({ pools: ['8ENUPj41wQ8A6TzAeBUzHpaSXxyHYo3GkCF7tQXhpgLw'], threshold: 85000000000n });
  });
  it('rejects junk', () => {
    expect(parseProgressRequest({ pools: ['not base58 0OIl'], threshold: '1' })).toBeNull();
    expect(parseProgressRequest({ pools: Array(21).fill('8ENUPj41wQ8A6TzAeBUzHpaSXxyHYo3GkCF7tQXhpgLw'), threshold: '1' })).toBeNull();
    expect(parseProgressRequest({ pools: [], threshold: 'abc' })).toBeNull();
    expect(parseProgressRequest('nope')).toBeNull();
  });
  it('reads progress for each pool from RPC', async () => {
    const open = new Uint8Array(readFileSync('test/fixtures/open.pool.bin')).subarray(PROGRESS_SLICE.offset, PROGRESS_SLICE.offset + PROGRESS_SLICE.length);
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ jsonrpc: '2.0', id: 1, result: { value: [{ data: [Buffer.from(open).toString('base64'), 'base64'] }, null] } })));
    const qr = BigInt(sdk('open').quoteReserve);
    const r = await progressFor('http://rpc', ['A', 'B'], qr * 2n);
    expect(r.A).toBeCloseTo(0.5);
    expect(r.B).toBeUndefined();
  });
});
