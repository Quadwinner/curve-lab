'use client';
import type { ConfigParameters } from '@meteora-ag/dynamic-bonding-curve-sdk';
import { CreateConfigButton } from './CreateConfigButton';
import { WalletProviders } from './WalletProviders';

export function DevnetCreate({ config }: { config: ConfigParameters }) {
  return (
    <WalletProviders>
      <CreateConfigButton config={config} />
    </WalletProviders>
  );
}
