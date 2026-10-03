import Link from 'next/link';
import { LeaderboardTable } from '@/components/LeaderboardTable';
import { StatCard } from '@/components/StatCard';
import { loadMeta, loadPresets } from '@/lib/data/load';
import { fmtCompact, fmtPct, timeAgo } from '@/lib/format';
import { parseQuery, queryPresets, type LeaderboardQuery } from '@/lib/leaderboard';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 50;

function Chip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} className={`rounded border px-2.5 py-1 font-mono text-xs transition-colors ${active ? 'border-phosphor/70 bg-phosphor/10 text-ink' : 'border-line text-ink-3 hover:border-ink-3 hover:text-ink-2'}`}>
      {children}
    </Link>
  );
}

export default async function Home({ searchParams }: PageProps<'/'>) {
  const q = parseQuery(await searchParams);
  const [meta, presets] = await Promise.all([loadMeta(), loadPresets()]);
  if (!meta || !presets) {
    return <p className="py-24 text-center text-ink-2">The first mainnet scan is still running. Check back in a few minutes.</p>;
  }
  const { rows, total, pages } = queryPresets(presets, q, PAGE_SIZE);
  const page = Math.min(q.page, pages);
  const t = meta.totals;
  const m = meta.market;
  const stale = Date.now() / 1000 - meta.generatedAt > 12 * 3600;
  const link = (o: Partial<LeaderboardQuery>) => {
    const next = { ...q, ...o };
    return `/?${new URLSearchParams({ sort: next.sort, quote: next.quote, min: String(next.min), page: String(next.page), pf: next.prefunded ?? 'show' })}`;
  };
  return (
    <div className="space-y-8">
      <section className="rise max-w-4xl">
        <p className="label-caps">launch settings, ranked by what actually happened</p>
        <h1 className="mt-2 font-display text-5xl leading-[1.05] text-ink md:text-6xl">
          Which Meteora launch settings <em className="text-accent-text">actually</em> work?
        </h1>
        <p className="mt-4 max-w-2xl text-ink-2">
          Every Dynamic Bonding Curve launch on Solana mainnet, grouped by identical settings. Curves completed within 60 seconds count as <span className="text-warn-text">instant</span>, and setting groups where almost every launch graduates are flagged <span className="text-warn-text">pre-funded</span>: the launchpad buys out its own curves. What remains is real market demand.
        </p>
        <p className={`mt-3 font-mono text-xs ${stale ? 'text-warn-text' : 'text-ink-3'}`}>
          ● scanned {timeAgo(meta.generatedAt)} · slot {meta.refSlot.toLocaleString('en')}{stale ? ' · refresh delayed' : ''}
        </p>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Launches" value={fmtCompact(t.pools)} hint={`${fmtCompact(t.presets)} setting groups · ${fmtCompact(t.configs)} configs`} delay={60} />
        <StatCard label="Instant graduations" value={fmtPct(t.instant / Math.max(1, t.pools))} hint={`${fmtCompact(t.instant)} curves done < 60 s`} tone="warn" delay={120} />
        <StatCard label="Pre-funded launchpads" value={m ? fmtPct(m.prefundedLaunches / Math.max(1, t.pools)) : '—'} hint={m ? `of launches · ${fmtCompact(m.prefundedGroups)} groups graduate ≥ 90%` : undefined} tone="warn" delay={180} />
        <StatCard label="Open-market graduation" value={m ? fmtPct(m.marketOrganic / Math.max(1, m.marketEligible)) : '—'} hint="excluding instant and pre-funded" tone="accent" delay={240} />
        <StatCard label="Dead after graduation" value={m?.postCount ? fmtPct(m.postDead / m.postCount) : '—'} hint={m?.postCount ? `of ${fmtCompact(m.postCount)} graduated tokens now < 10% of graduation price` : 'price on DAMM v2 vs graduation'} tone="warn" delay={300} />
      </section>

      <section className="flex flex-wrap items-center gap-2">
        <span className="label-caps mr-1">quote</span>
        {(['all', 'SOL', 'USDC', 'stocks', 'other'] as const).map((quote) => (
          <Chip key={quote} href={link({ quote, page: 1 })} active={q.quote === quote}>{quote}</Chip>
        ))}
        <span className="label-caps ml-4 mr-1">min launches</span>
        {[5, 20, 100, 1000].map((min) => (
          <Chip key={min} href={link({ min, page: 1 })} active={q.min === min}>≥{min}</Chip>
        ))}
        <span className="label-caps ml-4 mr-1">pre-funded</span>
        <Chip href={link({ prefunded: 'show', page: 1 })} active={q.prefunded !== 'hide'}>show</Chip>
        <Chip href={link({ prefunded: 'hide', page: 1 })} active={q.prefunded === 'hide'}>hide</Chip>
        <span className="readout ml-auto text-xs text-ink-3">{total.toLocaleString('en')} groups</span>
      </section>

      <LeaderboardTable rows={rows} q={q} offset={(page - 1) * PAGE_SIZE} />

      {pages > 1 && (
        <nav className="flex items-center gap-4 font-mono text-xs text-ink-2">
          {page > 1 && <Link href={link({ page: page - 1 })} className="hover:text-ink">← prev</Link>}
          <span className="text-ink-3">page {page} / {pages}</span>
          {page < pages && <Link href={link({ page: page + 1 })} className="hover:text-ink">next →</Link>}
        </nav>
      )}

      <details className="max-w-3xl rounded-md border border-line bg-panel/60 p-4 text-sm text-ink-2">
        <summary className="cursor-pointer text-ink">How the numbers are computed</summary>
        <ul className="mt-3 list-disc space-y-1 pl-5">
          <li>A <b>setting group</b> is every config account with byte-identical settings (curve, fees, thresholds, LP split), ignoring who claims the fees.</li>
          <li><b>Instant</b>: the curve completed within 60 s of the launch, which almost always means it was bought out in the creation transaction.</li>
          <li><b>Organic graduation</b> = graduated launches ÷ non-instant launches, shown once a group has at least 5 non-instant launches.</li>
          <li><b>Holding up</b>: for graduated tokens, the current price in the Meteora DAMM v2 pool they migrated to, compared with the graduation price. Shown as the share at or above graduation price and the median multiple; &quot;dead&quot; means below 0.1×.</li>
          <li><b>Pre-funded</b>: a group with ≥ 20 launches where ≥ 90% complete their curve. On mainnet completion is bimodal (most groups graduate under 20% or over 80%), so these are launchpads buying out their own curves, often a few blocks after creation.</li>
          <li>Slot-activated launches are timed with real block times sampled every 10,000 slots (error under 20 s).</li>
          <li>Raised and fees are quote-token amounts summed over every launch in the group.</li>
        </ul>
      </details>
    </div>
  );
}
