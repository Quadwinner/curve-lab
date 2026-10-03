import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { parseArgs } from 'node:util';
import { buildDetail, buildFeature, buildSummary, sanityCheck } from '../src/indexer/build';
import { configEntryFromBody, loadConfigCache, saveConfigCache, type ConfigEntry } from '../src/indexer/cache';
import { resolveQuotes } from '../src/indexer/quotes';
import { decodeConfigParams } from '../src/lib/dbc/config';
import { CONFIG_SIZE, CONFIG_SLICE, DBC_PROGRAM_ID, POOL_SIZE, POOL_SLICE } from '../src/lib/dbc/layout';
import { decodePoolSlice, type PoolRow } from '../src/lib/dbc/pool';
import type { Meta, PresetSummary } from '../src/lib/data/types';
import { aggregate } from '../src/lib/metrics/aggregate';
import { classify } from '../src/lib/metrics/classify';
import { PoolTable } from '../src/lib/metrics/table';
import { getAccountsData } from '../src/lib/rpc/accounts';
import { getRefClock } from '../src/lib/rpc/clock';
import { streamPartitioned } from '../src/lib/rpc/gpaStream';
import { withRetry } from '../src/lib/rpc/http';
import { anchorSlots, fetchBlockTimes, SlotTimeline, type Anchor } from '../src/lib/rpc/slotTimeline';

const { values } = parseArgs({
  options: {
    out: { type: 'string', default: 'data-out' },
    cache: { type: 'string', default: '.cache/configs.tsv.gz' },
    rpc: { type: 'string' },
    'min-summary': { type: 'string', default: '5' },
    'min-detail': { type: 'string', default: '20' },
    'pool-partitions': { type: 'string' },
  },
});
const rpc = values.rpc ?? process.env.RPC_URL ?? 'https://api.mainnet-beta.solana.com';
const minSummary = Number(values['min-summary']);
const minDetail = Number(values['min-detail']);
const poolPartitions = values['pool-partitions'] ? Array.from({ length: Number(values['pool-partitions']) }, (_, i) => i) : undefined;
const partial = poolPartitions !== undefined;
const log = (msg: string) => console.log(`[indexer ${new Date().toISOString()}] ${msg}`);

const refClock = await withRetry(() => getRefClock(rpc), { label: 'clock' });
log(`clock slot=${refClock.refSlot} time=${refClock.refTime}`);

const ANCHOR_FROM_SLOT = 320_000_000;
const ANCHOR_STEP = 10_000;
const anchorsPath = join(dirname(values.cache!), 'slot-anchors.json');
const anchors: Anchor[] = existsSync(anchorsPath) ? JSON.parse(readFileSync(anchorsPath, 'utf8')) : [];
const anchored = new Set(anchors.map((a) => a.target));
const missingAnchors = anchorSlots(ANCHOR_FROM_SLOT, refClock.refSlot, ANCHOR_STEP).filter((t) => t < refClock.refSlot - 1000 && !anchored.has(t));
if (missingAnchors.length) {
  anchors.push(...(await fetchBlockTimes(rpc, missingAnchors)));
  mkdirSync(dirname(anchorsPath), { recursive: true });
  writeFileSync(anchorsPath, JSON.stringify(anchors));
  log(`slot anchors: ${anchors.length} (${missingAnchors.length} requested)`);
}
const timeline = new SlotTimeline(anchors, refClock);
const clock = { ...refClock, slotTime: (slot: number) => timeline.timeAt(slot) };

const cache = await loadConfigCache(values.cache!);
log(`config cache: ${cache.size}`);
if (cache.size === 0 && !partial) {
  const r = await streamPartitioned({
    rpcUrl: rpc, programId: DBC_PROGRAM_ID, dataSize: CONFIG_SIZE, slice: CONFIG_SLICE, partitionOffset: 40, attempts: 8, allowFailures: true,
    onPartition: (d, n) => d % 32 === 0 && log(`config partitions ${d}/${n} (${cache.size} configs, heap ${(process.memoryUsage().heapUsed / 1e6).toFixed(0)} MB)`),
    onAccount: (k, d) => cache.set(k, configEntryFromBody(d)),
  });
  log(`configs streamed: ${r.count} (${(r.bytes / 1e6).toFixed(0)} MB)${r.failed.length ? `; ${r.failed.length} partitions skipped, their configs will be fetched per pool` : ''}`);
  await saveConfigCache(values.cache!, cache);
}

const presetIndex = new Map<string, number>();
const presets: ConfigEntry[] = [];
const configIndex = new Map<string, number>();
const configKeys: string[] = [];
const configClaimer: string[] = [];
const table = new PoolTable();
let skipped = 0;

function add(key: string, row: PoolRow, e: ConfigEntry) {
  let p = presetIndex.get(e.presetId);
  if (p === undefined) {
    p = presets.length;
    presetIndex.set(e.presetId, p);
    presets.push(e);
  }
  let c = configIndex.get(row.config);
  if (c === undefined) {
    c = configKeys.length;
    configIndex.set(row.config, c);
    configKeys.push(row.config);
    configClaimer.push(e.feeClaimer);
  }
  table.push(key, p, c, classify(row, e.threshold, e.activationType, clock), row);
}

