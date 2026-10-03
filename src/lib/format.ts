export const fmtCompact = (n: number) => new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
export const fmtPct = (x: number | null) => (x === null ? '—' : `${(x * 100).toFixed(1)}%`);
function quoteNumber(n: number): string {
  if (n === 0) return '0';
  if (n >= 1000) return fmtCompact(n);
  if (n >= 1) return n.toFixed(1);
  if (n >= 0.001) return String(Number(n.toPrecision(2)));
  return '<0.001';
}

export const fmtQuote = (n: number, symbol: string) => `${quoteNumber(n)} ${symbol}`;
export const shortAddr = (a: string) => `${a.slice(0, 4)}…${a.slice(-3)}`;

export function fmtDuration(s: number | null): string {
  if (s === null) return '—';
  if (s < 120) return `${Math.round(s)}s`;
  if (s < 2 * 3600) return `${Math.round(s / 60)}m`;
  if (s < 2 * 86400) return `${Math.round(s / 3600)}h`;
  return `${Math.round(s / 86400)}d`;
}

export const timeAgo = (t: number, now = Date.now() / 1000) => `${fmtDuration(Math.max(0, now - t))} ago`;

export const plural = (n: number, one: string, many: string) => `${fmtCompact(n)} ${n === 1 ? one : many}`;
