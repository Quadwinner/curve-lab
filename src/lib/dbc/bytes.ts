import bs58 from 'bs58';

export const u8 = (b: Uint8Array, o: number): number => b[o];
export const u16 = (b: Uint8Array, o: number): number => b[o] | (b[o + 1] << 8);

export function u64(b: Uint8Array, o: number): bigint {
  return new DataView(b.buffer, b.byteOffset, b.byteLength).getBigUint64(o, true);
}

export function u128(b: Uint8Array, o: number): bigint {
  return u64(b, o) | (u64(b, o + 8) << 64n);
}

// bs58 builds strings char by char; the resulting V8 cons-string costs ~1 KB vs ~74 B flattened, which matters for millions of keys.
export const pubkey = (b: Uint8Array, o: number): string => Buffer.from(bs58.encode(b.subarray(o, o + 32)), 'latin1').toString('latin1');
