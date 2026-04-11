/**
 * Focused integration tests for the free-tier / paid-tier pricing model.
 *
 * These tests exercise the 10 000-request free tier, the 5 % ScraperKast fee
 * that activates after it, and the fee-calculation arithmetic in detail.
 *
 * Broad middleware behaviour (bot detection, JWT auth, 403 responses, etc.)
 * is covered in src/index.test.ts.  This file concentrates only on the
 * pricing-model concerns listed in the task specification.
 */
import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import type { RequestCounter } from '@scraperkast/core';
import { scraperKast } from '../src/index.js';
import type { PaymentRequiredBody } from '../src/index.js';

// ─── Constants pulled from PricingEngine ─────────────────────────────────────

const FREE_TIER_LIMIT       = 10_000;
const SCRAPERKAST_FEE_PCT   = 5;           // percent

// ─── Test infrastructure ──────────────────────────────────────────────────────

const JWT_SECRET = 'test-secret-32-chars-minimum-ok!!';
const GPTBOT_UA  = 'GPTBot/1.0 (+https://openai.com/gptbot)';

/**
 * Deterministic counter stub — returns a fixed count for every key.
 * Lets us pin the tier without performing thousands of increments.
 */
class FixedCounter implements RequestCounter {
  constructor(private readonly fixedCount: number) {}
  async getCount(_key: string): Promise<number> { return this.fixedCount; }
  async increment(_key: string): Promise<void>  { /* no-op */ }
}

function makeApp(pricePerPage: number, requestCount: number) {
  const app = express();
  app.use(scraperKast({
    jwtSecret: JWT_SECRET,
    counter: new FixedCounter(requestCount),
    rules: [{
      id: 'test-rule',
      path: '/content/*',
      pricePerPage,
      licenseType: 'summarization',
    }],
  }));
  app.get('*', (_req, res) => res.json({ ok: true }));
  return app;
}

