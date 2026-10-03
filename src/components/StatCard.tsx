export function StatCard({ label, value, hint, tone = 'ink', delay = 0 }: { label: string; value: string; hint?: string; tone?: 'ink' | 'warn' | 'accent'; delay?: number }) {
  const color = tone === 'warn' ? 'text-warn-text' : tone === 'accent' ? 'text-accent-text' : 'text-ink';
  return (
    <div className="rise relative overflow-hidden rounded-md border border-line bg-panel/80 px-4 py-3 backdrop-blur-sm" style={{ animationDelay: `${delay}ms` }}>
      <div className="label-caps">{label}</div>
      <div className={`readout mt-1 text-[1.65rem] leading-tight ${color}`}>{value}</div>
      {hint && <div className="mt-0.5 text-xs text-ink-3">{hint}</div>}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-phosphor/40 to-transparent" />
    </div>
  );
}
