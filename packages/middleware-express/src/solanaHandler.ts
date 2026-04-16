import { PublicKey } from '@solana/web3.js';
import {
  SolanaConnection,
  SolanaPaymentService,
  NETWORKS,
  AuthService,
} from '@scraperkast/core';
import type { PriceResult, PaymentStatus } from '@scraperkast/core';
import type {
  SolanaPaymentConfig,
  PaymentInstructions,
  VerificationResult,
} from './types.js';

// Credits = floor(ownerReceived / MIN_UNIT_MICRO_USDC).
// With MIN_UNIT = 100, a 1 000 µUSDC payment yields 10 credits (10 page accesses).
const MIN_UNIT_MICRO_USDC = 100;
const MIN_CREDITS = 1;

/**
 * Wraps `SolanaConnection` + `SolanaPaymentService` into a high-level helper
 * consumed by the ScraperKast Express middleware.
 *
 * Responsibilities:
 *  1. Build the Solana payment instructions object included in 402 responses.
 *  2. Verify an on-chain transaction and issue a JWT access token.
 *  3. Query payment status by tx signature.
 */
export class SolanaPaymentHandler {
  private readonly config: SolanaPaymentConfig;
  private readonly solanaConn: SolanaConnection;
  private readonly paymentService: SolanaPaymentService;
  readonly ownerWallet: PublicKey;
  readonly platformWallet: PublicKey;

  constructor(config: SolanaPaymentConfig) {
    this.config = config;

    // Allow callers to supply a custom RPC URL via config (falls back to
    // SOLANA_RPC_URL env var, then the public cluster endpoint).
    if (config.rpcUrl) {
      process.env['SOLANA_RPC_URL'] = config.rpcUrl;
    }
    process.env['SOLANA_NETWORK'] = config.network;

    try {
      this.ownerWallet    = new PublicKey(config.ownerWallet);
      this.platformWallet = new PublicKey(config.platformWallet);
    } catch (e) {
      throw new Error(
        `SolanaPaymentHandler: invalid wallet address — ${(e as Error).message}`,
      );
    }

    this.solanaConn     = new SolanaConnection(config.network);
    this.paymentService = new SolanaPaymentService(this.solanaConn, this.platformWallet);
  }

  // ── generatePaymentInstructions ──────────────────────────────────────────────

  /**
   * Converts a `PriceResult` from the pricing engine into the Solana payment
   * instructions object that gets embedded in the 402 response body.
   *
   * The returned object tells the bot:
   *  - Which two wallets to transfer USDC to
   *  - How much to send each
   *  - Which USDC mint to use
   *  - Where to submit the tx signature for verification
   */
  generatePaymentInstructions(
    priceResult: PriceResult,
    _botId: string,
    _domain: string,
  ): PaymentInstructions {
    const { network } = this.config;
    const networkCfg  = NETWORKS[network];

    const instructions: PaymentInstructions['instructions'] = [
      {
        type:     'transfer',
        token:    'USDC-SPL',
        from:     'bot_wallet',
        to:       this.config.ownerWallet,
        amount:   priceResult.basePrice,
        decimals: 6,
      },
    ];

    if (priceResult.scraperKastFee > 0) {
      instructions.push({
        type:     'transfer',
        token:    'USDC-SPL',
        from:     'bot_wallet',
        to:       this.config.platformWallet,
        amount:   priceResult.scraperKastFee,
        decimals: 6,
      });
    }

    return {
      method:          'solana',
      network,
      instructions,
      usdcMint:        networkCfg.usdcMint,
      verifyEndpoint:  '/verify-payment',
      explorerUrl:     networkCfg.explorerUrl,
    };
  }

  // ── verifyAndIssueToken ──────────────────────────────────────────────────────

  /**
   * Verifies the Solana transaction identified by `txSignature` and, if valid,
   * issues a signed JWT access token.
   *
   * Checks:
   *  1. Transaction is confirmed on-chain (not failed / not found).
   *  2. Owner wallet received > 0 µUSDC.
   *  3. Platform wallet received > 0 µUSDC (confirms the 5 % fee was paid).
   *
   * On success, credits are set to `floor(ownerReceived / 100)` (min 1),
   * granting access for a number of page views proportional to the payment.
   *
   * @throws When the Solana RPC is unreachable (caller returns HTTP 503).
   */
  async verifyAndIssueToken(
    txSignature: string,
    botId: string,
    domain: string,
    authService: AuthService,
  ): Promise<VerificationResult> {
    console.log(
      `[Solana] Verifying payment: tx=${txSignature} bot=${botId} domain=${domain}`,
    );

    // RPC errors intentionally propagate — callers should return HTTP 503.
    const verification = await this.paymentService.verifyPayment(txSignature);

    if (!verification.isValid) {
      const reason = verification.status === 'failed'
        ? 'Transaction failed on-chain'
        : 'Transaction not found or unconfirmed';

      console.warn(`[Solana] Verification failed: ${reason} tx=${txSignature}`);
      return {
        success: false,
        error:   reason,
        details: `Transaction ${txSignature} status: ${verification.status}`,
      };
    }

    // Confirm owner received funds (i.e. correct owner wallet was the recipient).
    if (verification.ownerReceived <= 0) {
      console.warn(`[Solana] Owner wallet received 0 µUSDC: tx=${txSignature}`);
      return {
        success: false,
        error:   'No payment received by owner wallet',
        details: `Owner wallet ${this.config.ownerWallet} received 0 µUSDC in tx ${txSignature}`,
      };
    }

    // Confirm platform fee was included.
    if (verification.platformReceived <= 0) {
      console.warn(`[Solana] Platform fee missing: tx=${txSignature}`);
      return {
        success: false,
        error:   'Platform fee not included',
        details: `Platform wallet ${this.config.platformWallet} received 0 µUSDC in tx ${txSignature}`,
      };
    }

    // Issue JWT: credits proportional to amount paid.
    const credits = Math.max(
      MIN_CREDITS,
      Math.floor(verification.ownerReceived / MIN_UNIT_MICRO_USDC),
    );
    const token = authService.generateToken(botId, credits, [domain]);

    console.log(
      `[Solana] Payment verified ✓ tx=${txSignature} ` +
      `owner=${verification.ownerReceived}µUSDC ` +
      `platform=${verification.platformReceived}µUSDC ` +
      `credits=${credits} bot=${botId}`,
    );

    return {
      success:     true,
      accessToken: token,
      expiresIn:   3600,
      message:     'Payment verified. Access granted.',
    };
  }

  // ── getPaymentStatus ─────────────────────────────────────────────────────────

  /** Polls the current confirmation status of a transaction. */
  async getPaymentStatus(txSignature: string): Promise<PaymentStatus> {
    return this.paymentService.getPaymentStatus(txSignature);
  }
}
