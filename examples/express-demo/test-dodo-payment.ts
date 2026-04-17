/**
 * End-to-end Dodo Payments test client.
 *
 * Demonstrates the complete credit-card → USDC payment flow:
 *
 *   1. Bot hits gated content → 402 with Dodo checkout option
 *   2. Bot calls POST /checkout/create → receives checkout session + URL
 *   3. (Simulated) User completes payment on Dodo checkout page
 *   4. Dodo calls POST /webhooks/dodo (simulated with valid HMAC)
 *   5. Bot polls GET /checkout/:sessionId/token → receives JWT
 *   6. Bot retries request with JWT → 200 content served
 *
 * PREREQUISITES
 *   - Server running: npm run dev (in examples/express-demo)
 *   - PLATFORM_WALLET + OWNER_WALLET set in .env (for Solana routing)
 *   - DODO_API_KEY + DODO_WEBHOOK_SECRET set in .env
 *
 * USAGE
 *   npx tsx examples/express-demo/test-dodo-payment.ts
 */

import 'dotenv/config';
import { DodoPaymentService } from '@scraperkast/core';

// ─── Configuration ────────────────────────────────────────────────────────────

const BASE_URL    = process.env['DEMO_URL']           ?? 'http://localhost:3000';
const TARGET_PATH = '/blog/intro-to-llms';
const BOT_UA      = 'GPTBot/1.0 (+https://openai.com/gptbot)';
const OWNER_WALLET = process.env['OWNER_WALLET']      ?? '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU';
const API_KEY      = process.env['DODO_API_KEY']      ?? 'dodo_dev_mock_key';
const WH_SECRET    = process.env['DODO_WEBHOOK_SECRET'] ?? 'dodo_dev_mock_secret';
const NETWORK      = (process.env['SOLANA_NETWORK'] ?? 'devnet') === 'mainnet'
  ? 'mainnet' as const
  : 'devnet'  as const;

// ANSI colours
const c = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  green: '\x1b[32m', red: '\x1b[31m', cyan: '\x1b[36m', yellow: '\x1b[33m',
};
const paint = (col: string, s: string) => `${col}${s}${c.reset}`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res  = await fetch(url, init);
  return res.json() as Promise<T>;
}

