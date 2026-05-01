import { Router, type Request, type Response, type NextFunction } from 'express';
import {
  detectBotEnhanced,
  PricingEngine,
  AuthService,
  AnalyticsCollector,
  DodoPaymentService,
  SessionStore,
} from '@scraperkast/core';
import type { PricingRule, PriceResult, RequestCounter, RequestContext } from '@scraperkast/core';
import { SolanaPaymentHandler } from './solanaHandler.js';
import { createVerifyPaymentRouter } from './routes/verifyPayment.js';
import { createDodoCheckoutRouter } from './routes/dodoCheckout.js';
import { createDodoWebhookRouter } from './routes/dodoWebhook.js';
import { createGetTokenRouter } from './routes/getToken.js';
import type {
  SolanaPaymentConfig,
  DodoPaymentConfig,
  PaymentInstructions,
  SolanaPaymentOption,
  DodoPaymentOption,
  MultiPaymentOptions,
  VerificationResult,
  TokenRetrievalResult,
  CheckoutCreateResponse,
} from './types.js';

// ─── Public config interface ──────────────────────────────────────────────────

export interface ScraperKastConfig {
  /** Pricing rules the site owner has defined. */
  rules: PricingRule[];

  /**
   * Secret used to verify incoming bot JWT tokens.
   */
  jwtSecret: string;

  /**
   * Pluggable request counter.  Defaults to an in-memory counter that resets
   * on restart.  Inject a Redis- or database-backed implementation for
   * globally-consistent free-tier enforcement.
   */
  counter?: RequestCounter;

  /** Set to true to collect per-request analytics in memory. Default: false. */
  enableAnalytics?: boolean;

  /**
   * Enables on-chain USDC payment flow via Solana.
   * Mounts POST /verify-payment when set.
   */
  solana?: SolanaPaymentConfig;

  /**
   * Enables credit-card → USDC checkout via Dodo Payments.
   * Mounts POST /checkout/create, POST /webhooks/dodo,
   * and GET /checkout/:sessionId/token when set.
   *
   * Requires `solana` to be configured so the middleware knows which
   * wallets to route USDC to.
   */
  dodo?: DodoPaymentConfig;

