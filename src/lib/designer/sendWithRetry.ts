import type { Connection } from '@solana/web3.js';

type Conn = Pick<Connection, 'sendRawTransaction' | 'getSignatureStatuses' | 'getBlockHeight'>;

// Devnet drops transactions under load; rebroadcast until confirmed or the blockhash can no longer land.
export async function sendWithRetry(conn: Conn, raw: Uint8Array, lastValidBlockHeight: number, opts: { intervalMs?: number } = {}): Promise<string> {
  const interval = opts.intervalMs ?? 2000;
  let signature = '';
  for (;;) {
    signature = await conn.sendRawTransaction(raw, { skipPreflight: true, maxRetries: 0 });
    const status = (await conn.getSignatureStatuses([signature])).value[0];
    if (status?.err) throw new Error(`transaction failed on-chain: ${JSON.stringify(status.err)}`);
    if (status && (status.confirmationStatus === 'confirmed' || status.confirmationStatus === 'finalized')) return signature;
    if ((await conn.getBlockHeight('confirmed')) > lastValidBlockHeight) throw new Error(`transaction ${signature} expired before it landed; please try again`);
    await new Promise((r) => setTimeout(r, interval));
  }
}
