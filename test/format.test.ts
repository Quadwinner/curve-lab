import { describe, expect, it } from 'vitest';
import { fmtCompact, fmtDuration, fmtPct, fmtQuote, shortAddr, timeAgo } from '@/lib/format';

describe('format', () => {
  it('compacts numbers', () => {
    expect(fmtCompact(1_732_788)).toBe('1.7M');
    expect(fmtCompact(950)).toBe('950');
  });
  it('formats percentages and nulls', () => {
    expect(fmtPct(0.1234)).toBe('12.3%');
    expect(fmtPct(null)).toBe('—');
  });
  it('formats durations', () => {
    expect(fmtDuration(42)).toBe('42s');
    expect(fmtDuration(180)).toBe('3m');
    expect(fmtDuration(5 * 3600)).toBe('5h');
    expect(fmtDuration(3 * 86400)).toBe('3d');
    expect(fmtDuration(null)).toBe('—');
  });
  it('formats quote amounts', () => expect(fmtQuote(85.123, 'SOL')).toBe('85.1 SOL'));
  it('keeps small quote amounts readable', () => {
    expect(fmtQuote(0.054, 'SOL')).toBe('0.054 SOL');
    expect(fmtQuote(0.0004, 'SOL')).toBe('<0.001 SOL');
    expect(fmtQuote(0, 'SOL')).toBe('0 SOL');
  });
  it('shortens addresses', () => expect(shortAddr('dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN')).toBe('dbci…aqN'));
  it('describes time ago', () => expect(timeAgo(1000, 1000 + 7200)).toBe('2h ago'));
});
