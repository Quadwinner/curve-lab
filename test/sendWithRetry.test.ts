import { describe, expect, it } from 'vitest';
import { sendWithRetry } from '@/lib/designer/sendWithRetry';

function fakeConnection(opts: { confirmAfterSends?: number; err?: unknown; heights: number[] }) {
  let sends = 0;
  let h = 0;
  return {
    sends: () => sends,
    conn: {
      sendRawTransaction: async () => {
        sends++;
        return 'SIG';
      },
      getSignatureStatuses: async () => ({
        value: [opts.confirmAfterSends !== undefined && sends >= opts.confirmAfterSends ? { confirmationStatus: 'confirmed', err: opts.err ?? null } : null],
      }),
      getBlockHeight: async () => opts.heights[Math.min(h++, opts.heights.length - 1)],
    },
  };
}

describe('sendWithRetry', () => {
  it('resends until the transaction is confirmed', async () => {
    const f = fakeConnection({ confirmAfterSends: 3, heights: [100] });
    await expect(sendWithRetry(f.conn as never, new Uint8Array([1]), 200, { intervalMs: 1 })).resolves.toBe('SIG');
    expect(f.sends()).toBe(3);
  });
  it('fails with a clear message when the blockhash expires', async () => {
    const f = fakeConnection({ heights: [150, 199, 201] });
    await expect(sendWithRetry(f.conn as never, new Uint8Array([1]), 200, { intervalMs: 1 })).rejects.toThrow(/expired/);
  });
  it('surfaces an on-chain error', async () => {
    const f = fakeConnection({ confirmAfterSends: 1, err: { InstructionError: [0, 'Custom'] }, heights: [100] });
    await expect(sendWithRetry(f.conn as never, new Uint8Array([1]), 200, { intervalMs: 1 })).rejects.toThrow(/InstructionError/);
  });
});
