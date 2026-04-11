import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { AuthService } from '@scraperkast/core';
import type { RequestCounter } from '@scraperkast/core';
import { scraperKast } from './index.js';
import type { ScraperKastConfig, PaymentRequiredBody } from './index.js';

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const SECRET = 'test-secret-32-chars-minimum-ok!!';
const auth   = new AuthService(SECRET);

const BLOG_RULE = {
  id: 'blog',
  path: '/blog/*',
  pricePerPage: 100,
  licenseType: 'summarization' as const,
};

const GLOBAL_RULE = {
  id: 'global',
  pricePerPage: 50,
  licenseType: 'summarization' as const,
};

// Real-world User-Agent strings
const GPTBOT_UA     = 'Mozilla/5.0 (compatible; GPTBot/1.0; +https://openai.com/gptbot)';
const PERPLEXITY_UA = 'PerplexityBot/1.0';
const CHROME_UA     = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36';

/**
 * A counter stub whose count is fixed at construction time.
 * Lets tests pin the free/paid tier instantly without thousands of increments.
 */
class PresetCounter implements RequestCounter {
  constructor(private readonly count: number) {}
  async getCount(_key: string): Promise<number> { return this.count; }
  async increment(_key: string): Promise<void>  { /* no-op in tests */ }
}

const FREE_COUNTER = new PresetCounter(0);        // brand-new bot, fully in free tier
const PAID_COUNTER = new PresetCounter(10_000);   // free quota exactly exhausted

function buildApp(config: Partial<ScraperKastConfig> = {}) {
  const app = express();
  app.use(scraperKast({
    rules:     [BLOG_RULE],
    jwtSecret: SECRET,
    ...config,
  }));
  // Simple downstream handler — only reached by humans / authorised bots.
  app.get('*', (_req, res) => res.status(200).json({ content: 'hello' }));
  return app;
}

function validToken(credits = 10) {
  return auth.generateToken('openai', credits, ['example.com']);
}

// ─────────────────────────────────────────────────────────────────────────────
// Human browser requests
// ─────────────────────────────────────────────────────────────────────────────

