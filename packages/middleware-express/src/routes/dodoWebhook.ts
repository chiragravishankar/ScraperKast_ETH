import { Router, type Request, type Response } from 'express';
import type { AuthService } from '@scraperkast/core';
import type { DodoPaymentService, SessionStore } from '@scraperkast/core';

/** Minimum credits issued per payment (prevents zero-credit tokens). */
const MIN_CREDITS    = 1;
/** Granularity: 1 credit per 100 µUSDC paid to owner. */
const MIN_UNIT_MICRO = 100;

/**
 * Factory: returns a Router with POST /webhooks/dodo.
 *
 * Dodo calls this endpoint after a payment completes or fails.
 * The handler:
 *   1. Verifies the HMAC-SHA256 webhook signature (NEVER skip this)
 *   2. On `payment.succeeded`: issues a JWT and stores it in the session
 *   3. On `payment.failed`: marks the session as failed
 *   4. Always returns `{ received: true }` to acknowledge to Dodo
 *
 * Raw body access:
 *   The webhook signature is computed over the raw request body.
 *   Express must be configured with `express.json({ verify: (req, _res, buf) => { req.rawBody = buf.toString(); } })`
 *   OR the raw body is available via `req.rawBody`.
 *   As a fallback we JSON.stringify the parsed body (may differ in whitespace —
 *   acceptable for the mock; use raw body middleware in production).
 */
export function createDodoWebhookRouter(
  dodoService: DodoPaymentService,
  sessionStore: SessionStore,
  authService: AuthService,
): Router {
  const router = Router();

  router.post('/webhooks/dodo', (req: Request, res: Response): void => {
    void (async () => {
      // ── Extract raw body for signature verification ───────────────────────
      // In production: use a raw-body middleware before express.json().
      // Here: fall back to re-serialising the parsed body.
      const rawBody: string =
        (req as Request & { rawBody?: string }).rawBody ??
        JSON.stringify(req.body ?? {});

      const signature = req.headers['x-dodo-signature'] as string | undefined ?? '';

      // ── Process webhook ───────────────────────────────────────────────────
      const result = dodoService.handleWebhook(rawBody, signature);

      // Always acknowledge to Dodo immediately (avoids retry loops).
      res.status(200).json({ received: true });

      if (!result.verified) {
        console.warn(`[Dodo] Webhook rejected: ${result.error ?? 'bad signature'}`);
        return;
      }

      const { event, sessionId } = result;

      // ── payment.failed ────────────────────────────────────────────────────
      if (event === 'payment.failed') {
        if (sessionId) {
          sessionStore.setStatus(sessionId, 'failed');
          console.warn(`[Dodo] Session ${sessionId} marked as failed`);
        }
        return;
      }

      // ── payment.succeeded ─────────────────────────────────────────────────
      if (event !== 'payment.succeeded') return;

      if (!sessionId) {
        console.error('[Dodo] payment.succeeded missing sessionId — cannot issue token');
        return;
      }

      const session = sessionStore.get(sessionId);
      if (!session) {
        console.error(`[Dodo] payment.succeeded for unknown/expired session ${sessionId}`);
        return;
      }

      // Guard against duplicate webhook deliveries.
      if (session.status === 'completed') {
        console.warn(`[Dodo] Duplicate webhook for session ${sessionId} — ignoring`);
        return;
      }

      const ownerReceived    = result.ownerReceived    ?? 0;
      const platformReceived = result.platformReceived ?? 0;
      const txHash           = result.txHash           ?? '';

      // Validate that owner actually received funds.
      if (ownerReceived <= 0) {
        sessionStore.setStatus(sessionId, 'failed');
        console.error(`[Dodo] Owner received 0 µUSDC for session ${sessionId}`);
        return;
      }

      // Issue JWT — credits proportional to owner's received amount.
      const credits = Math.max(
        MIN_CREDITS,
        Math.floor(ownerReceived / MIN_UNIT_MICRO),
      );
      const accessToken = authService.generateToken(
        session.botId,
        credits,
        [session.domain],
      );

      sessionStore.complete(sessionId, txHash, accessToken);

      console.log(
        `[Dodo] ✓ Token issued — session=${sessionId} ` +
        `owner=${ownerReceived}µUSDC platform=${platformReceived}µUSDC ` +
        `credits=${credits} bot=${session.botId}`,
      );
    })();
  });

  return router;
}
