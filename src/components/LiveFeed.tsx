'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { shortAddr, timeAgo } from '@/lib/format';
import type { LiveEvent } from '@/lib/live/normalize';

const RELAY = process.env.NEXT_PUBLIC_RELAY_URL;

export function LiveFeed() {
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [status, setStatus] = useState<'connecting' | 'live' | 'offline'>(RELAY ? 'connecting' : 'offline');
  const [, tick] = useState(0);
  useEffect(() => {
    if (!RELAY) return;
    const es = new EventSource(`${RELAY}/events`);
    es.onopen = () => setStatus('live');
    es.onerror = () => setStatus('connecting');
    es.onmessage = (m) => {
      const ev = JSON.parse(m.data) as LiveEvent;
      setEvents((prev) => [ev, ...prev.filter((p) => !(p.kind === ev.kind && p.mint === ev.mint))].slice(0, 30));
    };
    const t = setInterval(() => tick((x) => x + 1), 10_000);
    return () => {
      es.close();
      clearInterval(t);
    };
  }, []);
  return (
    <div className="sticky top-20 rounded-md border border-line bg-panel/80 p-3 backdrop-blur-sm">
      <div className="mb-3 flex items-center justify-between">
        <span className="label-caps">live · mainnet</span>
        <span className={`inline-flex items-center gap-1.5 font-mono text-[0.68rem] ${status === 'live' ? 'text-accent-text' : 'text-ink-3'}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${status === 'live' ? 'animate-pulse bg-phosphor' : 'bg-ink-3'}`} />
          {status}
        </span>
      </div>
      {events.length === 0 && (
        <p className="text-xs text-ink-3">{status === 'offline' ? 'Live feed not configured.' : 'Waiting for the next Meteora DBC launch…'}</p>
      )}
      <ul className="max-h-[70vh] space-y-2.5 overflow-y-auto pr-1">
        {events.map((e) => (
          <li key={`${e.kind}-${e.mint}`} className="rise text-sm">
            <div className="flex items-baseline justify-between gap-2">
              <a href={`https://solscan.io/token/${e.mint}`} target="_blank" rel="noreferrer" className="truncate text-ink hover:text-accent-text">
                {e.symbol ?? shortAddr(e.mint)}
              </a>
              <span className={`shrink-0 font-mono text-[0.68rem] ${e.kind === 'graduation' ? 'text-accent-text' : 'text-ink-3'}`}>
                {e.kind === 'graduation' ? 'graduated' : 'launched'}
              </span>
            </div>
            <div className="font-mono text-[0.68rem] text-ink-3">
              {timeAgo(e.time)}
              {e.presetId && (
                <>
                  {' · '}
                  <Link href={`/preset/${e.presetId}`} className="text-ink-2 underline decoration-line underline-offset-2 hover:text-ink">
                    settings {e.presetId.slice(0, 6)}
                  </Link>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-3 border-t border-line pt-2 font-mono text-[0.62rem] text-ink-3">streamed by Solami Blur</p>
    </div>
  );
}
