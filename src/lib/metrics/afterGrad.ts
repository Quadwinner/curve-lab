import type { PoolTable } from './table';

export const POST_EDGES = [0.1, 0.5, 1, 2, 5];
export const POST_LABELS = ['<0.1×', '0.1–0.5×', '0.5–1×', '1–2×', '2–5×', '≥5×'];

export function priceMultiple(sqrtNow: number, sqrtAtGraduation: number): number | null {
  if (!Number.isFinite(sqrtNow) || !(sqrtAtGraduation > 0)) return null;
  return (sqrtNow / sqrtAtGraduation) ** 2;
}

export function postBucket(multiple: number): number {
  const i = POST_EDGES.findIndex((e) => multiple < e);
  return i === -1 ? POST_EDGES.length : i;
}

export interface PostStats {
  count: number;
  median: number | null;
  above: number;
  dead: number;
  buckets: number[];
}

const SAMPLE_CAP = 4001;

export function aggregatePost(t: PoolTable, presets: number[], graduationSqrt: Map<number, number>): Map<number, PostStats> {
  const wanted = new Set(presets);
  const acc = new Map<number, { buckets: number[]; sample: number[]; seen: number; above: number; dead: number }>();
  for (const p of presets) acc.set(p, { buckets: [0, 0, 0, 0, 0, 0], sample: [], seen: 0, above: 0, dead: 0 });
  let seed = 0x2545f491;
  const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  for (let i = 0; i < t.size; i++) {
    const p = t.preset[i];
    if (!wanted.has(p) || Number.isNaN(t.postSqrt[i])) continue;
    const m = priceMultiple(t.postSqrt[i], graduationSqrt.get(p) ?? 0);
    if (m === null) continue;
    const a = acc.get(p)!;
    a.buckets[postBucket(m)]++;
    if (m >= 1) a.above++;
    if (m < POST_EDGES[0]) a.dead++;
    a.seen++;
    if (a.sample.length < SAMPLE_CAP) a.sample.push(m);
    else {
      const j = Math.floor(rand() * a.seen);
      if (j < SAMPLE_CAP) a.sample[j] = m;
    }
  }
  const out = new Map<number, PostStats>();
  for (const [p, a] of acc) {
    const sorted = [...a.sample].sort((x, y) => x - y);
    const mid = sorted.length >> 1;
    const median = sorted.length === 0 ? null : sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    out.set(p, { count: a.seen, median, above: a.seen ? a.above / a.seen : 0, dead: a.seen ? a.dead / a.seen : 0, buckets: a.buckets });
  }
  return out;
}