describe('human browser requests', () => {
  it('passes Chrome through with 200', async () => {
    await request(buildApp())
      .get('/blog/my-post')
      .set('User-Agent', CHROME_UA)
      .expect(200, { content: 'hello' });
  });

  it('passes requests with no User-Agent through', async () => {
    await request(buildApp())
      .get('/blog/my-post')
      .unset('User-Agent')
      .expect(200);
  });

  it('passes curl through', async () => {
    await request(buildApp())
      .get('/page')
      .set('User-Agent', 'curl/8.7.1')
      .expect(200);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Bot with valid JWT
// ─────────────────────────────────────────────────────────────────────────────

describe('bot with valid JWT', () => {
  it('returns 200 and calls next()', async () => {
    await request(buildApp())
      .get('/blog/my-post')
      .set('User-Agent', GPTBOT_UA)
      .set('Authorization', `Bearer ${validToken()}`)
      .expect(200, { content: 'hello' });
  });

  it('fires onAuthorized callback with botName', async () => {
    const onAuthorized = vi.fn();
    await request(buildApp({ onAuthorized }))
      .get('/blog/my-post')
      .set('User-Agent', GPTBOT_UA)
      .set('Authorization', `Bearer ${validToken()}`);
    expect(onAuthorized).toHaveBeenCalledOnce();
    expect(onAuthorized.mock.calls[0][1]).toBe('OpenAI GPTBot');
  });

  it('allows access even when no pricing rule covers the path', async () => {
    await request(buildApp({ rules: [] }))
      .get('/unlisted-path')
      .set('User-Agent', GPTBOT_UA)
      .set('Authorization', `Bearer ${validToken()}`)
      .expect(200);
  });

  it('does not crash when onAuthorized callback throws', async () => {
    await request(buildApp({ onAuthorized: () => { throw new Error('cb error'); } }))
      .get('/blog/post')
      .set('User-Agent', GPTBOT_UA)
      .set('Authorization', `Bearer ${validToken()}`)
      .expect(200);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Bot with zero-credit JWT
// ─────────────────────────────────────────────────────────────────────────────

describe('bot with zero-credit JWT', () => {
  it('falls through to 402 when credits === 0 and a pricing rule exists', async () => {
    await request(buildApp())
      .get('/blog/post')
      .set('User-Agent', GPTBOT_UA)
      .set('Authorization', `Bearer ${validToken(0)}`)
      .expect(402);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Bot with expired / invalid token
// ─────────────────────────────────────────────────────────────────────────────

describe('bot with expired or invalid token', () => {
  it('returns 402 for a token signed with the wrong secret', async () => {
    const wrongAuth = new AuthService('wrong-secret-32-chars-minimum-ok!');
    const badToken  = wrongAuth.generateToken('openai', 10, []);
    await request(buildApp())
      .get('/blog/post')
      .set('User-Agent', GPTBOT_UA)
      .set('Authorization', `Bearer ${badToken}`)
      .expect(402);
  });

  it('returns 402 for a malformed (non-JWT) token', async () => {
    await request(buildApp())
      .get('/blog/post')
      .set('User-Agent', GPTBOT_UA)
      .set('Authorization', 'Bearer not.a.real.jwt')
      .expect(402);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 402 response body — free tier
// ─────────────────────────────────────────────────────────────────────────────

describe('402 response body — free tier', () => {
  let body: PaymentRequiredBody;

  beforeEach(async () => {
    const res = await request(buildApp({ counter: FREE_COUNTER }))
      .get('/blog/my-post')
      .set('User-Agent', GPTBOT_UA);
    expect(res.status).toBe(402);
    body = res.body as PaymentRequiredBody;
  });

  it('error is "Payment Required"', () => {
    expect(body.error).toBe('Payment Required');
  });

  it('bot is the detected bot name', () => {
    expect(body.bot).toBe('OpenAI GPTBot');
  });

  it('botType is "ai_training" for GPTBot', () => {
    expect(body.botType).toBe('ai_training');
  });

  it('path matches the request path', () => {
    expect(body.path).toBe('/blog/my-post');
  });

  it('basePrice equals the rule pricePerPage', () => {
    expect(body.basePrice).toBe(100);
  });

  it('scraperKastFee is 0 — no fee in free tier', () => {
    expect(body.scraperKastFee).toBe(0);
  });

  it('totalPrice equals basePrice when fee is 0', () => {
    expect(body.totalPrice).toBe(100);
  });

  it('currency is "USD_CENTS"', () => {
    expect(body.currency).toBe('USD_CENTS');
  });

  it('licenseType matches the rule', () => {
    expect(body.licenseType).toBe('summarization');
  });

  it('tier is "free"', () => {
    expect(body.tier).toBe('free');
  });

  it('requestCount is 0 for a brand-new bot', () => {
    expect(body.requestCount).toBe(0);
  });

  it('freeRequestsRemaining is 10 000 at the start', () => {
    expect(body.freeRequestsRemaining).toBe(10_000);
  });

  it('breakdown.websiteOwner equals basePrice', () => {
    expect(body.breakdown.websiteOwner).toBe(100);
  });

  it('breakdown.scraperKast is 0 in free tier', () => {
    expect(body.breakdown.scraperKast).toBe(0);
  });

  it('paymentUrl encodes bot name and path correctly', () => {
    const url = new URL(body.paymentUrl);
    expect(url.host).toBe('api.scraperkast.com');
    expect(url.searchParams.get('bot')).toBe('OpenAI GPTBot');
    expect(url.searchParams.get('path')).toBe('/blog/my-post');
  });

  it('response has no legacy "pricing" nesting', () => {
    // The old shape had res.body.pricing.pricePerPage — confirm it's gone.
    expect((body as Record<string, unknown>)['pricing']).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 402 response body — paid tier
// ─────────────────────────────────────────────────────────────────────────────

describe('402 response body — paid tier', () => {
  let body: PaymentRequiredBody;

  beforeEach(async () => {
    const res = await request(buildApp({ counter: PAID_COUNTER }))
      .get('/blog/my-post')
      .set('User-Agent', GPTBOT_UA);
    expect(res.status).toBe(402);
    body = res.body as PaymentRequiredBody;
  });

  it('tier is "paid"', () => {
    expect(body.tier).toBe('paid');
  });

  it('scraperKastFee is 5 % of basePrice', () => {
    // basePrice = 100, 5 % = 5 — exact division, no rounding
    expect(body.scraperKastFee).toBe(5);
  });

  it('totalPrice is basePrice + scraperKastFee', () => {
    expect(body.totalPrice).toBe(105);
  });

  it('breakdown.websiteOwner is basePrice', () => {
    expect(body.breakdown.websiteOwner).toBe(100);
  });

  it('breakdown.scraperKast is the fee', () => {
    expect(body.breakdown.scraperKast).toBe(5);
  });

  it('breakdown sums to totalPrice', () => {
    expect(body.breakdown.websiteOwner + body.breakdown.scraperKast).toBe(body.totalPrice);
  });

  it('freeRequestsRemaining is absent in paid tier', () => {
    // Omitted entirely when paid — would be misleading if present as 0.
    expect(body.freeRequestsRemaining).toBeUndefined();
  });

  it('requestCount reflects the counter value', () => {
    expect(body.requestCount).toBe(10_000);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Breakdown calculation accuracy
// ─────────────────────────────────────────────────────────────────────────────

describe('breakdown calculation', () => {
  it('ceil fee: pricePerPage=101 → scraperKastFee=6, total=107', async () => {
    const app = buildApp({
      rules:   [{ id: 'r', path: '/blog/*', pricePerPage: 101, licenseType: 'summarization' }],
      counter: PAID_COUNTER,
    });
    const res = await request(app).get('/blog/post').set('User-Agent', GPTBOT_UA);
    const b: PaymentRequiredBody = res.body;
    expect(b.basePrice).toBe(101);
    expect(b.scraperKastFee).toBe(6);
    expect(b.totalPrice).toBe(107);
    expect(b.breakdown).toEqual({ websiteOwner: 101, scraperKast: 6 });
  });

  it('ceil fee: pricePerPage=1 → scraperKastFee=1, total=2', async () => {
    const app = buildApp({
      rules:   [{ id: 'r', path: '/blog/*', pricePerPage: 1, licenseType: 'summarization' }],
      counter: PAID_COUNTER,
    });
    const res = await request(app).get('/blog/post').set('User-Agent', GPTBOT_UA);
    const b: PaymentRequiredBody = res.body;
    expect(b.scraperKastFee).toBe(1);
    expect(b.totalPrice).toBe(2);
  });

  it('pricePerPage=0 → fee=0, total=0 even in paid tier', async () => {
    const app = buildApp({
      rules:   [{ id: 'r', path: '/blog/*', pricePerPage: 0, licenseType: 'summarization' }],
      counter: PAID_COUNTER,
    });
    const res = await request(app).get('/blog/post').set('User-Agent', GPTBOT_UA);
    const b: PaymentRequiredBody = res.body;
    expect(b.scraperKastFee).toBe(0);
    expect(b.totalPrice).toBe(0);
    expect(b.breakdown).toEqual({ websiteOwner: 0, scraperKast: 0 });
  });

  it('breakdown always sums to totalPrice across different prices', async () => {
    for (const pricePerPage of [1, 50, 99, 100, 101, 500, 1_000]) {
      const app = buildApp({
        rules:   [{ id: 'r', path: '/blog/*', pricePerPage, licenseType: 'summarization' }],
        counter: PAID_COUNTER,
      });
      const res = await request(app).get('/blog/post').set('User-Agent', GPTBOT_UA);
      const b: PaymentRequiredBody = res.body;
      expect(
        b.breakdown.websiteOwner + b.breakdown.scraperKast,
        `pricePerPage=${pricePerPage}`,
      ).toBe(b.totalPrice);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// requestCount display across the free / paid tier boundary
// ─────────────────────────────────────────────────────────────────────────────

describe('requestCount display', () => {
  async function getBody(count: number): Promise<PaymentRequiredBody> {
    const res = await request(buildApp({ counter: new PresetCounter(count) }))
      .get('/blog/post')
      .set('User-Agent', GPTBOT_UA);
    return res.body as PaymentRequiredBody;
  }

  it('count = 0 → free, freeRequestsRemaining = 10 000', async () => {
    const b = await getBody(0);
    expect(b.requestCount).toBe(0);
    expect(b.tier).toBe('free');
    expect(b.freeRequestsRemaining).toBe(10_000);
  });

  it('count = 9 999 → free, freeRequestsRemaining = 1', async () => {
    const b = await getBody(9_999);
    expect(b.requestCount).toBe(9_999);
    expect(b.tier).toBe('free');
    expect(b.freeRequestsRemaining).toBe(1);
  });

  it('count = 10 000 → paid, freeRequestsRemaining absent', async () => {
    const b = await getBody(10_000);
    expect(b.requestCount).toBe(10_000);
    expect(b.tier).toBe('paid');
    expect(b.freeRequestsRemaining).toBeUndefined();
  });

  it('count = 25 000 → paid, large count shown', async () => {
    const b = await getBody(25_000);
    expect(b.requestCount).toBe(25_000);
    expect(b.tier).toBe('paid');
    expect(b.freeRequestsRemaining).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// botType field
// ─────────────────────────────────────────────────────────────────────────────

describe('botType field', () => {
  it('GPTBot → "ai_training"', async () => {
    const res = await request(buildApp()).get('/blog/post').set('User-Agent', GPTBOT_UA);
    expect(res.body.botType).toBe('ai_training');
  });

  it('PerplexityBot → "ai_inference"', async () => {
    const res = await request(buildApp()).get('/blog/post').set('User-Agent', PERPLEXITY_UA);
    expect(res.body.botType).toBe('ai_inference');
  });

  it('AhrefsBot → "crawler"', async () => {
    const res = await request(buildApp())
      .get('/blog/post')
      .set('User-Agent', 'AhrefsBot/7.0 (+http://ahrefs.com/robot/)');
    expect(res.body.botType).toBe('crawler');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// onPaymentRequired callback — now receives (req, priceResult)
// ─────────────────────────────────────────────────────────────────────────────

describe('onPaymentRequired callback', () => {
  it('is called once per 402 response', async () => {
    const onPaymentRequired = vi.fn();
    await request(buildApp({ onPaymentRequired }))
      .get('/blog/post')
      .set('User-Agent', GPTBOT_UA);
    expect(onPaymentRequired).toHaveBeenCalledOnce();
  });

  it('receives req as first argument', async () => {
    const onPaymentRequired = vi.fn();
    await request(buildApp({ onPaymentRequired }))
      .get('/blog/post')
      .set('User-Agent', GPTBOT_UA);
    expect(onPaymentRequired.mock.calls[0][0].path).toBe('/blog/post');
  });

  it('receives PriceResult as second argument (free tier)', async () => {
    const onPaymentRequired = vi.fn();
    await request(buildApp({ onPaymentRequired, counter: FREE_COUNTER }))
      .get('/blog/my-post')
      .set('User-Agent', GPTBOT_UA);
    const [, price] = onPaymentRequired.mock.calls[0];
    expect(price.basePrice).toBe(100);
    expect(price.scraperKastFee).toBe(0);
    expect(price.totalPrice).toBe(100);
    expect(price.tier).toBe('free');
    expect(price.matchedRuleId).toBe('blog');
  });

  it('receives paid-tier PriceResult when quota is exhausted', async () => {
    const onPaymentRequired = vi.fn();
    await request(buildApp({ onPaymentRequired, counter: PAID_COUNTER }))
      .get('/blog/my-post')
      .set('User-Agent', GPTBOT_UA);
    const [, price] = onPaymentRequired.mock.calls[0];
    expect(price.tier).toBe('paid');
    expect(price.scraperKastFee).toBe(5);
    expect(price.totalPrice).toBe(105);
  });

  it('does not crash when the callback throws', async () => {
    await request(buildApp({ onPaymentRequired: () => { throw new Error('oops'); } }))
      .get('/blog/post')
      .set('User-Agent', GPTBOT_UA)
      .expect(402);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 403 Forbidden — no matching rule
// ─────────────────────────────────────────────────────────────────────────────

describe('bot with no token and no matching pricing rule', () => {
  it('returns 403 when bot hits an unpriced path', async () => {
    await request(buildApp({ rules: [BLOG_RULE] }))
      .get('/admin/secret')
      .set('User-Agent', GPTBOT_UA)
      .expect(403);
  });

  it('response body has correct shape', async () => {
    const res = await request(buildApp({ rules: [BLOG_RULE] }))
      .get('/about')
      .set('User-Agent', GPTBOT_UA);
    expect(res.body.error).toBe('Forbidden');
    expect(res.body.message).toContain('OpenAI GPTBot');
    expect(res.body.message).toContain('/about');
  });

  it('returns 403 when no rules are configured at all', async () => {
    await request(buildApp({ rules: [] }))
      .get('/blog/post')
      .set('User-Agent', GPTBOT_UA)
      .expect(403);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Analytics
// ─────────────────────────────────────────────────────────────────────────────

describe('analytics tracking', () => {
  it('does not throw when enableAnalytics is true', async () => {
    await request(buildApp({ enableAnalytics: true }))
      .get('/blog/post')
      .set('User-Agent', GPTBOT_UA)
      .expect(402);
  });

  it('analytics is disabled by default without error', async () => {
    await request(buildApp({ enableAnalytics: false }))
      .get('/blog/post')
      .set('User-Agent', GPTBOT_UA)
      .expect(402);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Authorization header edge cases
// ─────────────────────────────────────────────────────────────────────────────

describe('Authorization header edge cases', () => {
  let app: ReturnType<typeof buildApp>;
  beforeEach(() => { app = buildApp(); });

  it('ignores a Bearer header with an empty token', async () => {
    await request(app)
      .get('/blog/post')
      .set('User-Agent', GPTBOT_UA)
      .set('Authorization', 'Bearer ')
      .expect(402);
  });

  it('ignores a non-Bearer Authorization scheme', async () => {
    const basic = Buffer.from('user:pass').toString('base64');
    await request(app)
      .get('/blog/post')
      .set('User-Agent', GPTBOT_UA)
      .set('Authorization', `Basic ${basic}`)
      .expect(402);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Wildcard path rules
// ─────────────────────────────────────────────────────────────────────────────

describe('wildcard pricing rules', () => {
  it('/blog/* matches blog posts', async () => {
    await request(buildApp({ rules: [BLOG_RULE] }))
      .get('/blog/some-article')
      .set('User-Agent', GPTBOT_UA)
      .expect(402);
  });

  it('global rule (no path) matches any path', async () => {
    await request(buildApp({ rules: [GLOBAL_RULE] }))
      .get('/completely/arbitrary/path')
      .set('User-Agent', GPTBOT_UA)
      .expect(402);
  });

  it('more specific path+bot rule wins over global — basePrice reflects winner', async () => {
    const specificRule = {
      id: 'blog-gpt',
      path: '/blog/*',
      bot: 'OpenAI GPTBot',
      pricePerPage: 999,
      licenseType: 'full_display' as const,
    };
    const res = await request(buildApp({ rules: [specificRule, GLOBAL_RULE] }))
      .get('/blog/post')
      .set('User-Agent', GPTBOT_UA);
    expect(res.status).toBe(402);
    expect(res.body.basePrice).toBe(999);           // flat field, not res.body.pricing.*
    expect(res.body.licenseType).toBe('full_display');
  });
});
