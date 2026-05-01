/**
 * lib/wallet/hot-wallet.ts
 *
 * Platform hot-wallet utilities for ScraperKast.
 * Used SERVER-SIDE ONLY (Node.js runtime, never Edge/client).
 *
 * Responsibilities:
 *  • Sign and broadcast USDC transfers from the platform wallet
 *  • Read the platform wallet's USDC balance
 *  • Provide the platform wallet address for the 402 response
 *
 * ⚠️  TESTNET ONLY — Base Sepolia.
 *      NEVER put a mainnet private key in environment variables.
 *      NEVER import this module in client components.
 */

import {
  createWalletClient,
  createPublicClient,
  http,
  parseUnits,
  parseAbi,
  type Address,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import { getNetworkConfig } from '@/lib/config';

// ── ABI fragments ─────────────────────────────────────────────────────────────

const ERC20_READ_ABI = parseAbi([
  'function balanceOf(address account) view returns (uint256)',
]);

const ERC20_WRITE_ABI = parseAbi([
  'function transfer(address to, uint256 amount) returns (bool)',
]);

// ── Chain resolver ────────────────────────────────────────────────────────────

function getChain(network: string) {
  if (network === 'base-sepolia') return baseSepolia;
  // Add more networks here as needed (e.g. mainnet, sepolia)
  throw new Error(`Unsupported hot-wallet network: "${network}"`);
}

function getPrivateKey(network: string): `0x${string}` {
  const key = process.env.PLATFORM_WALLET_PRIVATE_KEY_BASE_SEPOLIA;
  if (!key) {
    throw new Error(
      `Platform wallet private key not configured. ` +
      `Set PLATFORM_WALLET_PRIVATE_KEY_BASE_SEPOLIA in .env.local`,
    );
  }
  const normalized = key.startsWith('0x') ? key : `0x${key}`;
  return normalized as `0x${string}`;
}

// ── Account + clients ─────────────────────────────────────────────────────────

/**
 * Returns the viem Account for the platform hot wallet.
 * Throws if the private key env var is missing.
 */
export function getHotWalletAccount(network = 'base-sepolia') {
  return privateKeyToAccount(getPrivateKey(network));
}

/**
 * Returns a viem WalletClient (can sign + send transactions) for the hot wallet.
 */
export function getHotWalletClient(network = 'base-sepolia') {
  const account    = getHotWalletAccount(network);
  const networkCfg = getNetworkConfig(network);
  return createWalletClient({
    account,
    chain:     getChain(network),
    transport: http(networkCfg.rpc),
  });
}

/**
 * Returns a viem PublicClient (read-only) for the given network.
 */
export function getPublicClient(network = 'base-sepolia') {
  const networkCfg = getNetworkConfig(network);
  return createPublicClient({
    chain:     getChain(network),
    transport: http(networkCfg.rpc),
  });
}

/**
 * Returns the platform wallet's public address.
 * Falls back to deriving it from the private key if the env var is not set.
 */
export function getPlatformWalletAddress(network = 'base-sepolia'): string {
  const fromEnv = process.env.NEXT_PUBLIC_PLATFORM_WALLET_BASE_SEPOLIA;
  if (fromEnv) return fromEnv;

  // Fall back: derive from private key (adds a tiny overhead on first call)
  try {
    return getHotWalletAccount(network).address;
  } catch {
    return '';
  }
}

// ── USDC balance ──────────────────────────────────────────────────────────────

/**
 * Returns the platform wallet's USDC balance as a plain number (human units).
 * e.g. 12.5 → $12.50 USDC
 */
export async function getHotWalletBalance(network = 'base-sepolia'): Promise<number> {
  const networkCfg    = getNetworkConfig(network);
  const walletAddress = getPlatformWalletAddress(network);

  if (!walletAddress) return 0;

  const client = getPublicClient(network);

  const raw = await client.readContract({
    address:      networkCfg.usdc as Address,
    abi:          ERC20_READ_ABI,
    functionName: 'balanceOf',
    args:         [walletAddress as Address],
  });

  return Number(raw) / 1_000_000; // USDC has 6 decimals
}

// ── USDC transfer ─────────────────────────────────────────────────────────────

export interface TransferResult {
  txHash:      string;
  success:     boolean;
  blockNumber: number;
}

/**
 * Transfers USDC from the platform hot wallet to a recipient address.
 *
 * @param to       Recipient Ethereum address
 * @param amount   Amount in human USDC (e.g. 1.5 → $1.50)
 * @param network  "base-sepolia" (default)
 *
 * @throws If private key is missing, RPC fails, or the tx reverts.
 */
export async function executeUSDCTransfer({
  to,
  amount,
  network = 'base-sepolia',
}: {
  to:       string;
  amount:   number;
  network?: string;
}): Promise<TransferResult> {
  const networkCfg   = getNetworkConfig(network);
  const walletClient = getHotWalletClient(network);
  const publicClient = getPublicClient(network);

  // 6 decimal places — convert human amount to base units
  const amountWei = parseUnits(amount.toFixed(6), 6);

  // Broadcast the ERC-20 transfer
  const hash = await walletClient.writeContract({
    address:      networkCfg.usdc as Address,
    abi:          ERC20_WRITE_ABI,
    functionName: 'transfer',
    args:         [to as Address, amountWei],
  });

  // Wait for on-chain confirmation (1 block)
  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  if (receipt.status !== 'success') {
    throw new Error(`USDC transfer reverted. txHash: ${hash}`);
  }

  return {
    txHash:      hash,
    success:     true,
    blockNumber: Number(receipt.blockNumber),
  };
}

// ── Safety guards ─────────────────────────────────────────────────────────────

/** Returns true if the platform wallet is configured (key + address present). */
export function isPlatformWalletConfigured(network = 'base-sepolia'): boolean {
  return Boolean(process.env.PLATFORM_WALLET_PRIVATE_KEY_BASE_SEPOLIA) &&
         Boolean(getPlatformWalletAddress(network));
}

/**
 * Validates a proposed withdrawal against the configured limits.
 * Returns an error string or null if valid.
 */
export function validateWithdrawalAmount(amount: number): string | null {
  const min = parseFloat(process.env.MIN_WITHDRAWAL_AMOUNT ?? '0.01');
  const max = parseFloat(process.env.MAX_WITHDRAWAL_AMOUNT ?? '1000');

  if (isNaN(amount) || amount <= 0) return 'Amount must be a positive number';
  if (amount < min)                 return `Minimum withdrawal is $${min} USDC`;
  if (amount > max)                 return `Maximum withdrawal is $${max} USDC`;
  return null;
}
