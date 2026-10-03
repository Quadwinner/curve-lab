import { Keypair, PublicKey, type Connection, type Transaction } from '@solana/web3.js';
import { DynamicBondingCurveClient, type ConfigParameters } from '@meteora-ag/dynamic-bonding-curve-sdk';

export const DEVNET_RPC = process.env.NEXT_PUBLIC_DEVNET_RPC_URL ?? 'https://api.devnet.solana.com';
const WSOL = new PublicKey('So11111111111111111111111111111111111111112');

export async function buildCreateConfigTx(connection: Connection, config: ConfigParameters, owner: PublicKey): Promise<{ tx: Transaction; configKeypair: Keypair }> {
  const client = new DynamicBondingCurveClient(connection, 'confirmed');
  const configKeypair = Keypair.generate();
  const tx = await client.partner.createConfig({ ...config, config: configKeypair.publicKey, feeClaimer: owner, leftoverReceiver: owner, quoteMint: WSOL, payer: owner });
  tx.feePayer = owner;
  tx.recentBlockhash = (await connection.getLatestBlockhash('confirmed')).blockhash;
  return { tx, configKeypair };
}
