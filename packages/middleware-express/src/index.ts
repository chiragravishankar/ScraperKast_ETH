import type { Request, Response, NextFunction, RequestHandler } from 'express';
import {
  detectBot,
  PricingEngine,
  AuthService,
  AnalyticsCollector,
} from '@scraperkast/core';
import type { PricingRule } from '@scraperkast/core';

// ─── Public config interface ──────────────────────────────────────────────────

export interface ScraperKastConfig {
  /** Pricing rules the site owner has defined. */
  rules: PricingRule[];
  /**
   * Secret used to verify incoming bot JWT tokens.
   * Must match the secret used by the ScraperKast payment server that
   * issued the token.
   */
  jwtSecret: string;
  /** Set to true to collect per-request analytics in memory. Default: false. */
  enableAnalytics?: boolean;
  /**
   * Called after a bot is allowed through with a valid, credited JWT.
   * Useful for logging or decrementing credits in your own store.
   */
  onAuthorized?: (req: Request, botName: string) => void;
  /**
   * Called when a 402 Payment Required response is about to be sent.
   * Useful for logging or triggering a notification.
   */
  onPaymentRequired?: (req: Request) => void;
}

// ─── Response shapes ──────────────────────────────────────────────────────────

interface PaymentRequiredBody {
  error: 'Payment Required';
  bot: string;
  pricing: {
    pricePerPage: number;
    currency: 'USD';
  };
  paymentUrl: string;
  documentation: string;
}

interface ForbiddenBody {
  error: 'Forbidden';
  message: string;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

const PAYMENT_API_BASE = 'https://api.scraperkast.com/pay';
const DOCS_URL = 'https://docs.scraperkast.com';

function buildPaymentUrl(botName: string, path: string): string {
  const params = new URLSearchParams({ bot: botName, path });
  return `${PAYMENT_API_BASE}?${params.toString()}`;
}

function extractBearerToken(req: Request): string | null {
  const header = req.headers['authorization'];
  if (!header || !header.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length).trim();
  return token.length > 0 ? token : null;
}

// ─── Middleware factory ───────────────────────────────────────────────────────

/**
 * ScraperKast Express middleware.
 *
 * Intercepts AI bot traffic, gates it behind JWT authentication and your
 * pricing rules, and optionally tracks analytics — all without touching
 * requests from human browsers.
 *
 * @example
 * ```ts
 * app.use(scraperKast({
 *   jwtSecret: process.env.SCRAPERKAST_SECRET!,
 *   rules: [
 *     { id: 'blog', path: '/blog/*', pricePerPage: 100, licenseType: 'summarization' },
 *   ],
 *   enableAnalytics: true,
 * }));
 * ```
 */
export function scraperKast(config: ScraperKastConfig): RequestHandler {
  const {
    rules,
    jwtSecret,
    enableAnalytics = false,
    onAuthorized,
    onPaymentRequired,
  } = config;

  const pricingEngine = new PricingEngine(rules);
  const authService = new AuthService(jwtSecret);
  const analytics = enableAnalytics ? new AnalyticsCollector() : null;

  return function scraperKastMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
  ): void {
    try {
      const userAgent = req.headers['user-agent'] ?? '';
      const detection = detectBot(userAgent);

      // ── Not a bot → pass straight through ────────────────────────────────
      if (!detection.isBot || detection.botName === null) {
        next();
        return;
      }

      const { botName } = detection;
      const { path } = req;

      // ── Bot detected → check for a valid JWT ──────────────────────────────
      const rawToken = extractBearerToken(req);

      if (rawToken !== null) {
        const payload = authService.verifyToken(rawToken);

        if (payload !== null && payload.credits > 0) {
          // Valid, credited token → authorise access
          analytics?.trackAccess(botName, path, true, undefined);

          try {
            onAuthorized?.(req, botName);
          } catch {
            // Never let a callback crash the middleware
          }

          next();
          return;
        }
        // Token present but invalid / expired / zero credits → fall through
        // to pricing check (bot may need to purchase a new token)
      }

      // ── No valid token → consult pricing rules ────────────────────────────
      const priceResult = pricingEngine.getPrice(path, botName);

      if (priceResult === null) {
        // No rule covers this bot/path → block
        analytics?.trackAccess(botName, path, false);

        const body: ForbiddenBody = {
          error: 'Forbidden',
          message: `Bot "${botName}" is not permitted to access ${path}`,
        };
        res.status(403).json(body);
        return;
      }

      // Pricing rule exists → 402 Payment Required
      analytics?.trackPaymentRequired(botName, path, priceResult.pricePerPage);
      analytics?.trackAccess(botName, path, false, undefined);

      try {
        onPaymentRequired?.(req);
      } catch {
        // Never let a callback crash the middleware
      }

      const body: PaymentRequiredBody = {
        error: 'Payment Required',
        bot: botName,
        pricing: {
          pricePerPage: priceResult.pricePerPage,
          currency: 'USD',
        },
        paymentUrl: buildPaymentUrl(botName, path),
        documentation: DOCS_URL,
      };
      res.status(402).json(body);
    } catch (err) {
      // Unexpected error → don't expose internals, hand off to Express error handler
      next(err);
    }
  };
}

// ─── Re-export the collector so callers can read analytics from outside ───────
export { AnalyticsCollector };
export type { PricingRule };
