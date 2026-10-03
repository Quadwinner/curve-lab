import { afterEach, describe, expect, it, vi } from 'vitest';
import { launchTimeOf } from '@/lib/metrics/classify';
import { anchorSlots, fetchBlockTimes, SlotTimeline } from '@/lib/rpc/slotTimeline';

afterEach(() => vi.unstubAllGlobals());

describe('SlotTimeline', () => {
  const tl = new SlotTimeline([{ slot: 1000, time: 10_000 }, { slot: 2000, time: 10_390 }], { refSlot: 3000, refTime: 10_770 });
  it('returns exact times at anchors', () => {
    expect(tl.timeAt(1000)).toBe(10_000);
    expect(tl.timeAt(2000)).toBe(10_390);
    expect(tl.timeAt(3000)).toBe(10_770);
  });
  it('interpolates linearly between anchors', () => {
    expect(tl.timeAt(1500)).toBe(10_195);
    expect(tl.timeAt(2500)).toBe(10_580);
  });
  it('extrapolates at 0.4 s/slot outside the anchored range', () => {
    expect(tl.timeAt(900)).toBe(9_960);
    expect(tl.timeAt(3100)).toBe(10_810);
  });
  it('drives launchTimeOf for slot-activated pools', () => {
    expect(launchTimeOf(1500n, 0, { refSlot: 3000, refTime: 10_770, slotTime: (s) => tl.timeAt(s) })).toBe(10_195);
    expect(launchTimeOf(1500n, 1, { refSlot: 3000, refTime: 10_770, slotTime: (s) => tl.timeAt(s) })).toBe(1500);
  });
});

describe('anchorSlots', () => {
  it('lists step multiples covering the range', () => {
    expect(anchorSlots(1050, 1310, 100)).toEqual([1000, 1100, 1200, 1300, 1400]);
  });
});

describe('fetchBlockTimes', () => {
  it('batches calls and probes forward past skipped slots', async () => {
    const batches: number[][] = [];
    vi.stubGlobal('fetch', vi.fn(async (_u: string, init: { body: string }) => {
      const calls = JSON.parse(init.body) as { id: number; params: [number] }[];
      batches.push(calls.map((c) => c.params[0]));
      return Response.json(calls.map((c) => (c.params[0] === 200 ? { jsonrpc: '2.0', id: c.id, error: { code: -32007, message: 'Slot 200 was skipped' } } : { jsonrpc: '2.0', id: c.id, result: c.params[0] * 10 })));
    }));
    const anchors = await fetchBlockTimes('http://rpc', [100, 200, 300], { batch: 2 });
    expect(anchors.sort((a, b) => a.target - b.target)).toEqual([
      { target: 100, slot: 100, time: 1000 },
      { target: 200, slot: 201, time: 2010 },
      { target: 300, slot: 300, time: 3000 },
    ]);
    expect(batches).toEqual([[100, 200], [300], [201]]);
  });
});
