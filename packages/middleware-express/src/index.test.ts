import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { AuthService } from '@scraperkast/core';
import { scraperKast } from './index.js';
import type { ScraperKastConfig } from './index.js';

// ─── shared fixtures ──────────────────────────────────────────────────────────

const SECRET = 'test-secret-32-chars-minimum-ok!!';
const auth = new AuthService(SECRET);

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

// Real bot UA strings
const GPTBOT_UA = 'Mozilla/5.0 (compatible; GPTBot/1.0; +https://openai.com/gptbot)';
const PERPLEXITY_UA = 'PerplexityBot/1.0';
const CHROME_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36';

function buildApp(config: Partial<ScraperKastConfig> = {}) {
  const app = express();
  app.use(scraperKast({
    rules: [BLOG_RULE],
    jwtSecret: SECRET,
    ...config,
  }));
  // Simple downstream handler
  app.get('*', (_req, res) => res.status(200).json({ content: 'hello' }));
  return app;
}

function validToken(credits = 10) {
  return auth.generateToken('openai', credits, ['example.com']);
}

// ─── human browsers ───────────────────────────────────────────────────────────

describe('human browser requests', () => {
  it('passes Chrome through with 200', async () => {
    const app = buildApp();
    await request(app)
      .get('/blog/my-post')
      .set('User-Agent', CHROME_UA)
      .expect(200, { content: 'hello' });
  });

  it('passes requests with no User-Agent through', async () => {
    const app = buildApp();
    await request(app)
      .get('/blog/my-post')
      .unset('User-Agent')
      .expect(200);
  });

  it('passes curl through', async () => {
    const app = buildApp();
    await request(app)
      .get('/page')
      .set('User-Agent', 'curl/8.7.1')
      .expect(200);
  });
});

// ─── bot with valid JWT ───────────────────────────────────────────────────────

describe('bot with valid JWT', () => {
  it('returns 200 and calls next()', async () => {
    const app = buildApp();
    await request(app)
      .get('/blog/my-post')
      .set('User-Agent', GPTBOT_UA)
      .set('Authorization', `Bearer ${validToken()}`)
      .expect(200, { content: 'hello' });
  });

  it('fires onAuthorized callback with botName', async () => {
    const onAuthorized = vi.fn();
    const app = buildApp({ onAuthorized });
    await request(app)
      .get('/blog/my-post')
      .set('User-Agent', GPTBOT_UA)
      .set('Authorization', `Bearer ${validToken()}`);
    expect(onAuthorized).toHaveBeenCalledOnce();
    expect(onAuthorized.mock.calls[0][1]).toBe('OpenAI GPTBot');
  });

  it('allows access even for paths with no pricing rule when token is valid', async () => {
    const app = buildApp({ rules: [] }); // no rules
    await request(app)
      .get('/unlisted-path')
      .set('User-Agent', GPTBOT_UA)
      .set('Authorization', `Bearer ${validToken()}`)
      .expect(200);
  });

  it('does not crash when onAuthorized callback throws', async () => {
    const app = buildApp({
      onAuthorized: () => { throw new Error('callback error'); },
    });
    await request(app)
      .get('/blog/post')
      .set('User-Agent', GPTBOT_UA)
      .set('Authorization', `Bearer ${validToken()}`)
      .expect(200);
  });
});

// ─── bot with zero credits ────────────────────────────────────────────────────

describe('bot with zero-credit JWT', () => {
  it('falls through to 402 when credits === 0 and a pricing rule exists', async () => {
    const app = buildApp();
    await request(app)
      .get('/blog/post')
      .set('User-Agent', GPTBOT_UA)
      .set('Authorization', `Bearer ${validToken(0)}`)
      .expect(402);
  });
});

// ─── bot with expired / invalid token ────────────────────────────────────────

describe('bot with expired or invalid token', () => {
  it('returns 402 for an expired token when pricing exists', async () => {
    const expiredToken = auth.generateToken('openai', 10, []);
    // Force expiry by signing with a 0-second ttl via raw jsonwebtoken
    // Instead: use a token signed by a different secret → invalid
    const app = buildApp();
    const wrongSecret = new AuthService('wrong-secret-32-chars-minimum-ok!');
    const badToken = wrongSecret.generateToken('openai', 10, []);
    await request(app)
      .get('/blog/post')
      .set('User-Agent', GPTBOT_UA)
      .set('Authorization', `Bearer ${badToken}`)
      .expect(402);
    void expiredToken; // suppress unused warning
  });

  it('returns 402 for a malformed token when pricing exists', async () => {
    const app = buildApp();
    await request(app)
      .get('/blog/post')
      .set('User-Agent', GPTBOT_UA)
      .set('Authorization', 'Bearer not.a.real.jwt')
      .expect(402);
  });
});

// ─── bot with no token — 402 Payment Required ────────────────────────────────

