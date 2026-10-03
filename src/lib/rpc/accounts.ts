import { rpcCall, withRetry } from './http';

type AccountValue = { data: [string, string] } | null;

export async function getAccountsData(
  rpcUrl: string,
  keys: string[],
  opts: { slice?: { offset: number; length: number }; batch?: number; concurrency?: number; attempts?: number; timeoutMs?: number } = {},
): Promise<Map<string, Uint8Array | null>> {
  const batch = opts.batch ?? 100;
  const chunks: string[][] = [];
  for (let i = 0; i < keys.length; i += batch) chunks.push(keys.slice(i, i + batch));
  const out = new Map<string, Uint8Array | null>();
  let next = 0;
  const worker = async () => {
    while (next < chunks.length) {
      const chunk = chunks[next++];
      const config = { encoding: 'base64', commitment: 'confirmed', ...(opts.slice ? { dataSlice: opts.slice } : {}) };
      const res = await withRetry(() => rpcCall<{ value: AccountValue[] }>(rpcUrl, 'getMultipleAccounts', [chunk, config], opts.timeoutMs), {
        label: 'getMultipleAccounts',
        attempts: opts.attempts ?? 8,
        baseMs: 2000,
      });
      res.value.forEach((v, i) => out.set(chunk[i], v ? Buffer.from(v.data[0], 'base64') : null));
    }
  };
  await Promise.all(Array.from({ length: Math.min(opts.concurrency ?? 2, chunks.length) }, worker));
  return out;
}
