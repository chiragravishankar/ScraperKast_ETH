'use client';

import { useMemo } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { clusterApiUrl } from '@solana/web3.js';
import '@solana/wallet-adapter-react-ui/styles.css';

export default function SolanaProviders({ children }: { children: React.ReactNode }) {
  const endpoint = useMemo(() => {
    const url = clusterApiUrl('devnet');
    console.log('[SolanaProviders] RPC endpoint:', url);
    return url;
  }, []);

  // Empty array — Phantom, Solflare, and other modern wallets self-register via
  // the Wallet Standard protocol. Explicitly constructing their adapters here
  // creates duplicate entries and console warnings.
  const wallets = useMemo(() => [], []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
