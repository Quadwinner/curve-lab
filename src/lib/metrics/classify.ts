import type { PoolRow } from '../dbc/pool';

export const INSTANT_SECONDS = 60;
export const SLOT_SECONDS = 0.4;
export const BUCKET_EDGES = [0.01, 0.1, 0.25, 0.5, 0.75];
export const BUCKET_LABELS = ['<1%', '1–10%', '10–25%', '25–50%', '50–75%', '75–100%'];

export interface Clock {
  refSlot: number;
  refTime: number;
  slotTime?: (slot: number) => number;
}

export type LaunchClass = 'open' | 'organic' | 'instant';

export interface Classified {
  cls: LaunchClass;
  launchTime: number | null;
  gradSeconds: number | null;
  bucket: number | null;
  progress: number;
}

export function launchTimeOf(activationPoint: bigint, activationType: number, clock: Clock): number | null {
  if (activationPoint === 0n) return null;
  const v = Number(activationPoint);
  if (activationType === 1) return v;
  return clock.slotTime ? clock.slotTime(v) : Math.round(clock.refTime + (v - clock.refSlot) * SLOT_SECONDS);
}

export function classify(pool: PoolRow, threshold: bigint, activationType: number, clock: Clock): Classified {
  const launchTime = launchTimeOf(pool.activationPoint, activationType, clock);
  const finish = Number(pool.finishCurveTimestamp);
  if (finish > 0 || pool.isMigrated) {
    const gradSeconds = finish > 0 && launchTime !== null ? finish - launchTime : null;
    const instant = gradSeconds !== null && gradSeconds <= INSTANT_SECONDS;
    return { cls: instant ? 'instant' : 'organic', launchTime, gradSeconds, bucket: null, progress: 1 };
  }
  const progress = threshold > 0n ? Math.min(1, Number(pool.quoteReserve) / Number(threshold)) : 0;
  const idx = BUCKET_EDGES.findIndex((edge) => progress < edge);
  return { cls: 'open', launchTime, gradSeconds: null, bucket: idx === -1 ? 5 : idx, progress };
}