const pending: { key: string; row: PoolRow }[] = [];
const pools = await streamPartitioned({
  rpcUrl: rpc, programId: DBC_PROGRAM_ID, dataSize: POOL_SIZE, slice: POOL_SLICE, partitionOffset: 136, partitions: poolPartitions, attempts: 10,
  onPartition: (d, n) => d % 32 === 0 && log(`pool partitions ${d}/${n} (${table.size} pools, heap ${(process.memoryUsage().heapUsed / 1e6).toFixed(0)} MB)`),
  onAccount: (k, d) => {
    const row = decodePoolSlice(d);
    const e = cache.get(row.config);
    if (e) add(k, row, e);
    else pending.push({ key: k, row: { ...row, baseMintBytes: Uint8Array.from(row.baseMintBytes) } });
  },
});
log(`pools streamed: ${pools.count} (${(pools.bytes / 1e6).toFixed(0)} MB) pending=${pending.length}`);

const missing = [...new Set(pending.map((p) => p.row.config))];
if (missing.length) {
  const fetched = await getAccountsData(rpc, missing, { slice: CONFIG_SLICE });
  for (const [k, d] of fetched) if (d) cache.set(k, configEntryFromBody(d));
  log(`fetched ${missing.length} new configs`);
}
for (const p of pending) {
  const e = cache.get(p.row.config);
  if (e) add(p.key, p.row, e);
  else skipped++;
}

const stats = aggregate(table, presets.length, (i) => configClaimer[i], { minLaunches: minSummary, nowSec: clock.refTime, weeks: 12, recent: 10 });
log(`presets: ${presets.length}, listed (>=${minSummary}): ${stats.length}`);

const repConfigs = stats.map((s) => configKeys[s.topConfig.index]);
const fullConfigs = await getAccountsData(rpc, repConfigs);
const quotes = await resolveQuotes(rpc, [...new Set(stats.map((s) => presets[s.index].quoteMint))]);

const summaries: PresetSummary[] = [];
const staging = `${values.out!}.next`;
rmSync(staging, { recursive: true, force: true });
mkdirSync(join(staging, 'preset'), { recursive: true });
let detailed = 0;
stats.forEach((s, i) => {
  const data = fullConfigs.get(repConfigs[i]);
  if (!data) {
    skipped++;
    return;
  }
  const params = decodeConfigParams(data.subarray(CONFIG_SLICE.offset));
  const id = presets[s.index].presetId;
  const summary = buildSummary(id, s, params, quotes.get(params.quoteMint)!);
  summaries.push(summary);
  if (s.launches >= minDetail) {
    const recent = s.recent.map((r) => ({ pool: table.keys[r], mint: table.mintAt(r), launchTime: Number.isNaN(table.launchTime[r]) ? null : table.launchTime[r], cls: table.clsAt(r), progress: table.progress[r] }));
    const detail = buildDetail(summary, s, params, { address: repConfigs[i], launches: s.topConfig.launches }, recent);
    writeFileSync(join(staging, 'preset', `${id}.json`), JSON.stringify(detail));
    detailed++;
  }
});

let organic = 0, instant = 0, open = 0;
for (let i = 0; i < table.size; i++) {
  const c = table.clsAt(i);
  if (c === 'organic') organic++;
  else if (c === 'instant') instant++;
  else open++;
}
const meta: Meta = {
  generatedAt: Math.floor(Date.now() / 1000),
  refSlot: clock.refSlot,
  refTime: clock.refTime,
  totals: { pools: table.size, configs: configKeys.length, presets: presets.length, listed: summaries.length, detailed, organic, instant, open },
  skipped,
  ...(partial ? { partial: true } : {}),
};

async function loadPrevMeta(): Promise<Meta | null> {
  if (process.env.PREV_META && existsSync(process.env.PREV_META)) return JSON.parse(readFileSync(process.env.PREV_META, 'utf8')) as Meta;
  if (!process.env.DATA_BASE_URL) return null;
  return (await fetch(`${process.env.DATA_BASE_URL}/meta.json`).then((r) => (r.ok ? r.json() : null)).catch(() => null)) as Meta | null;
}
if (!partial) {
  const problem = sanityCheck(await loadPrevMeta(), meta);
  if (problem) {
    console.error(`[indexer] sanity check failed: ${problem}; not publishing`);
    rmSync(staging, { recursive: true, force: true });
    process.exit(1);
  }
}

writeFileSync(join(staging, 'presets.json'), JSON.stringify(summaries));
writeFileSync(join(staging, 'features.json'), JSON.stringify(summaries.filter((s) => s.launches >= minDetail).map(buildFeature)));
writeFileSync(join(staging, 'meta.json'), JSON.stringify(meta, null, 1));
rmSync(values.out!, { recursive: true, force: true });
renameSync(staging, values.out!);
if (!partial) await saveConfigCache(values.cache!, cache);
log(`done: ${JSON.stringify(meta.totals)} skipped=${skipped}`);
