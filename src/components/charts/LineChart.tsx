'use client';
import { useMemo, useRef, useState } from 'react';
import { fmtCompact, fmtDuration } from '@/lib/format';

type Pt = { x: number; y: number };

const FORMATS = {
  plain: (n: number) => String(Number(n.toPrecision(3))),
  compact: (n: number) => fmtCompact(n),
  sci: (n: number) => (n === 0 ? '0' : n.toExponential(1)),
  duration: (n: number) => fmtDuration(n),
  pct: (n: number) => `${Number(n.toFixed(2))}%`,
};
export type ChartFormat = keyof typeof FORMATS;

const W = 600;
const L = 64;
const R = 12;
const T = 12;
const B = 30;

function niceTicks(lo: number, hi: number, count = 4): number[] {
  if (hi <= lo) return [lo];
  const raw = (hi - lo) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-9; v += step) out.push(Number(v.toPrecision(12)));
  return out;
}

export function LineChart({
  points,
  xLabel,
  yLabel,
  logY = false,
  height = 240,
  xFormat = 'plain',
  yFormat = 'plain',
}: {
  points: Pt[];
  xLabel: string;
  yLabel: string;
  logY?: boolean;
  height?: number;
  xFormat?: ChartFormat;
  yFormat?: ChartFormat;
}) {
  const fmtX = FORMATS[xFormat];
  const fmtY = FORMATS[yFormat];
  const ref = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const H = height;
  const geo = useMemo(() => {
    const ty = (y: number) => (logY ? Math.log10(Math.max(y, 1e-300)) : y);
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => ty(p.y));
    const x0 = Math.min(...xs);
    const x1 = Math.max(...xs);
    let y0 = Math.min(...ys);
    let y1 = Math.max(...ys);
    if (!logY) y0 = Math.min(0, y0);
    if (y1 - y0 < 1e-12) {
      y0 -= 1;
      y1 += 1;
    }
    const sx = (x: number) => L + ((x - x0) / (x1 - x0 || 1)) * (W - L - R);
    const sy = (y: number) => H - B - ((ty(y) - y0) / (y1 - y0)) * (H - B - T);
    const yTicks = logY
      ? niceTicks(Math.ceil(y0), Math.floor(y1), 4).filter(Number.isInteger).map((k) => 10 ** k)
      : niceTicks(y0, y1, 4);
    return { sx, sy, xTicks: niceTicks(x0, x1, 4), yTicks };
  }, [points, logY, H]);

  if (points.length < 2) return <p className="py-10 text-center text-sm text-ink-3">Not enough data for this chart.</p>;
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${geo.sx(p.x).toFixed(1)},${geo.sy(p.y).toFixed(1)}`).join('');

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const box = ref.current!.getBoundingClientRect();
    const x = ((e.clientX - box.left) / box.width) * W;
    let best = 0;
    for (let i = 1; i < points.length; i++) if (Math.abs(geo.sx(points[i].x) - x) < Math.abs(geo.sx(points[best].x) - x)) best = i;
    setHover(best);
  };
  const hp = hover === null ? null : points[hover];

  return (
    <figure className="relative">
      <svg ref={ref} viewBox={`0 0 ${W} ${H}`} className="w-full touch-none select-none" role="img" aria-label={`${yLabel} by ${xLabel}`} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        {geo.yTicks.map((v) => (
          <g key={`y${v}`}>
            <line x1={L} x2={W - R} y1={geo.sy(v)} y2={geo.sy(v)} stroke="var(--line)" />
            <text x={L - 8} y={geo.sy(v) + 3.5} textAnchor="end" className="fill-ink-3 font-mono text-[10px]">{fmtY(v)}</text>
          </g>
        ))}
        {geo.xTicks.map((v) => (
          <text key={`x${v}`} x={geo.sx(v)} y={H - B + 16} textAnchor="middle" className="fill-ink-3 font-mono text-[10px]">{fmtX(v)}</text>
        ))}
        <line x1={L} x2={W - R} y1={H - B} y2={H - B} stroke="var(--ink-3)" strokeOpacity={0.5} />
        <path d={d} fill="none" stroke="var(--phosphor)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" pathLength={1} className="trace draw" style={{ ['--len' as string]: 1 }} />
        {hp && (
          <g>
            <line x1={geo.sx(hp.x)} x2={geo.sx(hp.x)} y1={T} y2={H - B} stroke="var(--ink-2)" strokeDasharray="3 3" strokeOpacity={0.6} />
            <circle cx={geo.sx(hp.x)} cy={geo.sy(hp.y)} r={4.5} fill="var(--phosphor)" stroke="var(--bg)" strokeWidth={2} />
          </g>
        )}
        <rect x={L} y={T} width={W - L - R} height={H - B - T} fill="transparent" />
      </svg>
      <figcaption className="label-caps mt-1 flex justify-between"><span>{yLabel}</span><span>{xLabel}</span></figcaption>
      {hp && (
        <div
          className="pointer-events-none absolute z-10 rounded border border-line bg-panel-2 px-2 py-1 font-mono text-xs text-ink shadow-lg"
          style={{ left: `${(geo.sx(hp.x) / W) * 100}%`, top: 0, transform: `translateX(${geo.sx(hp.x) > W * 0.7 ? '-105%' : '8px'})` }}
        >
          <div>{fmtY(hp.y)}</div>
          <div className="text-ink-3">{fmtX(hp.x)}</div>
        </div>
      )}
    </figure>
  );
}
