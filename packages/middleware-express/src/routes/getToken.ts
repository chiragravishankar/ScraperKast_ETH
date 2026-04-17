import { Router, type Request, type Response } from 'express';
import type { SessionStore } from '@scraperkast/core';
import type { TokenRetrievalResult } from '../types.js';

/**
 * Factory: returns a Router with GET /checkout/:sessionId/token.
 *
 * After the bot (or end-user) completes the Dodo credit-card checkout:
 *   1. Dodo fires POST /webhooks/dodo → webhook handler issues the JWT
 *   2. Bot polls GET /checkout/:sessionId/token until it gets the token
 *
 * Recommended polling interval: 3–5 seconds.
 * The endpoint returns a stable response shape regardless of status.
 */
export function createGetTokenRouter(sessionStore: SessionStore): Router {
  const router = Router();

  /**
   * GET /checkout/:sessionId/token
   *
   * Response shapes:
   *   200 + accessToken   — payment confirmed, token ready
   *   200 (no token)      — still pending, keep polling
   *   404                 — session not found or expired
   *   400                 — payment failed
   */
  router.get('/checkout/:sessionId/token', (req: Request, res: Response): void => {
    const { sessionId } = req.params;

    const session = sessionStore.get(sessionId);

    // ── Not found / expired ───────────────────────────────────────────────
    if (!session) {
      const body: TokenRetrievalResult = {
        success: false,
        error:   'Session not found or expired',
        message: `No checkout session found for ID: ${sessionId}`,
      };
      res.status(404).json(body);
      return;
    }

    // ── Payment failed ────────────────────────────────────────────────────
    if (session.status === 'failed') {
      const body: TokenRetrievalResult = {
        success: false,
        status:  'failed',
        error:   'Payment failed',
        message: 'The payment was not completed. Please start a new checkout.',
      };
      res.status(400).json(body);
      return;
    }

    // ── Completed — token ready ───────────────────────────────────────────
    if (session.status === 'completed' && session.accessToken) {
      const body: TokenRetrievalResult = {
        success:     true,
        accessToken: session.accessToken,
        expiresIn:   3600,
        txHash:      session.txHash,
      };
      res.status(200).json(body);
      return;
    }

    // ── Still pending ─────────────────────────────────────────────────────
    const body: TokenRetrievalResult = {
      success: false,
      status:  'pending',
      message: 'Payment processing — retry in 5 seconds',
    };
    res.status(200).json(body);
  });

  return router;
}
