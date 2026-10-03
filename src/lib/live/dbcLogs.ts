import { DBC_PROGRAM_ID, POOL_SIZE } from '../dbc/layout';

const LAUNCH = /^Program log: Instruction: InitializeVirtualPool/;
const GRADUATION = /^Program log: Instruction: (MigrationDammV2|MigrateMeteoraDamm)$/;

export function kindFromLogs(logs: string[], opts: { failed?: boolean } = {}): 'launch' | 'graduation' | null {
  if (opts.failed) return null;
  if (logs.some((l) => LAUNCH.test(l))) return 'launch';
  if (logs.some((l) => GRADUATION.test(l))) return 'graduation';
  return null;
}

export function pickDbcPool(keys: string[], accounts: ({ owner: string; space: number } | null)[]): string | null {
  const i = accounts.findIndex((a) => a?.owner === DBC_PROGRAM_ID && a.space === POOL_SIZE);
  return i >= 0 ? keys[i] : null;
}
