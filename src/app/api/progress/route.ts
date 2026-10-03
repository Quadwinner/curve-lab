import { loadPreset } from '@/lib/data/load';
import { openPools, progressFor } from '@/lib/live/progressServer';

const RPC = process.env.RPC_URL ?? 'https://api.mainnet-beta.solana.com';

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get('preset') ?? '';
  const preset = await loadPreset(id);
  if (!preset) return Response.json({ error: 'unknown preset' }, { status: 404 });
  const pools = openPools(preset.recent);
  try {
    const progress = pools.length ? await progressFor(RPC, pools, BigInt(preset.params.migrationQuoteThreshold)) : {};
    return Response.json({ progress, at: Math.floor(Date.now() / 1000) }, { headers: { 'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=20' } });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 502, headers: { 'Cache-Control': 'public, s-maxage=5' } });
  }
}