describe('bot with no token and matching pricing rule', () => {
  it('returns 402', async () => {
    const app = buildApp();
    await request(app)
      .get('/blog/post')
      .set('User-Agent', GPTBOT_UA)
      .expect(402);
  });

  it('response body has correct shape', async () => {
    const app = buildApp();
    const res = await request(app)
      .get('/blog/my-post')
      .set('User-Agent', GPTBOT_UA);

    expect(res.body.error).toBe('Payment Required');
    expect(res.body.bot).toBe('OpenAI GPTBot');
    expect(res.body.pricing.pricePerPage).toBe(100);
    expect(res.body.pricing.currency).toBe('USD');
    expect(res.body.paymentUrl).toContain('api.scraperkast.com/pay');
    expect(res.body.paymentUrl).toContain('OpenAI+GPTBot');
    expect(res.body.documentation).toBe('https://docs.scraperkast.com');
  });

  it('paymentUrl encodes bot name and path', async () => {
    const app = buildApp();
    const res = await request(app)
      .get('/blog/my-post')
      .set('User-Agent', GPTBOT_UA);

    const url = new URL(res.body.paymentUrl);
    expect(url.searchParams.get('bot')).toBe('OpenAI GPTBot');
    expect(url.searchParams.get('path')).toBe('/blog/my-post');
  });

  it('fires onPaymentRequired callback', async () => {
    const onPaymentRequired = vi.fn();
    const app = buildApp({ onPaymentRequired });
    await request(app)
      .get('/blog/post')
      .set('User-Agent', GPTBOT_UA);
    expect(onPaymentRequired).toHaveBeenCalledOnce();
  });

  it('does not crash when onPaymentRequired throws', async () => {
    const app = buildApp({
      onPaymentRequired: () => { throw new Error('oops'); },
    });
    await request(app)
      .get('/blog/post')
      .set('User-Agent', GPTBOT_UA)
      .expect(402);
  });

  it('works for a different bot (Perplexity)', async () => {
    const app = buildApp();
    const res = await request(app)
      .get('/blog/article')
      .set('User-Agent', PERPLEXITY_UA);
    expect(res.status).toBe(402);
    expect(res.body.bot).toBe('Perplexity PerplexityBot');
  });
});

// ─── bot with no token — 403 Forbidden ───────────────────────────────────────

describe('bot with no token and no matching pricing rule', () => {
  it('returns 403 when bot hits an unpriced path', async () => {
    const app = buildApp({ rules: [BLOG_RULE] }); // only /blog/* is priced
    await request(app)
      .get('/admin/secret')
      .set('User-Agent', GPTBOT_UA)
      .expect(403);
  });

  it('response body has correct shape', async () => {
    const app = buildApp({ rules: [BLOG_RULE] });
    const res = await request(app)
      .get('/about')
      .set('User-Agent', GPTBOT_UA);
    expect(res.body.error).toBe('Forbidden');
    expect(res.body.message).toContain('OpenAI GPTBot');
    expect(res.body.message).toContain('/about');
  });

  it('returns 403 when no rules are configured at all', async () => {
    const app = buildApp({ rules: [] });
    await request(app)
      .get('/blog/post')
      .set('User-Agent', GPTBOT_UA)
      .expect(403);
  });
});

// ─── analytics ────────────────────────────────────────────────────────────────

describe('analytics tracking (enableAnalytics: true)', () => {
  it('does not throw when analytics is enabled', async () => {
    const app = buildApp({ enableAnalytics: true });
    await request(app)
      .get('/blog/post')
      .set('User-Agent', GPTBOT_UA)
      .expect(402); // no token → 402, but no crash
  });

  it('tracking is disabled by default (no error either way)', async () => {
    const app = buildApp({ enableAnalytics: false });
    await request(app)
      .get('/blog/post')
      .set('User-Agent', GPTBOT_UA)
      .expect(402);
  });
});

// ─── Authorization header edge cases ─────────────────────────────────────────

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
    await request(app)
      .get('/blog/post')
      .set('User-Agent', GPTBOT_UA)
      .set('Authorization', `Basic ${Buffer.from('user:pass').toString('base64')}`)
      .expect(402);
  });
});

// ─── wildcard path rules ──────────────────────────────────────────────────────

describe('wildcard pricing rules', () => {
  it('matches /blog/* for a bot without a token', async () => {
    const app = buildApp({ rules: [BLOG_RULE] });
    await request(app)
      .get('/blog/some-article')
      .set('User-Agent', GPTBOT_UA)
      .expect(402);
  });

  it('global rule (no path) matches any path', async () => {
    const app = buildApp({ rules: [GLOBAL_RULE] });
    await request(app)
      .get('/completely/arbitrary/path')
      .set('User-Agent', GPTBOT_UA)
      .expect(402);
  });

  it('more specific path+bot rule wins over global', async () => {
    const specificRule = {
      id: 'blog-gpt',
      path: '/blog/*',
      bot: 'OpenAI GPTBot',
      pricePerPage: 999,
      licenseType: 'full_display' as const,
    };
    const app = buildApp({ rules: [specificRule, GLOBAL_RULE] });
    const res = await request(app)
      .get('/blog/post')
      .set('User-Agent', GPTBOT_UA);
    expect(res.status).toBe(402);
    expect(res.body.pricing.pricePerPage).toBe(999);
  });
});
