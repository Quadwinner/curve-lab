import Link from 'next/link';
import type { Feature } from '@/lib/data/types';
import { fmtCompact, fmtPct, fmtQuote } from '@/lib/format';
import { nearest } from '@/lib/curve/similarity';

export function SimilarPresets({ features, v, quoteMint, symbol }: { features: Feature[]; v: number[]; quoteMint: string; symbol: string }) {
  const near = nearest(features, v, quoteMint, 5);
  if (!near.length) return <p className="text-sm text-ink-3">No comparable mainnet settings for {symbol} yet.</p>;
  const rated = near.filter((n) => n.organicRate !== null);
  const total = rated.reduce((a, n) => a + n.launches, 0);
  const rate = total ? rated.reduce((a, n) => a + n.organicRate! * n.launches, 0) / total : null;
  return (
    <div>
      <p className="text-ink-2">
        Settings like yours graduated <span className="readout text-2xl text-accent-text">{fmtPct(rate)}</span> of non-instant launches on mainnet
        <span className="text-ink-3"> · {fmtCompact(near.reduce((a, n) => a + n.launches, 0))} launches across the {near.length} closest groups</span>
      </p>
      <table className="mt-3 w-full whitespace-nowrap text-sm">
        <thead className="label-caps text-left">
          <tr><th className="py-1.5 font-normal">group</th><th className="font-normal">launches</th><th className="font-normal">organic</th><th className="font-normal">target</th><th className="font-normal">start mcap</th><th className="font-normal">fee</th></tr>
        </thead>
        <tbody>
          {near.map((n) => (
            <tr key={n.id} className="border-t border-line/60">
              <td className="readout py-1.5"><Link href={`/preset/${n.id}`} className="text-ink hover:text-accent-text">{n.id.slice(0, 8)}</Link></td>
              <td className="readout text-ink-2">{fmtCompact(n.launches)}</td>
              <td className="readout text-ink">{fmtPct(n.organicRate)}</td>
              <td className="readout text-ink-2">{fmtQuote(n.threshold, symbol)}</td>
              <td className="readout text-ink-2">{n.startMcap ? fmtQuote(n.startMcap, symbol) : '—'}</td>
              <td className="readout text-ink-2">{Number((n.startFeeBps / 100).toFixed(2))}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
