'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { shortAddr, timeAgo } from '@/lib/format';
import type { LiveEvent } from '@/lib/live/normalize';

const RELAY = process.env.NEXT_PUBLIC_RELAY_URL;

const SOURCE_LABEL: Record<string, string> = {
  solami: 'streamed by Solami Blur',
  rpc: 'streamed from Solana RPC (logsSubscribe)',
  mock: 'MOCK DATA (development only)',
};

export function LiveFeed() {
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [status, setStatus] = useState<'connecting' | 'live' | 'offline'>(RELAY ? 'connecting' : 'offline');
  const [source, setSource] = useState<string | null>(null);
  const [, tick] = useState(0);
  useEffect(() => {
    if (!RELAY) return;
    let es: EventSource | null = null;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;
    let closed = false;
    const open = () => {
      es = new EventSource(`${RELAY}/events`);
      es.onopen = () => {
        attempt = 0;
        setStatus('live');
      };
      es.addEventListener('source', (m) => setSource((JSON.parse((m as MessageEvent).data) as { source: string }).source));
      es.onmessage = (m) => {
        const ev = JSON.parse(m.data) as LiveEvent;
        setEvents((prev) => [ev, ...prev.filter((p) => !(p.kind === ev.kind && p.mint === ev.mint))].slice(0, 30));
      };
      es.onerror = () => {
        setStatus('connecting');
        // EventSource gives up for good after a non-200 (e.g. the relay waking up); reopen it ourselves.
        if (es?.readyState === EventSource.CLOSED && !closed) {
          retry = setTimeout(open, Math.min(60_000, 3000 * 2 ** attempt++));
        }
      };
    };
    open();
    const t = setInterval(() => tick((x) => x + 1), 10_000);
    return () => {
      closed = true;
      es?.close();
      clearTimeout(retry);
      clearInterval(t);
    };
  }, []);
  return (
    <div className="sticky top-20 rounded-md border border-line bg-panel/80 p-3 backdrop-blur-sm">
      <div className="mb-3 flex items-center justify-between">
        <span className="label-caps">live · mainnet</span>
        <span className={`inline-flex items-center gap-1.5 font-mono text-[0.68rem] ${status === 'live' ? 'text-accent-text' : 'text-ink-3'}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${status === 'live' ? 'animate-pulse bg-phosphor' : 'bg-ink-3'}`} />
          {source === 'mock' ? 'mock' : status}
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
      <p className={`mt-3 border-t border-line pt-2 font-mono text-[0.62rem] ${source === 'mock' ? 'text-warn-text' : 'text-ink-3'}`}>{source ? SOURCE_LABEL[source] ?? source : 'live mainnet feed'}</p>
    </div>
  );
}
