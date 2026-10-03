import { ComputeBudgetProgram, Keypair, PublicKey, type Connection, type Transaction } from '@solana/web3.js';
import { DynamicBondingCurveClient, type ConfigParameters } from '@meteora-ag/dynamic-bonding-curve-sdk';

export const DEVNET_RPC = process.env.NEXT_PUBLIC_DEVNET_RPC_URL ?? 'https://api.devnet.solana.com';
export const MIN_DEVNET_SOL = 0.01;
const WSOL = new PublicKey('So11111111111111111111111111111111111111112');

export async function buildCreateConfigTx(
  connection: Connection,
  config: ConfigParameters,
  owner: PublicKey,
): Promise<{ tx: Transaction; configKeypair: Keypair; lastValidBlockHeight: number }> {
  const client = new DynamicBondingCurveClient(connection, 'confirmed');
  const configKeypair = Keypair.generate();
  const tx = await client.partner.createConfig({ ...config, config: configKeypair.publicKey, feeClaimer: owner, leftoverReceiver: owner, quoteMint: WSOL, payer: owner });
  if (!tx.instructions.some((ix) => ix.programId.equals(ComputeBudgetProgram.programId))) {
    tx.instructions.unshift(ComputeBudgetProgram.setComputeUnitLimit({ units: 80_000 }), ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 100_000 }));
  }
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
  tx.feePayer = owner;
  tx.recentBlockhash = blockhash;
  return { tx, configKeypair, lastValidBlockHeight };
}
