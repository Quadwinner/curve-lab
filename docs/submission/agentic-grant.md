# Agentic Engineering Grant — application draft

Listing: https://superteam.fun/earn/grants/agentic-engineering ($200 USDG: $100 upfront after KYC, $100 after shipping with $200 of AI-tool receipts)

## Project title
Curve Lab: Meteora DBC launch settings ranked by real mainnet outcomes

## One-line description
A public analytics and design tool that ranks every Meteora Dynamic Bonding Curve launch setting by what actually happened to the tokens launched with it, and lets launchpad builders design and create better settings.

## What I'm building
- An indexer that reads all ~1.7M DBC launches and ~530k configs from Solana mainnet, groups byte-identical configs into setting groups, and separates instant (pre-bought) graduations from organic ones.
- A web app: a leaderboard of setting groups, a detail page per group (curve, fee schedule, where launches stall, live progress), and a designer that builds a curve with the Meteora SDK, compares it with the closest real settings, and creates the config on devnet with a wallet.
- A live feed of new DBC launches and graduations from Solami's Blur stream, tagged with their setting group.

## How I use AI coding tools
I build with Claude Code: it writes the spec and plan, implements test-first (87 unit tests so far, including decoder tests against Meteora SDK fixtures from mainnet), and debugs live data issues. Examples: tracing a 15-day slot-time drift that hid instant graduations, and a V8 string-retention memory leak in the streaming indexer. The grant covers the AI coding subscription for the build month.

## Solana integration
- Reads mainnet accounts of the DBC program `dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN` (pools, configs) and block times.
- Uses `@meteora-ag/dynamic-bonding-curve-sdk` (`buildCurveWithMarketCap`, `validateConfigParameters`, `client.partner.createConfig`) to create configs on devnet.
- Streams live launches from Solami (Solana infrastructure).

## Milestones
- Oct 3–5: indexer + leaderboard (done: indexer, leaderboard, detail pages, designer)
- Oct 6–9: live feed on Solami, deployment, devnet creation from the browser
- Oct 10–12: polish, demo video, submission to Colosseum Crypto World's Fair (Meteora DBC, Solami and Superteam India tracks)

## Links
- GitHub: https://github.com/Quadwinner/curve-lab
- Live app: (add the Vercel URL after deploy)
- X: (your handle)
