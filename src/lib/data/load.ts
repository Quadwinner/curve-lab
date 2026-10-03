import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Feature, Meta, PresetDetail, PresetSummary } from './types';

const TTL_MS = 5 * 60_000;
const memo = new Map<string, { at: number; value: unknown }>();

async function fetchData<T>(path: string): Promise<T | null> {
  try {
    if (process.env.DATA_DIR) return JSON.parse(await readFile(join(process.env.DATA_DIR, path), 'utf8')) as T;
    const base = process.env.DATA_BASE_URL;
    if (!base) return null;
    const res = await fetch(`${base}/${path}`, { cache: 'no-store', signal: AbortSignal.timeout(20_000) });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

async function readData<T>(path: string): Promise<T | null> {
  const hit = memo.get(path);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value as T;
  const value = await fetchData<T>(path);
  if (value !== null) memo.set(path, { at: Date.now(), value });
  return value ?? ((hit?.value as T) ?? null);
}

export const loadMeta = () => readData<Meta>('meta.json');
export const loadPresets = () => readData<PresetSummary[]>('presets.json');
export const loadFeatures = () => readData<Feature[]>('features.json');
export const loadPreset = (id: string) => (/^[0-9a-f]{16}$/.test(id) ? readData<PresetDetail>(`preset/${id}.json`) : Promise.resolve(null));
