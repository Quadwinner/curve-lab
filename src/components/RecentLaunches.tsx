'use client';
import { useEffect, useState } from 'react';
import type { RecentLaunch } from '@/lib/data/types';
import { shortAddr, timeAgo } from '@/lib/format';
import { BoltIcon } from './icons';

export function RecentLaunches({ launches, presetId }: { launches: RecentLaunch[]; presetId: string }) {
  const [live, setLive] = useState<Record<string, number>>({});
  const [polled, setPolled] = useState<number | null>(null);
  useEffect(() => {
    if (!launches.some((l) => l.cls === 'open')) return;
    let inFlight = false;
    const poll = async () => {
      if (inFlight || document.visibilityState !== 'visible') return;
      inFlight = true;
      try {
        const res = await fetch(`/api/progress?preset=${presetId}`);
        if (!res.ok) return;
        const json = (await res.json()) as { progress: Record<string, number>; at: number };
        setLive(json.progress);
        setPolled(json.at);
      } catch {
        // best-effort; keep the last snapshot
      } finally {
        inFlight = false;
      }
    };
    poll();
    const id = setInterval(poll, 15_000);
    return () => clearInterval(id);
  }, [launches, presetId]);
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
