import { createHash } from 'node:crypto';
import { CONFIG_SLICE } from './layout';

const at = (accountOffset: number) => accountOffset - CONFIG_SLICE.offset;

export function presetIdOf(configBody: Uint8Array): string {
  return createHash('sha256')
    .update(configBody.subarray(0, 32))
    .update(configBody.subarray(at(104), CONFIG_SLICE.length))
    .digest('hex')
    .slice(0, 16);
}
