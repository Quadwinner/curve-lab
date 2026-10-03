import { describe, expect, it } from 'vitest';
import { aggregate } from '@/lib/metrics/aggregate';
import { classify, launchTimeOf } from '@/lib/metrics/classify';
import { PoolTable } from '@/lib/metrics/table';
import type { PoolRow } from '@/lib/dbc/pool';

const clock = { refSlot: 1_000_000, refTime: 1_790_000_000 };
const row = (o: Partial<PoolRow>): PoolRow => ({
  config: 'cfg',
  baseMintBytes: new Uint8Array(32).fill(1),
  quoteReserve: 0n,
  activationPoint: 1_789_000_000n,
  isMigrated: false,
  tradingQuoteFee: 0n,
  finishCurveTimestamp: 0n,
  ...o,
});

describe('launchTimeOf', () => {
  it('uses timestamps directly', () => expect(launchTimeOf(1_789_000_000n, 1, clock)).toBe(1_789_000_000));
  it('converts slots at 0.4 s', () => expect(launchTimeOf(999_000n, 0, clock)).toBe(1_790_000_000 - 400));
  it('returns null when not set', () => expect(launchTimeOf(0n, 1, clock)).toBeNull());
});

describe('classify', () => {
  it('flags graduation within 60 s as instant', () => {
    const c = classify(row({ finishCurveTimestamp: 1_789_000_030n, isMigrated: true }), 100n, 1, clock);
    expect(c).toMatchObject({ cls: 'instant', gradSeconds: 30, progress: 1, bucket: null });
  });
  it('counts slower graduation as organic', () => {
    expect(classify(row({ finishCurveTimestamp: 1_789_003_600n }), 100n, 1, clock)).toMatchObject({ cls: 'organic', gradSeconds: 3600 });
  });
  it('treats migrated pools without a finish time as organic with unknown duration', () => {
    expect(classify(row({ isMigrated: true }), 100n, 1, clock)).toMatchObject({ cls: 'organic', gradSeconds: null });
  });
  it('buckets open launches by progress', () => {
    expect(classify(row({ quoteReserve: 0n }), 100n, 1, clock).bucket).toBe(0);
    expect(classify(row({ quoteReserve: 5n }), 100n, 1, clock).bucket).toBe(1);
    expect(classify(row({ quoteReserve: 30n }), 100n, 1, clock).bucket).toBe(3);
    expect(classify(row({ quoteReserve: 99n }), 100n, 1, clock)).toMatchObject({ bucket: 5, progress: 0.99 });
  });
  it('survives a zero threshold and zero activation point', () => {
    const c = classify(row({ quoteReserve: 5n, activationPoint: 0n }), 0n, 1, clock);
    expect(c.progress).toBe(0);
    expect(c.bucket).toBe(0);
    expect(c.launchTime).toBeNull();
  });
});

describe('aggregate', () => {
  const t = new PoolTable();
  const now = 1_790_000_000;
  const week = 7 * 86_400;
  // preset 0: 6 launches (2 instant, 2 organic, 2 open); preset 1: 2 launches (filtered out)
  const add = (preset: number, config: number, r: Partial<PoolRow>, key: string) => {
    const p = row(r);
    t.push(key, preset, config, classify(p, 100n, 1, clock), p);
  };
  add(0, 0, { finishCurveTimestamp: 1_789_000_010n, isMigrated: true }, 'p1');
  add(0, 0, { finishCurveTimestamp: 1_789_000_020n, isMigrated: true }, 'p2');
  add(0, 1, { finishCurveTimestamp: 1_789_000_000n + 600n, isMigrated: true, tradingQuoteFee: 7n }, 'p3');
  add(0, 1, { finishCurveTimestamp: BigInt(now - 2 * week + 1800), isMigrated: true, activationPoint: BigInt(now - 2 * week) }, 'p4');
  add(0, 1, { quoteReserve: 50n, activationPoint: BigInt(now - 100) }, 'p5');
  add(0, 2, { quoteReserve: 2n }, 'p6');
  add(1, 3, {}, 'q1');
  add(1, 3, {}, 'q2');
  const claimers = ['A', 'A', 'B', 'C'];
  const stats = aggregate(t, 2, (i) => claimers[i], { minLaunches: 5, nowSec: now, weeks: 4, recent: 3 });

  it('keeps only presets with enough launches', () => {
    expect(stats.map((s) => s.index)).toEqual([0]);
  });
  it('counts classes, buckets, money', () => {
    const s = stats[0];
    expect(s).toMatchObject({ launches: 6, instant: 2, organic: 2, open: 2, feesRaw: 7, raisedRaw: 52 });
    expect(s.buckets).toEqual([0, 1, 0, 0, 1, 0]);
    expect(s.organicRate).toBeCloseTo(0.5);
    expect(s.medianGradSeconds).toBe(1200);
  });
  it('ranks fee claimers and configs', () => {
    const s = stats[0];
    expect(s.topFeeClaimers[0]).toEqual({ address: 'A', launches: 5 });
    expect(s.topConfig).toEqual({ index: 1, launches: 3 });
    expect(s.configCount).toBe(3);
  });
  it('zero-fills weekly series and orders recent launches newest first', () => {
    const s = stats[0];
    expect(s.weekly).toHaveLength(4);
    expect(s.weekly.reduce((a, w) => a + w.launches, 0)).toBe(6);
    expect(s.weekly.at(-1)!.launches).toBe(1);
    expect(s.recent).toHaveLength(3);
    expect(t.keys[s.recent[0]]).toBe('p5');
    expect(s.recent.map((r) => t.keys[r])).not.toContain('p4');
  });
});
