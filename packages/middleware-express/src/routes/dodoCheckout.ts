import { Router, type Request, type Response } from 'express';
import type { DodoPaymentService, SessionStore } from '@scraperkast/core';
import type { DodoPaymentConfig, CheckoutCreateResponse } from '../types.js';
import type { SolanaPaymentHandler } from '../solanaHandler.js';

/** µUSDC → USD string. 1 USDC = 1_000_000 µUSDC = $1.00 */
function microUsdcToUsd(microUsdc: number): string {
  const usd = microUsdc / 1_000_000;
  return usd >= 0.01 ? `$${usd.toFixed(2)}` : `$${usd.toFixed(6)}`;
}

/**
 * Factory: returns a Router with POST /checkout/create.
 *
 * The bot calls this after receiving a 402 with the Dodo payment option.
 * The endpoint creates a Dodo checkout session and returns the URL.
 *
 * Security notes:
 *   - Amount comes from the client but is capped and validated.
 *   - Wallet addresses come from server config (never from client).
 *   - In production, re-derive the price from the pricing engine + path.
 */
export function createDodoCheckoutRouter(
  dodoService: DodoPaymentService,
  sessionStore: SessionStore,
  solanaHandler: SolanaPaymentHandler,
  config: DodoPaymentConfig,
): Router {
  const router = Router();

  /**
   * POST /checkout/create
   *
   * Body:
   *   { botId: string; domain: string; amount: number; successUrl?: string; cancelUrl?: string; }
   *
   * `amount` is in µUSDC (matches `totalPrice` from the 402 response).
   */
  router.post('/checkout/create', (req: Request, res: Response): void => {
    void (async () => {
      const body = (req.body ?? {}) as {
        botId?: string;
        domain?: string;
        amount?: number;
        successUrl?: string;
        cancelUrl?: string;
        metadata?: Record<string, unknown>;
      };

      // ── Validate ────────────────────────────────────────────────────────
      if (!body.botId || typeof body.botId !== 'string') {
        res.status(400).json({ error: 'Missing botId' });
        return;
      }
      if (!body.domain || typeof body.domain !== 'string') {
        res.status(400).json({ error: 'Missing domain' });
        return;
      }
      if (typeof body.amount !== 'number' || body.amount <= 0) {
        res.status(400).json({ error: 'amount must be a positive number (µUSDC)' });
        return;
      }

      // Determine success/cancel URLs: prefer request body, then config, then defaults.
      const origin     = `${req.protocol}://${req.get('host') ?? 'localhost:3000'}`;
      const successUrl = body.successUrl ?? config.successUrl ?? `${origin}/payment-success`;
      const cancelUrl  = body.cancelUrl  ?? config.cancelUrl  ?? `${origin}/payment-cancel`;

      // Wallet addresses ALWAYS come from server config — never from the client.
      const ownerWallet    = solanaHandler.ownerWallet.toBase58();
      const platformWallet = solanaHandler.platformWallet.toBase58();

      // ── Create Dodo session ─────────────────────────────────────────────
      try {
        const session = await dodoService.createCheckout({
          amount:   body.amount,
          botId:    body.botId,
          domain:   body.domain,
          ownerWallet,
          platformWallet,
          successUrl,
          cancelUrl,
          metadata: {
            ...(body.metadata ?? {}),
          },
        });

        // Persist session so the webhook handler and token endpoint can find it.
        sessionStore.set(session.id, {
          botId:          body.botId,
          domain:         body.domain,
          amount:         body.amount,
          ownerWallet,
          platformWallet,
          createdAt:      Date.now(),
          expiresAt:      session.expiresAt,
          status:         'pending',
        });

        console.log(
          `[Dodo] /checkout/create — session=${session.id} ` +
          `amount=${body.amount}µUSDC bot=${body.botId}`,
        );

        const result: CheckoutCreateResponse = {
          checkoutUrl: session.url,
          sessionId:   session.id,
          expiresAt:   session.expiresAt,
          amount:      body.amount,
          amountUSD:   microUsdcToUsd(body.amount),
        };

        res.status(200).json(result);
      } catch (err) {
        const message = (err as Error).message ?? 'Checkout creation failed';
        console.error(`[Dodo] /checkout/create error: ${message}`);
        res.status(503).json({ error: 'Checkout unavailable', details: message });
      }
    })();
  });

  return router;
}
