import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DodoPaymentService } from './dodoPay.js';
import { SessionStore } from './sessionStore.js';
import type { SessionData } from './types.js';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const API_KEY        = 'dodo_test_key_abc123';
const WEBHOOK_SECRET = 'dodo_webhook_secret_xyz789';
const OWNER_WALLET   = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU';
const PLATFORM_WALLET = 'HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH';

function makeService() {
  return new DodoPaymentService(API_KEY, 'devnet', WEBHOOK_SECRET);
}

const CHECKOUT_PARAMS = {
  amount:          1050,
  botId:           'gptbot-123',
  domain:          'example.com',
  ownerWallet:     OWNER_WALLET,
  platformWallet:  PLATFORM_WALLET,
  successUrl:      'https://bot.example.com/payment-success',
  cancelUrl:       'https://bot.example.com/payment-cancel',
};

// ─── DodoPaymentService ───────────────────────────────────────────────────────

describe('DodoPaymentService — constructor', () => {
  it('throws when apiKey is empty', () => {
    expect(() => new DodoPaymentService('', 'devnet', WEBHOOK_SECRET))
      .toThrow('apiKey and webhookSecret are required');
  });

  it('throws when webhookSecret is empty', () => {
    expect(() => new DodoPaymentService(API_KEY, 'devnet', ''))
      .toThrow('apiKey and webhookSecret are required');
  });
});

describe('DodoPaymentService — createCheckout', () => {
  it('returns a checkout session with id, url, expiresAt, and status=pending', async () => {
    const svc = makeService();
    const session = await svc.createCheckout(CHECKOUT_PARAMS);

    expect(session.id).toMatch(/^dodo_/);
    expect(session.url).toContain('/mock-checkout');
    expect(session.url).toContain(CHECKOUT_PARAMS.botId);
    expect(session.expiresAt).toBeGreaterThan(Date.now());
    expect(session.status).toBe('pending');
  });

  it('includes amount and domain in the checkout URL', async () => {
    const svc     = makeService();
    const session = await svc.createCheckout(CHECKOUT_PARAMS);
    expect(session.url).toContain('amount=1050');
    expect(session.url).toContain('domain=example.com');
  });

  it('sets expiry ~1 hour in the future', async () => {
    const svc     = makeService();
    const before  = Date.now();
    const session = await svc.createCheckout(CHECKOUT_PARAMS);
    const after   = Date.now();

    const oneHourMs = 60 * 60 * 1000;
    expect(session.expiresAt).toBeGreaterThanOrEqual(before + oneHourMs - 100);
    expect(session.expiresAt).toBeLessThanOrEqual(after  + oneHourMs + 100);
  });

  it('each call generates a unique session ID', async () => {
    const svc = makeService();
    const s1  = await svc.createCheckout(CHECKOUT_PARAMS);
    const s2  = await svc.createCheckout(CHECKOUT_PARAMS);
    expect(s1.id).not.toBe(s2.id);
  });

  it('throws when amount is zero or negative', async () => {
    const svc = makeService();
    await expect(svc.createCheckout({ ...CHECKOUT_PARAMS, amount: 0 }))
      .rejects.toThrow('amount must be positive');
    await expect(svc.createCheckout({ ...CHECKOUT_PARAMS, amount: -100 }))
      .rejects.toThrow('amount must be positive');
  });

  it('throws when wallet addresses are missing', async () => {
    const svc = makeService();
    await expect(svc.createCheckout({ ...CHECKOUT_PARAMS, ownerWallet: '' }))
      .rejects.toThrow('wallet addresses required');
  });
});

describe('DodoPaymentService — handleWebhook (signature verification)', () => {
  it('verifies a correctly signed payload', async () => {
    const svc     = makeService();
    const session = await svc.createCheckout(CHECKOUT_PARAMS);

    const { rawBody, signature } = svc.buildMockWebhookPayload({
      sessionId:   session.id,
      amount:      CHECKOUT_PARAMS.amount,
      ownerWallet: OWNER_WALLET,
    });

    const result = svc.handleWebhook(rawBody, signature);
    expect(result.verified).toBe(true);
  });

  it('rejects a payload with an invalid signature', async () => {
    const svc     = makeService();
    const session = await svc.createCheckout(CHECKOUT_PARAMS);

    const { rawBody } = svc.buildMockWebhookPayload({
      sessionId:   session.id,
      amount:      CHECKOUT_PARAMS.amount,
      ownerWallet: OWNER_WALLET,
    });

    const result = svc.handleWebhook(rawBody, 'sha256=badhash');
    expect(result.verified).toBe(false);
    expect(result.error).toContain('signature');
  });

  it('rejects when x-dodo-signature header is missing', () => {
    const svc    = makeService();
    const result = svc.handleWebhook('{}', '');
    expect(result.verified).toBe(false);
  });

  it('rejects when payload is invalid JSON', () => {
    const svc  = makeService();
    const sig  = svc.generateWebhookSignature('not-json');
    const result = svc.handleWebhook('not-json', sig);
    expect(result.verified).toBe(false);
    expect(result.error).toContain('JSON');
  });
});

