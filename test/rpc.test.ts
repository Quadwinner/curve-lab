import { afterEach, describe, expect, it, vi } from 'vitest';
import { getAccountsData } from '@/lib/rpc/accounts';
import { parseAccounts, streamPartitioned, streamProgramAccounts } from '@/lib/rpc/gpaStream';
import { withRetry } from '@/lib/rpc/http';

const acct = (key: string, b64: string) =>
  `{"account":{"data":["${b64}","base64"],"executable":false,"lamports":1,"owner":"x","rentEpoch":0,"space":3},"pubkey":"${key}"}`;
const body = `{"jsonrpc":"2.0","result":[${acct('Key1111', 'AQID')},${acct('Key2222', 'BAUG')}],"id":1}`;

const streamResponse = (text: string, chunk = 7) =>
  new Response(
    new ReadableStream({
      start(c) {
        const bytes = new TextEncoder().encode(text);
        for (let i = 0; i < bytes.length; i += chunk) c.enqueue(bytes.subarray(i, i + chunk));
        c.close();
      },
    }),
  );

afterEach(() => vi.unstubAllGlobals());

const realAcct = (key: string, b64: string) =>
  `{"pubkey":"${key}","account":{"lamports":8184960,"data":["${b64}","base64"],"owner":"dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN","executable":false,"rentEpoch":18446744073709551615,"space":1048}}`;
const realBody = `{"jsonrpc":"2.0","result":[${realAcct('Key1111', 'AQID')},${realAcct('Key2222', 'BAUG')}],"id":1}`;

describe('parseAccounts', () => {
  it('parses the field order public mainnet RPC actually returns (pubkey first)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => streamResponse(realBody, 9)));
    const seen: [string, number[]][] = [];
    const r = await streamProgramAccounts({ rpcUrl: 'http://rpc', programId: 'p', dataSize: 3, onAccount: (k, d) => seen.push([k, [...d]]) });
    expect(seen).toEqual([['Key1111', [1, 2, 3]], ['Key2222', [4, 5, 6]]]);
    expect(r.count).toBe(2);
  });

  it('extracts complete accounts and reports how much was consumed', () => {
    const seen: [string, number[]][] = [];
    const { consumed, count } = parseAccounts(body.slice(0, body.length - 40), (k, d) => seen.push([k, [...d]]));
    expect(count).toBe(1);
    expect(seen).toEqual([['Key1111', [1, 2, 3]]]);
    expect(consumed).toBeGreaterThan(0);
  });
});

describe('streamProgramAccounts', () => {
  const opts = { rpcUrl: 'http://rpc', programId: 'p', dataSize: 3 };
  it('parses accounts split across arbitrary chunk boundaries', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => streamResponse(body, 5)));
    const keys: string[] = [];
    const r = await streamProgramAccounts({ ...opts, onAccount: (k) => keys.push(k) });
    expect(keys).toEqual(['Key1111', 'Key2222']);
    expect(r.count).toBe(2);
  });
  it('throws on a truncated response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => streamResponse(body.slice(0, -20))));
    await expect(streamProgramAccounts({ ...opts, onAccount: () => {} })).rejects.toThrow(/truncated/);
  });
  it('throws on an RPC error body', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => streamResponse('{"jsonrpc":"2.0","error":{"code":-32010,"message":"excluded"},"id":1}')));
    await expect(streamProgramAccounts({ ...opts, onAccount: () => {} })).rejects.toThrow(/excluded/);
  });
  it('accepts an empty result', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => streamResponse('{"jsonrpc":"2.0","result":[],"id":1}')));
    await expect(streamProgramAccounts({ ...opts, onAccount: () => {} })).resolves.toMatchObject({ count: 0 });
  });
});

describe('getAccountsData', () => {
  it('batches keys and maps missing accounts to null', async () => {
    const calls: string[][] = [];
    vi.stubGlobal('fetch', vi.fn(async (_u: string, init: { body: string }) => {
      const keys: string[] = JSON.parse(init.body).params[0];
      calls.push(keys);
      return Response.json({ jsonrpc: '2.0', id: 1, result: { value: keys.map((k) => (k === 'gone' ? null : { data: ['AQ==', 'base64'] })) } });
    }));
    const r = await getAccountsData('http://rpc', ['a', 'b', 'gone'], { batch: 2 });
    expect(calls).toEqual([['a', 'b'], ['gone']]);
    expect([...r.get('a')!]).toEqual([1]);
    expect(r.get('gone')).toBeNull();
  });
});

describe('withRetry', () => {
  it('retries then succeeds', async () => {
    let n = 0;
    await expect(withRetry(async () => (++n < 3 ? Promise.reject(new Error('x')) : 'ok'), { baseMs: 1 })).resolves.toBe('ok');
    expect(n).toBe(3);
  });
  it('gives up after the last attempt', async () => {
    await expect(withRetry(async () => Promise.reject(new Error('boom')), { attempts: 2, baseMs: 1 })).rejects.toThrow('boom');
  });
});

describe('streamPartitioned', () => {
  const bodyFor = (keys: string[]) => `{"jsonrpc":"2.0","result":[${keys.map((k) => realAcct(k, 'AQID')).join(',')}],"id":1}`;
  const partitionByte = (init: { body: string }) => {
    const filters = JSON.parse(init.body).params[1].filters as { memcmp?: { offset: number; bytes: string } }[];
    return filters.find((f) => f.memcmp?.offset === 40)!.memcmp!.bytes;
  };
  it('merges every partition and adds the partition filter to existing filters', async () => {
    const byPart: Record<string, string[]> = { '1': ['A1111'], '2': ['B2222', 'C3333'], '3': [] };
    vi.stubGlobal('fetch', vi.fn(async (_u: string, init: { body: string }) => streamResponse(bodyFor(byPart[partitionByte(init)]))));
    const keys: string[] = [];
    const r = await streamPartitioned({ rpcUrl: 'http://rpc', programId: 'p', dataSize: 3, partitionOffset: 40, partitions: [0, 1, 2], onAccount: (k) => keys.push(k) });
    expect(keys.sort()).toEqual(['A1111', 'B2222', 'C3333']);
    expect(r.count).toBe(3);
  });
  it('retries a failed partition without delivering its accounts twice', async () => {
    let calls = 0;
    vi.stubGlobal('fetch', vi.fn(async () => (++calls === 1 ? streamResponse(bodyFor(['A1111']).slice(0, -30)) : streamResponse(bodyFor(['A1111'])))));
    const keys: string[] = [];
    await streamPartitioned({ rpcUrl: 'http://rpc', programId: 'p', dataSize: 3, partitionOffset: 40, partitions: [0], retryBaseMs: 1, onAccount: (k) => keys.push(k) });
    expect(keys).toEqual(['A1111']);
    expect(calls).toBe(2);
  });
});
