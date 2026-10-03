# Curve Lab

**Which Meteora launch settings actually work?**

Curve Lab ranks every [Meteora Dynamic Bonding Curve](https://docs.meteora.ag/developer-guides/dbc) launch setting on Solana mainnet by what happened to the tokens launched with it. It then lets launchpad builders design new settings against that evidence and create them on devnet in one click.

Built solo for the [Colosseum Crypto World's Fair](https://colosseum.com/worldsfair) hackathon (Meteora DBC, Solami and Superteam India tracks).

## Why it exists

- **There is no "launchpad" unit in the data.** DBC has 1.7M+ launches on mainnet, but launchpads usually create a new config account for every token (most of the 530k+ configs are used once). Curve Lab groups configs whose settings are **byte-identical** (curve, fees, thresholds, LP split, vesting), ignoring only who claims the fees. Each group is a real, comparable launch setting.
- **Raw graduation counts lie.** A large share of curves complete within seconds because they are bought out in the creation transaction. Curve Lab separates these **instant** graduations from **organic** ones, so the graduation rate reflects real demand.

## What you can do

| Page | What it shows |
|---|---|
| **Leaderboard** `/` | Every setting group with ≥ 5 launches: launches, organic graduation rate, instant share, median time to graduate, total raised, trading fees, curve shape. Sort and filter by quote token. |
| **Setting group** `/preset/[id]` | Price-vs-raised curve, fee schedule, where launches stall on the curve, launches per week, launchpads (fee claimers) using it, the most-used config address to reuse, and the latest launches with live curve progress from mainnet. |
| **Designer** `/designer` | Build a curve with the Meteora SDK, see the closest real settings and how they performed, export the TypeScript, and create the config on devnet with your wallet. |
| **Live feed** (sidebar) | New DBC launches and graduations on mainnet as they happen, tagged with their setting group, streamed through [Solami](https://solami.dev) Blur. |

## How the numbers are computed

| Term | Definition |
|---|---|
| Launch | One DBC pool account (`VirtualPool` or `TransferHookPool`, 424 bytes) of program `dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN`. |
| Setting group | Config accounts whose bytes are identical except `feeClaimer` and `leftoverReceiver`. Id = first 16 hex chars of SHA-256 of those bytes. |
| Launch time | `activationPoint`. For slot-activated configs it is converted with real block times sampled every 10,000 slots (measured error ≤ 18 s). |
| Completed | `finishCurveTimestamp > 0` or `isMigrated`. |
| Instant | Completed within 60 s of launch time. |
| Organic graduation rate | (completed − instant) ÷ (launches − instant), shown when a group has ≥ 5 non-instant launches. |
| Raised / fees | `quoteReserve` and `metrics.totalTradingQuoteFee`, summed per group in quote-token units. |

## Architecture

```
mainnet RPC ──getProgramAccounts (256 memcmp partitions, streamed)──► scripts/indexer.ts ──► data/*.json ──► `data` git branch
                                                                                                      │
Solami Blur WebSocket ──► scripts/relay.ts (pool → config → setting group) ──SSE──► Next.js app ◄────┘
                                                                                       │
                                                         browser wallet ──createConfig──► devnet
```

- **Indexer** (`scripts/indexer.ts`): streams all pools and configs in 256 `memcmp` partitions (single responses of several hundred MB stall on public RPC), decodes accounts by byte offset (verified against the Meteora SDK with mainnet fixtures), classifies every launch, and aggregates per setting group. Configs are immutable, so they are cached (`.cache/configs.tsv.gz`) together with the block-time anchors (`.cache/slot-anchors.json`).
- **Relay** (`scripts/relay.ts`): one upstream Solami Blur connection (`token_create`, `graduation`), resolves each new pool to its setting group over RPC, and fans events out to browsers as Server-Sent Events.
- **Web** (Next.js 16 App Router): reads the JSON from the `data` branch. Live curve progress goes through `/api/progress` because public RPC rejects browser requests.

## Run it locally

Requires Node 24.

```bash
npm install
npm test

# index a small slice of mainnet (1 of 256 partitions, ~10k launches)
npm run indexer -- --pool-partitions 1 --min-summary 2 --min-detail 3

# full index (~30–60 min on public RPC the first time; cached afterwards)
npm run indexer

# web app on the local data
DATA_DIR=data-out npm run dev

# live feed relay (mock events without a key)
npm run relay
NEXT_PUBLIC_RELAY_URL=http://localhost:8787 DATA_DIR=data-out npm run dev
```

Publish a full local index to the `data` branch with `npm run publish-data`. It refuses partial (`--pool-partitions`) runs and any run whose launch count is more than 5 % below the published data. The indexer stages its output in `data-out.next/` and only swaps it into `data-out/` after its own checks pass.

### Environment variables

| Variable | Used by | Purpose |
|---|---|---|
| `RPC_URL` | indexer, relay, `/api/progress` | Mainnet RPC (defaults to `https://api.mainnet-beta.solana.com`). Point it at your Solami RPC endpoint. |
| `ARCHIVE_RPC_URL` | indexer | Archival RPC for historical block times (default public mainnet; Solami RPC has no history). |
| `DATA_BASE_URL` | web | Where the JSON lives, e.g. `https://raw.githubusercontent.com/Quadwinner/curve-lab/data` |
| `DATA_DIR` | web (dev) | Read JSON from a local folder instead |
| `NEXT_PUBLIC_RELAY_URL` | web | Relay base URL for the live feed |
| `NEXT_PUBLIC_DEVNET_RPC_URL` | web | Devnet RPC for config creation (default public devnet) |
| `SOLAMI_API_KEY` | relay | Solami key for the Blur stream |
| `RPC_WS_URL` | relay | WebSocket for the logsSubscribe fallback (default public mainnet) |
| `SOLAMI_WS_URL` | relay | Override the Blur endpoint (default `wss://ws.solami.dev/data/subscribe`) |
| `PREV_META` | indexer | Previous `meta.json`; publishing aborts if the launch count drops more than 5 % |

### Use your own Solami key

1. Create a key at [solami.dev](https://solami.dev) (Blur access).
2. Run the relay with it: `SOLAMI_API_KEY=... npm run relay`. `/health` reports `"upstream":"live"` once the stream is connected.
3. Set `RPC_URL=https://rpc.solami.dev/sol?api_key=<key>` so the indexer reads every DBC pool, config and DAMM v2 pool through Solami (block times still come from `ARCHIVE_RPC_URL`).

## Deploy

- **Web**: import the repo in Vercel and set `DATA_BASE_URL` and `NEXT_PUBLIC_RELAY_URL`.
- **Relay**: Render → New → Blueprint → this repo (`render.yaml`), then paste `SOLAMI_API_KEY`.
- **Data**: `.github/workflows/indexer.yml` re-indexes every 6 hours and force-pushes the `data` branch.

## Sponsor integrations

- **Meteora DBC**: decodes every DBC pool and config on mainnet, builds curves with `buildCurveWithMarketCap`, validates with `validateConfigParameters`, and creates configs with `client.partner.createConfig` on devnet.
- **Solami**: the Blur WebSocket stream powers the live launch and graduation feed. Solami RPC can serve the indexer through `RPC_URL`.

## License

MIT
