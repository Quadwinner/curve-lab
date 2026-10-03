import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, sendAndConfirmTransaction } from '@solana/web3.js';
import { buildDesign, DEFAULT_FORM } from '../src/lib/designer/build';
import { buildCreateConfigTx, DEVNET_RPC } from '../src/lib/designer/createConfig';
import { rpcCall } from '../src/lib/rpc/http';

const conn = new Connection(DEVNET_RPC, 'confirmed');
const design = buildDesign(DEFAULT_FORM);
if (!design.ok) throw new Error(design.error);

if (process.argv.includes('--simulate')) {
  // The faucet is often rate-limited; simulating with a funded payer still runs every on-chain check of the DBC program.
  const slot = await conn.getSlot('confirmed');
  const block = await rpcCall<{ transactions: { transaction: { accountKeys: { pubkey: string; signer: boolean }[] } }[] }>(DEVNET_RPC, 'getBlock', [
    slot - 5,
    { encoding: 'json', maxSupportedTransactionVersion: 1, transactionDetails: 'accounts', rewards: false },
  ]);
  const signers = [...new Set(block.transactions.flatMap((t) => t.transaction.accountKeys.filter((k) => k.signer).map((k) => k.pubkey)))].slice(0, 40);
  const infos = await conn.getMultipleAccountsInfo(signers.map((s) => new PublicKey(s)));
  const idx = infos.findIndex((a) => a && a.owner.equals(new PublicKey('11111111111111111111111111111111')) && a.data.length === 0 && a.lamports > 0.1 * LAMPORTS_PER_SOL);
  if (idx < 0) throw new Error('no funded system account found in a recent block');
  const payer = new PublicKey(signers[idx]);
  const { tx, configKeypair } = await buildCreateConfigTx(conn, design.config, payer);
  tx.partialSign(configKeypair);
  const sim = await conn.simulateTransaction(tx.compileMessage(), undefined);
  console.log(`simulated createConfig with payer ${payer.toBase58()}: ${sim.value.err ? `FAILED ${JSON.stringify(sim.value.err)}` : 'OK'}`);
  console.log((sim.value.logs ?? []).filter((l) => /dbcij3|invoke|success|failed|Error/.test(l)).join('\n'));
  process.exit(sim.value.err ? 1 : 0);
}

const payer = Keypair.generate();
const sig = await conn.requestAirdrop(payer.publicKey, LAMPORTS_PER_SOL);
await conn.confirmTransaction(sig, 'confirmed');
const { tx, configKeypair } = await buildCreateConfigTx(conn, design.config, payer.publicKey);
const done = await sendAndConfirmTransaction(conn, tx, [payer, configKeypair]);
console.log(`config ${configKeypair.publicKey.toBase58()} created: https://explorer.solana.com/tx/${done}?cluster=devnet`);
