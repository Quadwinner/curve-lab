import type { PresetParams } from '../lib/dbc/config';
import type { Feature, Meta, PresetDetail, PresetSummary, QuoteInfo, RecentLaunch } from '../lib/data/types';
import { feeScheduleBps } from '../lib/curve/fees';
import { curveSeries, marketCap, sparkline } from '../lib/curve/math';
import { featureVector } from '../lib/curve/similarity';
import type { PresetStats } from '../lib/metrics/aggregate';

const finiteOrNull = (x: number) => (Number.isFinite(x) && x > 0 ? x : null);

export function buildSummary(id: string, s: PresetStats, p: PresetParams, quote: QuoteInfo): PresetSummary {
  const scale = 10 ** quote.decimals;
  const fee = feeScheduleBps(p);
  const series = curveSeries(BigInt(p.sqrtStartPrice), p.curve, BigInt(p.migrationSqrtPrice), p.tokenDecimal, quote.decimals);
  return {
    id,
    quoteMint: p.quoteMint,
    quote,
    launches: s.launches,
    organic: s.organic,
    instant: s.instant,
    open: s.open,
    organicRate: s.organicRate,
    instantShare: s.launches ? s.instant / s.launches : 0,
    medianGradSeconds: s.medianGradSeconds,
    raised: s.raisedRaw / scale,
    fees: s.feesRaw / scale,
    threshold: Number(p.migrationQuoteThreshold) / scale,
    startFeeBps: fee[0].bps,
    endFeeBps: fee[fee.length - 1].bps,
    feeMode: p.baseFee.mode,
    dynamicFee: p.dynamicFee,
    creatorFeePct: p.creatorTradingFeePercentage,
    startMcap: finiteOrNull(marketCap(BigInt(p.sqrtStartPrice), p, quote.decimals)),
    migrationMcap: finiteOrNull(marketCap(BigInt(p.migrationSqrtPrice), p, quote.decimals)),
    spark: sparkline(series, 16),
    lastLaunch: s.lastLaunch,
  };
}

export function buildDetail(
  summary: PresetSummary,
  s: PresetStats,
  p: PresetParams,
  topConfig: { address: string; launches: number },
  recent: RecentLaunch[],
): PresetDetail {
  return {
    ...summary,
    params: p,
    curve: curveSeries(BigInt(p.sqrtStartPrice), p.curve, BigInt(p.migrationSqrtPrice), p.tokenDecimal, summary.quote.decimals, 64),
    feeSchedule: feeScheduleBps(p, 48),
    weekly: s.weekly,
    buckets: s.buckets,
    topFeeClaimers: s.topFeeClaimers,
    topConfig,
    configCount: s.configCount,
    recent,
  };
}

export function buildFeature(s: PresetSummary): Feature {
  return {
    id: s.id,
    quoteMint: s.quoteMint,
    v: featureVector({ startMcap: s.startMcap, migrationMcap: s.migrationMcap, threshold: s.threshold, startFeeBps: s.startFeeBps, creatorFeePct: s.creatorFeePct }),
    organicRate: s.organicRate,
    launches: s.launches,
    threshold: s.threshold,
    startMcap: s.startMcap,
    migrationMcap: s.migrationMcap,
    startFeeBps: s.startFeeBps,
  };
}

export function sanityCheck(prev: Meta | null, next: Meta): string | null {
  if (!prev || next.totals.pools >= prev.totals.pools * 0.95) return null;
  return `${next.totals.pools} pools vs ${prev.totals.pools} previously`;
}
