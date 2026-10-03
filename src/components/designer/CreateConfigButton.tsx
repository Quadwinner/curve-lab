'use client';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { useEffect, useState } from 'react';
import type { ConfigParameters } from '@meteora-ag/dynamic-bonding-curve-sdk';
import { buildCreateConfigTx, MIN_DEVNET_SOL } from '@/lib/designer/createConfig';
import { sendWithRetry } from '@/lib/designer/sendWithRetry';
import { shortAddr } from '@/lib/format';

type State = { busy: boolean; step?: string; error?: string; config?: string; signature?: string };

export function CreateConfigButton({ config }: { config: ConfigParameters }) {
  const { connection } = useConnection();
  const { publicKey, signTransaction, sendTransaction } = useWallet();
  const [balance, setBalance] = useState<number | null>(null);
  const [state, setState] = useState<State>({ busy: false });

  useEffect(() => {
    if (!publicKey) return;
    let live = true;
    const load = () => connection.getBalance(publicKey).then((b) => live && setBalance(b / LAMPORTS_PER_SOL)).catch(() => live && setBalance(null));
    load();
    const id = setInterval(load, 15_000);
    return () => {
      live = false;
      clearInterval(id);
    };
  }, [publicKey, connection, state.signature]);

  if (!publicKey) return <WalletMultiButton />;
  const lowBalance = balance !== null && balance < MIN_DEVNET_SOL;

  const create = async () => {
    setState({ busy: true, step: 'building transaction' });
    try {
      const { tx, configKeypair, lastValidBlockHeight } = await buildCreateConfigTx(connection, config, publicKey);
      tx.partialSign(configKeypair);
      let signature: string;
      if (signTransaction) {
        setState({ busy: true, step: 'waiting for your wallet' });
        const signed = await signTransaction(tx);
        setState({ busy: true, step: 'sending to devnet' });
        signature = await sendWithRetry(connection, signed.serialize(), lastValidBlockHeight);
      } else {
        signature = await sendTransaction(tx, connection, { signers: [configKeypair] });
        await connection.confirmTransaction({ signature, blockhash: tx.recentBlockhash!, lastValidBlockHeight }, 'confirmed');
      }
      setState({ busy: false, config: configKeypair.publicKey.toBase58(), signature });
    } catch (e) {
      setState({ busy: false, error: (e as Error).message });
    }
  };

  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap items-center gap-3">
        <WalletMultiButton />
        <span className="font-mono text-xs text-ink-3">
          {shortAddr(publicKey.toBase58())} · {balance === null ? '…' : `${balance.toFixed(3)} devnet SOL`}
        </span>
      </div>
      {lowBalance ? (
        <p className="text-warn-text">
          This wallet needs a little devnet SOL (≥ {MIN_DEVNET_SOL}). Get some free at{' '}
          <a className="underline" href="https://faucet.solana.com" target="_blank" rel="noreferrer">faucet.solana.com</a> (select devnet), then try again.
        </p>
      ) : (
        <button
          type="button"
          disabled={state.busy}
          onClick={create}
          className="rounded border border-phosphor/70 bg-phosphor/15 px-3 py-1.5 font-mono text-sm text-ink transition-colors hover:bg-phosphor/25 disabled:opacity-50"
        >
          {state.busy ? `${state.step}…` : 'Create config on devnet'}
        </button>
      )}
      {state.config && (
        <p className="text-ink-2">
          Created config <span className="readout text-ink">{state.config}</span> on devnet.{' '}
          <a className="text-accent-text underline" href={`https://explorer.solana.com/address/${state.config}?cluster=devnet`} target="_blank" rel="noreferrer">View config</a>
          {' · '}
          <a className="text-accent-text underline" href={`https://explorer.solana.com/tx/${state.signature}?cluster=devnet`} target="_blank" rel="noreferrer">View transaction</a>
        </p>
      )}
      {state.error && <p role="alert" className="text-warn-text">{state.error}</p>}
    </div>
  );
}
