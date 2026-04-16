import { Router, type Request, type Response, type NextFunction } from 'express';
import {
  detectBot,
  PricingEngine,
  AuthService,
  AnalyticsCollector,
} from '@scraperkast/core';
import type { PricingRule, PriceResult, RequestCounter } from '@scraperkast/core';
import { SolanaPaymentHandler } from './solanaHandler.js';
import { createVerifyPaymentRouter } from './routes/verifyPayment.js';
import type {
  SolanaPaymentConfig,
  PaymentInstructions,
  VerificationResult,
} from './types.js';

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
   */
  counter?: RequestCounter;

  /** Set to true to collect per-request analytics in memory. Default: false. */
  enableAnalytics?: boolean;

  /**
   * When provided, enables on-chain USDC payment flow via Solana.
   * 402 responses include payment instructions; POST /verify-payment is mounted
   * to issue JWTs after successful on-chain payment.
   */
  solana?: SolanaPaymentConfig;

  /**
   * Called after a bot is allowed through with a valid, credited JWT.
   */
  onAuthorized?: (req: Request, botName: string) => void;

  /**
   * Called when a 402 Payment Required response is about to be sent.
   */
  onPaymentRequired?: (req: Request, priceResult: PriceResult) => void;
}

// ─── 402 response body ────────────────────────────────────────────────────────

/**
 * Shape of the JSON body returned with every HTTP 402 response.
 *
 * All monetary amounts are in micro-USDC / micro-dollars (µ):
 *   100 = $0.0001, 1 000 = $0.001, 1 000 000 = $1.00
 *
 * When Solana is enabled:
 *  - `currency` is `"USDC"` instead of `"USD_CENTS"`
 *  - `payment` contains the on-chain transfer instructions
 *  - `botId` is populated for the bot to use in POST /verify-payment
 */
