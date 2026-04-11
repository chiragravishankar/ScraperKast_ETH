import { describe, it, expect, beforeEach } from 'vitest';
import {
  PricingEngine,
  InMemoryCounter,
} from './pricing.js';
import type { PricingRule, RequestCounter } from './pricing.js';

// ─── Test helpers ─────────────────────────────────────────────────────────────

/** Build a PricingRule with sensible defaults so tests only specify overrides. */
function rule(overrides: Partial<PricingRule> & { id: string }): PricingRule {
  return { pricePerPage: 100, licenseType: 'summarization', ...overrides };
}

/**
 * A stub counter whose starting count is set at construction time.
 * Allows tests to simulate any position in the free/paid tiers instantly,
 * without running thousands of real increments.
 */
class StubCounter implements RequestCounter {
  private count: number;
  constructor(initialCount: number) { this.count = initialCount; }
  async getCount(_key: string): Promise<number> { return this.count; }
  async increment(_key: string): Promise<void>  { this.count++; }
}

/** Shorthand: build an engine with a counter pre-seeded to `requestCount`. */
function engineAt(rules: PricingRule[], requestCount: number): PricingEngine {
  return new PricingEngine(rules, new StubCounter(requestCount));
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Free tier (requests 1 – 10 000)
// ─────────────────────────────────────────────────────────────────────────────

describe('free tier (requests 1 – 10 000)', () => {
  const rules = [rule({ id: 'r', pricePerPage: 200 })];

  it('request 1 (count = 0) is free — scraperKastFee = 0', async () => {
    const result = await engineAt(rules, 0).getPrice('/page', 'OpenAI GPTBot');
    expect(result?.tier).toBe('free');
    expect(result?.scraperKastFee).toBe(0);
    expect(result?.totalPrice).toBe(200);
  });

  it('request 5 000 (count = 4 999) is still free', async () => {
    const result = await engineAt(rules, 4_999).getPrice('/page', 'OpenAI GPTBot');
    expect(result?.tier).toBe('free');
    expect(result?.scraperKastFee).toBe(0);
  });

  it('request 10 000 (count = 9 999) — last free request', async () => {
    const result = await engineAt(rules, 9_999).getPrice('/page', 'OpenAI GPTBot');
    expect(result?.tier).toBe('free');
    expect(result?.scraperKastFee).toBe(0);
    expect(result?.freeRequestsRemaining).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Paid tier (requests 10 001+)
// ─────────────────────────────────────────────────────────────────────────────

describe('paid tier (requests 10 001+)', () => {
  const rules = [rule({ id: 'r', pricePerPage: 200 })];

  it('request 10 001 (count = 10 000) — first paid request', async () => {
    const result = await engineAt(rules, 10_000).getPrice('/page', 'OpenAI GPTBot');
    expect(result?.tier).toBe('paid');
    expect(result?.freeRequestsRemaining).toBe(0);
  });

  it('request 50 000 (count = 49 999) is paid', async () => {
    const result = await engineAt(rules, 49_999).getPrice('/page', 'OpenAI GPTBot');
    expect(result?.tier).toBe('paid');
  });

  it('freeRequestsRemaining is always 0 in paid tier', async () => {
    const result = await engineAt(rules, 10_001).getPrice('/page', 'OpenAI GPTBot');
    expect(result?.freeRequestsRemaining).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Tier boundary edge cases (9 999 / 10 000 / 10 001)
// ─────────────────────────────────────────────────────────────────────────────

describe('tier boundary edge cases', () => {
  const rules = [rule({ id: 'r', pricePerPage: 100 })];

  it('count = 9 999 → free  (9 999 < FREE_TIER_LIMIT)', async () => {
    const r = await engineAt(rules, 9_999).getPrice('/p', 'Bot');
    expect(r?.tier).toBe('free');
    expect(r?.freeRequestsRemaining).toBe(1);
  });

  it('count = 10 000 → paid (10 000 is NOT < FREE_TIER_LIMIT)', async () => {
    const r = await engineAt(rules, 10_000).getPrice('/p', 'Bot');
    expect(r?.tier).toBe('paid');
    expect(r?.freeRequestsRemaining).toBe(0);
  });

  it('count = 10 001 → paid', async () => {
    const r = await engineAt(rules, 10_001).getPrice('/p', 'Bot');
    expect(r?.tier).toBe('paid');
    expect(r?.freeRequestsRemaining).toBe(0);
  });

  it('FREE_TIER_LIMIT constant is exactly 10 000', () => {
    expect(PricingEngine.FREE_TIER_LIMIT).toBe(10_000);
  });

  it('SCRAPERKAST_FEE_PERCENT constant is exactly 5', () => {
    expect(PricingEngine.SCRAPERKAST_FEE_PERCENT).toBe(5);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Fee calculation (5 % of basePrice, ceiled)
// ─────────────────────────────────────────────────────────────────────────────

describe('ScraperKast fee calculation', () => {
  /** Returns a paid-tier result for the given pricePerPage. */
  async function paidResult(pricePerPage: number) {
    return (await engineAt([rule({ id: 'r', pricePerPage })], 10_000).getPrice('/page', 'Bot'))!;
  }

  it('100 µ$ → fee = 5 µ$,  total = 105 µ$', async () => {
    const r = await paidResult(100);
    expect(r.scraperKastFee).toBe(5);
    expect(r.totalPrice).toBe(105);
  });

  it('500 µ$ → fee = 25 µ$, total = 525 µ$', async () => {
    const r = await paidResult(500);
    expect(r.scraperKastFee).toBe(25);
    expect(r.totalPrice).toBe(525);
  });

  it('1 000 µ$ → fee = 50 µ$, total = 1 050 µ$', async () => {
    const r = await paidResult(1_000);
    expect(r.scraperKastFee).toBe(50);
    expect(r.totalPrice).toBe(1_050);
  });

  it('rounds up: 101 µ$ → fee = ceil(5.05) = 6 µ$, total = 107 µ$', async () => {
    const r = await paidResult(101);
    expect(r.scraperKastFee).toBe(6);
    expect(r.totalPrice).toBe(107);
  });

  it('rounds up: 1 µ$ → fee = ceil(0.05) = 1 µ$, total = 2 µ$', async () => {
    const r = await paidResult(1);
    expect(r.scraperKastFee).toBe(1);
    expect(r.totalPrice).toBe(2);
  });

  it('0 µ$ (free content) → fee = 0, total = 0, even in paid tier', async () => {
    const r = await paidResult(0);
    expect(r.scraperKastFee).toBe(0);
    expect(r.totalPrice).toBe(0);
  });

  it('free tier always has fee = 0 regardless of basePrice', async () => {
    const r = (await engineAt([rule({ id: 'r', pricePerPage: 9_999 })], 0).getPrice('/page', 'Bot'))!;
    expect(r.tier).toBe('free');
    expect(r.scraperKastFee).toBe(0);
    expect(r.totalPrice).toBe(9_999);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. requestCount and freeRequestsRemaining fields
// ─────────────────────────────────────────────────────────────────────────────

describe('requestCount and freeRequestsRemaining', () => {
  const rules = [rule({ id: 'r' })];

  it('reflects the count returned by the counter', async () => {
    const r = (await engineAt(rules, 42).getPrice('/p', 'Bot'))!;
    expect(r.requestCount).toBe(42);
  });

  it('freeRequestsRemaining counts down correctly', async () => {
    const counts = [0, 1, 9_999, 10_000, 10_001];
    const expected = [10_000, 9_999, 1, 0, 0];
    for (let i = 0; i < counts.length; i++) {
      const r = await engineAt(rules, counts[i]).getPrice('/p', 'Bot');
      expect(r?.freeRequestsRemaining, `count=${counts[i]}`).toBe(expected[i]);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. getRequestCount() public method
// ─────────────────────────────────────────────────────────────────────────────

describe('getRequestCount()', () => {
  it('delegates to the underlying counter', async () => {
    const engine = engineAt([rule({ id: 'r' })], 77);
    expect(await engine.getRequestCount('any-key')).toBe(77);
  });

  it('returns 0 for an unknown botId on a fresh counter', async () => {
    const engine = new PricingEngine([rule({ id: 'r' })], new InMemoryCounter());
    expect(await engine.getRequestCount('unknown-bot')).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. botId tracking key
// ─────────────────────────────────────────────────────────────────────────────

describe('tracking key: botId takes precedence over botName', () => {
  const rules = [rule({ id: 'r', pricePerPage: 100 })];

  it('uses botId as counter key when provided', async () => {
    const counter = new InMemoryCounter();
    for (let i = 0; i < 10_000; i++) await counter.increment('openai-abc123');
    const engine = new PricingEngine(rules, counter);
    const withId = await engine.getPrice('/page', 'OpenAI GPTBot', 'openai-abc123');
    expect(withId?.tier).toBe('paid');
  });

  it('falls back to botName when botId is omitted', async () => {
    const counter = new InMemoryCounter();
    for (let i = 0; i < 10_000; i++) await counter.increment('OpenAI GPTBot');
    const engine = new PricingEngine(rules, counter);
    const withoutId = await engine.getPrice('/page', 'OpenAI GPTBot');
    expect(withoutId?.tier).toBe('paid');
  });

  it('two bots sharing a botName but different botIds have independent counters', async () => {
    const counter = new InMemoryCounter();
    await counter.increment('bot-id-A'); // A has 1 request, B has 0
    const engine = new PricingEngine(rules, counter);

    const a = await engine.getPrice('/page', 'OpenAI GPTBot', 'bot-id-A');
    const b = await engine.getPrice('/page', 'OpenAI GPTBot', 'bot-id-B');

    expect(a?.requestCount).toBe(1);
    expect(b?.requestCount).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. InMemoryCounter unit tests
// ─────────────────────────────────────────────────────────────────────────────

describe('InMemoryCounter', () => {
  let counter: InMemoryCounter;
  beforeEach(() => { counter = new InMemoryCounter(); });

  it('returns 0 for an unseen key', async () => {
    expect(await counter.getCount('x')).toBe(0);
  });

  it('increments monotonically', async () => {
    await counter.increment('x');
    await counter.increment('x');
    await counter.increment('x');
    expect(await counter.getCount('x')).toBe(3);
  });

  it('keeps separate counts for different keys', async () => {
    await counter.increment('a');
    await counter.increment('b');
    await counter.increment('b');
    expect(await counter.getCount('a')).toBe(1);
    expect(await counter.getCount('b')).toBe(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. Existing matching and specificity tests (updated for async getPrice)
// ─────────────────────────────────────────────────────────────────────────────

describe('basic matching', () => {
  it('returns null when there are no rules', async () => {
    expect(await new PricingEngine([]).getPrice('/blog/post', 'OpenAI GPTBot')).toBeNull();
  });

  it('matches a global rule (no path, no bot)', async () => {
    const engine = new PricingEngine([rule({ id: 'global', pricePerPage: 50 })]);
    const result = await engine.getPrice('/anything', 'OpenAI GPTBot');
    expect(result?.basePrice).toBe(50);
    expect(result?.matchedRuleId).toBe('global');
  });

  it('returns null when no rule matches', async () => {
    const engine = new PricingEngine([rule({ id: 'r1', path: '/blog/*', bot: 'OpenAI GPTBot' })]);
    expect(await engine.getPrice('/shop/item', 'OpenAI GPTBot')).toBeNull();
  });

  it('includes licenseType in the result', async () => {
    const engine = new PricingEngine([rule({ id: 'r1', licenseType: 'full_display' })]);
    expect((await engine.getPrice('/page', 'AnyBot'))?.licenseType).toBe('full_display');
  });

  it('allows basePrice of 0 (explicit free access)', async () => {
    const engine = new PricingEngine([rule({ id: 'free', pricePerPage: 0 })]);
    const result = await engine.getPrice('/page', 'OpenAI GPTBot');
    expect(result?.basePrice).toBe(0);
    expect(result?.totalPrice).toBe(0);
  });
});

describe('exact path matching', () => {
  it('matches an exact path', async () => {
    const engine = new PricingEngine([rule({ id: 'r1', path: '/about' })]);
    expect((await engine.getPrice('/about', 'OpenAI GPTBot'))?.matchedRuleId).toBe('r1');
  });

  it('does not match a different exact path', async () => {
    const engine = new PricingEngine([rule({ id: 'r1', path: '/about' })]);
    expect(await engine.getPrice('/contact', 'OpenAI GPTBot')).toBeNull();
  });

  it('does not match a sub-path of an exact rule', async () => {
    const engine = new PricingEngine([rule({ id: 'r1', path: '/blog' })]);
    expect(await engine.getPrice('/blog/post', 'OpenAI GPTBot')).toBeNull();
  });

  it('treats trailing slashes as equivalent', async () => {
    const engine = new PricingEngine([rule({ id: 'r1', path: '/about/' })]);
    expect((await engine.getPrice('/about',  'OpenAI GPTBot'))?.matchedRuleId).toBe('r1');
    expect((await engine.getPrice('/about/', 'OpenAI GPTBot'))?.matchedRuleId).toBe('r1');
  });
});

describe('single-segment wildcard (*)', () => {
  it('matches one path segment', async () => {
    const engine = new PricingEngine([rule({ id: 'r1', path: '/blog/*' })]);
    expect((await engine.getPrice('/blog/my-post', 'GPTBot'))?.matchedRuleId).toBe('r1');
  });

  it('does not match two segments deep', async () => {
    const engine = new PricingEngine([rule({ id: 'r1', path: '/blog/*' })]);
    expect(await engine.getPrice('/blog/2024/my-post', 'GPTBot')).toBeNull();
  });

  it('does not match the parent path itself', async () => {
    const engine = new PricingEngine([rule({ id: 'r1', path: '/blog/*' })]);
    expect(await engine.getPrice('/blog', 'GPTBot')).toBeNull();
  });

  it('matches wildcard in a middle segment', async () => {
    const engine = new PricingEngine([rule({ id: 'r1', path: '/docs/*/overview' })]);
    expect((await engine.getPrice('/docs/v2/overview', 'GPTBot'))?.matchedRuleId).toBe('r1');
    expect((await engine.getPrice('/docs/v3/overview', 'GPTBot'))?.matchedRuleId).toBe('r1');
  });

  it('does not match when middle wildcard has wrong segment count', async () => {
    const engine = new PricingEngine([rule({ id: 'r1', path: '/docs/*/overview' })]);
    expect(await engine.getPrice('/docs/overview', 'GPTBot')).toBeNull();
  });
});

describe('double-star wildcard (**)', () => {
  it('matches any depth beneath a prefix', async () => {
    const engine = new PricingEngine([rule({ id: 'r1', path: '/api/**' })]);
    expect((await engine.getPrice('/api/v1/users',   'GPTBot'))?.matchedRuleId).toBe('r1');
    expect((await engine.getPrice('/api/v2/posts/1', 'GPTBot'))?.matchedRuleId).toBe('r1');
  });

  it('matches the prefix itself (zero trailing segments)', async () => {
    const engine = new PricingEngine([rule({ id: 'r1', path: '/api/**' })]);
    expect((await engine.getPrice('/api', 'GPTBot'))?.matchedRuleId).toBe('r1');
  });

  it('does not match a completely different prefix', async () => {
    const engine = new PricingEngine([rule({ id: 'r1', path: '/api/**' })]);
    expect(await engine.getPrice('/admin/users', 'GPTBot')).toBeNull();
  });
});

describe('bot-only matching (no path)', () => {
  it('matches any path for a specific bot', async () => {
    const engine = new PricingEngine([rule({ id: 'r1', bot: 'OpenAI GPTBot', pricePerPage: 200 })]);
    expect((await engine.getPrice('/anything', 'OpenAI GPTBot'))?.basePrice).toBe(200);
    expect((await engine.getPrice('/other',    'OpenAI GPTBot'))?.basePrice).toBe(200);
  });

  it('does not match a different bot', async () => {
    const engine = new PricingEngine([rule({ id: 'r1', bot: 'OpenAI GPTBot' })]);
    expect(await engine.getPrice('/page', 'Anthropic Claude-Web')).toBeNull();
  });
});

describe('specificity — most specific rule wins', () => {
  const rules: PricingRule[] = [
    rule({ id: 'global',    pricePerPage: 10 }),
    rule({ id: 'bot-only',  pricePerPage: 20,  bot: 'OpenAI GPTBot' }),
    rule({ id: 'path-only', pricePerPage: 30,  path: '/blog/*' }),
    rule({ id: 'exact',     pricePerPage: 40,  path: '/blog/post', bot: 'OpenAI GPTBot' }),
  ];

  it('path + bot beats all others', async () => {
    const engine = new PricingEngine(rules);
    expect((await engine.getPrice('/blog/post', 'OpenAI GPTBot'))?.matchedRuleId).toBe('exact');
  });

  it('path-only beats bot-only and global (different bot)', async () => {
    const engine = new PricingEngine(rules);
    expect((await engine.getPrice('/blog/anything', 'Anthropic Claude-Web'))?.matchedRuleId).toBe('path-only');
  });

  it('bot-only beats global (unmatched path)', async () => {
    const engine = new PricingEngine(rules);
    expect((await engine.getPrice('/shop/item', 'OpenAI GPTBot'))?.matchedRuleId).toBe('bot-only');
  });

  it('global is used as final fallback', async () => {
    const engine = new PricingEngine(rules);
    expect((await engine.getPrice('/shop/item', 'Anthropic Claude-Web'))?.matchedRuleId).toBe('global');
  });
});

describe('specificity — ties break by insertion order (first rule wins)', () => {
  it('first path+bot rule wins over second for same target', async () => {
    const engine = new PricingEngine([
      rule({ id: 'first',  path: '/blog/*', bot: 'OpenAI GPTBot', pricePerPage: 100 }),
      rule({ id: 'second', path: '/blog/*', bot: 'OpenAI GPTBot', pricePerPage: 999 }),
    ]);
    expect((await engine.getPrice('/blog/post', 'OpenAI GPTBot'))?.matchedRuleId).toBe('first');
  });

  it('first global rule wins when two globals exist', async () => {
    const engine = new PricingEngine([
      rule({ id: 'g1', pricePerPage:  5 }),
      rule({ id: 'g2', pricePerPage: 50 }),
    ]);
    expect((await engine.getPrice('/page', 'AnyBot'))?.matchedRuleId).toBe('g1');
  });
});

describe('real-world scenarios', () => {
  it('premium path + specific bot overrides global rate', async () => {
    const engine = new PricingEngine([
      rule({ id: 'global',       pricePerPage: 100, licenseType: 'summarization' }),
      rule({ id: 'premium-gpt',  pricePerPage: 500, path: '/research/**', bot: 'OpenAI GPTBot', licenseType: 'full_display' }),
      rule({ id: 'premium-path', pricePerPage: 300, path: '/research/**', licenseType: 'summarization' }),
    ]);
    const result = await engine.getPrice('/research/paper-1', 'OpenAI GPTBot');
    expect(result?.matchedRuleId).toBe('premium-gpt');
    expect(result?.basePrice).toBe(500);
    expect(result?.licenseType).toBe('full_display');
  });

  it('blog wildcard applies to all bots but per-bot rule overrides for Perplexity', async () => {
    const engine = new PricingEngine([
      rule({ id: 'blog-all',        pricePerPage: 150, path: '/blog/*' }),
      rule({ id: 'blog-perplexity', pricePerPage: 250, path: '/blog/*', bot: 'Perplexity PerplexityBot' }),
    ]);
    expect((await engine.getPrice('/blog/post-1', 'OpenAI GPTBot'))?.matchedRuleId).toBe('blog-all');
    expect((await engine.getPrice('/blog/post-1', 'Perplexity PerplexityBot'))?.matchedRuleId).toBe('blog-perplexity');
  });

  it('returns null for a path/bot combo no rule covers', async () => {
    const engine = new PricingEngine([rule({ id: 'r1', path: '/blog/*', bot: 'OpenAI GPTBot' })]);
    expect(await engine.getPrice('/blog/post', 'Anthropic Claude-Web')).toBeNull();
    expect(await engine.getPrice('/about',     'OpenAI GPTBot')).toBeNull();
  });

  it('free-access rule (pricePerPage = 0) is a valid match in any tier', async () => {
    const engine = engineAt([
      rule({ id: 'free', path: '/public/**', pricePerPage: 0 }),
      rule({ id: 'paid', pricePerPage: 100 }),
    ], 10_000); // paid tier
    const result = await engine.getPrice('/public/data', 'AnyBot');
    expect(result?.matchedRuleId).toBe('free');
    expect(result?.basePrice).toBe(0);
    expect(result?.scraperKastFee).toBe(0); // ceil(0 × 5%) = 0
    expect(result?.totalPrice).toBe(0);
  });

  it('a single bot transitions from free to paid tier mid-session', async () => {
    const counter = new InMemoryCounter();
    const engine  = new PricingEngine([rule({ id: 'r', pricePerPage: 100 })], counter);
    const BOT_ID  = 'openai-session-1';

    // Fast-forward to the very last free request.
    for (let i = 0; i < 9_999; i++) await counter.increment(BOT_ID);

    const lastFree = await engine.getPrice('/page', 'OpenAI GPTBot', BOT_ID);
    expect(lastFree?.tier).toBe('free');
    expect(lastFree?.freeRequestsRemaining).toBe(1);
    expect(lastFree?.scraperKastFee).toBe(0);

    // One more increment tips into the paid tier.
    await counter.increment(BOT_ID);

    const firstPaid = await engine.getPrice('/page', 'OpenAI GPTBot', BOT_ID);
    expect(firstPaid?.tier).toBe('paid');
    expect(firstPaid?.freeRequestsRemaining).toBe(0);
    expect(firstPaid?.scraperKastFee).toBe(5);   // 5 % of 100
    expect(firstPaid?.totalPrice).toBe(105);
  });
});
