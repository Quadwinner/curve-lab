import { describe, expect, it } from 'vitest';
import { normalizeBlur } from '@/lib/live/normalize';

describe('normalizeBlur', () => {
  it('maps a DBC token_create to a launch', () => {
    const e = { type: 'token_create', signature: 'sig', slot: 1, block_time: 1790000000, dex: 'meteora_dbc', mint: 'M', pool: 'P', quote_mint: 'So1', name: 'Cat', symbol: 'CAT', uri: 'u', creator: 'c' };
    expect(normalizeBlur(e)).toEqual({ kind: 'launch', mint: 'M', pool: 'P', symbol: 'CAT', name: 'Cat', time: 1790000000, signature: 'sig' });
  });
  it('maps a DBC graduation', () => {
    expect(normalizeBlur({ type: 'graduation', mint: 'M', launchpad: 'meteora_dbc', pool: 'NEW', block_time: 5 })).toMatchObject({ kind: 'graduation', mint: 'M', time: 5 });
  });
  it('ignores other launchpads, unknown types, missing mints and junk', () => {
    expect(normalizeBlur({ type: 'token_create', dex: 'pumpfun', mint: 'M' })).toBeNull();
    expect(normalizeBlur({ type: 'swap', dex: 'meteora_dbc', mint: 'M' })).toBeNull();
    expect(normalizeBlur({ type: 'token_create', dex: 'meteora_dbc' })).toBeNull();
    expect(normalizeBlur('nope')).toBeNull();
    expect(normalizeBlur(null)).toBeNull();
  });
  it('falls back to now when no time is given', () => {
    expect(normalizeBlur({ type: 'token_create', dex: 'meteora_dbc', mint: 'M' }, 42)?.time).toBe(42);
  });
});
