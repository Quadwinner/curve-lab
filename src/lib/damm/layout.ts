import { pubkey, u128 } from '../dbc/bytes';

export const DAMM_V2_PROGRAM_ID = 'cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG';
export const DAMM_POOL_SIZE = 1112;
export const DAMM_SLICE = { offset: 168, length: 304 } as const;

export interface DammRow {
  tokenAMint: string;
  tokenBMint: string;
  liquidity: bigint;
  sqrtPrice: bigint;
}

const at = (accountOffset: number) => accountOffset - DAMM_SLICE.offset;

export function decodeDammSlice(b: Uint8Array): DammRow {
  if (b.length < DAMM_SLICE.length) throw new Error(`damm slice too short: ${b.length}`);
  return {
    tokenAMint: pubkey(b, at(168)),
    tokenBMint: pubkey(b, at(200)),
    liquidity: u128(b, at(360)),
    sqrtPrice: u128(b, at(456)),
  };
}
