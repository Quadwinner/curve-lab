import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { decodeConfigParams } from '@/lib/dbc/config';
import { CONFIG_SLICE } from '@/lib/dbc/layout';
import { buildFeature, buildSummary, marketTotals, publishCheck, sanityCheck } from '@/indexer/build';
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
  it('treats a corrupt cache as empty instead of failing every run', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'cl-'));
    writeFileSync(join(dir, 'configs.tsv.gz'), Buffer.from([0x1f, 0x8b, 0x08, 0x00, 0x01, 0x02]));
    expect((await loadConfigCache(join(dir, 'configs.tsv.gz'))).size).toBe(0);
  });
  it('writes the cache atomically (no temp file left behind)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'cl-'));
    await saveConfigCache(join(dir, 'configs.tsv.gz'), new Map([['cfgA', configEntryFromBody(body)]]));
    expect(readdirSync(dir)).toEqual(['configs.tsv.gz']);
  });
  it('returns an empty map when no cache exists', async () => {
    expect((await loadConfigCache('/nonexistent/x.tsv.gz')).size).toBe(0);
  });
});

describe('resolveQuotes', () => {
  it('names unknown quote mints from the Jupiter token list, falling back to RPC decimals', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (String(url).includes('jup.ag')) return Response.json([{ id: 'XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB', symbol: 'TSLAx', decimals: 8 }]);
      return Response.json({ jsonrpc: '2.0', id: 1, result: { value: [{ data: [Buffer.from([5]).toString('base64'), 'base64'] }] } });
    }));
    const r = await resolveQuotes('http://rpc', ['XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB', 'Other11111111111111111111111111111111111111']);
    expect(r.get('XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB')).toEqual({ symbol: 'TSLAx', decimals: 8 });
    expect(r.get('Other11111111111111111111111111111111111111')).toEqual({ symbol: 'Othe…', decimals: 5 });
  });
  it('recognises the real mainnet USDC mint without network', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('no network expected'); }));
    const r = await resolveQuotes('http://rpc', ['EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v']);
    expect(r.get('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')).toEqual({ symbol: 'USDC', decimals: 6 });
  });
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

describe('publishCheck', () => {
  const meta = (pools: number, partial?: boolean) => ({ generatedAt: 0, refSlot: 0, refTime: 0, totals: { pools, configs: 0, presets: 0, listed: 0, detailed: 0, organic: 0, instant: 0, open: 0 }, skipped: 0, ...(partial ? { partial } : {}) });
  it('refuses partial runs', () => {
    expect(publishCheck(null, meta(9000, true))).toMatch(/partial/);
  });
  it('applies the 5% drop rule against the published data', () => {
    expect(publishCheck(meta(1000), meta(900))).toMatch(/900 pools vs 1000/);
    expect(publishCheck(meta(1000), meta(1001))).toBeNull();
  });
});

describe('pre-funded launchpads', () => {
  const params = decodeConfigParams(body);
  const stats = (o: Partial<PresetStats>): PresetStats => ({
    index: 0, launches: 100, instant: 20, organic: 75, open: 5, organicRate: 0.94, buckets: [5, 0, 0, 0, 0, 0],
    raisedRaw: 0, feesRaw: 0, medianGradSeconds: 120, firstLaunch: 1, lastLaunch: 2, weekly: [],
    topFeeClaimers: [], topConfig: { index: 0, launches: 1 }, configCount: 1, recent: [], ...o,
  });
  it('flags groups where ≥90% of launches complete', () => {
    expect(buildSummary('a'.repeat(16), stats({}), params, { symbol: 'SOL', decimals: 9 }).prefunded).toBe(true);
    expect(buildSummary('a'.repeat(16), stats({ organic: 10, open: 70 }), params, { symbol: 'SOL', decimals: 9 }).prefunded).toBe(false);
  });
  it('needs at least 20 launches to call a group pre-funded', () => {
    expect(buildSummary('a'.repeat(16), stats({ launches: 10, instant: 5, organic: 5, open: 0 }), params, { symbol: 'SOL', decimals: 9 }).prefunded).toBe(false);
  });
  it('adds up price-after-graduation counts across groups', () => {
    const t = marketTotals([{ launches: 10, instant: 0, organic: 4, prefunded: false, post: { count: 4, median: 0.5, above: 0.25, dead: 0.5 } }, { launches: 5, instant: 0, organic: 0, prefunded: false, post: null }]);
    expect(t).toMatchObject({ postCount: 4, postAbove: 1, postDead: 2 });
  });
  it('computes open-market totals without pre-funded groups', () => {
    const s = (launches: number, instant: number, organic: number, prefunded: boolean) => ({ launches, instant, organic, prefunded }) as never;
    expect(marketTotals([s(100, 90, 10, true), s(1000, 100, 9, false), s(50, 0, 1, false)])).toEqual({ prefundedGroups: 1, prefundedLaunches: 100, marketOrganic: 10, marketEligible: 950, postCount: 0, postAbove: 0, postDead: 0 });
  });
});
