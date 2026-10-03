import Link from 'next/link';
import type { PresetSummary } from '@/lib/data/types';
import { fmtCompact, fmtDuration, fmtPct, fmtQuote, timeAgo } from '@/lib/format';
import { presetLabel, type LeaderboardQuery, type SortKey } from '@/lib/leaderboard';
import { Sparkline } from './charts/Sparkline';
import { ArrowIcon, BoltIcon } from './icons';

const FEE_MODE = ['linear decay', 'exp. decay', 'rate limiter'];

function SortHeader({ q, k, children, className = '' }: { q: LeaderboardQuery; k: SortKey; children: React.ReactNode; className?: string }) {
  const params = new URLSearchParams({ sort: k, quote: q.quote, min: String(q.min), pf: q.prefunded ?? 'show' });
  const active = q.sort === k;
  return (
    <th className={`px-3 py-2 font-normal ${className}`} aria-sort={active ? 'descending' : 'none'}>
      <Link href={`/?${params}`} className={`inline-flex items-center gap-1 ${active ? 'text-accent-text' : 'hover:text-ink'}`}>
        {children}
        {active && <ArrowIcon />}
      </Link>
    </th>
  );
}

function OrganicMeter({ rate, prefunded }: { rate: number | null; prefunded: boolean }) {
  if (prefunded)
    return (
      <span className="inline-flex items-center gap-1 rounded border border-amber/40 bg-amber/10 px-1.5 py-0.5 font-mono text-[0.7rem] text-warn-text" title="≥90% of launches complete their curve: the launchpad buys out its own curves, so this is not market demand">
        <BoltIcon className="h-3 w-3" /> pre-funded
      </span>
    );
  if (rate === null) return <span className="text-ink-3" title="Fewer than 5 non-instant launches">—</span>;
  return (
    <div className="flex items-center gap-2">
      <span className="readout w-12 text-right text-ink">{fmtPct(rate)}</span>
      <span className="relative h-1.5 w-16 overflow-hidden rounded-full bg-mark-neutral/60" aria-hidden>
        <span className="absolute inset-y-0 left-0 rounded-full bg-phosphor" style={{ width: `${Math.max(2, rate * 100)}%` }} />
      </span>
    </div>
  );
}

function InstantCell({ share }: { share: number }) {
  if (share < 0.005) return <span className="readout text-ink-3">0%</span>;
  const heavy = share >= 0.5;
  return (
    <span className={`readout inline-flex items-center gap-1 ${heavy ? 'text-warn-text' : 'text-ink-2'}`} title={heavy ? 'Mostly pre-bought: curve completed within 60 s of launch' : undefined}>
      {heavy && <BoltIcon />}
      {fmtPct(share)}
    </span>
  );
}

export function LeaderboardTable({ rows, q, offset }: { rows: PresetSummary[]; q: LeaderboardQuery; offset: number }) {
  return (
    <div className="overflow-x-auto rounded-md border border-line bg-panel/70">
      <table className="w-full min-w-[1080px] whitespace-nowrap text-sm">
        <thead className="label-caps border-b border-line text-left">
          <tr>
            <th className="px-3 py-2 font-normal">#</th>
            <th className="px-3 py-2 font-normal">Setting group</th>
            <SortHeader q={q} k="launches" className="text-right">Launches</SortHeader>
            <SortHeader q={q} k="organic">Organic grad.</SortHeader>
            <th className="px-3 py-2 font-normal">Instant</th>
            <SortHeader q={q} k="speed">Median time</SortHeader>
            <SortHeader q={q} k="raised" className="text-right">Raised</SortHeader>
            <SortHeader q={q} k="fees" className="text-right">Fees</SortHeader>
            <th className="px-3 py-2 font-normal">Curve</th>
            <SortHeader q={q} k="recent">Last launch</SortHeader>
          </tr>
        </thead>
        <tbody>
          {rows.map((p, i) => (
            <tr key={p.id} className="rise group border-t border-line/60 transition-colors hover:bg-panel-2" style={{ animationDelay: `${Math.min(i, 20) * 25}ms` }}>
              <td className="readout px-3 py-2.5 text-ink-3">{offset + i + 1}</td>
              <td className="px-3 py-2.5">
                <Link href={`/preset/${p.id}`} className="block whitespace-nowrap">
                  <span className="block text-ink group-hover:text-accent-text">{presetLabel(p)}</span>
                  <span className="readout block text-[0.7rem] text-ink-3">{p.id.slice(0, 8)} · {FEE_MODE[p.feeMode] ?? 'custom'}</span>
                </Link>
              </td>
              <td className="readout px-3 py-2.5 text-right">{fmtCompact(p.launches)}</td>
              <td className="px-3 py-2.5"><OrganicMeter rate={p.organicRate} prefunded={p.prefunded} /></td>
              <td className="px-3 py-2.5"><InstantCell share={p.instantShare} /></td>
              <td className="readout px-3 py-2.5 text-ink-2">{fmtDuration(p.medianGradSeconds)}</td>
              <td className="readout px-3 py-2.5 text-right text-ink-2">{fmtQuote(p.raised, p.quote.symbol)}</td>
              <td className="readout px-3 py-2.5 text-right text-ink-2">{fmtQuote(p.fees, p.quote.symbol)}</td>
              <td className="px-3 py-1.5"><Sparkline values={p.spark} delay={Math.min(i, 20) * 25} /></td>
              <td className="px-3 py-2.5 text-ink-3">{p.lastLaunch ? timeAgo(p.lastLaunch) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
