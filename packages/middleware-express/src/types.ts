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

// ─── Dodo Payments configuration ─────────────────────────────────────────────

/**
 * Dodo Payments (credit card → USDC) configuration.
 * When enabled alongside Solana, bots may choose either:
 *   A) Direct Solana USDC transfer (crypto-native)
 *   B) Credit/debit card checkout via Dodo (traditional)
 */
export interface DodoPaymentConfig {
  enabled: boolean;
  /** Dodo API key from your Dodo dashboard. */
  apiKey: string;
  /** Secret used to verify incoming Dodo webhook signatures. */
  webhookSecret: string;
  /**
   * URL Dodo redirects to after a successful payment.
   * Defaults to `{origin}/payment-success`.
   */
  successUrl?: string;
  /**
   * URL Dodo redirects to if the user cancels.
   * Defaults to `{origin}/payment-cancel`.
   */
  cancelUrl?: string;
}

// ─── Payment instruction types (Solana) ──────────────────────────────────────

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
 * Solana direct-payment object for a 402 response (Solana-only mode).
 * When both Solana + Dodo are enabled, this is nested inside
 * {@link SolanaPaymentOption} within {@link MultiPaymentOptions}.
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

// ─── Multi-method payment options (Solana + Dodo) ────────────────────────────

/** Solana option within {@link MultiPaymentOptions}. */
export interface SolanaPaymentOption extends PaymentInstructions {
  /** Distinguishes direct on-chain transfer from checkout-based options. */
  type: 'direct';
}

/** Dodo (credit card) option within {@link MultiPaymentOptions}. */
export interface DodoPaymentOption {
  method: 'dodo';
  type: 'checkout';
  /** Endpoint the bot calls to get a Dodo checkout URL. */
  checkoutEndpoint: '/checkout/create';
  acceptedMethods: ('credit_card' | 'debit_card')[];
}

/**
 * Included in 402 responses when both Solana and Dodo are enabled.
 * Bots choose their preferred payment method from `options`.
 */
export interface MultiPaymentOptions {
  options: (SolanaPaymentOption | DodoPaymentOption)[];
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

// ─── Token retrieval result ───────────────────────────────────────────────────

/** Returned by GET /checkout/:sessionId/token */
export interface TokenRetrievalResult {
  success: boolean;
  /** Signed JWT — present when payment is confirmed. */
  accessToken?: string;
  /** Token lifetime in seconds. */
  expiresIn?: number;
  /** Solana tx hash — present when payment is confirmed. */
  txHash?: string;
  /** Current session status — present when still pending. */
  status?: string;
  /** Human-readable message. */
  message?: string;
  /** Error reason. */
  error?: string;
}

// ─── Checkout session response ────────────────────────────────────────────────

/** Returned by POST /checkout/create */
export interface CheckoutCreateResponse {
  checkoutUrl: string;
  sessionId: string;
  expiresAt: number;
  /** Total amount in µUSDC. */
  amount: number;
  /** USD equivalent string, e.g. "$0.001050". */
  amountUSD: string;
}
