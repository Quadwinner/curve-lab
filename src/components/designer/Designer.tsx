'use client';
import { useMemo, useState } from 'react';
import { LineChart } from '@/components/charts/LineChart';
import type { Feature } from '@/lib/data/types';
import { buildDesign, DEFAULT_FORM, designSnippet, QUOTES, type DesignerForm } from '@/lib/designer/build';
import { fmtQuote } from '@/lib/format';
import { SimilarPresets } from './SimilarPresets';

type NumKey = { [K in keyof DesignerForm]: DesignerForm[K] extends number ? K : never }[keyof DesignerForm];

const GROUPS: { title: string; fields: [NumKey, string, string?][] }[] = [
  {
    title: 'Market cap',
    fields: [
      ['initialMcap', 'Start market cap', 'quote'],
      ['migrationMcap', 'Graduation market cap', 'quote'],
      ['totalSupply', 'Total supply', 'tokens'],
    ],
  },
  {
    title: 'Fees on the curve',
    fields: [
      ['startFeeBps', 'Start fee', 'bps'],
      ['endFeeBps', 'End fee', 'bps'],
      ['feePeriods', 'Decay steps'],
      ['feeDurationSec', 'Decay duration', 'sec'],
      ['creatorFeePct', 'Creator share of fees', '%'],
    ],
  },
  {
    title: 'Liquidity after graduation',
    fields: [
      ['partnerLpPct', 'Partner LP', '%'],
      ['partnerLockedPct', 'Partner locked LP', '%'],
      ['creatorLpPct', 'Creator LP', '%'],
      ['creatorLockedPct', 'Creator locked LP', '%'],
    ],
  },
];

const input = 'mt-1 w-full rounded border border-line bg-bg/80 px-2 py-1.5 font-mono text-sm text-ink tabular-nums outline-none transition-colors focus:border-phosphor/70';

export function Designer({ features }: { features: Feature[] }) {
  const [form, setForm] = useState<DesignerForm>(DEFAULT_FORM);
  const result = useMemo(() => buildDesign(form), [form]);
  const symbol = form.quote;
  const setNum = (k: NumKey, v: string) => setForm((f) => ({ ...f, [k]: v === '' ? 0 : Number(v) }));

  return (
    <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
      <form className="space-y-5" onSubmit={(e) => e.preventDefault()}>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs text-ink-3">Quote token
            <select className={input} value={form.quote} onChange={(e) => setForm((f) => ({ ...f, quote: e.target.value as DesignerForm['quote'] }))}>
              {Object.keys(QUOTES).map((q) => <option key={q}>{q}</option>)}
            </select>
          </label>
          <label className="block text-xs text-ink-3">Fee decay
            <select className={input} value={form.feeMode} onChange={(e) => setForm((f) => ({ ...f, feeMode: e.target.value as DesignerForm['feeMode'] }))}>
              <option value="linear">linear</option>
              <option value="exponential">exponential</option>
            </select>
          </label>
        </div>
        {GROUPS.map((g) => (
          <fieldset key={g.title} className="rounded-md border border-line bg-panel/60 p-3">
            <legend className="label-caps px-1">{g.title}</legend>
            <div className="grid grid-cols-2 gap-x-3 gap-y-2">
              {g.fields.map(([k, label, unit]) => (
                <label key={k} className="block text-xs text-ink-3">
                  {label}
                  {unit && <span className="ml-1 text-ink-3/70">({unit === 'quote' ? symbol : unit})</span>}
                  <input type="number" min={0} step="any" className={input} value={form[k]} onChange={(e) => setNum(k, e.target.value)} />
                </label>
              ))}
            </div>
          </fieldset>
        ))}
        <label className="flex items-center gap-2 text-sm text-ink-2">
          <input type="checkbox" className="accent-[var(--phosphor)]" checked={form.dynamicFee} onChange={(e) => setForm((f) => ({ ...f, dynamicFee: e.target.checked }))} />
          Dynamic fee (volatility surcharge)
        </label>
      </form>

      <div className="min-w-0 space-y-5">
        {!result.ok ? (
          <p role="alert" className="rounded-md border border-amber/50 bg-amber/10 p-4 text-warn-text">{result.error}</p>
        ) : (
          <>
            <div className="rounded-md border border-line bg-panel/70 p-4">
              <p className="label-caps">graduates at</p>
              <p className="readout text-3xl text-ink">{fmtQuote(result.thresholdQuote, symbol)} <span className="text-base text-ink-3">raised</span></p>
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
              <section className="rounded-md border border-line bg-panel/70 p-4">
                <h2 className="font-display text-xl text-ink">Price as {symbol} flows in</h2>
                <LineChart points={result.series.map((s) => ({ x: s.raised, y: s.price }))} xLabel={`${symbol} raised`} yLabel={`price in ${symbol}`} logY xFormat="compact" yFormat="sci" />
              </section>
              <section className="rounded-md border border-line bg-panel/70 p-4">
                <h2 className="font-display text-xl text-ink">Fee over time</h2>
                {result.fee.length > 1 ? (
                  <LineChart points={result.fee.map((f) => ({ x: f.t, y: f.bps / 100 }))} xLabel="time after launch" yLabel="fee" xFormat="duration" yFormat="pct" />
                ) : (
                  <p className="py-12 text-center"><span className="readout text-4xl text-ink">{(result.fee[0].bps / 100).toFixed(2)}%</span><span className="mt-2 block text-sm text-ink-3">flat for the whole curve</span></p>
                )}
              </section>
            </div>
            <section className="rounded-md border border-line bg-panel/70 p-4">
              <h2 className="mb-2 font-display text-xl text-ink">Evidence from mainnet</h2>
              <SimilarPresets features={features} v={result.features} quoteMint={QUOTES[form.quote].mint} symbol={symbol} />
            </section>
            <details className="rounded-md border border-line bg-panel/70 p-4">
              <summary className="cursor-pointer text-sm text-ink">Export as TypeScript</summary>
              <pre className="mt-3 overflow-x-auto rounded bg-bg/80 p-3 font-mono text-xs text-ink-2">{designSnippet(form)}</pre>
            </details>
          </>
        )}
      </div>
    </div>
  );
}
