'use client';
import { useEffect, useState } from 'react';
import type { RecentLaunch } from '@/lib/data/types';
import { shortAddr, timeAgo } from '@/lib/format';
import { decodeProgress, PROGRESS_SLICE } from '@/lib/live/progress';
import { BoltIcon } from './icons';

const RPC = process.env.NEXT_PUBLIC_RPC_URL ?? 'https://api.mainnet-beta.solana.com';

export function RecentLaunches({ launches, threshold }: { launches: RecentLaunch[]; threshold: string }) {
  const [live, setLive] = useState<Record<string, number>>({});
  const [polled, setPolled] = useState<number | null>(null);
  useEffect(() => {
    const open = launches.filter((l) => l.cls === 'open').map((l) => l.pool);
    if (!open.length) return;
    const poll = async () => {
      try {
        const res = await fetch(RPC, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getMultipleAccounts', params: [open, { encoding: 'base64', dataSlice: PROGRESS_SLICE }] }),
        });
        const json = (await res.json()) as { result: { value: ({ data: [string] } | null)[] } };
        const next: Record<string, number> = {};
        json.result.value.forEach((v, i) => {
          if (!v) return;
          const bytes = Uint8Array.from(atob(v.data[0]), (c) => c.charCodeAt(0));
          next[open[i]] = decodeProgress(bytes, BigInt(threshold)).progress;
        });
        setLive(next);
        setPolled(Math.floor(Date.now() / 1000));
      } catch {
        // public RPC is best-effort; keep the last snapshot
      }
    };
    poll();
    const id = setInterval(poll, 15_000);
    return () => clearInterval(id);
  }, [launches, threshold]);
  return (
    <div>
      <ul className="divide-y divide-line/60">
        {launches.map((l) => {
          const progress = live[l.pool] ?? l.progress;
          const status = l.cls === 'instant' ? 'instant' : l.cls === 'organic' ? 'graduated' : `${(progress * 100).toFixed(1)}%`;
          return (
            <li key={l.pool} className="py-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <a className="readout text-ink hover:text-accent-text" href={`https://solscan.io/token/${l.mint}`} target="_blank" rel="noreferrer">{shortAddr(l.mint)}</a>
                <span className={`readout inline-flex items-center gap-1 text-xs ${l.cls === 'instant' ? 'text-warn-text' : l.cls === 'organic' ? 'text-accent-text' : 'text-ink-2'}`}>
                  {l.cls === 'instant' && <BoltIcon className="h-3 w-3" />}
                  {status}
                  <span className="text-ink-3">· {l.launchTime ? timeAgo(l.launchTime) : '—'}</span>
                </span>
              </div>
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-mark-neutral/50">
                <div className="h-1 rounded-full transition-[width] duration-700" style={{ width: `${Math.max(1, progress * 100)}%`, background: l.cls === 'instant' ? 'var(--amber)' : 'var(--phosphor)' }} />
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 font-mono text-[0.68rem] text-ink-3">{polled ? `curve progress polled from mainnet ${timeAgo(polled)}` : 'curve progress from the last scan'}</p>
    </div>
  );
}
