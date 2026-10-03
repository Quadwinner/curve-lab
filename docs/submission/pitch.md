# Curve Lab: pitch deck (slide text)

Numbers come from a full mainnet scan on 2026-10-04 (slot ~453M).

---

## 1. Title
**Curve Lab**
Which Meteora launch settings actually work?
Live: (Vercel URL) · Code: github.com/Quadwinner/curve-lab

---

## 2. The problem
Launchpads on Meteora's Dynamic Bonding Curve pick launch settings blind: curve shape, fees, graduation target, LP split.

- There is no way to see how a given setting performed. Launchpads usually create a fresh config account for every token (490k configs for 1.73M launches), so the data never adds up to an answer.
- The raw numbers mislead. "54% of DBC pools graduated" sounds healthy, and it is not.

---

## 3. What we found (1,734,247 launches)
- **39%** of launches complete their curve within 60 seconds: bought out at creation.
- **52.5%** come from **914 pre-funded setting groups** where ≥ 90% of launches graduate. The launchpad buys out its own curves.
- On the open market, only **1.3%** of launches graduate (9,692 of 742,213).
- After graduation, **46%** of 883,851 tokens trade below 10% of their graduation price on Meteora DAMM v2.

Nobody had these numbers. Launchpads and Meteora can now act on them.

---

## 4. Product
1. **Leaderboard**: 65,107 setting groups (configs with byte-identical settings), ranked by organic graduation, how graduated tokens hold up, time to graduate, raised and fees.
2. **Setting group page**: curve, fee schedule, where launches stall, launches per week, launchpads using it, after-graduation outcomes on DAMM v2, and live progress of the newest launches.
3. **Designer**: shape a curve with the Meteora SDK and see how the closest real settings performed (pre-funded excluded). Export the TypeScript, or create the config on devnet with a wallet.
4. **Live feed**: new launches and graduations on mainnet as they happen, each tagged with its setting group.

---

## 5. How it works
- An indexer reads every DBC pool and config and every DAMM v2 pool from mainnet through **Solami RPC**. Fetches are split into 256 partitions and streamed to survive multi-hundred-MB responses.
- Accounts are decoded by byte offset and verified against Meteora's SDK on real fixtures (120 tests).
- Real block-time anchors convert slot-based launches to time to within 18 s.
- Live events arrive via **Solami Blur**, with an RPC fallback, as Server-Sent Events.
- Next.js 16 front end, with JSON data refreshed every 6 hours.

---

## 6. Why Meteora and Solami
- **Meteora**: DBC is the launch primitive for most Solana launchpads. Curve Lab is developer tooling for the people configuring it, and the first public evidence on what DBC settings do: graduation, pre-funding, and life after migration to DAMM v2.
- **Solami**: Solami RPC is the data path for every mainnet account read, and Blur powers the live launch feed.

---

## 7. Business model
- **Curve Lab presets on mainnet.** We publish evidence-backed DBC configs with Curve Lab as the partner fee claimer. Every launch on them pays partner trading fees natively, with no subscription.
- **API for launchpads and trading terminals**: setting-group stats, graduation odds for fresh launches, and pre-funding flags as a paid data feed.
- **Launch audits**: a pre-launch review of a launchpad's settings against the closest real outcomes.

---

## 8. Traction plan (next 30 days)
- Publish the "52% pre-funded / 1.3% open-market" findings and tag launchpads and Meteora.
- Onboard 10 launchpad builders to the designer and collect feedback.
- First mainnet Curve Lab preset with partner fees on.

---

## 9. Roadmap
- Graduation odds for fresh launches from config plus first-hour activity.
- Alerts (Telegram/X) when a setting group starts outperforming.
- DLMM and DAMM v2 LP analytics for graduated tokens.
- Full devnet and then mainnet launch flow from the designer (config → pool → first buy).

---

## 10. Team
Solo builder from India (Superteam India). Built the full stack in 9 days: indexer, analytics, designer, live feed.
