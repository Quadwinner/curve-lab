import { createReadStream, createWriteStream, existsSync, mkdirSync, renameSync } from 'node:fs';
import { dirname } from 'node:path';
import { createInterface } from 'node:readline';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { createGunzip, createGzip } from 'node:zlib';
import { decodeConfigHeader } from '../lib/dbc/config';
import { presetIdOf } from '../lib/dbc/presetId';

export interface ConfigEntry {
  presetId: string;
  feeClaimer: string;
  threshold: bigint;
  activationType: number;
  quoteMint: string;
}

export function configEntryFromBody(body: Uint8Array): ConfigEntry {
  const h = decodeConfigHeader(body);
  return { presetId: presetIdOf(body), feeClaimer: h.feeClaimer, threshold: h.migrationQuoteThreshold, activationType: h.activationType, quoteMint: h.quoteMint };
}

export async function loadConfigCache(path: string): Promise<Map<string, ConfigEntry>> {
  const out = new Map<string, ConfigEntry>();
  if (!existsSync(path)) return out;
  try {
    const lines = createInterface({ input: createReadStream(path).pipe(createGunzip()), crlfDelay: Infinity });
    for await (const line of lines) {
      const [key, presetId, feeClaimer, threshold, activationType, quoteMint] = line.split('\t');
      if (quoteMint) out.set(key, { presetId, feeClaimer, threshold: BigInt(threshold), activationType: Number(activationType), quoteMint });
    }
  } catch (e) {
    console.warn(`[cache] ignoring unreadable config cache ${path}: ${(e as Error).message}`);
    return new Map();
  }
  return out;
}

export async function saveConfigCache(path: string, map: Map<string, ConfigEntry>): Promise<void> {
  mkdirSync(dirname(path), { recursive: true });
  async function* rows() {
    for (const [k, e] of map) yield `${k}\t${e.presetId}\t${e.feeClaimer}\t${e.threshold}\t${e.activationType}\t${e.quoteMint}\n`;
  }
  const tmp = `${path}.tmp`;
  await pipeline(Readable.from(rows()), createGzip(), createWriteStream(tmp));
  renameSync(tmp, path);
}
