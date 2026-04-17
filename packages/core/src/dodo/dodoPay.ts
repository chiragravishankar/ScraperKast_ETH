/**
 * DodoPaymentService
 *
 * Wraps the Dodo Payments API to provide credit-card → USDC checkout for
 * AI bot operators.
 *
 * NOTE: The `@dodo-payments/sdk` npm package does not yet exist as a public
 * release.  This implementation is a realistic mock that:
 *   - Uses the same interface and webhook format Dodo will expose
 *   - Generates HMAC-SHA256 signatures for testable webhook verification
 *   - Can be replaced by the real SDK by swapping the `_callDodoApi` method
 *
 * Webhook signature scheme (mirrors GitHub/Stripe style):
 *   Header: `x-dodo-signature: sha256=<hex_hmac>`
 *   HMAC key: `webhookSecret` from config
 *   HMAC data: raw JSON request body (string)
 */

import { createHmac, timingSafeEqual } from 'crypto';
import { randomUUID } from 'crypto';
import type {
  CreateCheckoutParams,
  CheckoutSession,
  DodoWebhookPayload,
  WebhookResult,
  SessionStatus,
} from './types.js';

/** Session TTL: 1 hour in ms. */
const SESSION_TTL_MS = 60 * 60 * 1000;

/** Mock checkout base URL — the demo server mounts a /mock-checkout route. */
const MOCK_CHECKOUT_BASE = 'http://localhost:3000/mock-checkout';

/**
 * Converts µUSDC to a human-readable USD string.
 * 1 USDC = 1_000_000 µUSDC = $1.00 USD
 */
function microUsdcToUsd(microUsdc: number): string {
  const usd = microUsdc / 1_000_000;
  return usd >= 0.01 ? `$${usd.toFixed(2)}` : `$${usd.toFixed(6)}`;
}

// ── DodoPaymentService ────────────────────────────────────────────────────────

export class DodoPaymentService {
  private readonly apiKey: string;
  private readonly network: 'devnet' | 'mainnet';
  private readonly webhookSecret: string;

  constructor(apiKey: string, network: 'devnet' | 'mainnet', webhookSecret: string) {
    if (!apiKey || !webhookSecret) {
      throw new Error('DodoPaymentService: apiKey and webhookSecret are required');
    }
    this.apiKey        = apiKey;
    this.network       = network;
    this.webhookSecret = webhookSecret;
  }

  // ── createCheckout ─────────────────────────────────────────────────────────

  /**
   * Creates a Dodo checkout session.
   *
   * Returns a session with a checkout URL the bot operator redirects users to.
   * After payment Dodo:
   *   1. Converts USD → USDC on Solana
   *   2. Sends USDC to ownerWallet (basePrice) + platformWallet (fee)
   *   3. Fires a POST to the webhook endpoint with tx details
   *
   * @throws If the API key is invalid (in production) or params are missing.
   */
  async createCheckout(params: CreateCheckoutParams): Promise<CheckoutSession> {
    const {
      amount, botId, domain, ownerWallet, platformWallet,
      successUrl, cancelUrl, metadata,
    } = params;

    if (amount <= 0) throw new Error('amount must be positive');
    if (!ownerWallet || !platformWallet) throw new Error('wallet addresses required');

    // In production this would call the Dodo REST API.
    // Mock: generate a session locally.
    const sessionId = `dodo_${randomUUID().replace(/-/g, '')}`;
    const expiresAt = Date.now() + SESSION_TTL_MS;

    // Build the mock checkout URL — the demo server renders a simple payment page.
    const params_: Record<string, string> = {
      session:    sessionId,
      amount:     String(amount),
      usd:        microUsdcToUsd(amount),
      botId,
      domain,
      successUrl,
      cancelUrl,
    };
    if (metadata?.path) params_['path'] = metadata.path;

    const checkoutUrl = `${MOCK_CHECKOUT_BASE}?${new URLSearchParams(params_).toString()}`;

    console.log(
      `[Dodo] Created checkout session=${sessionId} ` +
      `amount=${amount}µUSDC (${microUsdcToUsd(amount)}) ` +
      `bot=${botId} domain=${domain}`,
    );

    // In production, store session details server-side with Dodo.
    // Here we return the session for the middleware to store in SessionStore.
    return {
      id:        sessionId,
      url:       checkoutUrl,
      expiresAt,
      status:    'pending',
    };
  }

