import type { PresetParams } from '../lib/dbc/config';
import type { Feature, MarketTotals, Meta, PresetDetail, PresetSummary, QuoteInfo, RecentLaunch } from '../lib/data/types';
import { feeScheduleBps } from '../lib/curve/fees';
import { curveSeries, marketCap, sparkline } from '../lib/curve/math';
import { featureVector } from '../lib/curve/similarity';
import type { PresetStats } from '../lib/metrics/aggregate';
import type { PostStats } from '../lib/metrics/afterGrad';

const finiteOrNull = (x: number) => (Number.isFinite(x) && x > 0 ? x : null);

// Completion is bimodal on mainnet (most groups < 20% or > 80%); ≥ 90% means the launchpad buys out its own curves.
export const PREFUNDED_MIN_LAUNCHES = 20;
export const PREFUNDED_COMPLETION = 0.9;

export function buildSummary(id: string, s: PresetStats, p: PresetParams, quote: QuoteInfo, post?: PostStats): PresetSummary {
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
    prefunded: s.launches >= PREFUNDED_MIN_LAUNCHES && (s.organic + s.instant) / s.launches >= PREFUNDED_COMPLETION,
    post: post && post.count > 0 ? { count: post.count, median: post.median, above: post.above, dead: post.dead } : null,
  };
}

export function buildDetail(
  summary: PresetSummary,
  s: PresetStats,
  p: PresetParams,
  topConfig: { address: string; launches: number },
  recent: RecentLaunch[],
  post?: PostStats,
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
    postBuckets: post?.buckets ?? [0, 0, 0, 0, 0, 0],
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
    prefunded: s.prefunded,
  };
}

export function sanityCheck(prev: Meta | null, next: Meta): string | null {
  if (!prev || next.totals.pools >= prev.totals.pools * 0.95) return null;
  return `${next.totals.pools} pools vs ${prev.totals.pools} previously`;
}

export function publishCheck(published: Meta | null, next: Meta): string | null {
  if (next.partial) return 'partial run (--pool-partitions) cannot be published';
  return sanityCheck(published, next);
}

export function marketTotals(summaries: (Pick<PresetSummary, 'launches' | 'instant' | 'organic' | 'prefunded'> & { post?: PresetSummary['post'] })[]): MarketTotals {
  const t: MarketTotals = { prefundedGroups: 0, prefundedLaunches: 0, marketOrganic: 0, marketEligible: 0, postCount: 0, postAbove: 0, postDead: 0 };
  for (const s of summaries) {
    if (s.post) {
      t.postCount += s.post.count;
      t.postAbove += Math.round(s.post.above * s.post.count);
      t.postDead += Math.round(s.post.dead * s.post.count);
    }
    if (s.prefunded) {
      t.prefundedGroups++;
      t.prefundedLaunches += s.launches;
    } else {
      t.marketOrganic += s.organic;
      t.marketEligible += s.launches - s.instant;
    }
  }
  return t;
}
