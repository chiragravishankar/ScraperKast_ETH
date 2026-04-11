import type { Request, Response, NextFunction, RequestHandler } from 'express';
import {
  detectBot,
  PricingEngine,
  AuthService,
  AnalyticsCollector,
} from '@scraperkast/core';
import type { PricingRule, PriceResult, RequestCounter } from '@scraperkast/core';

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

  /**
   * Pluggable request counter.  Defaults to an in-memory counter that resets
   * on restart.  Inject a Redis- or database-backed implementation to enforce
   * the 10 k free tier globally across multiple servers.
   *
   * @example
   * ```ts
   * scraperKast({ counter: new RedisCounter(), ... })
   * ```
   */
  counter?: RequestCounter;

  /** Set to true to collect per-request analytics in memory. Default: false. */
  enableAnalytics?: boolean;

  /**
   * Called after a bot is allowed through with a valid, credited JWT.
   * Useful for logging or decrementing credits in your own store.
   */
  onAuthorized?: (req: Request, botName: string) => void;

  /**
   * Called when a 402 Payment Required response is about to be sent.
   * Receives the full {@link PriceResult} so you can log fees, tier changes,
   * or trigger downstream notifications.
   */
  onPaymentRequired?: (req: Request, priceResult: PriceResult) => void;
}

// ─── 402 response body ────────────────────────────────────────────────────────

/**
 * Shape of the JSON body returned with every HTTP 402 response.
 *
 * All monetary amounts are in micro-dollars (µ$):
 *   100 = $0.001, 1 000 = $0.01, 100 000 = $1.00
 *
 * `currency` is `"USD_CENTS"` to make the unit explicit to bot operators
 * parsing the response programmatically.
 */
export interface PaymentRequiredBody {
  error: 'Payment Required';
  /** Detected bot name, e.g. `"OpenAI GPTBot"`. */
  bot: string;
  /** Bot category, e.g. `"ai_training"` | `"ai_inference"` | `"crawler"`. */
  botType: string;
  /** The request path that triggered this response. */
  path: string;
  /** Site owner's configured price for this page (µ$). */
  basePrice: number;
  /** ScraperKast platform fee (µ$). 0 during the free tier; 5 % after. */
  scraperKastFee: number;
  /** Total amount the bot operator must pay (µ$). basePrice + scraperKastFee. */
  totalPrice: number;
  /** Unit for all monetary amounts. Values are in micro-dollars. */
  currency: 'USD_CENTS';
  /** Content license the bot is purchasing. */
  licenseType: string;
  /** `'free'` for the first 10 000 requests; `'paid'` thereafter. */
  tier: 'free' | 'paid';
  /** Total requests this bot has already made (before the current one). */
  requestCount: number;
  /**
   * How many more free requests remain before fees apply.
   * Present only while `tier === 'free'`; omitted once the paid tier begins.
   */
  freeRequestsRemaining?: number;
  /**
   * Breakdown of where the money goes.
   * `websiteOwner` is the site owner's cut; `scraperKast` is the platform fee.
   * Both are in µ$.
   */
  breakdown: {
    websiteOwner: number;
    scraperKast: number;
  };
  /** URL the bot operator should visit to purchase a token for this content. */
  paymentUrl: string;
}

// ─── 403 response body ────────────────────────────────────────────────────────

