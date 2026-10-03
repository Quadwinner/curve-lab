import bs58 from 'bs58';
import type { PoolRow } from '../dbc/pool';
import type { Classified, LaunchClass } from './classify';

const CLS: LaunchClass[] = ['open', 'organic', 'instant'];

export class PoolTable {
  keys: string[] = [];
  preset: number[] = [];
  config: number[] = [];
  cls: number[] = [];
  bucket: number[] = [];
  progress: number[] = [];
  launchTime: number[] = [];
  gradSeconds: number[] = [];
  raised: number[] = [];
  fees: number[] = [];
  private mints = new Uint8Array(32 * 1024);

  get size() {
    return this.keys.length;
  }

  reset() {
    for (const col of [this.keys, this.preset, this.config, this.cls, this.bucket, this.progress, this.launchTime, this.gradSeconds, this.raised, this.fees]) col.length = 0;
  }

  push(key: string, presetIdx: number, configIdx: number, c: Classified, pool: PoolRow) {
    const i = this.keys.length;
    if ((i + 1) * 32 > this.mints.length) {
      const grown = new Uint8Array(this.mints.length * 2);
      grown.set(this.mints);
      this.mints = grown;
    }
    this.mints.set(pool.baseMintBytes, i * 32);
    this.keys.push(key);
    this.preset.push(presetIdx);
    this.config.push(configIdx);
    this.cls.push(CLS.indexOf(c.cls));
    this.bucket.push(c.bucket ?? -1);
    this.progress.push(c.progress);
    this.launchTime.push(c.launchTime ?? Number.NaN);
    this.gradSeconds.push(c.gradSeconds ?? Number.NaN);
    this.raised.push(Number(pool.quoteReserve));
    this.fees.push(Number(pool.tradingQuoteFee));
  }

  clsAt(i: number): LaunchClass {
    return CLS[this.cls[i]];
  }

  mintAt(i: number): string {
    return bs58.encode(this.mints.subarray(i * 32, i * 32 + 32));
  }
}
