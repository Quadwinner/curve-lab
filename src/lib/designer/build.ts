import { PublicKey } from '@solana/web3.js';
import {
  ActivationType, BaseFeeMode, buildCurveWithMarketCap, CollectFeeMode, MigrationFeeOption, MigrationOption,
  TokenAuthorityOption, TokenDecimal, TokenType, validateConfigParameters, type BuildCurveWithMarketCapParams, type ConfigParameters,
} from '@meteora-ag/dynamic-bonding-curve-sdk';
import { feeScheduleBps, type FeePoint } from '../curve/fees';
import { curveSeries, sqrtPriceAtRaised, type SeriesPoint } from '../curve/math';
import { featureVector } from '../curve/similarity';

// validateTokenSupply rejects the default (all-zero) key; the real receiver is the connected wallet at creation time.
const VALIDATION_RECEIVER = new PublicKey('11111111111111111111111111111112');

export const QUOTES = {
  SOL: { mint: 'So11111111111111111111111111111111111111112', decimals: 9 },
  USDC: { mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', decimals: 6 },
} as const;

export interface DesignerForm {
  quote: keyof typeof QUOTES;
  totalSupply: number;
  decimals: 6 | 9;
  initialMcap: number;
  migrationMcap: number;
  startFeeBps: number;
  endFeeBps: number;
  feeMode: 'linear' | 'exponential';
  feePeriods: number;
  feeDurationSec: number;
  creatorFeePct: number;
  partnerLpPct: number;
  partnerLockedPct: number;
  creatorLpPct: number;
  creatorLockedPct: number;
  dynamicFee: boolean;
}

export const DEFAULT_FORM: DesignerForm = {
  quote: 'SOL', totalSupply: 1_000_000_000, decimals: 6, initialMcap: 30, migrationMcap: 400,
  startFeeBps: 100, endFeeBps: 100, feeMode: 'linear', feePeriods: 0, feeDurationSec: 0, creatorFeePct: 50,
  partnerLpPct: 0, partnerLockedPct: 50, creatorLpPct: 0, creatorLockedPct: 50, dynamicFee: false,
};

export type DesignResult =
  | { ok: true; config: ConfigParameters; thresholdQuote: number; series: SeriesPoint[]; fee: FeePoint[]; features: number[] }
  | { ok: false; error: string };

export function toBuildParams(f: DesignerForm): BuildCurveWithMarketCapParams {
  const flat = f.startFeeBps === f.endFeeBps;
  return {
    token: { tokenType: TokenType.SPLToken, tokenBaseDecimal: f.decimals as TokenDecimal, tokenQuoteDecimal: QUOTES[f.quote].decimals, tokenAuthorityOption: TokenAuthorityOption.Immutable, totalTokenSupply: f.totalSupply, leftover: 0 },
    fee: {
      baseFeeParams: {
        baseFeeMode: f.feeMode === 'linear' ? BaseFeeMode.FeeSchedulerLinear : BaseFeeMode.FeeSchedulerExponential,
        feeSchedulerParam: { startingFeeBps: f.startFeeBps, endingFeeBps: f.endFeeBps, numberOfPeriod: flat ? 0 : f.feePeriods, totalDuration: flat ? 0 : f.feeDurationSec },
      },
      dynamicFeeEnabled: f.dynamicFee, collectFeeMode: CollectFeeMode.QuoteToken, creatorTradingFeePercentage: f.creatorFeePct, poolCreationFee: 0, enableFirstSwapWithMinFee: false,
    },
    migration: { migrationOption: MigrationOption.MET_DAMM_V2, migrationFeeOption: MigrationFeeOption.FixedBps100, migrationFee: { feePercentage: 0, creatorFeePercentage: 0 } },
    liquidityDistribution: { partnerLiquidityPercentage: f.partnerLpPct, partnerPermanentLockedLiquidityPercentage: f.partnerLockedPct, creatorLiquidityPercentage: f.creatorLpPct, creatorPermanentLockedLiquidityPercentage: f.creatorLockedPct },
    lockedVesting: { totalLockedVestingAmount: 0, numberOfVestingPeriod: 0, cliffUnlockAmount: 0, totalVestingDuration: 0, cliffDurationFromMigrationTime: 0 },
    activationType: ActivationType.Timestamp,
    initialMarketCap: f.initialMcap,
    migrationMarketCap: f.migrationMcap,
  };
}

export function buildDesign(f: DesignerForm): DesignResult {
  if (!(f.migrationMcap > f.initialMcap)) return { ok: false, error: 'Graduation market cap must be higher than the starting market cap.' };
  if (f.partnerLpPct + f.partnerLockedPct + f.creatorLpPct + f.creatorLockedPct !== 100) return { ok: false, error: 'LP shares must add up to 100%.' };
  try {
    const config = buildCurveWithMarketCap(toBuildParams(f));
    validateConfigParameters({ ...config, leftoverReceiver: VALIDATION_RECEIVER } as never);
    const q = QUOTES[f.quote];
    const curve = config.curve.map((c) => ({ sqrtPrice: c.sqrtPrice.toString(), liquidity: c.liquidity.toString() }));
    const start = BigInt(config.sqrtStartPrice.toString());
    const threshold = BigInt(config.migrationQuoteThreshold.toString());
    const end = sqrtPriceAtRaised(start, curve, threshold);
    const baseFee = config.poolFees.baseFee;
    const fee = feeScheduleBps({
      activationType: ActivationType.Timestamp,
      baseFee: { cliffFeeNumerator: baseFee.cliffFeeNumerator.toString(), firstFactor: Number(baseFee.firstFactor), secondFactor: baseFee.secondFactor.toString(), thirdFactor: baseFee.thirdFactor.toString(), mode: Number(baseFee.baseFeeMode) },
    }, 48);
    const thresholdQuote = Number(threshold) / 10 ** q.decimals;
    return {
      ok: true, config, thresholdQuote, fee,
      series: curveSeries(start, curve, end, f.decimals, q.decimals, 64),
      features: featureVector({ startMcap: f.initialMcap, migrationMcap: f.migrationMcap, threshold: thresholdQuote, startFeeBps: f.startFeeBps, creatorFeePct: f.creatorFeePct }),
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export function designSnippet(f: DesignerForm): string {
  return `import { buildCurveWithMarketCap, DynamicBondingCurveClient } from '@meteora-ag/dynamic-bonding-curve-sdk';

const configParams = buildCurveWithMarketCap(${JSON.stringify(toBuildParams(f), null, 2)});
// then: client.partner.createConfig({ ...configParams, config, feeClaimer, leftoverReceiver, quoteMint: '${QUOTES[f.quote].mint}', payer })
`;
}
