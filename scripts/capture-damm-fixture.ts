import { writeFileSync } from 'node:fs';
import BN from 'bn.js';
import { Connection, PublicKey } from '@solana/web3.js';
import { createDammV2Program } from '@meteora-ag/dynamic-bonding-curve-sdk';

const RPC = process.env.RPC_URL ?? 'https://api.mainnet-beta.solana.com';
const [name, address] = (process.argv[2] ?? '').split('=');
if (!name || !address) throw new Error('usage: capture-damm-fixture <name>=<damm v2 pool>');
const conn = new Connection(RPC, 'confirmed');
type Decoder = { coder: { accounts: { decode(name: string, data: Buffer): Record<string, unknown> } } };
const created = createDammV2Program(conn) as unknown as { program?: Decoder } & Decoder;
const program = created.program ?? created;

const toJson = (v: unknown): unknown => {
  if (v === null || v === undefined) return v;
  if (v instanceof PublicKey) return v.toBase58();
  if (BN.isBN(v)) return (v as BN).toString();
  if (Array.isArray(v)) return v.map(toJson);
  if (typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, toJson(x)]));
  return v;
};

const acc = await conn.getAccountInfo(new PublicKey(address));
if (!acc) throw new Error(`account not found: ${address}`);
writeFileSync(`test/fixtures/${name}.damm.bin`, acc.data);
writeFileSync(`test/fixtures/${name}.damm.json`, JSON.stringify(toJson(program.coder.accounts.decode('pool', acc.data)), null, 1));
console.log(`${name}: damm v2 pool ${address} (${acc.data.length} bytes)`);
