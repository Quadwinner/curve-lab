import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { decodeConfigParams } from '@/lib/dbc/config';
import { CONFIG_SLICE } from '@/lib/dbc/layout';
import { buildFeature, buildSummary, sanityCheck } from '@/indexer/build';
import { configEntryFromBody, loadConfigCache, saveConfigCache } from '@/indexer/cache';
import { KNOWN_QUOTES, resolveQuotes } from '@/indexer/quotes';
import type { PresetStats } from '@/lib/metrics/aggregate';

const body = new Uint8Array(readFileSync('test/fixtures/grad.config.bin')).subarray(CONFIG_SLICE.offset);
afterEach(() => vi.unstubAllGlobals());

describe('config cache', () => {
  it('round-trips entries through gzip', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'cl-'));
    const m = new Map([['cfgA', configEntryFromBody(body)]]);
    await saveConfigCache(join(dir, 'configs.tsv.gz'), m);
    const back = await loadConfigCache(join(dir, 'configs.tsv.gz'));
    expect(back.get('cfgA')).toEqual(m.get('cfgA'));
  });
  it('returns an empty map when no cache exists', async () => {
    expect((await loadConfigCache('/nonexistent/x.tsv.gz')).size).toBe(0);
  });
});

describe('resolveQuotes', () => {
  it('uses known mints without network and falls back for unknown ones', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ jsonrpc: '2.0', id: 1, result: { value: [null] } })));
    const sol = 'So11111111111111111111111111111111111111112';
    const r = await resolveQuotes('http://rpc', [sol, 'Weird1111111111111111111111111111111111111']);
    expect(r.get(sol)).toEqual(KNOWN_QUOTES[sol]);
    expect(r.get('Weird1111111111111111111111111111111111111')).toEqual({ symbol: '?', decimals: 9 });
  });
});

describe('buildSummary', () => {
  const params = decodeConfigParams(body);
  const stats: PresetStats = {
    index: 0, launches: 10, instant: 2, organic: 4, open: 4, organicRate: 0.5, buckets: [1, 1, 1, 1, 0, 0],
    raisedRaw: 5e9, feesRaw: 1e8, medianGradSeconds: 900, firstLaunch: 1, lastLaunch: 2, weekly: [],
    topFeeClaimers: [], topConfig: { index: 0, launches: 10 }, configCount: 1, recent: [],
  };
  it('applies quote decimals and computes fee and market-cap fields', () => {
    const s = buildSummary('abcdabcdabcdabcd', stats, params, { symbol: 'SOL', decimals: 9 });
    expect(s.raised).toBe(5);
    expect(s.fees).toBeCloseTo(0.1);
    expect(s.instantShare).toBeCloseTo(0.2);
    expect(s.threshold).toBeCloseTo(Number(params.migrationQuoteThreshold) / 1e9);
    expect(s.spark.length).toBe(16);
    expect(s.startMcap).toBeGreaterThan(0);
    expect(s.migrationMcap!).toBeGreaterThan(s.startMcap!);
    const f = buildFeature(s);
    expect(f.v.every(Number.isFinite)).toBe(true);
  });
});

describe('sanityCheck', () => {
  const meta = (pools: number) => ({ generatedAt: 0, refSlot: 0, refTime: 0, totals: { pools, configs: 0, presets: 0, listed: 0, detailed: 0, organic: 0, instant: 0, open: 0 }, skipped: 0 });
  it('blocks publishing when pools drop more than 5%', () => {
    expect(sanityCheck(meta(1000), meta(940))).toMatch(/940 pools vs 1000/);
  });
  it('allows normal growth, small dips, and first runs', () => {
    expect(sanityCheck(meta(1000), meta(960))).toBeNull();
    expect(sanityCheck(meta(1000), meta(1200))).toBeNull();
    expect(sanityCheck(null, meta(5))).toBeNull();
  });
});
