import type { PresetParams } from '../dbc/config';

export const FEE_DENOMINATOR = 1_000_000_000;
const SLOT_SECONDS = 0.4;

export interface FeePoint {
  t: number;
  bps: number;
}

type FeeInput = { baseFee: PresetParams['baseFee']; activationType: number };

const toBps = (numerator: number) => (numerator / FEE_DENOMINATOR) * 10_000;

// SDK mapping (getFeeSchedulerParams): firstFactor = numberOfPeriod, secondFactor = periodFrequency, thirdFactor = reductionFactor.
export function feeScheduleBps(p: FeeInput, steps = 24): FeePoint[] {
  const cliff = Number(p.baseFee.cliffFeeNumerator);
  const periods = p.baseFee.firstFactor;
  const frequency = Number(p.baseFee.secondFactor);
  const reduction = Number(p.baseFee.thirdFactor);
  const mode = p.baseFee.mode;
  if (mode > 1 || periods === 0 || frequency === 0) return [{ t: 0, bps: toBps(cliff) }];
  const unit = p.activationType === 1 ? 1 : SLOT_SECONDS;
  const feeAt = (n: number) => (mode === 0 ? cliff - n * reduction : cliff * (1 - reduction / 10_000) ** n);
  const stride = Math.max(1, Math.ceil(periods / steps));
  const out: FeePoint[] = [];
  for (let n = 0; n < periods; n += stride) out.push({ t: n * frequency * unit, bps: toBps(feeAt(n)) });
  out.push({ t: periods * frequency * unit, bps: toBps(feeAt(periods)) });
  return out;
}
