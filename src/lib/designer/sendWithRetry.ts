import type { Connection } from '@solana/web3.js';

type Conn = Pick<Connection, 'sendRawTransaction' | 'getSignatureStatuses' | 'getBlockHeight'>;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Devnet drops transactions and rate-limits RPC calls; rebroadcast until confirmed, and treat RPC errors as transient.
export async function sendWithRetry(conn: Conn, raw: Uint8Array, lastValidBlockHeight: number, opts: { intervalMs?: number } = {}): Promise<string> {
  const interval = opts.intervalMs ?? 2000;
  let signature: string | null = null;

  const landed = async (): Promise<boolean> => {
    if (!signature) return false;
    let status;
    try {
      status = (await conn.getSignatureStatuses([signature], { searchTransactionHistory: true })).value[0];
    } catch {
      return false;
    }
    if (status?.err) throw new Error(`transaction failed on-chain: ${JSON.stringify(status.err)}`);
    return status?.confirmationStatus === 'confirmed' || status?.confirmationStatus === 'finalized';
  };

  for (;;) {
    try {
      signature = await conn.sendRawTransaction(raw, { skipPreflight: true, maxRetries: 0 });
    } catch {
      // keep the last signature; the next loop rebroadcasts
    }
    if (await landed()) return signature!;
    let height: number | null = null;
    try {
      height = await conn.getBlockHeight('confirmed');
    } catch {
      height = null;
    }
    if (height !== null && height > lastValidBlockHeight) {
      if (await landed()) return signature!;
      throw new Error(`transaction ${signature ?? ''} expired before it landed; please try again`);
    }
    await sleep(interval);
  }
}
