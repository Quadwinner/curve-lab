import { parseProgressRequest, progressFor } from '@/lib/live/progressServer';

const RPC = process.env.RPC_URL ?? 'https://api.mainnet-beta.solana.com';

export async function POST(request: Request) {
  const parsed = parseProgressRequest(await request.json().catch(() => null));
  if (!parsed) return Response.json({ error: 'expected { pools: base58[] (max 20), threshold: digits }' }, { status: 400 });
  try {
    return Response.json({ progress: await progressFor(RPC, parsed.pools, parsed.threshold), at: Math.floor(Date.now() / 1000) });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 502 });
  }
}