export interface PaymentRequiredBody {
  error: 'Payment Required';
  bot: string;
  botType: string;
  path: string;
  basePrice: number;
  scraperKastFee: number;
  totalPrice: number;
  currency: 'USD_CENTS' | 'USDC';
  licenseType: string;
  tier: 'free' | 'paid';
  requestCount: number;
  freeRequestsRemaining?: number;
  breakdown: {
    websiteOwner: number;
    scraperKast: number;
  };
  /** Present when Solana is enabled. */
  payment?: PaymentInstructions;
  /** Bot identifier to include in POST /verify-payment. Present when Solana is enabled. */
  botId?: string;
  /** Absolute request number (same as requestCount). Present when Solana is enabled. */
  requestNumber?: number;
  /** Fallback payment URL when Solana is not enabled. */
  paymentUrl?: string;
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

/** Derive a stable bot identifier from a bot display name. */
function deriveBotId(botName: string): string {
  return botName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// ─── Middleware factory ───────────────────────────────────────────────────────

/**
 * ScraperKast Express middleware.
 *
 * Returns an Express `Router` so it can mount the POST /verify-payment
 * endpoint alongside the main interception middleware.  Usage is identical
 * to a plain `RequestHandler`:
 *
 * ```ts
 * app.use(scraperKast({ ... }));
 * ```
 *
 * **Decision flow:**
 * ```
 * Request
 *   │
 *   ├─ POST /verify-payment  → Solana tx verification → JWT
 *   │
 *   ├─ Not a bot?            → next()                          [200]
 *   ├─ Valid JWT + credits?  → onAuthorized → next()           [200]
 *   ├─ No pricing rule?      → 403 Forbidden
 *   └─ Pricing rule found    → onPaymentRequired → 402
 *        └─ Solana enabled + paid tier? → include payment instructions
 * ```
 */
export function scraperKast(config: ScraperKastConfig): Router {
  const {
    rules,
    jwtSecret,
    counter,
    enableAnalytics = false,
    solana,
    onAuthorized,
    onPaymentRequired,
  } = config;

  const pricingEngine = new PricingEngine(rules, counter);
  const authService   = new AuthService(jwtSecret);
  const analytics     = enableAnalytics ? new AnalyticsCollector() : null;

  // Initialise Solana handler once (connection is expensive to create).
  let solanaHandler: SolanaPaymentHandler | null = null;
  if (solana?.enabled) {
    solanaHandler = new SolanaPaymentHandler(solana);
    console.log(
      `[ScraperKast] Solana payments enabled — network=${solana.network} ` +
      `owner=${solana.ownerWallet} platform=${solana.platformWallet}`,
    );
  }

  const router = Router();

  // ── Mount POST /verify-payment when Solana is enabled ────────────────────
  if (solanaHandler) {
    router.use(createVerifyPaymentRouter(solanaHandler, authService));
  }

  // ── Main interception middleware ─────────────────────────────────────────
  router.use(function scraperKastMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
  ): void {
    void (async () => {
      try {
        const userAgent = req.headers['user-agent'] ?? '';
        const detection = detectBot(userAgent);

        // ── Not a bot → pass straight through ────────────────────────────
        if (!detection.isBot || detection.botName === null) {
          next();
          return;
        }

        const { botName } = detection;
        const botType = detection.type ?? 'unknown';
        const { path } = req;

        // ── Bot detected → check for a valid JWT ──────────────────────────
        const rawToken = extractBearerToken(req);
        let jwtBotId: string | undefined;

        if (rawToken !== null) {
          const payload = authService.verifyToken(rawToken);

          if (payload !== null && payload.credits > 0) {
            jwtBotId = payload.botId;
            analytics?.trackAccess(botName, path, true, undefined);

            try {
              onAuthorized?.(req, botName);
            } catch {
              // Never let a callback crash the middleware.
            }

            next();
            return;
          }
          // Invalid / expired / zero-credit token → fall through to pricing.
        }

        // ── No valid token → consult pricing rules ────────────────────────
        const priceResult = await pricingEngine.getPrice(path, botName, jwtBotId);

        if (priceResult === null) {
          analytics?.trackAccess(botName, path, false);

          const body: ForbiddenBody = {
            error:   'Forbidden',
            message: `Bot "${botName}" is not permitted to access ${path}`,
          };
          res.status(403).json(body);
          return;
        }

        // ── Pricing rule found → 402 Payment Required ─────────────────────
        analytics?.trackPaymentRequired(botName, path, priceResult.totalPrice);
        analytics?.trackAccess(botName, path, false, undefined);

        try {
          onPaymentRequired?.(req, priceResult);
        } catch {
          // Never let a callback crash the middleware.
        }

        const usingSolana = solanaHandler !== null && priceResult.tier === 'paid';
        const effectiveBotId = jwtBotId ?? deriveBotId(botName);

        // Build 402 body.
        const body: PaymentRequiredBody = {
          error:          'Payment Required',
          bot:            botName,
          botType,
          path,
          basePrice:      priceResult.basePrice,
          scraperKastFee: priceResult.scraperKastFee,
          totalPrice:     priceResult.totalPrice,
          currency:       usingSolana ? 'USDC' : 'USD_CENTS',
          licenseType:    priceResult.licenseType,
          tier:           priceResult.tier,
          requestCount:   priceResult.requestCount,
          ...(priceResult.tier === 'free'
            ? { freeRequestsRemaining: priceResult.freeRequestsRemaining }
            : {}),
          breakdown: {
            websiteOwner: priceResult.basePrice,
            scraperKast:  priceResult.scraperKastFee,
          },
          ...(usingSolana
            ? {
                payment:       solanaHandler!.generatePaymentInstructions(
                  priceResult,
                  effectiveBotId,
                  req.hostname,
                ),
                botId:         effectiveBotId,
                requestNumber: priceResult.requestCount,
              }
            : { paymentUrl: buildPaymentUrl(botName, path) }),
        };

        if (usingSolana) {
          console.log(
            `[ScraperKast] 402 Solana payment required — ` +
            `bot=${botName} path=${path} ` +
            `base=${priceResult.basePrice}µUSDC fee=${priceResult.scraperKastFee}µUSDC`,
          );
        }

        res.status(402).json(body);
      } catch (err) {
        next(err);
      }
    })();
  });

  return router;
}

// ─── Re-exports ───────────────────────────────────────────────────────────────
export { AnalyticsCollector };
export type { PricingRule, PriceResult, RequestCounter };
export type { SolanaPaymentConfig, PaymentInstructions, VerificationResult };
export { SolanaPaymentHandler };
