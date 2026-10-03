import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { pubkey } from '@/lib/dbc/bytes';
import { decodeConfigHeader, decodeConfigParams } from '@/lib/dbc/config';
import { CONFIG_SLICE, POOL_SLICE } from '@/lib/dbc/layout';
import { decodePoolSlice } from '@/lib/dbc/pool';

const load = (name: string) => ({
  pool: new Uint8Array(readFileSync(`test/fixtures/${name}.pool.bin`)),
  poolSdk: JSON.parse(readFileSync(`test/fixtures/${name}.pool.json`, 'utf8')),
  config: new Uint8Array(readFileSync(`test/fixtures/${name}.config.bin`)),
  configSdk: JSON.parse(readFileSync(`test/fixtures/${name}.config.json`, 'utf8')),
});

describe.each(['grad', 'open', 'hook'])('%s fixture', (name) => {
  const f = load(name);

  it('decodes the pool slice exactly like the SDK', () => {
    const row = decodePoolSlice(f.pool.subarray(POOL_SLICE.offset, POOL_SLICE.offset + POOL_SLICE.length));
    expect(row.config).toBe(f.poolSdk.config);
    expect(pubkey(row.baseMintBytes, 0)).toBe(f.poolSdk.baseMint);
    expect(row.quoteReserve.toString()).toBe(f.poolSdk.quoteReserve);
    expect(row.activationPoint.toString()).toBe(f.poolSdk.activationPoint);
    expect(row.isMigrated).toBe(Number(f.poolSdk.isMigrated) === 1);
    expect(row.tradingQuoteFee.toString()).toBe(f.poolSdk.metrics.totalTradingQuoteFee);
    expect(row.finishCurveTimestamp.toString()).toBe(f.poolSdk.finishCurveTimestamp);
  });

  it('decodes the config exactly like the SDK', () => {
    const body = f.config.subarray(CONFIG_SLICE.offset);
    const h = decodeConfigHeader(body);
    const p = decodeConfigParams(body);
    const s = f.configSdk;
    expect(h.quoteMint).toBe(s.quoteMint);
    expect(h.feeClaimer).toBe(s.feeClaimer);
    expect(h.migrationQuoteThreshold.toString()).toBe(s.migrationQuoteThreshold);
    expect(h.activationType).toBe(s.activationType);
    expect(p.quoteMint).toBe(s.quoteMint);
    expect(p.tokenDecimal).toBe(s.tokenDecimal);
    expect(p.baseFee.cliffFeeNumerator).toBe(s.poolFees.baseFee.cliffFeeNumerator);
    expect(p.baseFee.firstFactor).toBe(s.poolFees.baseFee.firstFactor);
    expect(p.baseFee.secondFactor).toBe(s.poolFees.baseFee.secondFactor);
    expect(p.baseFee.thirdFactor).toBe(s.poolFees.baseFee.thirdFactor);
    expect(p.baseFee.mode).toBe(s.poolFees.baseFee.baseFeeMode);
    expect(p.creatorTradingFeePercentage).toBe(s.creatorTradingFeePercentage);
    expect(p.lp.partnerLocked).toBe(s.partnerPermanentLockedLiquidityPercentage);
    expect(p.lp.creator).toBe(s.creatorLiquidityPercentage);
    expect(p.migrationSqrtPrice).toBe(s.migrationSqrtPrice);
    expect(p.sqrtStartPrice).toBe(s.sqrtStartPrice);
    expect(p.swapBaseAmount).toBe(s.swapBaseAmount);
    expect(p.migrationBaseThreshold).toBe(s.migrationBaseThreshold);
    const sdkCurve = (s.curve as { sqrtPrice: string; liquidity: string }[]).filter((c) => c.sqrtPrice !== '0');
    expect(p.curve).toEqual(sdkCurve.map((c) => ({ sqrtPrice: c.sqrtPrice, liquidity: c.liquidity })));
  });
});

it('rejects a short pool slice', () => {
  expect(() => decodePoolSlice(new Uint8Array(10))).toThrow(/too short/);
});
