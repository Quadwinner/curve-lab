import { describe, expect, it } from 'vitest';
import { kindFromLogs, pickDbcPool } from '@/lib/live/dbcLogs';

const P = 'dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN';

describe('kindFromLogs', () => {
  it('detects launches from any initialize variant', () => {
    expect(kindFromLogs([`Program ${P} invoke [1]`, 'Program log: Instruction: InitializeVirtualPoolWithSplToken'])).toBe('launch');
    expect(kindFromLogs(['Program log: Instruction: InitializeVirtualPoolWithToken2022TransferHook'])).toBe('launch');
  });
  it('detects graduations (migration to DAMM)', () => {
    expect(kindFromLogs(['Program log: Instruction: MigrationDammV2'])).toBe('graduation');
    expect(kindFromLogs(['Program log: Instruction: MigrateMeteoraDamm'])).toBe('graduation');
  });
  it('ignores swaps, metadata and failed transactions', () => {
    expect(kindFromLogs(['Program log: Instruction: Swap2', 'Program log: Instruction: TransferChecked'])).toBeNull();
    expect(kindFromLogs(['Program log: Instruction: MigrationDammV2CreateMetadata'])).toBeNull();
    expect(kindFromLogs(['Program log: Instruction: InitializeVirtualPoolWithSplToken'], { failed: true })).toBeNull();
  });
});

describe('pickDbcPool', () => {
  it('returns the 424-byte account owned by the DBC program', () => {
    const keys = ['cfg', 'pool', 'mint'];
    const accounts = [{ owner: P, space: 1048 }, { owner: P, space: 424 }, { owner: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', space: 82 }];
    expect(pickDbcPool(keys, accounts)).toBe('pool');
  });
  it('returns null when no pool is present', () => {
    expect(pickDbcPool(['a'], [null])).toBeNull();
  });
});