function printStep(n: number, title: string) {
  console.log('');
  console.log(paint(c.bold, `Step ${n}: ${title}`));
  console.log(paint(c.dim, '─'.repeat(60)));
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Main flow ────────────────────────────────────────────────────────────────

async function main() {
  console.log(paint(c.bold + c.cyan, '\n💳 ScraperKast — Dodo Payments end-to-end test'));
  console.log(paint(c.dim, `Target: ${BASE_URL}${TARGET_PATH}\n`));

  // ── Step 1: Hit gated content (expect 402 with Dodo option) ───────────────
  printStep(1, `GET ${TARGET_PATH} as GPTBot (expecting 402 with Dodo option)`);

  const raw402 = await fetchJson<Record<string, unknown>>(`${BASE_URL}${TARGET_PATH}`, {
    headers: { 'User-Agent': BOT_UA },
  });

  const payment = raw402['payment'] as { options?: Array<{ method: string }> } | undefined;
  const hasDodo = payment?.options?.some((o) => o.method === 'dodo') ?? false;

  if (!hasDodo) {
    console.error(paint(c.red, 'ERROR: No Dodo payment option in 402 response.'));
    console.error('Make sure the server has DODO_API_KEY + DODO_WEBHOOK_SECRET configured.');
    console.error('Response:', JSON.stringify(raw402, null, 2));
    process.exit(1);
  }

  const botId        = raw402['botId'] as string;
  const totalPrice   = raw402['totalPrice'] as number;
  const fiatEquiv    = raw402['fiatEquivalent'] as string;

  console.log(paint(c.green, '✓ Received 402 with Dodo payment option'));
  console.log(`  botId:         ${botId}`);
  console.log(`  totalPrice:    ${totalPrice} µUSDC (${fiatEquiv})`);
  console.log(`  options:       ${payment?.options?.map((o) => o.method).join(', ')}`);

  // ── Step 2: Create Dodo checkout session ──────────────────────────────────
  printStep(2, 'POST /checkout/create');

  const checkout = await fetchJson<{
    checkoutUrl: string;
    sessionId: string;
    expiresAt: number;
    amount: number;
    amountUSD: string;
  }>(`${BASE_URL}/checkout/create`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': BOT_UA },
    body: JSON.stringify({
      botId,
      domain:     'example.com',
      amount:     totalPrice,
      successUrl: `${BASE_URL}/payment-success`,
      cancelUrl:  `${BASE_URL}/payment-cancel`,
    }),
  });

  if (!checkout.sessionId) {
    console.error(paint(c.red, 'ERROR: No sessionId in checkout response'));
    console.error(JSON.stringify(checkout, null, 2));
    process.exit(1);
  }

  console.log(paint(c.green, '✓ Checkout session created'));
  console.log(`  sessionId:   ${checkout.sessionId}`);
  console.log(`  checkoutUrl: ${checkout.checkoutUrl.slice(0, 80)}…`);
  console.log(`  amount:      ${checkout.amount} µUSDC (${checkout.amountUSD})`);

  // ── Step 3: Simulate Dodo calling the webhook ─────────────────────────────
  printStep(3, 'Simulate Dodo webhook (POST /webhooks/dodo)');

  const dodoSvc = new DodoPaymentService(API_KEY, NETWORK, WH_SECRET);
  const { rawBody, signature } = dodoSvc.buildMockWebhookPayload({
    sessionId:   checkout.sessionId,
    amount:      checkout.amount,
    ownerWallet: OWNER_WALLET,
  });

  const webhookRes = await fetchJson<{ received: boolean }>(`${BASE_URL}/webhooks/dodo`, {
    method:  'POST',
    headers: {
      'Content-Type':     'application/json',
      'x-dodo-signature': signature,
    },
    body: rawBody,
  });

  if (!webhookRes.received) {
    console.error(paint(c.red, 'ERROR: Webhook not acknowledged'));
    process.exit(1);
  }

  console.log(paint(c.green, '✓ Webhook acknowledged'));

  // ── Step 4: Poll for access token ─────────────────────────────────────────
  printStep(4, `Poll GET /checkout/${checkout.sessionId}/token`);

  let accessToken: string | null = null;
  let txHash:      string | null = null;

  for (let attempt = 1; attempt <= 10; attempt++) {
    const tokenRes = await fetchJson<{
      success: boolean;
      accessToken?: string;
      txHash?: string;
      status?: string;
    }>(`${BASE_URL}/checkout/${checkout.sessionId}/token`);

    if (tokenRes.success && tokenRes.accessToken) {
      accessToken = tokenRes.accessToken;
      txHash      = tokenRes.txHash ?? null;
      console.log(paint(c.green, `  ✓ Token ready (attempt ${attempt})`));
      break;
    }

    console.log(`  [${attempt}/10] status=${tokenRes.status ?? 'pending'} — retrying in 1s…`);
    await sleep(1000);
  }

  if (!accessToken) {
    console.error(paint(c.red, 'ERROR: Token not ready after 10 attempts'));
    process.exit(1);
  }

  if (txHash) console.log(`  txHash: ${txHash.slice(0, 20)}…`);
  console.log(`  token:  ${accessToken.slice(0, 40)}…`);

  // ── Step 5: Access content with JWT ───────────────────────────────────────
  printStep(5, `GET ${TARGET_PATH} with Authorization: Bearer <token>`);

  const contentRes = await fetch(`${BASE_URL}${TARGET_PATH}`, {
    headers: {
      'User-Agent':    BOT_UA,
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (contentRes.status !== 200) {
    console.error(paint(c.red, `ERROR: Expected 200 but got ${contentRes.status}`));
    process.exit(1);
  }

  const content = await contentRes.json() as Record<string, unknown>;
  console.log(paint(c.green + c.bold, '  ✓ Content served successfully!'));
  console.log(`  Title: ${(content['title'] as string | undefined) ?? '(no title field)'}`);

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('');
  console.log(paint(c.bold + c.green, '🎉 Dodo end-to-end payment test PASSED'));
  console.log(paint(c.dim, '─'.repeat(60)));
  console.log(`  session:      ${checkout.sessionId}`);
  console.log(`  amount:       ${checkout.amount} µUSDC (${checkout.amountUSD})`);
  console.log(`  access token: ${accessToken.slice(0, 40)}…`);
  console.log('');
  console.log(paint(c.dim, 'Payment flow: credit card → USDC on Solana → JWT access token ✓'));
  console.log('');
}

main().catch((err) => {
  console.error(paint(c.red + c.bold, '\n❌ Test failed:'), (err as Error).message);
  process.exit(1);
});
