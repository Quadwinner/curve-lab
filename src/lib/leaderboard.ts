import type { PresetSummary } from './data/types';

export type SortKey = 'launches' | 'organic' | 'speed' | 'raised' | 'fees' | 'recent';
export interface LeaderboardQuery {
  sort: SortKey;
  quote: 'all' | 'SOL' | 'USDC' | 'other';
  min: number;
  page: number;
}

const KEY: Record<SortKey, (p: PresetSummary) => number | null> = {
  launches: (p) => p.launches,
  organic: (p) => p.organicRate,
  speed: (p) => (p.medianGradSeconds === null ? null : -p.medianGradSeconds),
  raised: (p) => p.raised,
  fees: (p) => p.fees,
  recent: (p) => p.lastLaunch,
};

export function parseQuery(sp: Record<string, string | string[] | undefined>): LeaderboardQuery {
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]![0] : sp[k]);
  const sort = (one('sort') ?? 'launches') as SortKey;
  const quote = (one('quote') ?? 'all') as LeaderboardQuery['quote'];
  return {
    sort: sort in KEY ? sort : 'launches',
    quote: ['all', 'SOL', 'USDC', 'other'].includes(quote) ? quote : 'all',
    min: Math.max(5, Number(one('min')) || 20),
    page: Math.max(1, Number(one('page')) || 1),
  };
}

export function queryPresets(all: PresetSummary[], q: LeaderboardQuery, pageSize = 50) {
  const key = KEY[q.sort];
  const filtered = all.filter(
    (p) =>
      p.launches >= q.min &&
      (q.quote === 'all' || (q.quote === 'other' ? !['SOL', 'USDC'].includes(p.quote.symbol) : p.quote.symbol === q.quote)),
  );
  filtered.sort((a, b) => {
    const x = key(a);
    const y = key(b);
    if (x === null && y === null) return b.launches - a.launches;
    if (x === null) return 1;
    if (y === null) return -1;
    return y - x || b.launches - a.launches;
  });
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = Math.min(q.page, pages);
  return { rows: filtered.slice((page - 1) * pageSize, page * pageSize), total: filtered.length, pages };
}

const pct = (bps: number) => `${Number((bps / 100).toFixed(2))}%`;
const amount = (n: number) => (n >= 1000 ? new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n) : String(Number(n.toFixed(2))));

export function presetLabel(p: Pick<PresetSummary, 'threshold' | 'quote' | 'startFeeBps' | 'endFeeBps'>): string {
  const fee = Math.abs(p.startFeeBps - p.endFeeBps) < 0.5 ? pct(p.startFeeBps) : `${pct(p.startFeeBps)}→${pct(p.endFeeBps)}`;
  return `${amount(p.threshold)} ${p.quote.symbol} target · ${fee} fee`;
}
