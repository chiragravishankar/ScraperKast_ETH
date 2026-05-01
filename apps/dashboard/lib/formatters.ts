/** Format µUSDC → human-readable USDC string. 1 USDC = 1_000_000 µUSDC. */
export function formatUsdc(microUsdc: number, decimals = 4): string {
  return (microUsdc / 1_000_000).toFixed(decimals);
}

/** Format µUSDC as a dollar-sign string, e.g. "$0.0120". */
export function formatUsdcDollar(microUsdc: number): string {
  const usdc = microUsdc / 1_000_000;
  return usdc >= 1
    ? `$${usdc.toFixed(2)}`
    : `$${usdc.toFixed(4)}`;
}

/** Shorten a base58 string to "XXXX…XXXX" (8 chars each side). */
export function shortenHash(hash: string, chars = 8): string {
  if (hash.length <= chars * 2 + 3) return hash;
  return `${hash.slice(0, chars)}…${hash.slice(-chars)}`;
}

/** Shorten a wallet address similarly. */
export function shortenAddress(address: string): string {
  return shortenHash(address, 4);
}

/** Relative time, e.g. "2m ago", "just now". */
export function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 5)   return 'just now';
  if (seconds < 60)  return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

/** Format a percentage with sign, e.g. "+12.3%" or "-4.1%". */
export function formatPctChange(current: number, previous: number): { text: string; positive: boolean } {
  if (previous === 0) return { text: '+0%', positive: true };
  const pct = ((current - previous) / previous) * 100;
  const positive = pct >= 0;
  return { text: `${positive ? '+' : ''}${pct.toFixed(1)}%`, positive };
}

/** Compact large numbers: 1247 → "1.2k", 1_234_567 → "1.2M". */
export function compactNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

/** Format date as "Apr 16, 14:23". */
export function formatDateTime(date: Date): string {
  return date.toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

/** Build a blockchain explorer URL for a transaction hash (Base Sepolia / Sepolia). */
export function explorerUrl(txHash: string, network: 'base-sepolia' | 'sepolia' = 'base-sepolia'): string {
  const base = network === 'sepolia'
    ? 'https://sepolia.etherscan.io'
    : 'https://sepolia.basescan.org';
  return `${base}/tx/${txHash}`;
}
