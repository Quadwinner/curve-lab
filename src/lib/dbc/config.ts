import { pubkey, u128, u16, u64, u8 } from './bytes';
import { CONFIG_SLICE, MAX_CURVE_POINTS } from './layout';

export interface CurvePoint {
  sqrtPrice: string;
  liquidity: string;
}

export interface PresetParams {
  quoteMint: string;
  tokenDecimal: number;
  activationType: number;
  collectFeeMode: number;
  migrationOption: number;
  tokenType: number;
  version: number;
  baseFee: { cliffFeeNumerator: string; firstFactor: number; secondFactor: string; thirdFactor: string; mode: number };
  dynamicFee: boolean;
  creatorTradingFeePercentage: number;
  lp: { partner: number; partnerLocked: number; creator: number; creatorLocked: number };
  migrationFeeOption: number;
  migrationFeePercentage: number;
  creatorMigrationFeePercentage: number;
  migratedPoolFeeBps: number;
  poolCreationFee: string;
  tokenUpdateAuthority: number;
  fixedTokenSupply: boolean;
  swapBaseAmount: string;
  migrationQuoteThreshold: string;
  migrationBaseThreshold: string;
  migrationSqrtPrice: string;
  lockedVesting: { amountPerPeriod: string; cliffDurationFromMigrationTime: string; frequency: string; numberOfPeriod: string; cliffUnlockAmount: string };
  preMigrationTokenSupply: string;
  postMigrationTokenSupply: string;
  sqrtStartPrice: string;
  curve: CurvePoint[];
}

export interface ConfigHeader {
  quoteMint: string;
  feeClaimer: string;
  migrationQuoteThreshold: bigint;
  activationType: number;
}

const at = (accountOffset: number) => accountOffset - CONFIG_SLICE.offset;

function assertBody(b: Uint8Array) {
  if (b.length < CONFIG_SLICE.length) throw new Error(`config body too short: ${b.length}`);
}

export function decodeConfigHeader(b: Uint8Array): ConfigHeader {
  assertBody(b);
  return {
    quoteMint: pubkey(b, at(8)),
    feeClaimer: pubkey(b, at(40)),
    migrationQuoteThreshold: u64(b, at(264)),
    activationType: u8(b, at(234)),
  };
}

export function decodeConfigParams(b: Uint8Array): PresetParams {
  assertBody(b);
  const curve: CurvePoint[] = [];
  for (let i = 0; i < MAX_CURVE_POINTS; i++) {
    const o = at(408) + i * 32;
    const sqrtPrice = u128(b, o);
    if (sqrtPrice === 0n) break;
    curve.push({ sqrtPrice: sqrtPrice.toString(), liquidity: u128(b, o + 16).toString() });
  }
  return {
    quoteMint: pubkey(b, at(8)),
    baseFee: {
      cliffFeeNumerator: u64(b, at(104)).toString(),
      secondFactor: u64(b, at(112)).toString(),
      thirdFactor: u64(b, at(120)).toString(),
      firstFactor: u16(b, at(128)),
      mode: u8(b, at(130)),
    },
    dynamicFee: u8(b, at(136)) === 1,
    collectFeeMode: u8(b, at(232)),
    migrationOption: u8(b, at(233)),
    activationType: u8(b, at(234)),
    tokenDecimal: u8(b, at(235)),
    version: u8(b, at(236)),
    tokenType: u8(b, at(237)),
    lp: { partnerLocked: u8(b, at(239)), partner: u8(b, at(240)), creatorLocked: u8(b, at(241)), creator: u8(b, at(242)) },
    migrationFeeOption: u8(b, at(243)),
    fixedTokenSupply: u8(b, at(244)) === 1,
    creatorTradingFeePercentage: u8(b, at(245)),
    tokenUpdateAuthority: u8(b, at(246)),
    migrationFeePercentage: u8(b, at(247)),
    creatorMigrationFeePercentage: u8(b, at(248)),
    swapBaseAmount: u64(b, at(256)).toString(),
    migrationQuoteThreshold: u64(b, at(264)).toString(),
    migrationBaseThreshold: u64(b, at(272)).toString(),
    migrationSqrtPrice: u128(b, at(280)).toString(),
    lockedVesting: {
      amountPerPeriod: u64(b, at(296)).toString(),
      cliffDurationFromMigrationTime: u64(b, at(304)).toString(),
      frequency: u64(b, at(312)).toString(),
      numberOfPeriod: u64(b, at(320)).toString(),
      cliffUnlockAmount: u64(b, at(328)).toString(),
    },
    preMigrationTokenSupply: u64(b, at(344)).toString(),
    postMigrationTokenSupply: u64(b, at(352)).toString(),
    migratedPoolFeeBps: u16(b, at(362)),
    poolCreationFee: u64(b, at(368)).toString(),
    sqrtStartPrice: u128(b, at(392)).toString(),
    curve,
  };
}
