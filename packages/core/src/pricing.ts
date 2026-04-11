export type LicenseType = 'summarization' | 'full_display';

export interface PricingRule {
  /** Unique identifier for this rule. */
  id: string;
  /**
   * URL path to match. Supports a single trailing wildcard segment.
   *
   * Examples:
   *   "/blog/*"   – matches /blog/anything but not /blog/a/b
   *   "/api/**"   – matches /api/ and any depth beneath it
   *   "/about"    – exact match only
   *
   * Omit to match any path (global / bot-only rule).
   */
  path?: string;
  /**
   * Bot name to match. Must equal the `botName` returned by `detectBot()`
   * (e.g. "OpenAI GPTBot").
   *
   * Omit to match any bot (path-only or global rule).
   */
  bot?: string;
  /**
   * Price in micro-dollars (µ$). 100 = $0.001, 1000 = $0.01, 100_000 = $1.00.
   * Use 0 to explicitly allow free access.
   */
  pricePerPage: number;
  /** What the bot is licensed to do with the content. */
  licenseType: LicenseType;
}

// ─── Request counter ──────────────────────────────────────────────────────────

/**
 * Pluggable counter that tracks how many requests a bot has made.
 *
 * The default {@link InMemoryCounter} resets on every process restart and is
 * scoped to a single server. For production deployments where the 10 k free
 * tier must be enforced globally across all websites and all servers, inject
 * a Redis- or database-backed implementation.
 *
 * @example
 * ```ts
 * class RedisCounter implements RequestCounter {
 *   async getCount(key: string) { return +(await redis.get(`sk:${key}`)) || 0; }
 *   async increment(key: string) { await redis.incr(`sk:${key}`); }
 * }
 * const engine = new PricingEngine(rules, new RedisCounter());
 * ```
 */
export interface RequestCounter {
  /**
   * Return the total number of requests already recorded for `key`.
   * Return 0 when the key is unknown; never throw.
   */
  getCount(key: string): Promise<number>;

  /**
   * Atomically increment the counter for `key` by 1.
   * Swallow failures silently; never throw.
   */
  increment(key: string): Promise<void>;
}

/**
 * Default in-memory counter.  Counts are lost on restart.
 * Suitable for development, single-process deployments, and unit tests.
 */
export class InMemoryCounter implements RequestCounter {
  private readonly counts = new Map<string, number>();

  async getCount(key: string): Promise<number> {
    return this.counts.get(key) ?? 0;
  }

  async increment(key: string): Promise<void> {
    this.counts.set(key, (this.counts.get(key) ?? 0) + 1);
  }
}

// ─── Price result ─────────────────────────────────────────────────────────────

export interface PriceResult {
  /**
   * The website owner's configured price for this page (µ$).
   * Equals the matched rule's `pricePerPage`.
   */
  basePrice: number;

  /**
   * ScraperKast platform fee (µ$).
   *
   * - `'free'` tier → always **0**
   * - `'paid'` tier → `Math.ceil(basePrice × 5 %)` (rounded up so the
   *   platform always recovers at least 1 µ$ on any non-zero basePrice)
   */
  scraperKastFee: number;

  /**
   * Total amount the bot operator must pay for this page (µ$).
   * `totalPrice = basePrice + scraperKastFee`.
   */
  totalPrice: number;

  /**
   * Billing tier for this request.
   *
   * - `'free'`  – within the first {@link PricingEngine.FREE_TIER_LIMIT}
   *               requests; `scraperKastFee` is 0.
   * - `'paid'`  – free quota exhausted; `scraperKastFee` applies.
   */
  tier: 'free' | 'paid';

  /**
   * Number of requests this bot has **already** made (read from the counter
   * before the current request is recorded).
   */
  requestCount: number;

  /**
   * Remaining free-tier requests for this bot.
   * Counts down from {@link PricingEngine.FREE_TIER_LIMIT} to 0, then stays at 0.
   */
  freeRequestsRemaining: number;

  /** License type from the matched rule. */
  licenseType: LicenseType;

