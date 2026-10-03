export function Sparkline({ values, width = 96, height = 26, delay = 0 }: { values: number[]; width?: number; height?: number; delay?: number }) {
  if (values.length < 2) return <span className="text-ink-3">—</span>;
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${((i / (values.length - 1)) * (width - 2) + 1).toFixed(1)},${(height - 3 - v * (height - 6)).toFixed(1)}`).join('');
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden className="overflow-visible">
      <path d={d} fill="none" stroke="var(--phosphor)" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" pathLength={1} className="trace draw" style={{ ['--len' as string]: 1, animationDelay: `${delay}ms` }} />
    </svg>
  );
}
