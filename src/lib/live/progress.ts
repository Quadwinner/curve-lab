export const PROGRESS_SLICE = { offset: 240, length: 66 } as const;

export function decodeProgress(d: Uint8Array, threshold: bigint): { progress: number; migrated: boolean } {
  const view = new DataView(d.buffer, d.byteOffset, d.byteLength);
  const quoteReserve = view.getBigUint64(0, true);
  const migrated = d[305 - PROGRESS_SLICE.offset] === 1;
  if (migrated) return { progress: 1, migrated };
  return { progress: threshold > 0n ? Math.min(1, Number(quoteReserve) / Number(threshold)) : 0, migrated };
}
