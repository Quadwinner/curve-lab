import { describe, expect, it } from 'vitest';
import { parseQuery, presetLabel, queryPresets } from '@/lib/leaderboard';
import type { PresetSummary } from '@/lib/data/types';

const p = (id: string, o: Partial<PresetSummary>): PresetSummary => ({
  id, quoteMint: 'So11111111111111111111111111111111111111112', quote: { symbol: 'SOL', decimals: 9 },
  launches: 100, organic: 10, instant: 0, open: 90, organicRate: 0.1, instantShare: 0, medianGradSeconds: 600,
  raised: 1, fees: 1, threshold: 85, startFeeBps: 100, endFeeBps: 100, feeMode: 0, dynamicFee: false,
  creatorFeePct: 0, startMcap: 30, migrationMcap: 400, spark: [], lastLaunch: 1, prefunded: false, ...o,
});
const all = [
  p('a', { launches: 30, organicRate: 0.5 }),
  p('b', { launches: 300, organicRate: 0.05 }),
  p('c', { launches: 8, organicRate: 0.9 }),
  p('d', { launches: 50, organicRate: null, quote: { symbol: 'USDC', decimals: 6 } }),
];

describe('queryPresets', () => {
  it('filters by min launches and sorts by launches by default', () => {
    expect(queryPresets(all, { sort: 'launches', quote: 'all', min: 20, page: 1 }).rows.map((r) => r.id)).toEqual(['b', 'd', 'a']);
  });
  it('sorts by organic rate with nulls last', () => {
    expect(queryPresets(all, { sort: 'organic', quote: 'all', min: 5, page: 1 }).rows.map((r) => r.id)).toEqual(['c', 'a', 'b', 'd']);
  });
  it('filters by quote symbol', () => {
    expect(queryPresets(all, { sort: 'launches', quote: 'USDC', min: 5, page: 1 }).rows.map((r) => r.id)).toEqual(['d']);
  });
  it('filters stock-quoted presets (xStocks)', () => {
    const stock = p('s', { quote: { symbol: 'TSLAx', decimals: 8 } });
    const rows = queryPresets([...all, stock], { sort: 'launches', quote: 'stocks', min: 5, page: 1 }).rows;
    expect(rows.map((r) => r.id)).toEqual(['s']);
    expect(queryPresets([...all, stock], { sort: 'launches', quote: 'other', min: 5, page: 1 }).rows.map((r) => r.id)).toEqual(['s']);
  });
  it('paginates', () => {
    const r = queryPresets(all, { sort: 'launches', quote: 'all', min: 5, page: 2 }, 3);
    expect(r).toMatchObject({ total: 4, pages: 2 });
    expect(r.rows.map((x) => x.id)).toEqual(['c']);
  });
});

describe('presetLabel', () => {
  it('names a preset by its target and fee', () => {
    expect(presetLabel(p('x', { threshold: 85, startFeeBps: 100, endFeeBps: 100 }))).toBe('85 SOL target · 1% fee');
    expect(presetLabel(p('x', { threshold: 85.004, startFeeBps: 25, endFeeBps: 25 }))).toBe('85 SOL target · 0.25% fee');
    expect(presetLabel(p('x', { threshold: 200, startFeeBps: 5000, endFeeBps: 201 }))).toBe('200 SOL target · 50%→2.01% fee');
  });
});

describe('parseQuery', () => {
  it('does not compare amounts across quote tokens', () => {
    expect(parseQuery({ sort: 'raised' })).toMatchObject({ sort: 'raised', quote: 'SOL' });
    expect(parseQuery({ sort: 'fees', quote: 'all' })).toMatchObject({ quote: 'SOL' });
    expect(parseQuery({ sort: 'fees', quote: 'USDC' })).toMatchObject({ quote: 'USDC' });
    expect(parseQuery({ sort: 'launches' })).toMatchObject({ quote: 'all' });
  });
});

describe('pre-funded groups on the leaderboard', () => {
  const rows = [p('pf', { launches: 900, organicRate: 1, prefunded: true }), p('real', { launches: 100, organicRate: 0.05, prefunded: false })];
  it('ranks pre-funded groups after real ones when sorting by organic rate', () => {
    expect(queryPresets(rows, { sort: 'organic', quote: 'all', min: 5, page: 1, prefunded: 'show' }).rows.map((r) => r.id)).toEqual(['real', 'pf']);
  });
  it('can hide pre-funded groups', () => {
    expect(queryPresets(rows, { sort: 'launches', quote: 'all', min: 5, page: 1, prefunded: 'hide' }).rows.map((r) => r.id)).toEqual(['real']);
    expect(parseQuery({ pf: 'hide' }).prefunded).toBe('hide');
    expect(parseQuery({}).prefunded).toBe('show');
  });
});
