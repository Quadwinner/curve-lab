import { readFileSync } from 'node:fs';
import BN from 'bn.js';
import { describe, expect, it } from 'vitest';
import { BaseFeeMode, getFeeSchedulerParams, getQuoteReserveFromNextSqrtPrice } from '@meteora-ag/dynamic-bonding-curve-sdk';
import { decodeConfigParams } from '@/lib/dbc/config';
import { CONFIG_SLICE } from '@/lib/dbc/layout';
import { presetIdOf } from '@/lib/dbc/presetId';
import { feeScheduleBps } from '@/lib/curve/fees';
import { curveSeries, quoteRaisedAt, sparkline, sqrtPriceAtRaised, sqrtPriceToPrice } from '@/lib/curve/math';
import { featureVector, nearest } from '@/lib/curve/similarity';

const body = new Uint8Array(readFileSync('test/fixtures/grad.config.bin')).subarray(CONFIG_SLICE.offset);
const p = decodeConfigParams(body);
const start = BigInt(p.sqrtStartPrice);
const mig = BigInt(p.migrationSqrtPrice);
const threshold = BigInt(p.migrationQuoteThreshold);

describe('presetIdOf', () => {
  it('ignores feeClaimer and leftoverReceiver', () => {
    const a = Uint8Array.from(body);
    a.fill(7, 32, 96);
    expect(presetIdOf(a)).toBe(presetIdOf(body));
    expect(presetIdOf(body)).toMatch(/^[0-9a-f]{16}$/);
  });
  it('changes when the curve changes', () => {
    const a = Uint8Array.from(body);
    a[408 - 8] ^= 1;
    expect(presetIdOf(a)).not.toBe(presetIdOf(body));
  });
});

describe('curve math', () => {
  it('raises the migration threshold exactly at the migration price', () => {
    const raised = quoteRaisedAt(start, p.curve, mig);
    const diff = Number(raised - threshold) / Number(threshold);
    expect(Math.abs(diff)).toBeLessThan(0.01);
  });
  it('matches the SDK quote reserve within rounding', () => {
    const sdk = getQuoteReserveFromNextSqrtPrice(new BN(mig.toString()), {
      sqrtStartPrice: new BN(p.sqrtStartPrice),
      curve: p.curve.map((c) => ({ sqrtPrice: new BN(c.sqrtPrice), liquidity: new BN(c.liquidity) })),
    } as never);
    const ours = quoteRaisedAt(start, p.curve, mig);
    expect(Number(BigInt(sdk.toString()) - ours)).toBeLessThanOrEqual(p.curve.length);
  });
  it('inverts quoteRaisedAt', () => {
    const s = sqrtPriceAtRaised(start, p.curve, threshold);
    expect(Math.abs(Number(s - mig) / Number(mig))).toBeLessThan(0.001);
  });
  it('builds a monotonic series from 0 to the threshold', () => {
    const series = curveSeries(start, p.curve, mig, p.tokenDecimal, 9, 20);
    expect(series).toHaveLength(21);
    expect(series[0].raised).toBe(0);
    for (let i = 1; i < series.length; i++) {
      expect(series[i].raised).toBeGreaterThanOrEqual(series[i - 1].raised);
      expect(series[i].price).toBeGreaterThan(series[i - 1].price);
    }
  });
  it('returns an empty series for a degenerate curve', () => {
    expect(curveSeries(mig, p.curve, start, 6, 9)).toEqual([]);
  });
  it('converts sqrt price to price', () => {
    expect(sqrtPriceToPrice(1n << 64n, 6, 9)).toBeCloseTo(0.001);
  });
  it('normalizes sparklines into 0..1', () => {
    const s = sparkline(curveSeries(start, p.curve, mig, p.tokenDecimal, 9), 8);
    expect(s).toHaveLength(8);
    expect(Math.min(...s)).toBe(0);
    expect(Math.max(...s)).toBe(1);
    expect(sparkline([{ raised: 0, price: 1 }, { raised: 1, price: 1 }], 4)).toEqual([0.5, 0.5, 0.5, 0.5]);
  });
});

describe('fee schedule', () => {
  const asParams = (mode: BaseFeeMode) => {
    const bf = getFeeSchedulerParams(5000, 100, mode, 10, 600);
    return {
      activationType: 1,
      baseFee: {
        cliffFeeNumerator: bf.cliffFeeNumerator.toString(),
        firstFactor: bf.firstFactor,
        secondFactor: bf.secondFactor.toString(),
        thirdFactor: bf.thirdFactor.toString(),
        mode,
      },
    };
  };
  it('reproduces a linear SDK schedule', () => {
    const s = feeScheduleBps(asParams(BaseFeeMode.FeeSchedulerLinear));
    expect(s[0]).toEqual({ t: 0, bps: 5000 });
    expect(s.at(-1)!.t).toBe(600);
    expect(s.at(-1)!.bps).toBeCloseTo(100, 0);
  });
  it('reproduces an exponential SDK schedule', () => {
    const s = feeScheduleBps(asParams(BaseFeeMode.FeeSchedulerExponential));
    expect(s[0].bps).toBe(5000);
    expect(Math.abs(s.at(-1)!.bps - 100) / 100).toBeLessThan(0.05);
  });
  it('treats a flat or rate-limited fee as a single point', () => {
    const flat = { activationType: 1, baseFee: { cliffFeeNumerator: '10000000', firstFactor: 0, secondFactor: '0', thirdFactor: '0', mode: 0 } };
    expect(feeScheduleBps(flat)).toEqual([{ t: 0, bps: 100 }]);
    expect(feeScheduleBps({ ...flat, baseFee: { ...flat.baseFee, mode: 2, firstFactor: 5 } })).toEqual([{ t: 0, bps: 100 }]);
  });
  it('converts slots to seconds', () => {
    const slots = { ...asParams(BaseFeeMode.FeeSchedulerLinear), activationType: 0 };
    expect(feeScheduleBps(slots).at(-1)!.t).toBeCloseTo(240);
  });
});

describe('similarity', () => {
  const items = [
    { id: 'a', quoteMint: 'SOL', v: featureVector({ startMcap: 30, migrationMcap: 400, threshold: 85, startFeeBps: 100, creatorFeePct: 50 }) },
    { id: 'b', quoteMint: 'SOL', v: featureVector({ startMcap: 3000, migrationMcap: 40000, threshold: 8500, startFeeBps: 5000, creatorFeePct: 0 }) },
    { id: 'c', quoteMint: 'USDC', v: featureVector({ startMcap: 30, migrationMcap: 400, threshold: 85, startFeeBps: 100, creatorFeePct: 50 }) },
  ];
  it('ranks by distance within the same quote mint', () => {
    const q = featureVector({ startMcap: 32, migrationMcap: 420, threshold: 90, startFeeBps: 100, creatorFeePct: 50 });
    const r = nearest(items, q, 'SOL', 5);
    expect(r.map((x) => x.id)).toEqual(['a', 'b']);
    expect(r[0].distance).toBeLessThan(r[1].distance);
  });
  it('handles missing market caps', () => {
    expect(featureVector({ startMcap: null, migrationMcap: null, threshold: 1, startFeeBps: 0, creatorFeePct: 0 }).every(Number.isFinite)).toBe(true);
  });
});
