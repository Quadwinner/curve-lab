import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="py-24 text-center">
      <p className="font-display text-3xl text-ink">No detail page for this setting group yet</p>
      <p className="mt-2 text-ink-2">Detail pages exist for groups with at least 20 launches.</p>
      <Link href="/" className="mt-6 inline-block font-mono text-sm text-accent-text hover:underline">← back to the leaderboard</Link>
    </div>
  );
}
