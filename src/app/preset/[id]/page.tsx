import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BarChart } from '@/components/charts/BarChart';
import { LineChart } from '@/components/charts/LineChart';
import { CopyButton } from '@/components/CopyButton';
import { BoltIcon } from '@/components/icons';
import { RecentLaunches } from '@/components/RecentLaunches';
import { StatCard } from '@/components/StatCard';
import { loadPreset } from '@/lib/data/load';
import { fmtCompact, fmtDuration, fmtPct, fmtQuote, plural, shortAddr } from '@/lib/format';
import { presetLabel } from '@/lib/leaderboard';
import { BUCKET_LABELS } from '@/lib/metrics/classify';

export const revalidate = 300;

const FEE_MODE = ['Linear fee decay', 'Exponential fee decay', 'Rate limiter'];

function Panel({ title, caption, children }: { title: string; caption?: string; children: React.ReactNode }) {
  return (
    <section className="rise rounded-md border border-line bg-panel/70 p-4">
      <h2 className="font-display text-xl text-ink">{title}</h2>
      {caption && <p className="mb-3 mt-0.5 text-xs text-ink-3">{caption}</p>}
      {children}
    </section>
  );
}

export default async function PresetPage({ params }: PageProps<'/preset/[id]'>) {
  const { id } = await params;
  const p = await loadPreset(id);
  if (!p) notFound();
  const q = p.quote.symbol;
  const lp = p.params.lp;
  const stalled = p.buckets.reduce((a, b) => a + b, 0);
  return (
    <div className="space-y-8">
      <header className="rise">
        <Link href="/" className="font-mono text-xs text-ink-3 hover:text-ink-2">← leaderboard</Link>
        <p className="label-caps mt-4">setting group {p.id}</p>
        <h1 className="mt-1 font-display text-4xl leading-tight text-ink md:text-5xl">{presetLabel(p)}</h1>
        <p className="mt-2 text-ink-2">
          {FEE_MODE[p.feeMode] ?? 'Custom fee'} · used by {fmtCompact(p.configCount)} config account{p.configCount === 1 ? '' : 's'} · creator gets {p.creatorFeePct}% of trading fees
        </p>
        {p.instantShare >= 0.5 && (
          <p className="mt-3 inline-flex items-center gap-2 rounded border border-amber/40 bg-amber/10 px-3 py-1.5 text-sm text-warn-text">
            <BoltIcon /> {fmtPct(p.instantShare)} of these launches completed their curve within 60 s (pre-bought), so raw graduation counts overstate demand.
          </p>
        )}
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Launches" value={fmtCompact(p.launches)} delay={40} />
        <StatCard label="Organic graduation" value={fmtPct(p.organicRate)} hint={`${fmtCompact(p.organic)} graduated after 60 s`} tone="accent" delay={80} />
        <StatCard label="Instant" value={fmtPct(p.instantShare)} hint={`${plural(p.instant, 'curve', 'curves')} done < 60 s`} tone={p.instantShare >= 0.5 ? 'warn' : 'ink'} delay={120} />
        <StatCard label="Median time to graduate" value={fmtDuration(p.medianGradSeconds)} hint="organic graduations" delay={160} />
        <StatCard label="Raised" value={fmtQuote(p.raised, q)} hint="sum over all launches" delay={200} />
        <StatCard label="Trading fees" value={fmtQuote(p.fees, q)} hint="generated on the curve" delay={240} />
        <StatCard label="Start market cap" value={p.startMcap ? fmtQuote(p.startMcap, q) : '—'} hint="approx." delay={280} />
        <StatCard label="Graduation market cap" value={p.migrationMcap ? fmtQuote(p.migrationMcap, q) : '—'} hint="approx." delay={320} />
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title={`Price as ${q} flows in`} caption={`Token price along the bonding curve until it graduates at ${fmtQuote(p.threshold, q)}. Log scale.`}>
          <LineChart points={p.curve.map((c) => ({ x: c.raised, y: c.price }))} xLabel={`${q} raised`} yLabel={`price in ${q}`} logY xFormat="compact" yFormat="sci" />
        </Panel>
        <Panel title="Fee over time" caption="Swap fee charged on the curve after launch.">
          {p.feeSchedule.length > 1 ? (
            <LineChart points={p.feeSchedule.map((f) => ({ x: f.t, y: f.bps / 100 }))} xLabel="time after launch" yLabel="fee" xFormat="duration" yFormat="pct" />
          ) : (
            <p className="py-12 text-center"><span className="readout text-4xl text-ink">{(p.startFeeBps / 100).toFixed(2)}%</span><span className="mt-2 block text-sm text-ink-3">flat for the whole curve{p.feeMode === 2 ? ', rising with trade size (rate limiter)' : ''}</span></p>
          )}
        </Panel>
        <Panel title="Where launches stall" caption={`${fmtCompact(stalled)} launches still on the curve, by how far they got toward the target; graduated (after 60 s) shown for comparison.`}>
          <BarChart
            bars={[
              ...BUCKET_LABELS.map((label, i) => ({ label, value: p.buckets[i], note: 'of target raised' })),
              { label: 'graduated', value: p.organic, tone: 'good' as const, note: 'organic graduations' },
            ]}
            labelled={['<1%', 'graduated']}
          />
        </Panel>
        <Panel title="Launches per week" caption="Last 12 weeks, by launch time.">
          <BarChart bars={p.weekly.map((w) => ({ label: new Date(w.week * 1000).toISOString().slice(5, 10), value: w.launches, note: `${w.organic} organic graduations` }))} />
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <div className="space-y-4">
          <Panel title="Launchpads using it" caption="Fee claimers (partners) of the config accounts in this group.">
            {p.topFeeClaimers[0]?.launches <= 1 ? (
              <p className="text-sm text-ink-2">Every launch here has its own config account and fee claimer ({fmtCompact(p.configCount)} configs), so the launchpad mints a fresh config per token.</p>
            ) : (
            <ul className="divide-y divide-line/60">
              {p.topFeeClaimers.map((c) => (
                <li key={c.address} className="flex items-center justify-between py-1.5 text-sm">
                  <a className="readout text-ink hover:text-accent-text" href={`https://solscan.io/account/${c.address}`} target="_blank" rel="noreferrer">{shortAddr(c.address)}</a>
                  <span className="readout text-ink-2">{plural(c.launches, 'launch', 'launches')}</span>
                </li>
              ))}
            </ul>
            )}
          </Panel>
          <Panel title="Reuse these settings" caption="Most-used config account in this group. Anyone can launch a token against it; its fee claimer earns the partner fees.">
            <div className="flex flex-wrap items-center gap-2">
              <code className="readout break-all text-sm text-ink">{p.topConfig.address}</code>
              <CopyButton text={p.topConfig.address} />
            </div>
            <p className="mt-1 text-xs text-ink-3">{plural(p.topConfig.launches, 'launch', 'launches')} on this config</p>
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <dt className="text-ink-3">Partner LP</dt><dd className="readout text-ink-2">{lp.partner}% + {lp.partnerLocked}% locked</dd>
              <dt className="text-ink-3">Creator LP</dt><dd className="readout text-ink-2">{lp.creator}% + {lp.creatorLocked}% locked</dd>
              <dt className="text-ink-3">Dynamic fee</dt><dd className="readout text-ink-2">{p.dynamicFee ? 'on' : 'off'}</dd>
              <dt className="text-ink-3">Graduated pool fee</dt><dd className="readout text-ink-2">{(p.params.migratedPoolFeeBps / 100).toFixed(2)}%</dd>
              <dt className="text-ink-3">Curve points</dt><dd className="readout text-ink-2">{p.params.curve.length}</dd>
            </dl>
          </Panel>
        </div>
        <Panel title="Latest launches" caption="Newest tokens on these settings; open curves refresh from mainnet every 15 s.">
          <RecentLaunches launches={p.recent} threshold={p.params.migrationQuoteThreshold} />
        </Panel>
      </div>
    </div>
  );
}
