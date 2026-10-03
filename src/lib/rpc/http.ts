export async function rpcCall<T>(url: string, method: string, params: unknown[], timeoutMs = 60_000): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`${method}: HTTP ${res.status}`);
  const json = (await res.json()) as { result?: T; error?: { message: string } };
  if (json.error) throw new Error(`${method}: ${json.error.message}`);
  return json.result as T;
}

export async function withRetry<T>(fn: () => Promise<T>, opts: { attempts?: number; baseMs?: number; label?: string } = {}): Promise<T> {
  const attempts = opts.attempts ?? 5;
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      if (i < attempts - 1) {
        if (opts.label) console.warn(`[retry] ${opts.label} attempt ${i + 1} failed: ${(e as Error).message}`);
        await new Promise((r) => setTimeout(r, (opts.baseMs ?? 1500) * 2 ** i));
      }
    }
  }
  throw last;
}

export type BatchResult<T> = { result?: T; error?: { message: string } };

export async function rpcBatch<T>(url: string, calls: { method: string; params: unknown[] }[], timeoutMs = 90_000): Promise<BatchResult<T>[]> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(calls.map((c, id) => ({ jsonrpc: '2.0', id, method: c.method, params: c.params }))),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`batch: HTTP ${res.status}`);
  const json = (await res.json()) as ({ id: number } & BatchResult<T>)[];
  if (!Array.isArray(json)) throw new Error('batch: response is not an array');
  const out: BatchResult<T>[] = new Array(calls.length).fill({ error: { message: 'missing' } });
  for (const r of json) out[r.id] = r;
  return out;
}
