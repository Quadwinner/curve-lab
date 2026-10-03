export interface LiveEvent {
  kind: 'launch' | 'graduation';
  mint: string;
  pool: string | null;
  symbol: string | null;
  name: string | null;
  time: number;
  signature: string | null;
  presetId: string | null;
}

const str = (v: unknown) => (typeof v === 'string' && v.length > 0 ? v : null);
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null);
const isDbc = (v: unknown) => typeof v === 'string' && /meteora_dbc|dynamic.?bonding/i.test(v);

export function normalizeBlur(raw: unknown, now = Math.floor(Date.now() / 1000)): Omit<LiveEvent, 'presetId'> | null {
  if (!raw || typeof raw !== 'object') return null;
  const e = raw as Record<string, unknown>;
  const meta = (e.metadata && typeof e.metadata === 'object' ? e.metadata : {}) as Record<string, unknown>;
  const mint = str(e.mint);
  if (!mint) return null;
  const base = {
    mint,
    pool: str(e.pool),
    symbol: str(e.symbol) ?? str(meta.symbol),
    name: str(e.name) ?? str(meta.name),
    time: num(e.block_time) ?? num(e.time) ?? now,
    signature: str(e.signature),
  };
  if (e.type === 'token_create' && isDbc(e.dex)) return { kind: 'launch', ...base };
  if (e.type === 'graduation' && (isDbc(e.launchpad) || isDbc(e.dex))) return { kind: 'graduation', ...base };
  return null;
}