  // ── handleWebhook ──────────────────────────────────────────────────────────

  /**
   * Verifies a Dodo webhook request and extracts payment details.
   *
   * Callers pass the **raw JSON string** (not the parsed object) and the
   * `x-dodo-signature` header value.  Using the raw body ensures the HMAC
   * matches — JSON.stringify(JSON.parse(body)) can differ in whitespace.
   *
   * @param rawBody     Raw request body (string).
   * @param signature   Value of the `x-dodo-signature` header.
   */
  handleWebhook(rawBody: string, signature: string): WebhookResult {
    // ── Verify HMAC signature ───────────────────────────────────────────────
    if (!this.verifySignature(rawBody, signature)) {
      console.warn('[Dodo] Webhook signature verification FAILED');
      return { verified: false, event: 'unknown', error: 'Invalid webhook signature' };
    }

    // ── Parse payload ───────────────────────────────────────────────────────
    let payload: DodoWebhookPayload;
    try {
      payload = JSON.parse(rawBody) as DodoWebhookPayload;
    } catch {
      return { verified: false, event: 'unknown', error: 'Invalid JSON payload' };
    }

    const { event, sessionId, solana } = payload;

    if (event === 'payment.succeeded') {
      console.log(
        `[Dodo] Webhook payment.succeeded ` +
        `session=${sessionId} tx=${solana.txHash} ` +
        `owner=${solana.amount}µUSDC platform=${solana.platformAmount}µUSDC`,
      );

      return {
        verified:         true,
        event,
        sessionId,
        txHash:           solana.txHash,
        ownerReceived:    solana.amount,
        platformReceived: solana.platformAmount,
      };
    }

    if (event === 'payment.failed') {
      console.warn(`[Dodo] Webhook payment.failed session=${sessionId}`);
      return { verified: true, event, sessionId };
    }

    return { verified: true, event, sessionId, error: `Unknown event: ${event}` };
  }

  // ── getSessionStatus ───────────────────────────────────────────────────────

  /**
   * Polls Dodo's API for the current status of a checkout session.
   *
   * In production this calls `GET /sessions/:id`.
   * Mock: always returns 'pending' (status is tracked locally via SessionStore).
   */
  async getSessionStatus(_sessionId: string): Promise<SessionStatus> {
    // Real implementation: call Dodo API
    // return await this._callDodoApi(`/sessions/${sessionId}`)
    return 'pending';
  }

  // ── generateWebhookSignature ───────────────────────────────────────────────

  /**
   * Helper for **tests and the demo server** to generate a valid webhook
   * signature.  In production, Dodo signs the payload with your secret.
   *
   * @param rawBody Raw JSON string of the webhook payload.
   */
  generateWebhookSignature(rawBody: string): string {
    const hmac = createHmac('sha256', this.webhookSecret)
      .update(rawBody)
      .digest('hex');
    return `sha256=${hmac}`;
  }

  /**
   * Helper for **tests** to build a signed mock webhook payload for a
   * `payment.succeeded` event.
   */
  buildMockWebhookPayload(params: {
    sessionId: string;
    amount: number;
    ownerWallet: string;
    txHash?: string;
  }): { rawBody: string; signature: string } {
    const basePrice = Math.floor(params.amount * 0.9524); // ~95%
    const fee       = params.amount - basePrice;           // ~5%
    const txHash    = params.txHash ?? `MOCK${randomUUID().replace(/-/g, '').toUpperCase()}`;

    const payload: DodoWebhookPayload = {
      event:     'payment.succeeded',
      sessionId: params.sessionId,
      amount:    params.amount,
      solana: {
        network:        this.network,
        txHash,
        recipient:      params.ownerWallet,
        amount:         basePrice,
        platformAmount: fee,
      },
      metadata:  {},
      timestamp: Date.now(),
    };

    const rawBody = JSON.stringify(payload);
    return { rawBody, signature: this.generateWebhookSignature(rawBody) };
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private verifySignature(rawBody: string, signature: string): boolean {
    if (!signature || !signature.startsWith('sha256=')) return false;

    const expected = `sha256=${createHmac('sha256', this.webhookSecret)
      .update(rawBody)
      .digest('hex')}`;

    try {
      return timingSafeEqual(
        Buffer.from(expected, 'utf8'),
        Buffer.from(signature, 'utf8'),
      );
    } catch {
      // Buffers of different length throw — treat as mismatch.
      return false;
    }
  }
}
