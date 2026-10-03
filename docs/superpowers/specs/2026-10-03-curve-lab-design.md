# Curve Lab — Design Spec

Date: 2026-10-03 · Author: Shubham (solo) · Deadline: 2026-10-12 23:59 PT (2026-10-13 12:29 IST)

## 1. Goal

Win prize money in the Colosseum Crypto World's Fair hackathon with one project submitted to:

| Where | Prize | Why it fits |
|---|---|---|
| Colosseum main (country: India) | $30k grand / 20 × $15k / Solana track 10 × $10k | Startup-grade tool for the largest Solana launch primitive |
| Superteam India track | $2.5k / $1.5k / $1k | India-based solo builder, Solana-only |
| Meteora DBC track | $10k / $5k / $3k / $1.5k / $500 | Hits Meteora's listed ideas: "novel curve or fee configurations", "developer tooling for launchpad builders", "config preset marketplace" |
| Solami track | $1.2k / $1k / $500 / $300 | Live mainnet app; Solami is the data path |

Constraints: solo, full-time, TypeScript/React + Rust, **zero budget** (no SOL, no paid services). Writes happen on devnet only; mainnet is read-only. Keep code clean enough to continue if it wins (Solana Foundation India grant afterwards).

## 2. Product in one line

Curve Lab ranks every Meteora Dynamic Bonding Curve launch setting by what actually happened to the tokens launched with it, and lets launchpad builders design new settings against that evidence.

## 3. Facts measured on mainnet (2026-10-03, public RPC)

- 1,732,788 DBC pools (launches); 533,435 `PoolConfig` accounts; 489,703 configs used at least once.
- 472,383 configs were used exactly once: many launchpads create one config per token. **Ranking raw config accounts is meaningless → we group configs by identical settings.**
- 54% of pools are migrated, but many partners show ~100% migration (instant / pre-bought graduations). **Raw graduation rate is misleading → we separate instant from organic graduations.**
- Full config fetch: ~8 min in 256 `memcmp` partitions. Full pool fetch (234-byte slice): ~100 s in one call.
- Public RPC `https://api.mainnet-beta.solana.com` served all of the above without a key.

## 4. Key definitions

- **Launch** = one `VirtualPool` account (424 bytes) of program `dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN`.
- **Preset (settings group)** = all `PoolConfig` accounts whose bytes are identical except `feeClaimer` (offset 40) and `leftoverReceiver` (offset 72). ID = first 16 hex chars of SHA-256 over the remaining bytes (Node `crypto`, no extra dependency).
- **Launch time** = `activationPoint` (offset 296). If the config's `activationType` = slot, convert with a reference `(slot, blockTime)` pair at 0.4 s/slot (labelled approximate).
- **Completed** = `finishCurveTimestamp` (offset 344) > 0, else `isMigrated` (offset 305) = 1.
- **Instant graduation** = completed within 60 s of launch time.
- **Organic graduation rate** = (completed − instant) / (launches − instant).
- **Raised** = `quoteReserve` (offset 240) in quote-token units.
- **Fees generated** = `metrics.totalTradingQuoteFee` (offset 336).
- **Drop-off buckets** for not-completed launches by `quoteReserve / migrationQuoteThreshold`: <1%, 1–10%, 10–25%, 25–50%, 50–75%, 75–100%.
- **Time to graduate** = median of (finishCurveTimestamp − launch time) over organic graduations.

## 5. Features (MVP)

1. **Leaderboard** (`/`): presets with ≥ 20 launches by default (filter can go down to 5). Columns: launches, organic graduation %, instant %, median time to graduate, total raised, fees generated, quote token, graduation threshold, base fee + fee mode, curve sparkline. Sort, filter by quote token / threshold range / min launches. Header totals + "data updated N min ago".
2. **Preset detail** (`/preset/[id]`): curve chart (price vs supply), fee schedule chart, LP/fee split table, launches-per-week chart, drop-off chart, top fee claimers (launchpads using it), representative config address (most launches) with copy button, last 10 launches with live curve progress (browser polls RPC).
3. **Designer** (`/designer`): build settings with the Meteora SDK (`buildCurveWithMarketCap`), live curve + fee charts, "similar real presets" panel (nearest neighbours with their outcomes), export as TypeScript snippet/JSON, **Create config on devnet** with a connected wallet.
4. **Live feed** (sidebar on every page): new DBC launches and graduations on mainnet as they happen, tagged with their preset, from Solami Blur.

Out of scope: trading/swaps, token-launch UI for end users, Panta, accounts/login, any mainnet write, paid tiers.

Stretch (only if ahead of plan): graduation-odds score for fresh launches; documented public JSON API.

## 6. Architecture

One repo, one `package.json` (Next.js app at root plus `scripts/`), shared code in `src/lib`. All TypeScript: there is no custom on-chain program, and bulk decoding by byte offset is fast enough in Node, so no Rust is needed.