  /** ID of the rule that matched (useful for debugging). */
  matchedRuleId: string;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Specificity rank — higher number wins over lower.
 *
 * | path | bot | rank |
 * |------|-----|------|
 * |  ✓   |  ✓  |  3   |  most specific
 * |  ✓   |  –  |  2   |
 * |  –   |  ✓  |  1   |
 * |  –   |  –  |  0   |  global / catch-all
 */
function specificity(rule: PricingRule): number {
  return (rule.path !== undefined ? 2 : 0) + (rule.bot !== undefined ? 1 : 0);
}

/**
 * Returns true when `rulePath` matches `requestPath`.
 *
 * Supported wildcard syntax:
 *   "*"   in a path segment – matches exactly one segment
 *   "**"  as the final segment – matches zero or more trailing segments
 */
function matchesPath(rulePath: string, requestPath: string): boolean {
  // Normalise by stripping trailing slashes (except root "/").
  const normalise = (p: string) => (p.length > 1 ? p.replace(/\/+$/, '') : p);
  const rule = normalise(rulePath);
  const req = normalise(requestPath);

  const ruleParts = rule.split('/');
  const reqParts = req.split('/');

  // "**" as the final segment: rule prefix must match.
  if (ruleParts[ruleParts.length - 1] === '**') {
    const prefix = ruleParts.slice(0, -1);
    if (reqParts.length < prefix.length) return false;
    return prefix.every((seg, i) => seg === '*' || seg === reqParts[i]);
  }

  // Segment count must match for non-"**" patterns.
  if (ruleParts.length !== reqParts.length) return false;

  return ruleParts.every((seg, i) => seg === '*' || seg === reqParts[i]);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export class PricingEngine {
  /**
   * Number of requests each bot receives for free before the ScraperKast fee
   * is added.  Requests 1–10 000 (inclusive) are free; request 10 001 and
   * beyond enter the paid tier.
   *
   * Enforcing this limit globally (across all websites and servers) requires a
   * shared {@link RequestCounter} such as Redis. The default in-memory counter
   * only enforces the limit within a single process.
   */
  static readonly FREE_TIER_LIMIT = 10_000;

  /**
   * ScraperKast's commission rate as a percentage of the site owner's
   * `basePrice`.  Applied once a bot exhausts its free-tier quota.
   */
  static readonly SCRAPERKAST_FEE_PERCENT = 5;

  private readonly rules: readonly PricingRule[];
  private readonly counter: RequestCounter;

  constructor(rules: PricingRule[], counter: RequestCounter = new InMemoryCounter()) {
    this.counter = counter;

    if (rules.length === 0) {
      this.rules = [];
      return;
    }

    // Stable sort: higher specificity first, insertion order within ties.
    const indexed = rules.map((rule, i) => ({ rule, i }));
    indexed.sort((a, b) => {
      const diff = specificity(b.rule) - specificity(a.rule);
      return diff !== 0 ? diff : a.i - b.i;
    });
    this.rules = indexed.map(({ rule }) => rule);
  }

  /**
   * Return the total number of requests recorded for a bot.
   *
   * @param botId - Stable identifier for the bot operator.  Use the `botId`
   *   claim from a verified JWT when the bot is authenticated; fall back to
   *   the `botName` from {@link detectBot} for unauthenticated crawlers.
   */
  getRequestCount(botId: string): Promise<number> {
    return this.counter.getCount(botId);
  }

  /**
   * Look up the price for a bot fetching a given path, applying the
   * ScraperKast free tier and commission model.
   *
   * **Free tier:** the first {@link FREE_TIER_LIMIT} requests made by a bot
   * carry no ScraperKast fee — the bot pays only the site owner's `basePrice`.
   * Once the limit is exhausted, a 5 % commission is added on top.
   *
   * @param path    - The request path, e.g. `"/blog/my-post"`.
   * @param botName - Bot name from {@link detectBot}, e.g. `"OpenAI GPTBot"`.
   * @param botId   - Stable bot identifier for the request counter.  Falls back
   *   to `botName` when omitted (unauthenticated bots).
   * @returns A {@link PriceResult} for the best-matching rule, or `null` when
   *   no rule covers this path + bot combination.
   */
  async getPrice(
    path: string,
    botName: string,
    botId?: string,
  ): Promise<PriceResult | null> {
    // ── 1. Find the most specific matching rule ──────────────────────────────
    // Rules are already sorted by descending specificity in the constructor,
    // so the first match is always the winner.
    let matchedRule: PricingRule | null = null;
    for (const rule of this.rules) {
      const pathMatches = rule.path === undefined || matchesPath(rule.path, path);
      const botMatches  = rule.bot  === undefined || rule.bot === botName;
      if (pathMatches && botMatches) {
        matchedRule = rule;
        break;
      }
    }

    if (matchedRule === null) return null;

    // ── 2. Fetch the counter and determine the tier ──────────────────────────
    // Use botId when available so authenticated bots share one global counter
    // across all the sites they access.  Unauthenticated bots are tracked by
    // botName, which is a coarser key but avoids needing an identity.
    const trackingKey = botId ?? botName;
    const requestCount = await this.counter.getCount(trackingKey);

    const tier: 'free' | 'paid' =
      requestCount < PricingEngine.FREE_TIER_LIMIT ? 'free' : 'paid';

    // ── 3. Calculate fees ────────────────────────────────────────────────────
    const basePrice = matchedRule.pricePerPage;

    // Math.ceil ensures the platform recovers at least 1 µ$ on any non-zero
    // basePrice (e.g. basePrice = 1 → fee = ceil(0.05) = 1).
    const scraperKastFee =
      tier === 'paid'
        ? Math.ceil((basePrice * PricingEngine.SCRAPERKAST_FEE_PERCENT) / 100)
        : 0;

    const totalPrice = basePrice + scraperKastFee;

    const freeRequestsRemaining = Math.max(
      0,
      PricingEngine.FREE_TIER_LIMIT - requestCount,
    );

    return {
      basePrice,
      scraperKastFee,
      totalPrice,
      tier,
      requestCount,
      freeRequestsRemaining,
      licenseType: matchedRule.licenseType,
      matchedRuleId: matchedRule.id,
    };
  }
}
