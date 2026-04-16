/**
 * Tests for Solana payment integration in the ScraperKast Express middleware.
 *
 * Mocks SolanaConnection and SolanaPaymentService so tests run without a live
 * Solana node.  All Solana-specific behaviour is exercised here; general
 * middleware behaviour (bot detection, JWT auth, 403 responses) is in the
 * existing test files.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';
import { AuthService } from '@scraperkast/core';
import { scraperKast } from '../src/index.js';
import type { PaymentRequiredBody, VerificationResult } from '../src/index.js';

// ─── Hoist mock state to avoid TDZ in vi.mock factories ──────────────────────

const {
  mockVerifyPayment,
  mockGetPaymentStatus,
  MockSolanaConnection,
  MockSolanaPaymentService,
} = vi.hoisted(() => {
  const mockVerifyPayment    = vi.fn();
  const mockGetPaymentStatus = vi.fn();

  class MockSolanaConnection {
    getNetwork() { return 'devnet' as const; }
    getConnection() { return {} as never; }
  }

  class MockSolanaPaymentService {
    verifyPayment    = mockVerifyPayment;
    getPaymentStatus = mockGetPaymentStatus;
  }

  return {
    mockVerifyPayment,
    mockGetPaymentStatus,
    MockSolanaConnection,
    MockSolanaPaymentService,
  };
});

// Replace the real classes with our mocks.
vi.mock('@scraperkast/core', async (importOriginal) => {
  const original = await importOriginal<typeof import('@scraperkast/core')>();
  return {
    ...original,
    SolanaConnection:    MockSolanaConnection,
    SolanaPaymentService: MockSolanaPaymentService,
  };
});

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const JWT_SECRET      = 'test-secret-32-chars-minimum-ok!!';
const GPTBOT_UA       = 'GPTBot/1.0 (+https://openai.com/gptbot)';
const OWNER_WALLET    = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU';
const PLATFORM_WALLET = 'HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH';
const TX_SIG          = '5vWFwCXzpv7gJJzLPGKhYTrLaADKgpz5AZhyuDAmZ6TxB9eXQHNnFCxApQxnFjw3Aq7GNcPuREAbKLBE';

const SOLANA_CONFIG = {
  enabled:        true,
  network:        'devnet' as const,
  platformWallet: PLATFORM_WALLET,
  ownerWallet:    OWNER_WALLET,
};

const BASE_RULES = [
  {
    id:          'blog',
    path:        '/blog/*',
    pricePerPage: 1000,
    licenseType: 'summarization',
  },
];

/** Build an app with 10 001 requests already counted (paid tier). */
function makePaidApp(overrides: object = {}): Express {
  const app = express();
  app.use(express.json());
  app.use(scraperKast({
    jwtSecret: JWT_SECRET,
    rules: BASE_RULES,
    // Inject a FixedCounter that puts the bot in the paid tier.
    counter: {
      async getCount() { return 10_001; },
      async increment() { /* no-op */ },
    },
    solana: SOLANA_CONFIG,
    ...overrides,
  }));
  app.get('*', (_req, res) => res.json({ ok: true }));
  return app;
}

