import type { CurvePoint, PresetParams } from '../dbc/config';

export interface SeriesPoint {
  raised: number;
  price: number;
}

export function sqrtPriceToPrice(sqrtPrice: bigint, baseDecimals: number, quoteDecimals: number): number {
  const s = Number(sqrtPrice) / 2 ** 64;
  return s * s * 10 ** (baseDecimals - quoteDecimals);
}

// DBC quote delta: liquidity * (upper - lower) >> 128 (both sqrt prices are Q64.64).
export function quoteRaisedAt(sqrtStart: bigint, curve: CurvePoint[], target: bigint): bigint {
  let total = 0n;
  let lower = sqrtStart;
  for (const point of curve) {
    if (target <= lower) break;
    const upper = BigInt(point.sqrtPrice);
    const hi = target < upper ? target : upper;
    if (hi > lower) total += (BigInt(point.liquidity) * (hi - lower)) >> 128n;
    lower = upper;
  }
  return total;
}

export function sqrtPriceAtRaised(sqrtStart: bigint, curve: CurvePoint[], raised: bigint): bigint {
  let lo = sqrtStart;
  let hi = curve.length ? BigInt(curve[curve.length - 1].sqrtPrice) : sqrtStart;
  for (let i = 0; i < 160 && hi - lo > 1n; i++) {
    const mid = (lo + hi) >> 1n;
    if (quoteRaisedAt(sqrtStart, curve, mid) < raised) lo = mid;
    else hi = mid;
  }
  return hi;
}

export function totalSupplyRaw(p: PresetParams): bigint {
  if (p.fixedTokenSupply) return BigInt(p.preMigrationTokenSupply);
  const v = p.lockedVesting;
  const vesting = BigInt(v.amountPerPeriod) * BigInt(v.numberOfPeriod) + BigInt(v.cliffUnlockAmount);
  return BigInt(p.swapBaseAmount) + BigInt(p.migrationBaseThreshold) + vesting;
}

export function marketCap(sqrtPrice: bigint, p: PresetParams, quoteDecimals: number): number {
  const supply = Number(totalSupplyRaw(p)) / 10 ** p.tokenDecimal;
  return sqrtPriceToPrice(sqrtPrice, p.tokenDecimal, quoteDecimals) * supply;
}

export function curveSeries(
  sqrtStart: bigint,
  curve: CurvePoint[],
  end: bigint,
  baseDecimals: number,
  quoteDecimals: number,
  points = 48,
): SeriesPoint[] {
  if (end <= sqrtStart || curve.length === 0) return [];
  const a = Number(sqrtStart);
  const ratio = Number(end) / a;
  const out: SeriesPoint[] = [];
  for (let i = 0; i <= points; i++) {
    const s = i === 0 ? sqrtStart : i === points ? end : BigInt(Math.round(a * ratio ** (i / points)));
    out.push({
      raised: Number(quoteRaisedAt(sqrtStart, curve, s)) / 10 ** quoteDecimals,
      price: sqrtPriceToPrice(s, baseDecimals, quoteDecimals),
    });
  }
  return out;
}

export function sparkline(series: SeriesPoint[], n = 16): number[] {
  if (series.length === 0) return [];
  const picked = Array.from({ length: n }, (_, i) => series[Math.round((i * (series.length - 1)) / Math.max(1, n - 1))]);
  const logs = picked.map((p) => Math.log10(Math.max(p.price, Number.MIN_VALUE)));
  const min = Math.min(...logs);
  const max = Math.max(...logs);
  if (max - min < 1e-12) return logs.map(() => 0.5);
  return logs.map((l) => (l - min) / (max - min));
}
