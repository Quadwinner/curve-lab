import type { Metadata } from 'next';
import { IBM_Plex_Mono, IBM_Plex_Sans, Instrument_Serif } from 'next/font/google';
import { SiteHeader } from '@/components/SiteHeader';
import './globals.css';

const display = Instrument_Serif({ variable: '--font-instrument-serif', subsets: ['latin'], weight: '400', style: ['normal', 'italic'] });
const sans = IBM_Plex_Sans({ variable: '--font-plex-sans', subsets: ['latin'], weight: ['400', '500', '600'] });
const mono = IBM_Plex_Mono({ variable: '--font-plex-mono', subsets: ['latin'], weight: ['400', '500'] });

export const metadata: Metadata = {
  title: 'Curve Lab — Meteora DBC launch settings ranked by real outcomes',
  description: 'Which Meteora Dynamic Bonding Curve settings actually graduate tokens? Every mainnet launch, grouped by settings, with instant (pre-bought) graduations separated out.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable} antialiased`}>
      <body className="min-h-screen font-sans">
        <SiteHeader />
        <div className="mx-auto flex max-w-[1440px] gap-6 px-5 py-8">
          <main className="min-w-0 flex-1">{children}</main>
          <aside id="live-feed-slot" className="hidden w-72 shrink-0 2xl:block" />
        </div>
      </body>
    </html>
  );
}
