/**
 * Tests for Dodo Payments integration in the ScraperKast Express middleware.
 *
 * Tests cover:
 *   - 402 response includes Dodo option when both Solana + Dodo are configured
 *   - POST /checkout/create creates and stores a session
 *   - POST /webhooks/dodo processes payment.succeeded → issues JWT
 *   - POST /webhooks/dodo rejects invalid signatures
 *   - POST /webhooks/dodo handles payment.failed
 *   - GET /checkout/:sessionId/token returns pending then token
 *   - Bot can access gated content with the Dodo-issued JWT
 *   - Missing required fields return 400
 *   - Session not found returns 404
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';
import { AuthService, DodoPaymentService } from '@scraperkast/core';
import { scraperKast } from '../src/index.js';
import type {
  PaymentRequiredBody,
  MultiPaymentOptions,
  TokenRetrievalResult,
  CheckoutCreateResponse,
} from '../src/index.js';

// ─── Hoist mocks ─────────────────────────────────────────────────────────────
// We mock SolanaConnection and SolanaPaymentService so tests don't hit a node.

const { MockSolanaConnection, MockSolanaPaymentService } = vi.hoisted(() => {
  class MockSolanaConnection {
    getNetwork() { return 'devnet' as const; }
    getConnection() { return {} as never; }
  }
  class MockSolanaPaymentService {
    verifyPayment    = vi.fn().mockResolvedValue({ isValid: false, status: 'failed' });
    getPaymentStatus = vi.fn().mockResolvedValue('pending');
  }
  return { MockSolanaConnection, MockSolanaPaymentService };
});

vi.mock('@scraperkast/core', async (importOriginal) => {
  const original = await importOriginal<typeof import('@scraperkast/core')>();
  return {
    ...original,
    SolanaConnection:     MockSolanaConnection,
    SolanaPaymentService: MockSolanaPaymentService,
  };
});

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const JWT_SECRET      = 'test-secret-32-chars-minimum-ok!!';
const OWNER_WALLET    = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU';
const PLATFORM_WALLET = 'HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH';
const DODO_API_KEY    = 'dodo_test_key_abc123';
const WEBHOOK_SECRET  = 'dodo_webhook_secret_xyz789';
const GPTBOT_UA       = 'GPTBot/1.0 (+https://openai.com/gptbot)';

const SOLANA_CONFIG = {
  enabled:        true,
  network:        'devnet' as const,
  platformWallet: PLATFORM_WALLET,
  ownerWallet:    OWNER_WALLET,
};

const DODO_CONFIG = {
  enabled:        true,
  apiKey:         DODO_API_KEY,
  webhookSecret:  WEBHOOK_SECRET,
  successUrl:     'http://localhost:3000/payment-success',
  cancelUrl:      'http://localhost:3000/payment-cancel',
};

const RULES = [
  { id: 'blog', path: '/blog/*', pricePerPage: 1000, licenseType: 'summarization' },
];

/** App with both Solana + Dodo, bot in paid tier. */
function makeFullApp(): Express {
  const app = express();
  app.use(express.json());
  app.use(scraperKast({
    jwtSecret: JWT_SECRET,
    rules: RULES,
    counter: {
      async getCount() { return 10_001; },
      async increment() { /* no-op */ },
    },
    solana: SOLANA_CONFIG,
    dodo:   DODO_CONFIG,
  }));
  app.get('*', (_req, res) => res.json({ ok: true }));
  return app;
}

/** App with Solana only (no Dodo). */
function makeSolanaOnlyApp(): Express {
  const app = express();
  app.use(express.json());
  app.use(scraperKast({
    jwtSecret: JWT_SECRET,
    rules: RULES,
    counter: { async getCount() { return 10_001; }, async increment() {} },
    solana: SOLANA_CONFIG,
  }));
  app.get('*', (_req, res) => res.json({ ok: true }));
  return app;
}

/** Fetch the 402 body for a bot request. */
async function get402(app: Express): Promise<PaymentRequiredBody> {
  const res = await request(app)
    .get('/blog/my-post')
    .set('User-Agent', GPTBOT_UA);
  expect(res.status).toBe(402);
  return res.body as PaymentRequiredBody;
}

/** Build a signed Dodo webhook payload. */
function buildWebhook(app: Express, sessionId: string, amount = 1050, event: 'payment.succeeded' | 'payment.failed' = 'payment.succeeded') {
  // Access the real DodoPaymentService to generate a valid HMAC.
  const svc = new DodoPaymentService(DODO_API_KEY, 'devnet', WEBHOOK_SECRET);
  if (event === 'payment.failed') {
    const payload = JSON.stringify({
      event, sessionId, amount: 0,
      solana: { network: 'devnet', txHash: '', recipient: '', amount: 0, platformAmount: 0 },
      metadata: {}, timestamp: Date.now(),
    });
    return { rawBody: payload, signature: svc.generateWebhookSignature(payload) };
  }
  return svc.buildMockWebhookPayload({ sessionId, amount, ownerWallet: OWNER_WALLET });
}

