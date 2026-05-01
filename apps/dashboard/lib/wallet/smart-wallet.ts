/**
 * lib/wallet/smart-wallet.ts
 *
 * Per-user deterministic smart wallet utilities.
 * SERVER-SIDE ONLY — never import from client components.
 *
 * Each user gets a unique Ethereum wallet address derived from their userId.
 * The private key is stored encrypted in the database so bots can pay directly
 * to the user's address, and users can withdraw funds from it.
 *
 * ⚠️  TESTNET ONLY. Never use this with real funds without a proper KMS.
 */

import { keccak256, toHex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import {
  createWalletClient,
  createPublicClient,
  http,
  parseUnits,
  parseAbi,
  type Address,
} from 'viem';
import { baseSepolia } from 'viem/chains';
import crypto from 'crypto';
import { getNetworkConfig } from '@/lib/config';
import type { PrismaClient } from '@prisma/client';

// ── Encryption config ─────────────────────────────────────────────────────────

const ENCRYPTION_KEY = process.env.WALLET_ENCRYPTION_KEY ?? 'default-key-change-in-production-xx';

/** Normalise the encryption key to exactly 32 bytes. */
function getKeyBuf(): Buffer {
  return Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32));
}

/** Fixed IV — acceptable for testnet / hackathon. Use a per-record IV in prod. */
const FIXED_IV = Buffer.alloc(16, 0);

// ── Key generation ────────────────────────────────────────────────────────────

/**
 * Generate a deterministic wallet for a user from their userId.
 *
 * seed = keccak256(hex(userId))  →  used directly as the 32-byte private key.
 * Because cuid/UUID userIds are opaque, this is safe for testnet purposes.
 */
export function generateUserWallet(userId: string): { address: string; privateKey: `0x${string}` } {
  const seed    = keccak256(toHex(userId));          // 0x-prefixed 32-byte hex
  const account = privateKeyToAccount(seed as `0x${string}`);
  return { address: account.address, privateKey: seed as `0x${string}` };
}

// ── Encryption helpers ────────────────────────────────────────────────────────

/** AES-256-CBC encrypt a private key string for DB storage. */
export function encryptPrivateKey(privateKey: string): string {
  const cipher    = crypto.createCipheriv('aes-256-cbc', getKeyBuf(), FIXED_IV);
  const encrypted = cipher.update(privateKey, 'utf8', 'hex') + cipher.final('hex');
  return encrypted;
}

/** Reverse of `encryptPrivateKey`. */
export function decryptPrivateKey(encryptedKey: string): string {
  const decipher  = crypto.createDecipheriv('aes-256-cbc', getKeyBuf(), FIXED_IV);
  const decrypted = decipher.update(encryptedKey, 'hex', 'utf8') + decipher.final('utf8');
  return decrypted;
}

// ── Ensure wallet exists ──────────────────────────────────────────────────────

/**
 * Returns the user's smart wallet, creating and persisting it if it doesn't
 * exist yet. Idempotent — safe to call on every request.
 */
export async function ensureUserWallet(
  userId: string,
  prisma: PrismaClient,
): Promise<{ address: string; encryptedKey: string }> {
  const user = await prisma.user.findUnique({
    where:  { id: userId },
    select: { smartWalletAddress: true, smartWalletEncryptedKey: true },
  });

  if (user?.smartWalletAddress && user.smartWalletEncryptedKey) {
    return {
      address:      user.smartWalletAddress,
      encryptedKey: user.smartWalletEncryptedKey,
    };
  }

  // Generate + persist (upsert handles the case where the Prisma user row
  // doesn't exist yet for a brand-new Supabase sign-up)
  const wallet       = generateUserWallet(userId);
  const encryptedKey = encryptPrivateKey(wallet.privateKey);

  await prisma.user.upsert({
    where:  { id: userId },
    create: {
      id:                      userId,
      email:                   `wallet-${userId}@scraperkast.internal`,
      smartWalletAddress:      wallet.address,
      smartWalletEncryptedKey: encryptedKey,
    },
    update: {
      smartWalletAddress:      wallet.address,
      smartWalletEncryptedKey: encryptedKey,
    },
  });

  return { address: wallet.address, encryptedKey };
}

// ── Transfer from user's smart wallet ────────────────────────────────────────

const ERC20_TRANSFER_ABI = parseAbi([
  'function transfer(address to, uint256 amount) returns (bool)',
]);

export interface SmartWalletTransferResult {
  txHash:  string;
  success: boolean;
}

/**
 * Send USDC from a user's smart wallet to a destination address.
 *
 * @param encryptedKey  The `smartWalletEncryptedKey` field from the DB
 * @param to            Destination Ethereum address
 * @param amount        Human-readable USDC amount (e.g. 1.5 = $1.50)
 * @param network       Defaults to "base-sepolia"
 */
export async function transferFromSmartWallet({
  encryptedKey,
  to,
  amount,
  network = 'base-sepolia',
}: {
  encryptedKey: string;
  to:           string;
  amount:       number;
  network?:     string;
}): Promise<SmartWalletTransferResult> {
  if (network !== 'base-sepolia') {
    throw new Error(`Unsupported network for smart wallet transfers: "${network}"`);
  }

  const networkCfg = getNetworkConfig(network);
  const privateKey = decryptPrivateKey(encryptedKey) as `0x${string}`;
  const account    = privateKeyToAccount(privateKey);

  const walletClient = createWalletClient({
    account,
    chain:     baseSepolia,
    transport: http(networkCfg.rpc),
  });

  const publicClient = createPublicClient({
    chain:     baseSepolia,
    transport: http(networkCfg.rpc),
  });

  const amountWei = parseUnits(amount.toFixed(6), 6);

  const hash = await walletClient.writeContract({
    address:      networkCfg.usdc as Address,
    abi:          ERC20_TRANSFER_ABI,
    functionName: 'transfer',
    args:         [to as Address, amountWei],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  if (receipt.status !== 'success') {
    throw new Error(`USDC transfer reverted. txHash: ${hash}`);
  }

  return { txHash: hash, success: true };
}

// ── Validation ────────────────────────────────────────────────────────────────

/** Returns an error string, or null if the amount is within configured limits. */
export function validateWithdrawalAmount(amount: number): string | null {
  const min = parseFloat(process.env.MIN_WITHDRAWAL_AMOUNT ?? '0.01');
  const max = parseFloat(process.env.MAX_WITHDRAWAL_AMOUNT ?? '1000');

  if (isNaN(amount) || amount <= 0) return 'Amount must be a positive number';
  if (amount < min)                  return `Minimum withdrawal is $${min} USDC`;
  if (amount > max)                  return `Maximum withdrawal is $${max} USDC`;
  return null;
}
