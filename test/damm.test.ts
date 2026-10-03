import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DAMM_SLICE, decodeDammSlice } from '@/lib/damm/layout';
import { POST_LABELS, postBucket, priceMultiple } from '@/lib/metrics/afterGrad';

describe('decodeDammSlice', () => {
  it('decodes a DAMM v2 pool exactly like the SDK', () => {
    const bin = new Uint8Array(readFileSync('test/fixtures/grad.damm.bin'));
    const sdk = JSON.parse(readFileSync('test/fixtures/grad.damm.json', 'utf8'));
    const d = decodeDammSlice(bin.subarray(DAMM_SLICE.offset, DAMM_SLICE.offset + DAMM_SLICE.length));
    expect(d.tokenAMint).toBe(sdk.tokenAMint);
    expect(d.tokenBMint).toBe(sdk.tokenBMint);
    expect(d.sqrtPrice.toString()).toBe(sdk.sqrtPrice);
    expect(d.liquidity.toString()).toBe(sdk.liquidity);
  });
  it('rejects short slices', () => {
    expect(() => decodeDammSlice(new Uint8Array(8))).toThrow(/too short/);
  });
});

describe('price after graduation', () => {
  it('compares the DAMM v2 price with the graduation price', () => {
    expect(priceMultiple(2, 1)).toBe(4);
    expect(priceMultiple(1, 2)).toBe(0.25);
    expect(priceMultiple(1, 0)).toBeNull();
    expect(priceMultiple(Number.NaN, 1)).toBeNull();
  });
  it('buckets multiples', () => {
    expect(POST_LABELS).toHaveLength(6);
    expect([0.05, 0.3, 0.9, 1, 3, 50].map(postBucket)).toEqual([0, 1, 2, 3, 4, 5]);
  });
});

describe('aggregatePost', () => {
  it('summarizes price after graduation per preset, ignoring launches without a DAMM v2 pool', async () => {
    const { PoolTable } = await import('@/lib/metrics/table');
    const { classify } = await import('@/lib/metrics/classify');
    const { aggregatePost } = await import('@/lib/metrics/afterGrad');
    const t = new PoolTable();
    const clock = { refSlot: 0, refTime: 2_000_000_000 };
    const row = { config: 'c', baseMintBytes: new Uint8Array(32), quoteReserve: 0n, activationPoint: 1_000n, isMigrated: true, tradingQuoteFee: 0n, finishCurveTimestamp: 5_000n };
    for (let i = 0; i < 5; i++) t.push(`p${i}`, 0, 0, classify(row, 1n, 1, clock), row);
    t.push('other', 1, 0, classify(row, 1n, 1, clock), row);
    [0.2, 0.6, 1.0, 3.0].forEach((sqrt, i) => t.setPostSqrt(i, sqrt));
    const r = aggregatePost(t, [0], new Map([[0, 1]]));
    const s = r.get(0)!;
    expect(s.count).toBe(4);
    expect(s.buckets).toEqual([1, 1, 0, 1, 0, 1]);
    expect(s.above).toBeCloseTo(0.5);
    expect(s.dead).toBeCloseTo(0.25);
    expect(s.median).toBeCloseTo((0.36 + 1) / 2);
    expect(r.has(1)).toBe(false);
  });
  it('returns no stats for a preset without a graduation price', async () => {
    const { PoolTable } = await import('@/lib/metrics/table');
    const { aggregatePost } = await import('@/lib/metrics/afterGrad');
    expect(aggregatePost(new PoolTable(), [0], new Map()).get(0)).toEqual({ count: 0, median: null, above: 0, dead: 0, buckets: [0, 0, 0, 0, 0, 0] });
  });
});