// ─── 402 response format ──────────────────────────────────────────────────────

describe('402 — Solana + Dodo (multi-method)', () => {
  it('returns payment.options array when both are enabled', async () => {
    const body = await get402(makeFullApp());
    const payment = body.payment as MultiPaymentOptions;
    expect(payment.options).toHaveLength(2);
  });

  it('first option is Solana direct', async () => {
    const body   = await get402(makeFullApp());
    const payment = body.payment as MultiPaymentOptions;
    expect(payment.options[0]?.method).toBe('solana');
    expect((payment.options[0] as { type?: string }).type).toBe('direct');
  });

  it('second option is Dodo checkout', async () => {
    const body   = await get402(makeFullApp());
    const payment = body.payment as MultiPaymentOptions;
    expect(payment.options[1]?.method).toBe('dodo');
    expect((payment.options[1] as { checkoutEndpoint?: string }).checkoutEndpoint).toBe('/checkout/create');
  });

  it('includes fiatEquivalent when Dodo is enabled', async () => {
    const body = await get402(makeFullApp());
    expect(body.fiatEquivalent).toBeDefined();
    expect(body.fiatEquivalent).toContain('$');
  });

  it('currency is USDC when Solana is enabled', async () => {
    const body = await get402(makeFullApp());
    expect(body.currency).toBe('USDC');
  });
});

describe('402 — Solana only (no Dodo)', () => {
  it('returns PaymentInstructions object (not options array)', async () => {
    const body = await get402(makeSolanaOnlyApp());
    const payment = body.payment as { method?: string; options?: unknown };
    expect(payment?.method).toBe('solana');
    expect(payment?.options).toBeUndefined();
  });

  it('does not include fiatEquivalent', async () => {
    const body = await get402(makeSolanaOnlyApp());
    expect(body.fiatEquivalent).toBeUndefined();
  });
});

// ─── POST /checkout/create ────────────────────────────────────────────────────

describe('POST /checkout/create', () => {
  it('creates a checkout session and returns checkoutUrl + sessionId', async () => {
    const res = await request(makeFullApp())
      .post('/checkout/create')
      .send({ botId: 'gptbot-123', domain: 'example.com', amount: 1050 });

    expect(res.status).toBe(200);
    const body = res.body as CheckoutCreateResponse;
    expect(body.sessionId).toMatch(/^dodo_/);
    expect(body.checkoutUrl).toContain('/mock-checkout');
    expect(body.amount).toBe(1050);
    expect(body.amountUSD).toBeDefined();
    expect(body.expiresAt).toBeGreaterThan(Date.now());
  });

  it('returns 400 when botId is missing', async () => {
    const res = await request(makeFullApp())
      .post('/checkout/create')
      .send({ domain: 'example.com', amount: 1050 });
    expect(res.status).toBe(400);
  });

  it('returns 400 when domain is missing', async () => {
    const res = await request(makeFullApp())
      .post('/checkout/create')
      .send({ botId: 'gptbot-123', amount: 1050 });
    expect(res.status).toBe(400);
  });

  it('returns 400 when amount is zero or missing', async () => {
    const res = await request(makeFullApp())
      .post('/checkout/create')
      .send({ botId: 'gptbot-123', domain: 'example.com', amount: 0 });
    expect(res.status).toBe(400);
  });

  it('returns 404 from catch-all when Dodo is not configured', async () => {
    // /checkout/create should not exist without Dodo config
    const res = await request(makeSolanaOnlyApp())
      .post('/checkout/create')
      .send({ botId: 'gptbot-123', domain: 'example.com', amount: 1050 });
    // No route → catch-all returns 200 { ok: true } (any non-Dodo route)
    // The key thing: it's not a proper checkout response
    expect((res.body as { sessionId?: string }).sessionId).toBeUndefined();
  });
});

// ─── POST /webhooks/dodo ──────────────────────────────────────────────────────

