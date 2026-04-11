export * from './config.js';
export * from './connection.js';
export * from './types.js';

import { NETWORKS, getCurrentConfig } from './config.js';

/** Returns the active network name without logging. */
export function getCurrentNetwork(): 'devnet' | 'mainnet' {
  const raw = (process.env['SOLANA_NETWORK'] ?? 'devnet').toLowerCase();
  return raw === 'mainnet' ? 'mainnet' : 'devnet';
}

/**
 * Returns the Solana Explorer URL for a given address or transaction,
 * using the active network's explorer base URL.
 */
export function getExplorerUrl(address: string): string {
  const network = getCurrentNetwork();
  const { explorerUrl } = NETWORKS[network];
  return `${explorerUrl}/address/${address}`;
}

// Silence unused-import warning — re-exported for convenience
export { getCurrentConfig };
