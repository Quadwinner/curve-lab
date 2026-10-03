'use client';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useState } from 'react';
import type { ConfigParameters } from '@meteora-ag/dynamic-bonding-curve-sdk';
import { buildCreateConfigTx } from '@/lib/designer/createConfig';

export function CreateConfigButton({ config }: { config: ConfigParameters }) {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const [state, setState] = useState<{ busy: boolean; msg?: string; link?: string }>({ busy: false });
  if (!publicKey) return <WalletMultiButton />;
  const create = async () => {
    setState({ busy: true });
    try {
      const { tx, configKeypair } = await buildCreateConfigTx(connection, config, publicKey);
      const sig = await sendTransaction(tx, connection, { signers: [configKeypair] });
      await connection.confirmTransaction(sig, 'confirmed');
      setState({ busy: false, msg: `Config ${configKeypair.publicKey.toBase58()} created on devnet.`, link: `https://explorer.solana.com/address/${configKeypair.publicKey.toBase58()}?cluster=devnet` });
    } catch (e) {
      setState({ busy: false, msg: (e as Error).message });
    }
  };
  return (
    <div className="space-y-2">
      <button type="button" disabled={state.busy} onClick={create} className="rounded border border-phosphor/70 bg-phosphor/15 px-3 py-1.5 font-mono text-sm text-ink transition-colors hover:bg-phosphor/25 disabled:opacity-50">
        {state.busy ? 'Creating…' : 'Create config on devnet'}
      </button>
      {state.msg && <p className="text-sm text-ink-2">{state.msg} {state.link && <a className="underline" href={state.link} target="_blank" rel="noreferrer">View</a>}</p>}
    </div>
  );
}
