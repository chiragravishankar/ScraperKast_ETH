import { Router, type Request, type Response } from 'express';
import type { AuthService } from '@scraperkast/core';
import type { SolanaPaymentHandler } from '../solanaHandler.js';
import type { VerificationResult } from '../types.js';

/**
 * Factory that returns an Express Router with a single route:
 *   POST /verify-payment
 *
 * The bot calls this endpoint after executing its Solana payment transaction.
 * On success the response includes a signed JWT the bot can use in subsequent
 * `Authorization: Bearer <token>` requests to access gated content.
 *
 * @param handler     Initialised `SolanaPaymentHandler` from the middleware.
 * @param authService `AuthService` that signs the JWT (same secret as middleware).
 */
export function createVerifyPaymentRouter(
  handler: SolanaPaymentHandler,
  authService: AuthService,
): Router {
  const router = Router();

  /**
   * POST /verify-payment
   *
   * Body (JSON):
   *   { txSignature: string; botId: string; domain: string }
   *
   * Responses:
   *   200  { success: true,  accessToken, expiresIn, message }
   *   400  { success: false, error, details }
   *   503  { success: false, error: 'Solana RPC unavailable', details }
   */
  router.post('/verify-payment', (req: Request, res: Response): void => {
    void (async () => {
      const { txSignature, botId, domain } = (req.body ?? {}) as {
        txSignature?: string;
        botId?: string;
        domain?: string;
      };

      // ── Validate request body ─────────────────────────────────────────────
      if (!txSignature || typeof txSignature !== 'string' || txSignature.trim().length === 0) {
        const body: VerificationResult = {
          success: false,
          error:   'Missing txSignature',
          details: 'Request body must include a non-empty txSignature string',
        };
        res.status(400).json(body);
        return;
      }

      if (!botId || typeof botId !== 'string' || botId.trim().length === 0) {
        const body: VerificationResult = {
          success: false,
          error:   'Missing botId',
          details: 'Request body must include a non-empty botId string',
        };
        res.status(400).json(body);
        return;
      }

      if (!domain || typeof domain !== 'string' || domain.trim().length === 0) {
        const body: VerificationResult = {
          success: false,
          error:   'Missing domain',
          details: 'Request body must include a non-empty domain string',
        };
        res.status(400).json(body);
        return;
      }

      // ── Verify the on-chain transaction ───────────────────────────────────
      try {
        const result = await handler.verifyAndIssueToken(
          txSignature.trim(),
          botId.trim(),
          domain.trim(),
          authService,
        );

        console.log(
          `[/verify-payment] ${result.success ? '✓ issued token' : '✗ rejected'} ` +
          `tx=${txSignature} bot=${botId}`,
        );

        res.status(result.success ? 200 : 400).json(result);
      } catch (err) {
        // Solana RPC failure — let callers retry.
        const message = (err as Error).message ?? 'Unknown RPC error';
        console.error(`[/verify-payment] RPC error: ${message} tx=${txSignature}`);

        const body: VerificationResult = {
          success: false,
          error:   'Solana RPC unavailable',
          details: message,
        };
        res.status(503).json(body);
      }
    })();
  });

  return router;
}
