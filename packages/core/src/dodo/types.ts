// ─── Session status ───────────────────────────────────────────────────────────

export type SessionStatus = 'pending' | 'completed' | 'expired' | 'failed';

// ─── Checkout params ──────────────────────────────────────────────────────────

/**
 * Parameters passed to `DodoPaymentService.createCheckout()`.
 *
 * `amount` is in **micro-USDC** (µUSDC) — the same unit as `totalPrice` in the
 * 402 response.  The service converts to USD cents for display purposes.
 * 1 USDC = 1_000_000 µUSDC = $1.00 USD = 100 USD cents.
 */
export interface CreateCheckoutParams {
  /** Total amount in µUSDC (base price + platform fee). */
  amount: number;
  /** Unique bot identifier. */
  botId: string;
  /** Domain being accessed. */
  domain: string;
  /** Solana address that receives 95 % (base price). */
  ownerWallet: string;
  /** ScraperKast platform wallet that receives 5 % (fee). */
  platformWallet: string;
  /** Redirect URL after successful payment (bot-operator controlled). */
  successUrl: string;
  /** Redirect URL if user cancels (bot-operator controlled). */
  cancelUrl: string;
  /** Optional contextual metadata. */
  metadata?: {
    requestNumber?: number;
    tier?: string;
    path?: string;
  };
}

// ─── Checkout session ─────────────────────────────────────────────────────────

/** Returned by `DodoPaymentService.createCheckout()`. */
export interface CheckoutSession {
  /** Unique session identifier — used to poll for the access token. */
  id: string;
  /** Full URL to redirect the user to for payment. */
  url: string;
  /** Unix timestamp (ms) when the session expires. */
  expiresAt: number;
  status: SessionStatus;
}

// ─── Webhook types ────────────────────────────────────────────────────────────

/**
 * Payload sent by Dodo Payments to the webhook endpoint.
 *
 * In a real integration this is the JSON body of the POST request.
 * Our mock implementation uses the same shape so tests are realistic.
 */
export interface DodoWebhookPayload {
  event: 'payment.succeeded' | 'payment.failed';
  sessionId: string;
  /** Total amount charged in µUSDC. */
  amount: number;
  solana: {
    network: 'devnet' | 'mainnet';
    /** Solana transaction signature (88-char base58). */
    txHash: string;
    /** Owner wallet address that received the USDC. */
    recipient: string;
    /** Amount in µUSDC sent to the recipient (base price, 95 %). */
    amount: number;
    /** Amount in µUSDC sent to the platform wallet (fee, 5 %). */
    platformAmount: number;
  };
  metadata: Record<string, unknown>;
  timestamp: number;
}

/** Returned by `DodoPaymentService.handleWebhook()`. */
export interface WebhookResult {
  verified: boolean;
  event: string;
  txHash?: string;
  ownerReceived?: number;
  platformReceived?: number;
  sessionId?: string;
  error?: string;
}

// ─── Session store data ───────────────────────────────────────────────────────

/** Internal record stored per checkout session. */
export interface SessionData {
  botId: string;
  domain: string;
  /** Total amount in µUSDC. */
  amount: number;
  ownerWallet: string;
  platformWallet: string;
  createdAt: number;
  expiresAt: number;
  status: SessionStatus;
  /** Solana tx signature (set after webhook received). */
  txHash?: string;
  /** Signed JWT (set after webhook verified + token issued). */
  accessToken?: string;
}