describe('DodoPaymentService — handleWebhook (payment.succeeded)', () => {
  it('returns event, txHash, ownerReceived, platformReceived on success', async () => {
    const svc     = makeService();
    const session = await svc.createCheckout(CHECKOUT_PARAMS);

    const { rawBody, signature } = svc.buildMockWebhookPayload({
      sessionId:   session.id,
      amount:      1050,
      ownerWallet: OWNER_WALLET,
    });

    const result = svc.handleWebhook(rawBody, signature);
    expect(result.event).toBe('payment.succeeded');
    expect(result.txHash).toBeDefined();
    expect(result.ownerReceived).toBeGreaterThan(0);
    expect(result.platformReceived).toBeGreaterThan(0);
    // 95/5 split: owner + platform = total
    expect(result.ownerReceived! + result.platformReceived!).toBe(1050);
  });

  it('returns the session ID from the webhook payload', async () => {
    const svc     = makeService();
    const session = await svc.createCheckout(CHECKOUT_PARAMS);

    const { rawBody, signature } = svc.buildMockWebhookPayload({
      sessionId:   session.id,
      amount:      1050,
      ownerWallet: OWNER_WALLET,
    });

    const result = svc.handleWebhook(rawBody, signature);
    expect(result.sessionId).toBe(session.id);
  });
});

describe('DodoPaymentService — handleWebhook (payment.failed)', () => {
  it('returns verified=true with event=payment.failed', async () => {
    const svc     = makeService();
    const session = await svc.createCheckout(CHECKOUT_PARAMS);

    const failPayload = JSON.stringify({
      event:     'payment.failed',
      sessionId: session.id,
      amount:    0,
      solana:    { network: 'devnet', txHash: '', recipient: '', amount: 0, platformAmount: 0 },
      metadata:  {},
      timestamp: Date.now(),
    });
    const sig = svc.generateWebhookSignature(failPayload);

    const result = svc.handleWebhook(failPayload, sig);
    expect(result.verified).toBe(true);
    expect(result.event).toBe('payment.failed');
  });
});

describe('DodoPaymentService — getSessionStatus', () => {
  it('returns pending (mock always returns pending)', async () => {
    const svc    = makeService();
    const status = await svc.getSessionStatus('any-session-id');
    expect(status).toBe('pending');
  });
});

// ─── SessionStore ─────────────────────────────────────────────────────────────

function makeSession(overrides: Partial<SessionData> = {}): SessionData {
  return {
    botId:         'gptbot-123',
    domain:        'example.com',
    amount:        1050,
    ownerWallet:   OWNER_WALLET,
    platformWallet: PLATFORM_WALLET,
    createdAt:     Date.now(),
    expiresAt:     Date.now() + 3_600_000,
    status:        'pending',
    ...overrides,
  };
}

describe('SessionStore — basic operations', () => {
  let store: SessionStore;

  beforeEach(() => { store = new SessionStore(); });

  it('stores and retrieves a session', () => {
    store.set('sess-1', makeSession());
    expect(store.get('sess-1')).not.toBeNull();
    expect(store.get('sess-1')?.botId).toBe('gptbot-123');
  });

  it('returns null for unknown session ID', () => {
    expect(store.get('does-not-exist')).toBeNull();
  });

  it('deletes a session', () => {
    store.set('sess-1', makeSession());
    store.delete('sess-1');
    expect(store.get('sess-1')).toBeNull();
  });

  it('has() returns true for existing session, false after delete', () => {
    store.set('sess-1', makeSession());
    expect(store.has('sess-1')).toBe(true);
    store.delete('sess-1');
    expect(store.has('sess-1')).toBe(false);
  });
});

describe('SessionStore — update and complete', () => {
  let store: SessionStore;

  beforeEach(() => { store = new SessionStore(); });

  it('updates partial fields without overwriting others', () => {
    store.set('sess-1', makeSession());
    store.update('sess-1', { status: 'completed' });
    const s = store.get('sess-1')!;
    expect(s.status).toBe('completed');
    expect(s.botId).toBe('gptbot-123'); // untouched
  });

  it('complete() sets status, txHash, and accessToken', () => {
    store.set('sess-1', makeSession());
    store.complete('sess-1', 'tx-hash-123', 'jwt-token-abc');
    const s = store.get('sess-1')!;
    expect(s.status).toBe('completed');
    expect(s.txHash).toBe('tx-hash-123');
    expect(s.accessToken).toBe('jwt-token-abc');
  });

  it('update returns false for non-existent session', () => {
    expect(store.update('ghost', { status: 'completed' })).toBe(false);
  });
});

describe('SessionStore — expiry', () => {
  it('returns null for an expired session', () => {
    // Short TTL: 1 ms
    const store = new SessionStore(1);
    store.set('sess-1', makeSession({ expiresAt: Date.now() - 1000 }));
    expect(store.get('sess-1')).toBeNull();
  });

  it('cleanup() removes expired sessions and returns count', () => {
    const store = new SessionStore();
    store.set('expired', makeSession({ expiresAt: Date.now() - 1000 }));
    store.set('valid',   makeSession({ expiresAt: Date.now() + 3_600_000 }));
    const removed = store.cleanup();
    expect(removed).toBe(1);
    expect(store.get('valid')).not.toBeNull();
  });

  it('size property excludes expired sessions', () => {
    const store = new SessionStore();
    store.set('expired', makeSession({ expiresAt: Date.now() - 1000 }));
    store.set('valid',   makeSession());
    expect(store.size).toBe(1);
  });
});
