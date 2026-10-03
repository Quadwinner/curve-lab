import { rpcBatch, withRetry } from './http';

const FALLBACK_SLOT_SECONDS = 0.4;

export interface Anchor {
  target: number;
  slot: number;
  time: number;
}

// Slot duration drifts (~0.38–0.42 s), so converting slots with a constant is off by days over a year; interpolate real block times instead.
export class SlotTimeline {
  private readonly slots: number[];
  private readonly times: number[];

  constructor(anchors: { slot: number; time: number }[], ref: { refSlot: number; refTime: number }) {
    const merged = new Map<number, number>();
    for (const a of anchors) merged.set(a.slot, a.time);
    merged.set(ref.refSlot, ref.refTime);
    const sorted = [...merged.entries()].sort((a, b) => a[0] - b[0]);
    this.slots = sorted.map(([s]) => s);
    this.times = sorted.map(([, t]) => t);
  }

  timeAt(slot: number): number {
    const s = this.slots;
    const t = this.times;
    const last = s.length - 1;
    if (slot <= s[0]) return Math.round(t[0] - (s[0] - slot) * FALLBACK_SLOT_SECONDS);
    if (slot >= s[last]) return Math.round(t[last] + (slot - s[last]) * FALLBACK_SLOT_SECONDS);
    let lo = 0;
    let hi = last;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (s[mid] <= slot) lo = mid;
      else hi = mid;
    }
    return Math.round(t[lo] + ((slot - s[lo]) * (t[hi] - t[lo])) / (s[hi] - s[lo]));
  }
}

export function anchorSlots(from: number, to: number, step: number): number[] {
  const out: number[] = [];
  for (let s = Math.floor(from / step) * step; s < to + step; s += step) out.push(s);
  return out;
}

export async function fetchBlockTimes(
  rpcUrl: string,
  targets: number[],
  opts: { batch?: number; concurrency?: number; maxSkip?: number } = {},
): Promise<Anchor[]> {
  const batch = opts.batch ?? 100;
  const anchors: Anchor[] = [];
  let pending = targets.map((target) => ({ target, probe: target }));
  for (let round = 0; round <= (opts.maxSkip ?? 30) && pending.length; round++) {
    const chunks: (typeof pending)[] = [];
    for (let i = 0; i < pending.length; i += batch) chunks.push(pending.slice(i, i + batch));
    const next: typeof pending = [];
    let idx = 0;
    const worker = async () => {
      while (idx < chunks.length) {
        const chunk = chunks[idx++];
        const res = await withRetry(() => rpcBatch<number | null>(rpcUrl, chunk.map((c) => ({ method: 'getBlockTime', params: [c.probe] }))), {
          label: 'getBlockTime batch',
          attempts: 8,
          baseMs: 2000,
        });
        res.forEach((r, i) => {
          const c = chunk[i];
          if (typeof r.result === 'number') anchors.push({ target: c.target, slot: c.probe, time: r.result });
          else next.push({ target: c.target, probe: c.probe + 1 });
        });
      }
    };
    await Promise.all(Array.from({ length: Math.min(opts.concurrency ?? 2, chunks.length) }, worker));
    pending = next;
  }
  return anchors;
}
