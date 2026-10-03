import Link from 'next/link';

export const REPO_URL = 'https://github.com/Quadwinner/curve-lab';

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-bg/85 backdrop-blur">
      <nav className="mx-auto flex max-w-[1440px] items-center gap-6 px-5 py-3">
        <Link href="/" className="flex items-baseline gap-2">
          <span className="font-display text-2xl leading-none text-ink">Curve Lab</span>
          <span className="label-caps hidden sm:inline">meteora dbc · mainnet</span>
        </Link>
        <div className="ml-4 flex gap-5 text-sm">
          <Link href="/" className="text-ink-2 transition-colors hover:text-ink">Leaderboard</Link>
          <Link href="/designer" className="text-ink-2 transition-colors hover:text-ink">Designer</Link>
        </div>
        <a href={REPO_URL} className="ml-auto text-sm text-ink-3 transition-colors hover:text-ink" target="_blank" rel="noreferrer">GitHub</a>
      </nav>
    </header>
  );
}