async function get402(pricePerPage: number, requestCount: number): Promise<PaymentRequiredBody> {
  const res = await request(makeApp(pricePerPage, requestCount))
    .get('/content/page')
    .set('User-Agent', GPTBOT_UA);
  expect(res.status).toBe(402);
  return res.body as PaymentRequiredBody;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1.  Free tier — requests 1 through 10 000
// ─────────────────────────────────────────────────────────────────────────────

describe('free tier — first 10 000 requests', () => {
  it('tier is "free" when requestCount is 0 (very first request)', async () => {
    const body = await get402(100, 0);
    expect(body.tier).toBe('free');
  });

  it('tier is "free" when requestCount is 1', async () => {
    const body = await get402(100, 1);
    expect(body.tier).toBe('free');
  });

  it('tier is "free" when requestCount is 5 000 (halfway)', async () => {
    const body = await get402(100, 5_000);
    expect(body.tier).toBe('free');
  });

  it('tier is "free" when requestCount is 9 999 (last free request)', async () => {
    const body = await get402(100, 9_999);
    expect(body.tier).toBe('free');
  });

  it('scraperKastFee is 0 throughout the free tier', async () => {
    for (const count of [0, 1, 4_999, 9_998, 9_999]) {
      const body = await get402(100, count);
      expect(body.scraperKastFee, `count=${count}`).toBe(0);
    }
  });

  it('totalPrice equals basePrice (no fee added) in free tier', async () => {
    const body = await get402(250, 0);
    expect(body.totalPrice).toBe(body.basePrice);
    expect(body.totalPrice).toBe(250);
  });

  it('freeRequestsRemaining counts down correctly', async () => {
    const cases: [number, number][] = [
      [0,     FREE_TIER_LIMIT],
      [1,     FREE_TIER_LIMIT - 1],
      [9_999, 1],
    ];
    for (const [count, expected] of cases) {
      const body = await get402(100, count);
      expect(body.freeRequestsRemaining, `count=${count}`).toBe(expected);
    }
  });

  it('requestCount is reflected accurately in the response', async () => {
    for (const count of [0, 500, 9_999]) {
      const body = await get402(100, count);
      expect(body.requestCount, `count=${count}`).toBe(count);
    }
  });

  it('breakdown.scraperKast is 0 in free tier', async () => {
    const body = await get402(1_000, 5_000);
    expect(body.breakdown.scraperKast).toBe(0);
    expect(body.breakdown.websiteOwner).toBe(1_000);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2.  Paid tier — requests 10 001 and beyond
// ─────────────────────────────────────────────────────────────────────────────

describe('paid tier — from request 10 001 onwards', () => {
  it('tier flips to "paid" at exactly requestCount = 10 000', async () => {
    const body = await get402(100, 10_000);
    expect(body.tier).toBe('paid');
  });

  it('tier is "paid" when requestCount is 10 001', async () => {
    const body = await get402(100, 10_001);
    expect(body.tier).toBe('paid');
  });

  it('tier is "paid" for large request counts', async () => {
    const body = await get402(100, 500_000);
    expect(body.tier).toBe('paid');
  });

  it('scraperKastFee is non-zero in paid tier', async () => {
    const body = await get402(100, 10_000);
    expect(body.scraperKastFee).toBeGreaterThan(0);
  });

  it('freeRequestsRemaining is absent (undefined) in paid tier', async () => {
    for (const count of [10_000, 10_001, 50_000]) {
      const body = await get402(100, count);
      expect(body.freeRequestsRemaining, `count=${count}`).toBeUndefined();
    }
  });

  it('requestCount is reflected accurately in the response', async () => {
    const body = await get402(100, 25_000);
    expect(body.requestCount).toBe(25_000);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3.  Fee calculation — 5 % of basePrice, rounded up (ceiling)
// ─────────────────────────────────────────────────────────────────────────────

describe('fee calculation — 5 % of basePrice, ceiling', () => {
  const PAID = 10_000;   // requestCount that puts us in paid tier

  it('basePrice=100  → fee=5,  total=105', async () => {
    const body = await get402(100, PAID);
    expect(body.basePrice).toBe(100);
    expect(body.scraperKastFee).toBe(5);
    expect(body.totalPrice).toBe(105);
  });

  it('basePrice=200  → fee=10, total=210', async () => {
    const body = await get402(200, PAID);
    expect(body.scraperKastFee).toBe(10);
    expect(body.totalPrice).toBe(210);
  });

  it('basePrice=1000 → fee=50, total=1050', async () => {
    const body = await get402(1_000, PAID);
    expect(body.scraperKastFee).toBe(50);
    expect(body.totalPrice).toBe(1_050);
  });

  it('basePrice=101  → fee=ceil(5.05)=6, total=107  (ceiling on fractional fee)', async () => {
    const body = await get402(101, PAID);
    expect(body.scraperKastFee).toBe(6);
    expect(body.totalPrice).toBe(107);
  });

  it('basePrice=1    → fee=ceil(0.05)=1, total=2    (minimum fee = 1)', async () => {
    const body = await get402(1, PAID);
    expect(body.scraperKastFee).toBe(1);
    expect(body.totalPrice).toBe(2);
  });

  it('basePrice=19   → fee=ceil(0.95)=1, total=20', async () => {
    const body = await get402(19, PAID);
    expect(body.scraperKastFee).toBe(1);
    expect(body.totalPrice).toBe(20);
  });

  it('basePrice=20   → fee=ceil(1.0)=1, total=21', async () => {
    const body = await get402(20, PAID);
    expect(body.scraperKastFee).toBe(1);
    expect(body.totalPrice).toBe(21);
  });

  it('basePrice=0    → fee=0,   total=0   (free content, no fee even in paid tier)', async () => {
    const body = await get402(0, PAID);
    expect(body.scraperKastFee).toBe(0);
    expect(body.totalPrice).toBe(0);
  });

  it('fee is always ceil(basePrice * FEE_PCT / 100) for a range of prices', async () => {
    const prices = [1, 7, 19, 20, 21, 99, 100, 101, 199, 200, 500, 999, 1_000, 5_000];
    for (const price of prices) {
      const body = await get402(price, PAID);
      const expected = Math.ceil(price * SCRAPERKAST_FEE_PCT / 100);
      expect(body.scraperKastFee, `price=${price}`).toBe(expected);
      expect(body.totalPrice,     `price=${price}`).toBe(price + expected);
    }
  });

  it('breakdown always sums to totalPrice', async () => {
    const prices = [1, 100, 101, 1_000];
    for (const price of prices) {
      const body = await get402(price, PAID);
      expect(
        body.breakdown.websiteOwner + body.breakdown.scraperKast,
        `price=${price}`,
      ).toBe(body.totalPrice);
    }
  });

  it('breakdown.websiteOwner always equals basePrice', async () => {
    const body = await get402(500, PAID);
    expect(body.breakdown.websiteOwner).toBe(500);
  });

  it('scraperKastFee is 0 for the same prices when in free tier', async () => {
    const prices = [1, 100, 1_000];
    for (const price of prices) {
      const body = await get402(price, 0);   // free tier
      expect(body.scraperKastFee, `price=${price} free`).toBe(0);
      expect(body.totalPrice,     `price=${price} free`).toBe(price);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4.  Tier boundary — the exact transition at request 10 000
// ─────────────────────────────────────────────────────────────────────────────

describe('tier boundary at request 10 000', () => {
  it('request 9 999 (count=9998) → free, request 10 000 (count=9999) → free', async () => {
    const penultimate = await get402(100, 9_998);
    expect(penultimate.tier).toBe('free');
    expect(penultimate.freeRequestsRemaining).toBe(2);

    const last = await get402(100, 9_999);
    expect(last.tier).toBe('free');
    expect(last.freeRequestsRemaining).toBe(1);
  });

  it('request 10 001 (count=10000) → paid, fee kicks in immediately', async () => {
    const body = await get402(100, 10_000);
    expect(body.tier).toBe('paid');
    expect(body.scraperKastFee).toBe(5);
    expect(body.freeRequestsRemaining).toBeUndefined();
  });

  it('currency is "USD_CENTS" on both sides of the boundary', async () => {
    const freeSide = await get402(100, 9_999);
    const paidSide = await get402(100, 10_000);
    expect(freeSide.currency).toBe('USD_CENTS');
    expect(paidSide.currency).toBe('USD_CENTS');
  });
});
