# Submission answers

All three Superteam Earn tracks ask the same questions. Submit to **Colosseum first** (country: India), then paste these into each listing:

- Meteora DBC: https://superteam.fun/earn/listing/meteora-dbc
- Solami: https://superteam.fun/earn/listing/build-something-live-on-solana-data
- Superteam India: https://superteam.fun/earn/listing/colosseum-crypto-worlds-fair-hackathon-superteam-india-track

Deadline: **Oct 12, 11:59 PM PT = Oct 13, 12:29 PM IST**. Submit by the night of Oct 12 IST.

---

**Project Name**
Curve Lab

**Project Github Link**
https://github.com/Quadwinner/curve-lab

**Project Website**
(Vercel URL after deploy)

**Project X Link**
(your X profile or launch post)

**Link to your pitch deck or Loom/video presentation**
(YouTube/Loom link of the demo video; put the deck link in the description too)

**Did you submit this project to the official Crypto World's Fair Hackathon on Colosseum? (Yes/No)**
Yes

**Link to Colosseum project / profile**
(from arena.colosseum.org after submitting)

---

## Project Description: Meteora DBC track

Curve Lab ranks every Meteora Dynamic Bonding Curve launch setting on Solana mainnet by what actually happened to the tokens launched with it, and lets launchpad builders design better settings against that evidence.

- **Data.** We index all 1,734,247 DBC launches and 490k config accounts. Configs with byte-identical settings become 65,107 comparable setting groups. We follow 883,851 graduated tokens into the Meteora DAMM v2 pools they migrated to.
- **Findings.** 39% of launches complete their curve within 60 s (bought out at creation). 52.5% come from 914 pre-funded setting groups where ≥ 90% of launches graduate. On the open market only 1.3% graduate. 46% of graduated tokens now trade below 10% of their graduation price.
- **Product.** A leaderboard of setting groups (organic graduation, holding up after graduation, time to graduate, raised, fees). A page per setting group: curve, fee schedule, where launches stall, after-graduation outcomes on DAMM v2, launchpads using it, and live progress of the latest launches. A designer that builds curves with `buildCurveWithMarketCap`, validates them with `validateConfigParameters`, compares them with the closest real settings, and creates the config on devnet via `client.partner.createConfig`. A live feed of new launches and graduations tagged with their setting group.
- **Meteora stack.** DBC pools and configs (decoders verified against the SDK on mainnet fixtures), DBC SDK for building, validation and config creation, and DAMM v2 pools for after-graduation prices.
- **Next.** Publish Curve Lab presets on mainnet with Curve Lab as partner fee claimer, a graduation-odds API for launchpads and terminals, and alerts.

## Project Description: Solami track

Curve Lab is a live analytics product for Meteora DBC launches, and **Solami is its data path**:

- **Indexer.** It reads every DBC pool (1.73M), config (490k) and DAMM v2 pool (1.58M) on mainnet through **Solami RPC** (`getProgramAccounts` in 256 streamed memcmp partitions, plus `getMultipleAccounts`). Only historical block times come from an archival endpoint, because Solami RPC returns none for old slots.
- **Live feed.** It streams new DBC launches and graduations from **Solami Blur** (`token_create`, `graduation`). Each event is resolved to its setting group and fanned out to browsers over Server-Sent Events.
- **Running it.** The README explains how to run everything with your own Solami key (`RPC_URL=https://rpc.solami.dev/sol?api_key=…`, `SOLAMI_API_KEY=…`). The demo video runs against live mainnet.

It answers a question traders and launchpad builders actually have: which launch settings produce real demand, and do graduated tokens hold up? The finding: 52.5% of launches are pre-funded, only 1.3% of open-market launches graduate, and 46% of graduated tokens fall below 10% of their graduation price.

## Project Description: Superteam India track

Curve Lab is built solo from India. It is a public analytics and design tool for the most-used token launch primitive on Solana, Meteora's Dynamic Bonding Curve.

- **Problem.** Launchpads choose curve, fee and graduation settings blind, and raw graduation numbers are inflated by pre-bought launches.
- **User.** Launchpad builders and token creators choosing settings, plus traders who want to know which launchpads produce real demand.
- **What it shows.** Indexing all 1.73M mainnet launches, Curve Lab shows that 52.5% of launches are pre-funded and only 1.3% of open-market launches graduate. It ranks 65k setting groups by organic graduation and by how graduated tokens hold up on DAMM v2, and the designer lets builders test new settings against that evidence and create them on devnet.
- **Growth.** Evidence-backed presets published on mainnet with partner fees, an API for launchpads and terminals, and alerts. It brings launchpad builders to Solana with better launch economics.
