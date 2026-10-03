import { describe, expect, it } from 'vitest';
import { buildDesign, DEFAULT_FORM, designSnippet } from '@/lib/designer/build';

describe('buildDesign', () => {
  it('builds valid config parameters for the defaults', () => {
    const r = buildDesign(DEFAULT_FORM);
    if (!r.ok) throw new Error(r.error);
    expect(r.thresholdQuote).toBeGreaterThan(0);
    expect(r.series.length).toBeGreaterThan(10);
    expect(r.series.at(-1)!.raised).toBeCloseTo(r.thresholdQuote, 0);
    expect(r.fee[0].bps).toBeCloseTo(DEFAULT_FORM.startFeeBps);
    expect(r.features.every(Number.isFinite)).toBe(true);
  });
  it('rejects a graduation market cap at or below the start', () => {
    expect(buildDesign({ ...DEFAULT_FORM, migrationMcap: DEFAULT_FORM.initialMcap })).toMatchObject({ ok: false });
  });
  it('rejects LP shares that do not sum to 100', () => {
    expect(buildDesign({ ...DEFAULT_FORM, creatorLockedPct: 10 })).toMatchObject({ ok: false, error: expect.stringMatching(/100/) });
  });
  it('builds a decaying fee schedule', () => {
    const r = buildDesign({ ...DEFAULT_FORM, startFeeBps: 5000, endFeeBps: 100, feePeriods: 10, feeDurationSec: 600 });
    if (!r.ok) throw new Error(r.error);
    expect(r.fee.at(-1)!.bps).toBeLessThan(r.fee[0].bps);
  });
  it('exports a runnable snippet', () => {
    expect(designSnippet(DEFAULT_FORM)).toContain('buildCurveWithMarketCap(');
  });
});