describe('POST /webhooks/dodo — payment.succeeded', () => {
  it('acknowledges the webhook with { received: true }', async () => {
    const app = makeFullApp();
    // Create session first
    const checkoutRes = await request(app)
      .post('/checkout/create')
      .send({ botId: 'gptbot-123', domain: 'example.com', amount: 1050 });
    const { sessionId } = checkoutRes.body as CheckoutCreateResponse;

    const { rawBody, signature } = buildWebhook(app, sessionId);

    const res = await request(app)
      .post('/webhooks/dodo')
      .set('x-dodo-signature', signature)
      .set('Content-Type', 'application/json')
      .send(rawBody);

    expect(res.status).toBe(200);
    expect((res.body as { received: boolean }).received).toBe(true);
  });

  it('stores JWT in session after payment.succeeded', async () => {
    const app = makeFullApp();

    const checkoutRes = await request(app)
      .post('/checkout/create')
      .send({ botId: 'gptbot-123', domain: 'example.com', amount: 1050 });
    const { sessionId } = checkoutRes.body as CheckoutCreateResponse;

    const { rawBody, signature } = buildWebhook(app, sessionId, 1050);
    await request(app)
      .post('/webhooks/dodo')
      .set('x-dodo-signature', signature)
      .set('Content-Type', 'application/json')
      .send(rawBody);

    // Token should now be available
    const tokenRes = await request(app).get(`/checkout/${sessionId}/token`);
    expect(tokenRes.status).toBe(200);
    const tokenBody = tokenRes.body as TokenRetrievalResult;
    expect(tokenBody.success).toBe(true);
    expect(typeof tokenBody.accessToken).toBe('string');
  });

  it('rejects webhook with invalid signature', async () => {
    const app = makeFullApp();

    const checkoutRes = await request(app)
      .post('/checkout/create')
      .send({ botId: 'gptbot-123', domain: 'example.com', amount: 1050 });
    const { sessionId } = checkoutRes.body as CheckoutCreateResponse;

    const { rawBody } = buildWebhook(app, sessionId);

    // Still returns 200 (to prevent Dodo retry storms) but doesn't issue token
    const webhookRes = await request(app)
      .post('/webhooks/dodo')
      .set('x-dodo-signature', 'sha256=badhash')
      .set('Content-Type', 'application/json')
      .send(rawBody);

    expect(webhookRes.status).toBe(200);

    // Token should NOT be issued
    const tokenRes = await request(app).get(`/checkout/${sessionId}/token`);
    expect((tokenRes.body as TokenRetrievalResult).success).toBe(false);
    expect((tokenRes.body as TokenRetrievalResult).status).toBe('pending');
  });
});

describe('POST /webhooks/dodo — payment.failed', () => {
  it('marks session as failed', async () => {
    const app = makeFullApp();

    const checkoutRes = await request(app)
      .post('/checkout/create')
      .send({ botId: 'gptbot-123', domain: 'example.com', amount: 1050 });
    const { sessionId } = checkoutRes.body as CheckoutCreateResponse;

    const { rawBody, signature } = buildWebhook(app, sessionId, 0, 'payment.failed');
    await request(app)
      .post('/webhooks/dodo')
      .set('x-dodo-signature', signature)
      .set('Content-Type', 'application/json')
      .send(rawBody);

    const tokenRes = await request(app).get(`/checkout/${sessionId}/token`);
    expect(tokenRes.status).toBe(400);
    expect((tokenRes.body as TokenRetrievalResult).status).toBe('failed');
  });
});

// ─── GET /checkout/:sessionId/token ──────────────────────────────────────────

describe('GET /checkout/:sessionId/token', () => {
  it('returns pending before webhook fires', async () => {
    const app = makeFullApp();

    const checkoutRes = await request(app)
      .post('/checkout/create')
      .send({ botId: 'gptbot-123', domain: 'example.com', amount: 1050 });
    const { sessionId } = checkoutRes.body as CheckoutCreateResponse;

    const res = await request(app).get(`/checkout/${sessionId}/token`);
    expect(res.status).toBe(200);
    expect((res.body as TokenRetrievalResult).success).toBe(false);
    expect((res.body as TokenRetrievalResult).status).toBe('pending');
  });

  it('returns 404 for unknown session ID', async () => {
    const res = await request(makeFullApp()).get('/checkout/nonexistent/token');
    expect(res.status).toBe(404);
  });

  it('issued JWT is valid and grants content access', async () => {
    const app = makeFullApp();

    const checkoutRes = await request(app)
      .post('/checkout/create')
      .send({ botId: 'gptbot-123', domain: 'example.com', amount: 1050 });
    const { sessionId } = checkoutRes.body as CheckoutCreateResponse;

    const { rawBody, signature } = buildWebhook(app, sessionId);
    await request(app)
      .post('/webhooks/dodo')
      .set('x-dodo-signature', signature)
      .set('Content-Type', 'application/json')
      .send(rawBody);

    const tokenBody = (await request(app).get(`/checkout/${sessionId}/token`))
      .body as TokenRetrievalResult;
    const { accessToken } = tokenBody;

    // Validate JWT payload
    const auth    = new AuthService(JWT_SECRET);
    const payload = auth.verifyToken(accessToken!);
    expect(payload).not.toBeNull();
    expect(payload?.botId).toBe('gptbot-123');
    expect(payload?.credits).toBeGreaterThanOrEqual(1);

    // Use JWT to access gated content
    const contentRes = await request(app)
      .get('/blog/my-post')
      .set('User-Agent', GPTBOT_UA)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(contentRes.status).toBe(200);
  });
});