  /**
   * Behavioral detection tuning.
   *
   * By default the middleware runs both User-Agent matching (catches declared
   * bots like GPTBot) and behavioral analysis (catches disguised commercial
   * scrapers like Firecrawl and BrightData). These options let you tune or
   * disable each layer independently.
   */
  detection?: {
    /**
     * Minimum confidence (0–100) required to act on a behavioral detection.
     * UA-based detections always have confidence 100 and bypass this threshold.
     * @default 70
     */
    confidenceThreshold?: number;
    /**
     * Run behavioral analysis (RPS, sequential access, fingerprint checks)
     * to catch scrapers that fake a Chrome User-Agent.
     * @default true
     */
    enableBehavioral?: boolean;
    /**
     * Log every bot detection (method, confidence, botName) to console.
     * Useful during initial setup; leave off in production to reduce noise.
     * @default false
     */
    logDetections?: boolean;
  };

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
 * When only Solana is enabled:
 *   `payment` = {@link PaymentInstructions} (backward-compatible)
 *
 * When both Solana + Dodo are enabled:
 *   `payment` = {@link MultiPaymentOptions} with `options` array
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
  /** USD equivalent string — present when Dodo is enabled. */
  fiatEquivalent?: string;
  licenseType: string;
  tier: 'free' | 'paid';
  requestCount: number;
  freeRequestsRemaining?: number;
  breakdown: {
    websiteOwner: number;
    scraperKast: number;
  };
  /**
   * Payment instructions.
   * - `PaymentInstructions`   — Solana-only mode
   * - `MultiPaymentOptions`   — Solana + Dodo mode
   * - absent                  — no Solana config, or free tier
   */
  payment?: PaymentInstructions | MultiPaymentOptions;
  /** Bot identifier for use in /checkout/create and /verify-payment. */
  botId?: string;
  /** Same as `requestCount` — present when Solana is enabled. */
  requestNumber?: number;
  /** Fallback URL — present when Solana is NOT configured. */
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

function deriveBotId(botName: string): string {
  return botName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/** µUSDC → USD display string. */
function microUsdcToUsd(microUsdc: number): string {
  const usd = microUsdc / 1_000_000;
  return usd >= 0.01 ? `$${usd.toFixed(2)}` : `$${usd.toFixed(6)}`;
}

// ─── Middleware factory ───────────────────────────────────────────────────────

/**
 * ScraperKast Express middleware.
 *
 * Returns an Express `Router`.  Usage is identical to a `RequestHandler`:
 * ```ts
 * app.use(scraperKast({ ... }));
 * ```
 *
 * Mounted endpoints (depending on config):
 *   POST /verify-payment          — Solana: exchange tx sig for JWT
 *   POST /checkout/create         — Dodo: create checkout session
 *   POST /webhooks/dodo           — Dodo: receive payment webhook
 *   GET  /checkout/:id/token      — Dodo: poll for JWT after payment
 *
 * Decision flow:
 * ```
 * Request
 *   ├─ /verify-payment, /checkout/*, /webhooks/*  → payment routes
 *   ├─ Not a bot?           → next()
 *   ├─ Valid JWT + credits? → onAuthorized → next()
 *   ├─ No pricing rule?     → 403 Forbidden
 *   └─ Pricing rule found   → 402 Payment Required
 *        ├─ Solana only          → payment = PaymentInstructions
 *        ├─ Solana + Dodo        → payment = { options: [...] }
 *        └─ Neither              → paymentUrl (fallback)
 * ```
 */
export function scraperKast(config: ScraperKastConfig): Router {
  const {
    rules,
    jwtSecret,
    counter,
    enableAnalytics = false,
    solana,
    dodo,
    detection,
    onAuthorized,
    onPaymentRequired,
  } = config;

  const confidenceThreshold = detection?.confidenceThreshold ?? 70;
  const enableBehavioral    = detection?.enableBehavioral    ?? true;
  const logDetections       = detection?.logDetections       ?? false;

  const pricingEngine = new PricingEngine(rules, counter);
  const authService   = new AuthService(jwtSecret);
  const analytics     = enableAnalytics ? new AnalyticsCollector() : null;

  // ── Initialise Solana handler ──────────────────────────────────────────
  let solanaHandler: SolanaPaymentHandler | null = null;
  if (solana?.enabled) {
    solanaHandler = new SolanaPaymentHandler(solana);
    console.log(
      `[ScraperKast] Solana payments enabled — network=${solana.network} ` +
      `owner=${solana.ownerWallet} platform=${solana.platformWallet}`,
    );
  }

  // ── Initialise Dodo handler ────────────────────────────────────────────
  let dodoService:   DodoPaymentService | null = null;
  let sessionStore:  SessionStore | null       = null;
  let cleanupTimer:  ReturnType<typeof setInterval> | null = null;

  if (dodo?.enabled) {
    if (!solanaHandler) {
      throw new Error(
        '[ScraperKast] Dodo payments require Solana to be configured ' +
        '(wallet addresses are needed for USDC routing).',
      );
    }
    const network = solana?.network ?? 'devnet';
    dodoService  = new DodoPaymentService(dodo.apiKey, network, dodo.webhookSecret);
    sessionStore = new SessionStore();

    // Prune expired sessions every 5 minutes.
    cleanupTimer = setInterval(() => {
      const removed = sessionStore!.cleanup();
      if (removed > 0) console.log(`[Dodo] Cleaned up ${removed} expired session(s)`);
    }, 5 * 60 * 1000);

    // Allow GC — don't keep the process alive just for cleanup.
    if (cleanupTimer.unref) cleanupTimer.unref();

    console.log(
      `[ScraperKast] Dodo payments enabled — ` +
      `checkout=POST /checkout/create webhook=POST /webhooks/dodo`,
    );
  }

  const router = Router();

  // ── Mount payment sub-routes ───────────────────────────────────────────
  if (solanaHandler) {
    router.use(createVerifyPaymentRouter(solanaHandler, authService));
  }

  if (dodoService && sessionStore && solanaHandler) {
    router.use(createDodoCheckoutRouter(dodoService, sessionStore, solanaHandler, dodo!));
    router.use(createDodoWebhookRouter(dodoService, sessionStore, authService));
    router.use(createGetTokenRouter(sessionStore));
  }

  // ── Main interception middleware ───────────────────────────────────────
  router.use(function scraperKastMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
  ): void {
    void (async () => {
      try {
        // Build full request context for enhanced detection.
        const context: RequestContext = {
          userAgent: req.headers['user-agent'] ?? '',
          ip:        req.ip ?? (req.socket.remoteAddress ?? ''),
          headers:   req.headers as Record<string, string | string[] | undefined>,
          path:      req.path,
          timestamp: Date.now(),
        };

        const detection = detectBotEnhanced(context, enableBehavioral);

        if (logDetections && detection.isBot) {
          const pct = Math.round(detection.confidence * 100);
          console.log(
            `[ScraperKast] Bot detected — name="${detection.botName}" ` +
            `method=${detection.method} confidence=${pct}%` +
            (detection.behavioralScore !== undefined
              ? ` score=${detection.behavioralScore}`
              : ''),
          );
        }

        // ── Not a bot (or below confidence threshold) ─────────────────────
        const confidencePct = detection.confidence * 100;
        if (!detection.isBot || detection.botName === null || confidencePct < confidenceThreshold) {
          next();
          return;
        }

        const { botName } = detection;
        const botType = detection.type ?? 'unknown';
        const { path } = req;

        // ── Valid JWT? ────────────────────────────────────────────────────
        const rawToken = extractBearerToken(req);
        let jwtBotId: string | undefined;

        if (rawToken !== null) {
          const payload = authService.verifyToken(rawToken);

          if (payload !== null && payload.credits > 0) {
            jwtBotId = payload.botId;
            analytics?.trackAccess(botName, path, true, undefined);

            try { onAuthorized?.(req, botName); } catch { /* never crash */ }

            next();
            return;
          }
        }

        // ── Pricing ───────────────────────────────────────────────────────
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

        // ── 402 Payment Required ──────────────────────────────────────────
        analytics?.trackPaymentRequired(botName, path, priceResult.totalPrice);
        analytics?.trackAccess(botName, path, false, undefined);

        try { onPaymentRequired?.(req, priceResult); } catch { /* never crash */ }

        const hasSolana   = solanaHandler !== null && priceResult.tier === 'paid';
        const hasDodo     = dodoService   !== null && priceResult.tier === 'paid';
        const useSolana   = hasSolana;
        const effectiveBotId = jwtBotId ?? deriveBotId(botName);

        // Build the `payment` field.
        let paymentField: PaymentInstructions | MultiPaymentOptions | undefined;

        if (useSolana && hasDodo) {
          // Both methods — return options array.
          const solanaOption: SolanaPaymentOption = {
            ...solanaHandler!.generatePaymentInstructions(
              priceResult,
              effectiveBotId,
              req.hostname,
            ),
            type: 'direct',
          };
          const dodoOption: DodoPaymentOption = {
            method:           'dodo',
            type:             'checkout',
            checkoutEndpoint: '/checkout/create',
            acceptedMethods:  ['credit_card', 'debit_card'],
          };
          paymentField = { options: [solanaOption, dodoOption] } satisfies MultiPaymentOptions;
        } else if (useSolana) {
          // Solana only — original format.
          paymentField = solanaHandler!.generatePaymentInstructions(
            priceResult, effectiveBotId, req.hostname,
          );
        }
        // else: no Solana → paymentUrl fallback below.

        const body: PaymentRequiredBody = {
          error:          'Payment Required',
          bot:            botName,
          botType,
          path,
          basePrice:      priceResult.basePrice,
          scraperKastFee: priceResult.scraperKastFee,
          totalPrice:     priceResult.totalPrice,
          currency:       useSolana ? 'USDC' : 'USD_CENTS',
          ...(hasDodo ? { fiatEquivalent: microUsdcToUsd(priceResult.totalPrice) } : {}),
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
          ...(paymentField
            ? { payment: paymentField, botId: effectiveBotId, requestNumber: priceResult.requestCount }
            : { paymentUrl: buildPaymentUrl(botName, path) }),
        };

        if (useSolana) {
          const mode = hasDodo ? 'Solana+Dodo' : 'Solana';
          console.log(
            `[ScraperKast] 402 [${mode}] — ` +
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
export { AnalyticsCollector, SolanaPaymentHandler };
export type {
  PricingRule, PriceResult, RequestCounter,
  SolanaPaymentConfig, DodoPaymentConfig,
  PaymentInstructions, MultiPaymentOptions, SolanaPaymentOption, DodoPaymentOption,
  VerificationResult, TokenRetrievalResult, CheckoutCreateResponse,
};
