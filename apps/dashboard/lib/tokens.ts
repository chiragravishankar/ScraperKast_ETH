/**
 * lib/tokens.ts
 *
 * ERC-20 token lists per testnet network.
 * All addresses come from official testnet deployments — none are hardcoded
 * in middleware or route logic. Update here to add new tokens.
 */

import type { NetworkKey } from './config';

export interface Token {
  symbol:   string;
  address:  string;   // checksummed address
  decimals: number;
  name:     string;
  logoUrl?: string;
}

// ── Base Sepolia ──────────────────────────────────────────────────────────────

const BASE_SEPOLIA_TOKENS: Token[] = [
  {
    symbol:   'WETH',
    address:  '0x4200000000000000000000000000000000000006',
    decimals: 18,
    name:     'Wrapped Ether',
  },
  {
    symbol:   'DAI',
    address:  '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb',
    decimals: 18,
    name:     'Dai Stablecoin',
  },
  {
    symbol:   'USDT',
    address:  '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2',
    decimals: 6,
    name:     'Tether USD',
  },
];

// ── Sepolia ───────────────────────────────────────────────────────────────────

const SEPOLIA_TOKENS: Token[] = [
  {
    symbol:   'WETH',
    address:  '0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9',
    decimals: 18,
    name:     'Wrapped Ether',
  },
  {
    symbol:   'DAI',
    address:  '0x3e622317f8C93f7328350cF0B56d9eD4C620C5d6',
    decimals: 18,
    name:     'Dai Stablecoin',
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const TOKEN_MAP: Record<NetworkKey, Token[]> = {
  'base-sepolia': BASE_SEPOLIA_TOKENS,
  sepolia:        SEPOLIA_TOKENS,
};

/**
 * Returns the list of tokens a bot can use to pay on a given network.
 * USDC is intentionally excluded — it's the output, not the input.
 */
export function getTokenList(network: string): Token[] {
  return TOKEN_MAP[network as NetworkKey] ?? [];
}

/**
 * Look up token metadata by address (case-insensitive).
 */
export function getTokenByAddress(address: string, network: string): Token | undefined {
  return getTokenList(network).find(
    t => t.address.toLowerCase() === address.toLowerCase(),
  );
}

/**
 * Look up token metadata by symbol.
 */
export function getTokenBySymbol(symbol: string, network: string): Token | undefined {
  return getTokenList(network).find(
    t => t.symbol.toUpperCase() === symbol.toUpperCase(),
  );
}

/**
 * Resolve decimals for an address — uses token list first, falls back to 18.
 */
export function getTokenDecimals(address: string, network: string): number {
  return getTokenByAddress(address, network)?.decimals ?? 18;
}
