// ─── Solana payment configuration ────────────────────────────────────────────

/**
 * Solana USDC payment configuration for the ScraperKast middleware.
 * When `enabled` is true the middleware generates on-chain payment
 * instructions in 402 responses and mounts a POST /verify-payment endpoint.
 */
export interface SolanaPaymentConfig {
  enabled: boolean;
  /** Solana cluster to use. */
  network: 'devnet' | 'mainnet';
  /** ScraperKast platform wallet address (receives the 5 % fee). */
  platformWallet: string;
  /** Website owner wallet address (receives the 95 % base price). */
  ownerWallet: string;
  /** Optional custom RPC endpoint. Defaults to the public cluster RPC. */
  rpcUrl?: string;
}

// ─── Payment instruction types (included in 402 response) ─────────────────

/** A single SPL-token transfer instruction described for the bot operator. */
export interface PaymentInstruction {
  type: 'transfer';
  token: 'USDC-SPL';
  /** Symbolic source — the bot must fill in its own wallet address. */
  from: 'bot_wallet';
  /** Recipient wallet address. */
  to: string;
  /** Amount in micro-USDC (1 USDC = 1_000_000). */
  amount: number;
  /** Always 6 for USDC. */
  decimals: 6;
}

/**
 * Full Solana payment object embedded in a 402 response when Solana is enabled.
 * Bot operators read this, build the transaction, and call POST /verify-payment
 * with the resulting signature.
 */
export interface PaymentInstructions {
  method: 'solana';
  network: 'devnet' | 'mainnet';
  /** Ordered list of SPL token transfers the bot must execute. */
  instructions: PaymentInstruction[];
  /** On-chain USDC mint address for the active network. */
  usdcMint: string;
  /** Relative path the bot should POST to with the tx signature. */
  verifyEndpoint: '/verify-payment';
  /** Solana Explorer base URL for the active network. */
  explorerUrl: string;
}

// ─── Verification result ──────────────────────────────────────────────────────

/**
 * Returned by POST /verify-payment and by
 * `SolanaPaymentHandler.verifyAndIssueToken()`.
 */
export interface VerificationResult {
  success: boolean;
  /** Signed JWT — present only on success. */
  accessToken?: string;
  /** Token lifetime in seconds — present only on success. */
  expiresIn?: number;
  /** Human-readable success message. */
  message?: string;
  /** Short machine-readable error reason — present on failure. */
  error?: string;
  /** Extended failure details. */
  details?: string;
}
