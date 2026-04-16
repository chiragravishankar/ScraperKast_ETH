import type { PublicKey } from '@solana/web3.js';

export type PaymentStatus = 'pending' | 'confirmed' | 'failed';

export interface NetworkConfig {
  network: string;
  rpcUrl: string;
  usdcMint: string;
  explorerUrl: string;
}

export interface SolanaPaymentRequest {
  amount: number;
  recipient: string;
  botId: string;
  domain: string;
}

export interface SolanaPaymentResponse {
  txHash: string;
  status: PaymentStatus;
  timestamp: number;
  explorerUrl: string;
}

export interface TokenAccount {
  address: string;
  balance: number;
  owner: string;
}

// ── Payment service types ─────────────────────────────────────────────────────

export interface CreatePaymentParams {
  /** Who is paying (the AI bot). */
  botWallet: PublicKey;
  /** Website owner — receives basePrice (95%). */
  ownerWallet: PublicKey;
  /** ScraperKast platform — receives scraperKastFee (5%). */
  platformWallet: PublicKey;
  /** Micro-USDC to send to the owner (maps 1:1 from PricingEngine.basePrice). */
  basePrice: number;
  /** Micro-USDC to send to the platform (maps 1:1 from PricingEngine.scraperKastFee). */
  scraperKastFee: number;
  /** Bot identifier for logging. */
  botId: string;
  /** Domain being accessed for logging. */
  domain: string;
}

export interface PaymentVerification {
  isValid: boolean;
  txSignature: string;
  /** Total USDC change computed from chain (micro-USDC). */
  expectedAmount: number;
  /** Same as expectedAmount — both are read from chain. */
  actualAmount: number;
  /** Micro-USDC received by the website owner. */
  ownerReceived: number;
  /** Micro-USDC received by the platform. */
  platformReceived: number;
  status: PaymentStatus;
  explorerUrl: string;
}
