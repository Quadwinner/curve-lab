import { Designer } from '@/components/designer/Designer';
import { loadFeatures } from '@/lib/data/load';

export const revalidate = 300;

export default async function DesignerPage() {
  const features = (await loadFeatures()) ?? [];
  return (
    <div className="space-y-6">
      <header className="rise max-w-3xl">
        <p className="label-caps">designer</p>
        <h1 className="mt-1 font-display text-5xl leading-tight text-ink">Design a launch setting</h1>
        <p className="mt-3 text-ink-2">Shape a Meteora Dynamic Bonding Curve, see how the closest real settings on mainnet actually performed, then create it on devnet or export the code.</p>
      </header>
      <Designer features={features} />
    </div>
  );
}
