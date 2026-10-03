import type { PoolTable } from './table';

export interface PresetStats {
  index: number;
  launches: number;
  instant: number;
  organic: number;
  open: number;
  organicRate: number | null;
  buckets: number[];
  raisedRaw: number;
  feesRaw: number;
  medianGradSeconds: number | null;
  firstLaunch: number | null;
  lastLaunch: number | null;
  weekly: { week: number; launches: number; organic: number }[];
  topFeeClaimers: { address: string; launches: number }[];
  topConfig: { index: number; launches: number };
  configCount: number;
  recent: number[];
}

const WEEK = 7 * 86_400;
const MONDAY_OFFSET = 4 * 86_400;
const SAMPLE_CAP = 4001;
export const weekStart = (t: number) => Math.floor((t - MONDAY_OFFSET) / WEEK) * WEEK + MONDAY_OFFSET;

interface Acc {
  stats: PresetStats;
  grads: number[];
  seen: number;
  weeks: Map<number, { launches: number; organic: number }>;
  claimers: Map<string, number>;
  configs: Map<number, number>;
}

function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function aggregate(
  t: PoolTable,
  presetCount: number,
  configFeeClaimer: (configIdx: number) => string,
  opts: { minLaunches: number; minEligible?: number; nowSec: number; weeks: number; recent: number },
): PresetStats[] {
  const counts = new Uint32Array(presetCount);
  for (let i = 0; i < t.size; i++) counts[t.preset[i]]++;
  const accs = new Map<number, Acc>();
  for (let p = 0; p < presetCount; p++) {
    if (counts[p] < opts.minLaunches) continue;
    accs.set(p, {
      stats: {
        index: p, launches: 0, instant: 0, organic: 0, open: 0, organicRate: null, buckets: [0, 0, 0, 0, 0, 0],
        raisedRaw: 0, feesRaw: 0, medianGradSeconds: null, firstLaunch: null, lastLaunch: null, weekly: [],
        topFeeClaimers: [], topConfig: { index: -1, launches: 0 }, configCount: 0, recent: [],
      },
      grads: [], seen: 0, weeks: new Map(), claimers: new Map(), configs: new Map(),
    });
  }
  let seed = 0x9e3779b9;
  const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  for (let i = 0; i < t.size; i++) {
    const acc = accs.get(t.preset[i]);
    if (!acc) continue;
    const s = acc.stats;
    const cls = t.clsAt(i);
    s.launches++;
    s[cls]++;
    if (cls === 'open') s.buckets[t.bucket[i]]++;
    s.raisedRaw += t.raised[i];
    s.feesRaw += t.fees[i];
    const g = t.gradSeconds[i];
    if (cls === 'organic' && !Number.isNaN(g)) {
      acc.seen++;
      if (acc.grads.length < SAMPLE_CAP) acc.grads.push(g);
      else {
        const j = Math.floor(rand() * acc.seen);
        if (j < SAMPLE_CAP) acc.grads[j] = g;
      }
    }
    const lt = t.launchTime[i];
    if (!Number.isNaN(lt)) {
      s.firstLaunch = s.firstLaunch === null ? lt : Math.min(s.firstLaunch, lt);
      s.lastLaunch = s.lastLaunch === null ? lt : Math.max(s.lastLaunch, lt);
      const w = acc.weeks.get(weekStart(lt)) ?? { launches: 0, organic: 0 };
      w.launches++;
      if (cls === 'organic') w.organic++;
      acc.weeks.set(weekStart(lt), w);
    }
    const claimer = configFeeClaimer(t.config[i]);
    acc.claimers.set(claimer, (acc.claimers.get(claimer) ?? 0) + 1);
    acc.configs.set(t.config[i], (acc.configs.get(t.config[i]) ?? 0) + 1);
    const key = (r: number) => (Number.isNaN(t.launchTime[r]) ? -Infinity : t.launchTime[r]);
    if (s.recent.length < opts.recent || key(i) > key(s.recent[s.recent.length - 1])) {
      s.recent.push(i);
      s.recent.sort((a, b) => key(b) - key(a));
      if (s.recent.length > opts.recent) s.recent.pop();
    }
  }
  const lastWeek = weekStart(opts.nowSec);
  const out: PresetStats[] = [];
  for (const acc of accs.values()) {
    const s = acc.stats;
    const eligible = s.launches - s.instant;
    s.organicRate = eligible >= (opts.minEligible ?? 5) ? s.organic / eligible : null;
    s.medianGradSeconds = median(acc.grads);
    s.weekly = Array.from({ length: opts.weeks }, (_, k) => {
      const week = lastWeek - (opts.weeks - 1 - k) * WEEK;
      return { week, ...(acc.weeks.get(week) ?? { launches: 0, organic: 0 }) };
    });
    s.topFeeClaimers = [...acc.claimers.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([address, launches]) => ({ address, launches }));
    const [topIdx, topCount] = [...acc.configs.entries()].sort((a, b) => b[1] - a[1])[0];
    s.topConfig = { index: topIdx, launches: topCount };
    s.configCount = acc.configs.size;
    out.push(s);
  }
  return out.sort((a, b) => b.launches - a.launches);
}
