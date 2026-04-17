/**
 * SmartWalletService — platform-managed Solana wallets.
 *
 * Each user gets a deterministic keypair generated from their userId + a
 * platform master seed. The private key is encrypted at rest (KMS / env var
 * master key in production).  The public key is the deposit address we show
 * users in the dashboard.
 *
 * This file contains the production interface and a demo stub suitable for
 * local development and integration tests.
 */

import { Keypair, Connection, PublicKey } from '@solana/web3.js';
import { getAccount, getAssociatedTokenAddress } from '@solana/spl-token';

// ── Constants ─────────────────────────────────────────────────────────────────

// Official devnet USDC mint (Circle)
export const DEVNET_USDC_MINT  = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');
// Official mainnet USDC mint (Circle)
export const MAINNET_USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SmartWalletRecord {
  userId:    string;
  publicKey: string;
  createdAt: Date;
}

export interface SmartWalletBalance {
  /** On-chain USDC balance in µUSDC (6 decimal places) */
  usdcBalance: number;
  /** The associated token account address, or null if not yet created */
  tokenAccount: string | null;
}

// ── Service ───────────────────────────────────────────────────────────────────

export class SmartWalletService {
  /**
   * Generate a new Solana keypair for a user.
   *
   * Production: derive keypair from HMAC(masterSeed, userId), encrypt private
   * key with KMS, persist to smart_wallets table.
   *
   * Demo/stub: generate random keypair, return public key only.
   */
  static async createWallet(userId: string): Promise<SmartWalletRecord> {
    // TODO (production): derive deterministic keypair from master seed + userId
    //   const seed = await hmac(process.env.WALLET_MASTER_SEED!, userId);
    //   const keypair = Keypair.fromSeed(seed.slice(0, 32));
    //   const encryptedPrivateKey = await kmsEncrypt(keypair.secretKey);
    //   await db.smartWallets.insert({ userId, publicKey, encryptedPrivateKey });

    const keypair = Keypair.generate(); // demo only — not persisted
    return {
      userId,
      publicKey: keypair.publicKey.toBase58(),
      createdAt: new Date(),
    };
  }

  /**
   * Fetch the on-chain USDC balance for a smart wallet address.
   * Returns 0 (not an error) if the token account doesn't exist yet.
   */
  static async getUsdcBalance(
    connection: Connection,
    walletPublicKey: string,
    network: 'devnet' | 'mainnet' = 'devnet',
  ): Promise<SmartWalletBalance> {
    const owner = new PublicKey(walletPublicKey);
    const mint  = network === 'mainnet' ? MAINNET_USDC_MINT : DEVNET_USDC_MINT;

    try {
      const ata     = await getAssociatedTokenAddress(mint, owner);
      const account = await getAccount(connection, ata);
      return {
        usdcBalance:  Number(account.amount),
        tokenAccount: ata.toBase58(),
      };
    } catch (err) {
      const name = (err as Error).name;
      if (
        name === 'TokenAccountNotFoundError' ||
        name === 'TokenInvalidAccountOwnerError'
      ) {
        // Wallet has never received USDC — ATA not created yet
        return { usdcBalance: 0, tokenAccount: null };
      }
      throw err;
    }
  }
}