/** Build an app with Solana disabled (or not configured). */
function makeNoSolanaApp(): Express {
  const app = express();
  app.use(express.json());
  app.use(scraperKast({
    jwtSecret: JWT_SECRET,
    rules: BASE_RULES,
    counter: {
      async getCount() { return 10_001; },
      async increment() { /* no-op */ },
    },
    // solana intentionally omitted
  }));
  app.get('*', (_req, res) => res.json({ ok: true }));
  return app;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function get402(app: Express): Promise<PaymentRequiredBody> {
  const res = await request(app)
    .get('/blog/my-post')
    .set('User-Agent', GPTBOT_UA);
  expect(res.status).toBe(402);
  return res.body as PaymentRequiredBody;
}

function validVerification(ownerReceived = 1000, platformReceived = 50) {
  return {
    isValid:           true,
    txSignature:       TX_SIG,
    expectedAmount:    ownerReceived + platformReceived,
    actualAmount:      ownerReceived + platformReceived,
    ownerReceived,
    platformReceived,
    status:            'confirmed' as const,
    explorerUrl:       `https://explorer.solana.com?cluster=devnet/tx/${TX_SIG}`,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Solana — 402 response format', () => {
  it('includes Solana payment instructions when Solana is enabled', async () => {
    const body = await get402(makePaidApp());

    expect(body.payment).toBeDefined();
    expect(body.payment?.method).toBe('solana');
    expect(body.payment?.network).toBe('devnet');
    expect(body.currency).toBe('USDC');
  });

  it('includes two transfer instructions (owner + platform)', async () => {
    const body = await get402(makePaidApp());

    expect(body.payment?.instructions).toHaveLength(2);
    const [ownerInstr, platformInstr] = body.payment!.instructions;

    expect(ownerInstr?.to).toBe(OWNER_WALLET);
    expect(platformInstr?.to).toBe(PLATFORM_WALLET);
  });

  it('sets correct amounts: basePrice to owner, scraperKastFee to platform', async () => {
    const body = await get402(makePaidApp());

    const [ownerInstr, platformInstr] = body.payment!.instructions;
    expect(ownerInstr?.amount).toBe(body.basePrice);
    expect(platformInstr?.amount).toBe(body.scraperKastFee);
  });

  it('all instructions have token=USDC-SPL, from=bot_wallet, decimals=6', async () => {
    const body = await get402(makePaidApp());

    for (const instr of body.payment!.instructions) {
      expect(instr.token).toBe('USDC-SPL');
      expect(instr.from).toBe('bot_wallet');
      expect(instr.decimals).toBe(6);
    }
  });

  it('includes devnet USDC mint address', async () => {
    const body = await get402(makePaidApp());
    // devnet USDC mint
    expect(body.payment?.usdcMint).toBe('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');
  });

  it('sets verifyEndpoint to /verify-payment', async () => {
    const body = await get402(makePaidApp());
    expect(body.payment?.verifyEndpoint).toBe('/verify-payment');
  });

  it('includes botId in the 402 response for the bot to use when verifying', async () => {
    const body = await get402(makePaidApp());
    expect(body.botId).toBeDefined();
    expect(typeof body.botId).toBe('string');
    expect((body.botId ?? '').length).toBeGreaterThan(0);
  });

  it('uses paymentUrl fallback (no payment object) when Solana is disabled', async () => {
    const body = await get402(makeNoSolanaApp());
    expect(body.payment).toBeUndefined();
    expect(body.paymentUrl).toBeDefined();
    expect(body.currency).toBe('USD_CENTS');
  });
});

describe('Solana — free tier does not include payment instructions', () => {
  it('returns 402 for free tier without Solana payment instructions', async () => {
    const app = express();
    app.use(express.json());
    app.use(scraperKast({
      jwtSecret: JWT_SECRET,
      rules: BASE_RULES,
      counter: {
        async getCount() { return 500; }, // well within free tier
        async increment() { /* no-op */ },
      },
      solana: SOLANA_CONFIG,
    }));
    app.get('*', (_req, res) => res.json({ ok: true }));

    const body = await get402(app);
    expect(body.tier).toBe('free');
    // No payment instructions for free tier — bot shouldn't need to pay
    expect(body.payment).toBeUndefined();
    expect(body.currency).toBe('USD_CENTS');
  });
});

describe('POST /verify-payment — success', () => {
  beforeEach(() => {
    mockVerifyPayment.mockResolvedValue(validVerification());
  });

  it('returns 200 and accessToken for a valid payment', async () => {
    const res = await request(makePaidApp())
      .post('/verify-payment')
      .send({ txSignature: TX_SIG, botId: 'gptbot-123', domain: 'example.com' });

    expect(res.status).toBe(200);
    const body = res.body as VerificationResult;
    expect(body.success).toBe(true);
    expect(typeof body.accessToken).toBe('string');
    expect(body.expiresIn).toBe(3600);
    expect(body.message).toContain('Payment verified');
  });

  it('issued JWT is a valid signed token', async () => {
    const res = await request(makePaidApp())
      .post('/verify-payment')
      .send({ txSignature: TX_SIG, botId: 'gptbot-123', domain: 'example.com' });

    const { accessToken } = res.body as VerificationResult;
    const auth    = new AuthService(JWT_SECRET);
    const payload = auth.verifyToken(accessToken!);

    expect(payload).not.toBeNull();
    expect(payload?.botId).toBe('gptbot-123');
    expect(payload?.credits).toBeGreaterThanOrEqual(1);
    expect(payload?.allowedDomains).toContain('example.com');
  });

  it('credits scale with payment amount (10 credits for 1000µUSDC owner payment)', async () => {
    mockVerifyPayment.mockResolvedValue(validVerification(1000, 50));

    const res = await request(makePaidApp())
      .post('/verify-payment')
      .send({ txSignature: TX_SIG, botId: 'my-bot', domain: 'test.com' });

    const auth    = new AuthService(JWT_SECRET);
    const payload = auth.verifyToken((res.body as VerificationResult).accessToken!);
    // 1000 µUSDC / 100 (MIN_UNIT) = 10 credits
    expect(payload?.credits).toBe(10);
  });

  it('bot can access gated content with the returned JWT', async () => {
    const app = makePaidApp();

    const verifyRes = await request(app)
      .post('/verify-payment')
      .send({ txSignature: TX_SIG, botId: 'gptbot-123', domain: 'example.com' });

    const { accessToken } = verifyRes.body as VerificationResult;

    const contentRes = await request(app)
      .get('/blog/my-post')
      .set('User-Agent', GPTBOT_UA)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(contentRes.status).toBe(200);
    expect(contentRes.body).toEqual({ ok: true });
  });
});

describe('POST /verify-payment — failures', () => {
  it('returns 400 when transaction is not confirmed (not found)', async () => {
    mockVerifyPayment.mockResolvedValue({
      isValid:          false,
      txSignature:      TX_SIG,
      expectedAmount:   0,
      actualAmount:     0,
      ownerReceived:    0,
      platformReceived: 0,
      status:           'pending' as const,
      explorerUrl:      '',
    });

    const res = await request(makePaidApp())
      .post('/verify-payment')
      .send({ txSignature: TX_SIG, botId: 'bot-1', domain: 'example.com' });

    expect(res.status).toBe(400);
    expect((res.body as VerificationResult).success).toBe(false);
  });

  it('returns 400 when transaction failed on-chain', async () => {
    mockVerifyPayment.mockResolvedValue({
      isValid:          false,
      txSignature:      TX_SIG,
      expectedAmount:   0,
      actualAmount:     0,
      ownerReceived:    0,
      platformReceived: 0,
      status:           'failed' as const,
      explorerUrl:      '',
    });

    const res = await request(makePaidApp())
      .post('/verify-payment')
      .send({ txSignature: TX_SIG, botId: 'bot-1', domain: 'example.com' });

    expect(res.status).toBe(400);
    const body = res.body as VerificationResult;
    expect(body.success).toBe(false);
    expect(body.error).toContain('failed');
  });

  it('returns 400 when owner wallet received 0 µUSDC', async () => {
    mockVerifyPayment.mockResolvedValue({
      ...validVerification(),
      ownerReceived: 0,
    });

    const res = await request(makePaidApp())
      .post('/verify-payment')
      .send({ txSignature: TX_SIG, botId: 'bot-1', domain: 'example.com' });

    expect(res.status).toBe(400);
    expect((res.body as VerificationResult).error).toContain('owner wallet');
  });

  it('returns 400 when platform fee is missing', async () => {
    mockVerifyPayment.mockResolvedValue({
      ...validVerification(),
      platformReceived: 0,
    });

    const res = await request(makePaidApp())
      .post('/verify-payment')
      .send({ txSignature: TX_SIG, botId: 'bot-1', domain: 'example.com' });

    expect(res.status).toBe(400);
    expect((res.body as VerificationResult).error).toContain('Platform fee');
  });

  it('returns 503 when Solana RPC throws', async () => {
    mockVerifyPayment.mockRejectedValue(new Error('Connection refused'));

    const res = await request(makePaidApp())
      .post('/verify-payment')
      .send({ txSignature: TX_SIG, botId: 'bot-1', domain: 'example.com' });

    expect(res.status).toBe(503);
    expect((res.body as VerificationResult).error).toContain('RPC');
  });
});

describe('POST /verify-payment — input validation', () => {
  it('returns 400 when txSignature is missing', async () => {
    const res = await request(makePaidApp())
      .post('/verify-payment')
      .send({ botId: 'bot-1', domain: 'example.com' });

    expect(res.status).toBe(400);
    expect((res.body as VerificationResult).error).toContain('txSignature');
  });

  it('returns 400 when botId is missing', async () => {
    const res = await request(makePaidApp())
      .post('/verify-payment')
      .send({ txSignature: TX_SIG, domain: 'example.com' });

    expect(res.status).toBe(400);
    expect((res.body as VerificationResult).error).toContain('botId');
  });

  it('returns 400 when domain is missing', async () => {
    const res = await request(makePaidApp())
      .post('/verify-payment')
      .send({ txSignature: TX_SIG, botId: 'bot-1' });

    expect(res.status).toBe(400);
    expect((res.body as VerificationResult).error).toContain('domain');
  });

  it('returns 404 (not mounted) when Solana is disabled', async () => {
    // /verify-payment should not exist when Solana is not configured
    const res = await request(makeNoSolanaApp())
      .post('/verify-payment')
      .send({ txSignature: TX_SIG, botId: 'bot-1', domain: 'example.com' });

    // Express returns 404 for unknown routes; could also be 200 from catch-all
    // depending on the route order. The key assertion: no VerificationResult.
    expect(res.status).not.toBe(200);
  });
});
