'use client';
import { useState } from 'react';

export type Bar = { label: string; value: number; tone?: 'neutral' | 'good' | 'warn'; note?: string };

const FILL = { neutral: 'var(--mark-neutral)', good: 'var(--phosphor)', warn: 'var(--amber)' };

export function BarChart({ bars, height = 180, labelled = [] }: { bars: Bar[]; height?: number; labelled?: string[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...bars.map((b) => b.value));
  const W = 600;
  const top = 18;
  const base = height - 26;
  const gap = 2;
  const slot = W / bars.length;
  const width = Math.max(4, slot - gap - 10);
  return (
    <figure className="relative">
      <svg viewBox={`0 0 ${W} ${height}`} className="w-full" role="img" aria-label={bars.map((b) => `${b.label}: ${b.value}`).join(', ')} onMouseLeave={() => setHover(null)}>
        <line x1={0} x2={W} y1={base} y2={base} stroke="var(--ink-3)" strokeOpacity={0.5} />
        {bars.map((b, i) => {
          const h = (b.value / max) * (base - top);
          const x = i * slot + (slot - width) / 2;
          const r = Math.min(4, h / 2, width / 2);
          const path = h <= 0 ? '' : `M${x},${base} V${base - h + r} Q${x},${base - h} ${x + r},${base - h} H${x + width - r} Q${x + width},${base - h} ${x + width},${base - h + r} V${base} Z`;
          return (
            <g key={b.label} onMouseEnter={() => setHover(i)}>
              <rect x={i * slot} y={0} width={slot} height={height} fill="transparent" />
              {path && <path d={path} fill={FILL[b.tone ?? 'neutral']} opacity={hover === null || hover === i ? 1 : 0.55} />}
              {labelled.includes(b.label) && (
                <text x={x + width / 2} y={base - h - 5} textAnchor="middle" className="fill-ink-2 font-mono text-[10px]">{b.value.toLocaleString('en')}</text>
              )}
              <text x={x + width / 2} y={height - 8} textAnchor="middle" className="fill-ink-3 font-mono text-[10px]">{b.label}</text>
            </g>
          );
        })}
      </svg>
      {hover !== null && (
        <div className="pointer-events-none absolute top-0 z-10 rounded border border-line bg-panel-2 px-2 py-1 font-mono text-xs text-ink shadow-lg" style={{ left: `${((hover + 0.5) / bars.length) * 100}%`, transform: 'translateX(-50%)' }}>
          {bars[hover].label}: {bars[hover].value.toLocaleString('en')}
          {bars[hover].note && <div className="text-ink-3">{bars[hover].note}</div>}
        </div>
      )}
    </figure>
  );
}
