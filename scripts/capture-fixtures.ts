import { mkdirSync, writeFileSync } from 'node:fs';
import BN from 'bn.js';
import { Connection, PublicKey } from '@solana/web3.js';
import { DynamicBondingCurveClient } from '@meteora-ag/dynamic-bonding-curve-sdk';

const RPC = process.env.RPC_URL ?? 'https://api.mainnet-beta.solana.com';
const conn = new Connection(RPC, 'confirmed');
const client = new DynamicBondingCurveClient(conn, 'confirmed');
type Decoder = { coder: { accounts: { decode(name: string, data: Buffer): Record<string, unknown> } } };
const program = (client.state as unknown as { program?: Decoder }).program ?? (client as unknown as { program: Decoder }).program;

function decodeAs(names: string[], data: Buffer): Record<string, unknown> {
  for (const name of names) {
    try {
      return program.coder.accounts.decode(name, data);
    } catch {
      continue;
    }
  }
  throw new Error(`account matches none of ${names.join(', ')}`);
}

const toJson = (v: unknown): unknown => {
  if (v === null || v === undefined) return v;
  if (v instanceof PublicKey) return v.toBase58();
  if (BN.isBN(v)) return (v as BN).toString();
  if (Array.isArray(v)) return v.map(toJson);
  if (typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, toJson(x)]));
  return v;
};

mkdirSync('test/fixtures', { recursive: true });
for (const arg of process.argv.slice(2)) {
  const [name, address] = arg.split('=');
  const pool = await conn.getAccountInfo(new PublicKey(address));
  if (!pool) throw new Error(`pool not found: ${address}`);
  const decodedPool = decodeAs(['virtualPool', 'transferHookPool'], pool.data);
  const flatPool = (decodedPool.poolState ?? decodedPool) as Record<string, unknown>;
  const configKey = flatPool.config as PublicKey;
  const config = await conn.getAccountInfo(configKey);
  if (!config) throw new Error(`config not found: ${configKey.toBase58()}`);
  const rawConfig = decodeAs(['poolConfig', 'configWithTransferHook'], config.data);
  const decodedConfig = (rawConfig.transferHookProgram ? rawConfig.config : rawConfig) as Record<string, unknown>;
  writeFileSync(`test/fixtures/${name}.pool.bin`, pool.data);
  writeFileSync(`test/fixtures/${name}.pool.json`, JSON.stringify(toJson(flatPool), null, 1));
  writeFileSync(`test/fixtures/${name}.config.bin`, config.data);
  writeFileSync(`test/fixtures/${name}.config.json`, JSON.stringify(toJson(decodedConfig), null, 1));
  console.log(`${name}: pool ${address} config ${configKey.toBase58()}`);
}
