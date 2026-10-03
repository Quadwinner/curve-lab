export interface FeatureInput {
  startMcap: number | null;
  migrationMcap: number | null;
  threshold: number;
  startFeeBps: number;
  creatorFeePct: number;
}

const safeLog = (x: number | null) => Math.log10(Math.max(x ?? 1, 1e-9));

export function featureVector(x: FeatureInput): number[] {
  return [safeLog(x.startMcap), safeLog(x.migrationMcap), safeLog(x.threshold), x.startFeeBps / 1000, x.creatorFeePct / 50];
}

export function nearest<T extends { quoteMint: string; v: number[] }>(items: T[], v: number[], quoteMint: string, k = 5): (T & { distance: number })[] {
  return items
    .filter((it) => it.quoteMint === quoteMint)
    .map((it) => ({ ...it, distance: Math.hypot(...it.v.map((x, i) => x - v[i])) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, k);
}
