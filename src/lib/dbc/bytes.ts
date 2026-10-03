import bs58 from 'bs58';

export const u8 = (b: Uint8Array, o: number): number => b[o];
export const u16 = (b: Uint8Array, o: number): number => b[o] | (b[o + 1] << 8);

export function u64(b: Uint8Array, o: number): bigint {
  return new DataView(b.buffer, b.byteOffset, b.byteLength).getBigUint64(o, true);
}

export function u128(b: Uint8Array, o: number): bigint {
  return u64(b, o) | (u64(b, o + 8) << 64n);
}

export const pubkey = (b: Uint8Array, o: number): string => bs58.encode(b.subarray(o, o + 32));
