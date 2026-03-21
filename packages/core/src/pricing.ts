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

// ─── Internal ─────────────────────────────────────────────────────────────────

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

export interface PriceResult {
  pricePerPage: number;
  licenseType: LicenseType;
  /** The rule whose specificity won. */
  matchedRuleId: string;
}

export class PricingEngine {
  /**
   * Rules sorted by descending specificity so the first match is always the
   * most specific one. Ties preserve the original insertion order (the first
   * rule defined by the site owner wins).
   */
  private readonly rules: readonly PricingRule[];

  constructor(rules: PricingRule[]) {
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
   * Look up the price for a bot fetching a given path.
   *
   * @param path    - The request path, e.g. `"/blog/my-post"`.
   * @param botName - The `botName` from `detectBot()`, e.g. `"OpenAI GPTBot"`.
   * @returns A {@link PriceResult} for the best-matching rule, or `null` if no
   *          rule matches this path + bot combination.
   */
  getPrice(path: string, botName: string): PriceResult | null {
    for (const rule of this.rules) {
      const pathMatches = rule.path === undefined || matchesPath(rule.path, path);
      const botMatches = rule.bot === undefined || rule.bot === botName;

      if (pathMatches && botMatches) {
        return {
          pricePerPage: rule.pricePerPage,
          licenseType: rule.licenseType,
          matchedRuleId: rule.id,
        };
      }
    }

    return null;
  }
}
