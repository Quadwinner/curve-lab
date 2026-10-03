import { pubkey, u64, u8 } from './bytes';
import { POOL_SLICE } from './layout';

export interface PoolRow {
  config: string;
  baseMintBytes: Uint8Array;
  quoteReserve: bigint;
  activationPoint: bigint;
  isMigrated: boolean;
  tradingQuoteFee: bigint;
  finishCurveTimestamp: bigint;
}

const at = (accountOffset: number) => accountOffset - POOL_SLICE.offset;

export function decodePoolSlice(b: Uint8Array): PoolRow {
  if (b.length < POOL_SLICE.length) throw new Error(`pool slice too short: ${b.length}`);
  return {
    config: pubkey(b, at(72)),
    baseMintBytes: b.subarray(at(136), at(136) + 32),
    quoteReserve: u64(b, at(240)),
    activationPoint: u64(b, at(296)),
    isMigrated: u8(b, at(305)) === 1,
    tradingQuoteFee: u64(b, at(336)),
    finishCurveTimestamp: u64(b, at(344)),
  };
}
