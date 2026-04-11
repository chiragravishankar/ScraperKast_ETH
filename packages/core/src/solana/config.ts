import type { NetworkConfig } from './types.js';

export const NETWORKS: Record<'devnet' | 'mainnet', NetworkConfig> = {
  devnet: {
    network:     'devnet',
    rpcUrl:      'https://api.devnet.solana.com',
    usdcMint:    '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
    explorerUrl: 'https://explorer.solana.com?cluster=devnet',
  },
  mainnet: {
    network:     'mainnet',
    rpcUrl:      'https://api.mainnet-beta.solana.com',
    usdcMint:    'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    explorerUrl: 'https://explorer.solana.com',
  },
};

/**
 * Returns the active network config.
 * Reads SOLANA_NETWORK from the environment; defaults to 'devnet'.
 * Logs which network is active on first call.
 */
export function getCurrentConfig(): NetworkConfig {
  const raw = (process.env['SOLANA_NETWORK'] ?? 'devnet').toLowerCase();
  const network = raw === 'mainnet' ? 'mainnet' : 'devnet';

  if (network === 'mainnet') {
    console.warn('🔴 MAINNET MODE - REAL MONEY!');
  } else {
    console.log('🟡 DEVNET MODE - Test environment');
  }

  return NETWORKS[network];
}