interface ForbiddenBody {
  error: 'Forbidden';
  message: string;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

const PAYMENT_API_BASE = 'https://api.scraperkast.com/pay';

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
 * **Decision flow:**
 * ```
 * Request
 *   │
 *   ├─ Not a bot?          → next()                    [200]
 *   ├─ Valid JWT + credits? → onAuthorized → next()    [200]
 *   ├─ No pricing rule?    → 403 Forbidden
 *   └─ Pricing rule found  → onPaymentRequired → 402
 * ```
 *
 * @example
 * ```ts
 * app.use(scraperKast({
 *   jwtSecret: process.env.SCRAPERKAST_SECRET!,
 *   rules: [
 *     { id: 'blog', path: '/blog/*', pricePerPage: 100, licenseType: 'summarization' },
 *   ],
 *   enableAnalytics: true,
 *   onPaymentRequired(req, price) {
 *     console.log(`[402] ${price.tier} tier — bot owes ${price.totalPrice} µ$`);
 *   },
 * }));
 * ```
 */
export function scraperKast(config: ScraperKastConfig): RequestHandler {
  const {
    rules,
    jwtSecret,
    counter,
    enableAnalytics = false,
    onAuthorized,
    onPaymentRequired,
  } = config;

  // Pass the optional counter to PricingEngine so callers can inject Redis, etc.
  const pricingEngine = new PricingEngine(rules, counter);
  const authService   = new AuthService(jwtSecret);
  const analytics     = enableAnalytics ? new AnalyticsCollector() : null;

  // The inner handler is async because PricingEngine.getPrice() is async.
  // We wrap it in a void IIFE so the outer Express middleware signature stays
  // synchronous — compatible with Express 4 and Express 5.
  // All async errors are forwarded to next(err).
  return function scraperKastMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
  ): void {
    void (async () => {
      try {
        const userAgent = req.headers['user-agent'] ?? '';
        const detection = detectBot(userAgent);

        // ── Not a bot → pass straight through ──────────────────────────────
        if (!detection.isBot || detection.botName === null) {
          next();
          return;
        }

        const { botName } = detection;
        // detection.type is guaranteed non-null when isBot is true.
        const botType = detection.type ?? 'unknown';
        const { path } = req;

        // ── Bot detected → check for a valid JWT ────────────────────────────
        const rawToken = extractBearerToken(req);
        let botId: string | undefined;

        if (rawToken !== null) {
          const payload = authService.verifyToken(rawToken);

          if (payload !== null && payload.credits > 0) {
            // Valid, credited token → authorise access.
            botId = payload.botId;
            analytics?.trackAccess(botName, path, true, undefined);

            try {
              onAuthorized?.(req, botName);
            } catch {
              // Never let a callback crash the middleware.
            }

            next();
            return;
          }
          // Token invalid / expired / zero credits → fall through to pricing.
        }

        // ── No valid token → consult pricing rules ──────────────────────────
        const priceResult = await pricingEngine.getPrice(path, botName, botId);

        if (priceResult === null) {
          // No rule covers this bot/path → block.
          analytics?.trackAccess(botName, path, false);

          const body: ForbiddenBody = {
            error: 'Forbidden',
            message: `Bot "${botName}" is not permitted to access ${path}`,
          };
          res.status(403).json(body);
          return;
        }

        // ── Pricing rule found → 402 Payment Required ───────────────────────
        analytics?.trackPaymentRequired(botName, path, priceResult.totalPrice);
        analytics?.trackAccess(botName, path, false, undefined);

        try {
          onPaymentRequired?.(req, priceResult);
        } catch {
          // Never let a callback crash the middleware.
        }

        const body: PaymentRequiredBody = {
          error:         'Payment Required',
          bot:           botName,
          botType,
          path,
          basePrice:     priceResult.basePrice,
          scraperKastFee: priceResult.scraperKastFee,
          totalPrice:    priceResult.totalPrice,
          currency:      'USD_CENTS',
          licenseType:   priceResult.licenseType,
          tier:          priceResult.tier,
          requestCount:  priceResult.requestCount,
          // Only include freeRequestsRemaining while still in the free tier.
          // In the paid tier it is always 0 — including it would be misleading.
          ...(priceResult.tier === 'free'
            ? { freeRequestsRemaining: priceResult.freeRequestsRemaining }
            : {}),
          breakdown: {
            websiteOwner: priceResult.basePrice,
            scraperKast:  priceResult.scraperKastFee,
          },
          paymentUrl: buildPaymentUrl(botName, path),
        };

        res.status(402).json(body);
      } catch (err) {
        // Unexpected error → forward to Express error handler.
        next(err);
      }
    })();
  };
}

// ─── Re-exports ───────────────────────────────────────────────────────────────
export { AnalyticsCollector };
export type { PricingRule, PriceResult, RequestCounter };
