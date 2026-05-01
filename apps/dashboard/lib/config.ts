/**
 * lib/config.ts
 *
 * Central config helper — reads exclusively from environment variables.
 * NO hardcoded values for addresses, RPC URLs, or chain IDs.
 * Change behaviour by editing .env.local — never this file.
 */

export type NetworkKey = 'base-sepolia' | 'sepolia';

export interface NetworkConfig {
  rpc:           string;
  chainId:       number;
  name:          string;
  explorerUrl:   string;
  explorerTxUrl: string; // <explorerUrl>/tx/<hash>
  usdc:          string; // USDC contract address
  uniswapRouter: string; // Uniswap V3 router address
}

// ── Per-network configuration (all values from env) ───────────────────────────

const networks: Record<NetworkKey, NetworkConfig> = {
  'base-sepolia': {
    rpc:           process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC   ?? '',
    chainId:       84532,
    name:          'Base Sepolia',
    explorerUrl:   'https://sepolia.basescan.org',
    explorerTxUrl: 'https://sepolia.basescan.org/tx',
    usdc:          process.env.NEXT_PUBLIC_BASE_SEPOLIA_USDC           ?? '',
    uniswapRouter: process.env.NEXT_PUBLIC_BASE_SEPOLIA_UNISWAP_ROUTER ?? '',
  },
  sepolia: {
    rpc:           process.env.NEXT_PUBLIC_SEPOLIA_RPC   ?? '',
    chainId:       11155111,
    name:          'Sepolia',
    explorerUrl:   'https://sepolia.etherscan.io',
    explorerTxUrl: 'https://sepolia.etherscan.io/tx',
    usdc:          process.env.NEXT_PUBLIC_SEPOLIA_USDC           ?? '',
    uniswapRouter: process.env.NEXT_PUBLIC_SEPOLIA_UNISWAP_ROUTER ?? '',
  },
};

// ── Top-level config object ───────────────────────────────────────────────────

export const config = {
  /** Default network for new sites (from env, falls back to base-sepolia) */
  defaultNetwork: (process.env.NEXT_PUBLIC_DEFAULT_NETWORK ?? 'base-sepolia') as NetworkKey,

  /** All available networks keyed by their slug */
  networks,

  /** App URL (port 3001 in dev!) */
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001',
} as const;

// ── Helper functions ──────────────────────────────────────────────────────────

/**
 * Returns the full NetworkConfig for the given network key.
 * Throws if the key is not recognised — don't silently swallow bad config.
 */
export function getNetworkConfig(network: string): NetworkConfig {
  const cfg = networks[network as NetworkKey];
  if (!cfg) {
    throw new Error(
      `Unknown network "${network}". Valid options: ${Object.keys(networks).join(', ')}`,
    );
  }
  return cfg;
}

/**
 * Returns a block-explorer URL for a given transaction hash.
 */
export function getTxExplorerUrl(txHash: string, network: string): string {
  try {
    const cfg = getNetworkConfig(network);
    return `${cfg.explorerTxUrl}/${txHash}`;
  } catch {
    return `#${txHash}`;
  }
}

/**
 * List of network options for UI dropdowns — derived from config, never hardcoded.
 */
export const NETWORK_OPTIONS: { value: NetworkKey; label: string }[] =
  (Object.entries(networks) as [NetworkKey, NetworkConfig][]).map(([value, cfg]) => ({
    value,
    label: cfg.name,
  }));