```
            mainnet RPC (Solami if key set, else public)
                     │  getProgramAccounts (partitioned)
                     ▼
 GitHub Actions cron ─ scripts/indexer.ts ─► data branch (JSON) ─► raw.githubusercontent.com
   (every 6 h)        config cache in actions/cache                     │
                                                                        ▼
 Solami Blur WS ─► scripts/relay.ts (Render free) ─SSE─► Next.js app on Vercel ◄─ browser
                    (pool → config → preset lookup)          │ wallet → devnet createConfig
                                                             └ public RPC: live progress polls
```

### Units

- `src/lib/dbc/layout.ts` — byte offsets and decoders for `PoolConfig` and `VirtualPool` slices (no Anchor dependency for bulk decode).
- `src/lib/dbc/fingerprint.ts` — preset ID from config bytes.
- `src/lib/metrics/` — per-launch classification (instant/organic/not-completed + bucket) and per-preset aggregation (pure functions).
- `src/lib/rpc/gpa.ts` — partitioned `getProgramAccounts` with retry/backoff and streaming-safe sizes (each partition response stays well under V8's 512 MB string limit).
- `src/lib/curve/` — price/market-cap math (wraps SDK helpers), nearest-neighbour similarity.
- `scripts/indexer.ts` — fetch → decode → classify → aggregate → write `data/` JSON. Config cache: configs are immutable, so only unseen config pubkeys are fetched after the first run (cache file in `actions/cache`).
- `scripts/relay.ts` — one outbound Solami Blur WebSocket (`type=token_create,graduation`, `dex=meteora_dbc`), resolves pool → config (RPC `getAccountInfo`) → preset ID (fingerprint computed on the fly), fans out over Server-Sent Events. Keeps the last 50 events in memory for new clients.
- `app/` — Next.js App Router pages; data fetched from the data branch with 5-minute revalidation.

### Data files (data branch, force-pushed orphan commit each run)

- `meta.json` — generatedAt, slot, totals, reference slot/time.
- `presets.json` — every preset with ≥ 5 launches: summary metrics + feature vector for similarity + sparkline points.
- `preset/<id>.json` — presets with ≥ 20 launches: full curve points, fee params, LP split, weekly series, drop-off buckets, top fee claimers, representative config, last 10 launches.

### Hosting (all free tiers)

Vercel (web), GitHub Actions + data branch (indexer + data), Render free web service (relay; sleeps when idle, wakes on first request). If the relay is asleep or down, the live feed shows "connecting…" and the rest of the site works.

## 7. Solami usage

- Blur WebSocket stream drives the live feed and attributes each new launch/graduation to a preset (core feature).
- Indexer uses Solami RPC when `SOLAMI_RPC_URL` is set (falls back to public RPC).
- README explains how to point the app at your own Solami key.
- Solami Pro free trial (7 days via the hackathon signup link) activated on 2026-10-06 so it covers submission. If the trial does not include Blur bandwidth, fall back to Mirage or RPC `logsSubscribe` through Solami and note it.

## 8. Error handling

- Indexer: retry each partition up to 6 times with backoff; if any partition still fails, abort without publishing (never publish partial aggregates). Sanity check: pool count must be ≥ 95% of the previous run's count, otherwise abort.
- Unknown/new account versions: decode by offset; if a field is out of range (e.g. `activationType` > 1), skip the account and count it in `meta.json.skipped`.
- Web: if data fetch fails, show the last cached page (ISR) and a stale-data banner when `generatedAt` is older than 12 h.
- Relay: reconnect with exponential backoff (1 s → 60 s); heartbeat comment every 15 s on SSE.
- Designer: validate inputs with the SDK's `validateCurve` before enabling "Create on devnet"; show RPC/wallet errors verbatim.

## 9. Testing

- Vitest unit tests for decoders (fixtures = real mainnet account bytes captured once into `test/fixtures`), fingerprinting, classification, aggregation, similarity.
- Indexer dry run against a small partition set (`--partitions 0-3`) in CI.
- Manual check script comparing 5 random pools against the Meteora SDK's decoded state.
- Before submission: full indexer run, Lighthouse pass on `/`, devnet config creation end to end.

## 10. Submission deliverables

Public GitHub repo with README (setup, env vars, Solami key), deployed site, 2–3 min demo video against live mainnet data, pitch deck/Loom, X post. Submit to Colosseum first (country: India), then Superteam Earn: India track, Meteora DBC track, Solami track. Apply for the $200 Agentic Engineering grant now.

## 11. Accounts the user must create (cannot be automated)

GitHub (repo + Actions), Vercel, Render, Solami (on 2026-10-06), Colosseum registration, a devnet wallet (Phantom/Solflare/Backpack).
