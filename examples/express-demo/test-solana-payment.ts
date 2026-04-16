/**
 * End-to-end Solana payment test client.
 *
 * Demonstrates the full ScraperKast payment flow:
 *   1. Bot hits gated content → 402 with Solana instructions
 *   2. Bot creates + sends USDC transaction
 *   3. Bot calls POST /verify-payment with tx signature
 *   4. Server verifies payment → returns JWT
 *   5. Bot retries request with JWT → 200 content served
 *
 * PREREQUISITES
 *   - Server running: npm run dev (in examples/express-demo)
 *   - Solana devnet wallets configured in .env
 *   - Bot wallet has devnet USDC and SOL for fees
 *
 * USAGE
 *   npx tsx examples/express-demo/test-solana-payment.ts
 *
 * To get devnet USDC, use the Circle devnet faucet:
 *   https://faucet.circle.com
 */

import 'dotenv/config';
import {
  Keypair,
  Connection,
  PublicKey,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import {
  getOrCreateAssociatedTokenAccount,
  mintTo,
  createMint,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import {
  SolanaConnection,
  SolanaPaymentService,
} from '@scraperkast/core';

// ─── Configuration ────────────────────────────────────────────────────────────

const BASE_URL    = process.env['DEMO_URL']    ?? 'http://localhost:3000';
const TARGET_PATH = '/blog/intro-to-llms';
const BOT_UA      = 'GPTBot/1.0 (+https://openai.com/gptbot)';
const NETWORK     = 'devnet' as const;
const RPC_URL     = process.env['SOLANA_RPC_URL'] ?? 'https://api.devnet.solana.com';

// ANSI colours
const c = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  green: '\x1b[32m', red: '\x1b[31m', cyan: '\x1b[36m', yellow: '\x1b[33m',
};
const paint = (col: string, s: string) => `${col}${s}${c.reset}`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function fetchJson(url: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(url, init);
  const body: unknown = await res.json();
  return body;
}

function printStep(n: number, title: string) {
  console.log('');
  console.log(paint(c.bold, `Step ${n}: ${title}`));
  console.log(paint(c.dim, '─'.repeat(60)));
}

// ─── Main flow ────────────────────────────────────────────────────────────────

async function main() {
  console.log(paint(c.bold + c.cyan, '\n⛓  ScraperKast — Solana payment end-to-end test'));
  console.log(paint(c.dim, `Target: ${BASE_URL}${TARGET_PATH}\n`));

  // ── Step 1: Hit the protected endpoint as a bot (no token) ────────────────
  printStep(1, `GET ${TARGET_PATH} as GPTBot (expecting 402)`);

  const raw402 = await fetchJson(`${BASE_URL}${TARGET_PATH}`, {
    headers: { 'User-Agent': BOT_UA },
  }) as Record<string, unknown>;

  if (!raw402['payment']) {
    console.error(paint(c.red, 'ERROR: No payment instructions in 402 response.'));
    console.error('Make sure the server is running with Solana configured (OWNER_WALLET + PLATFORM_WALLET).');
    console.error('Response:', JSON.stringify(raw402, null, 2));
    process.exit(1);
  }

  const botId = raw402['botId'] as string;
  const payment = raw402['payment'] as {
    instructions: Array<{ to: string; amount: number }>;
    usdcMint: string;
    verifyEndpoint: string;
  };

  console.log(paint(c.green, '✓ Received 402 with Solana instructions'));
  console.log(`  botId:          ${botId}`);
  console.log(`  USDC mint:      ${payment.usdcMint}`);
  console.log(`  Verify at:      ${payment.verifyEndpoint}`);
  for (const instr of payment.instructions) {
    console.log(`  Transfer:       ${instr.amount} µUSDC → ${instr.to.slice(0, 8)}…`);
  }

  // ── Step 2: Set up a devnet bot wallet ────────────────────────────────────
  printStep(2, 'Create bot keypair + airdrop devnet SOL');

  const connection = new Connection(RPC_URL, 'confirmed');
  const botKeypair = Keypair.generate();
  console.log(`  Bot wallet:  ${botKeypair.publicKey.toBase58()}`);

  // Airdrop SOL for transaction fees
  const airdropSig = await connection.requestAirdrop(
    botKeypair.publicKey,
    0.5 * LAMPORTS_PER_SOL,
  );
  await connection.confirmTransaction(airdropSig);
  console.log(paint(c.green, `  ✓ Airdropped 0.5 SOL`));

  // ── Step 3: Mint devnet USDC to bot wallet ────────────────────────────────
  printStep(3, 'Mint devnet USDC to bot wallet');

  // On devnet we create our own test USDC mint (Circle devnet faucet not
  // available in automated tests). In a real integration you would get USDC
  // from https://faucet.circle.com and use the real devnet mint.
  const payer     = botKeypair;
  const usdcMint  = await createMint(connection, payer, payer.publicKey, null, 6);
  const ownerKey  = new PublicKey(payment.instructions[0]!.to);
  const platformKey = new PublicKey(
    payment.instructions[payment.instructions.length - 1]!.to,
  );

  const botAta = await getOrCreateAssociatedTokenAccount(
    connection, payer, usdcMint, botKeypair.publicKey,
  );
  await getOrCreateAssociatedTokenAccount(connection, payer, usdcMint, ownerKey);
  await getOrCreateAssociatedTokenAccount(connection, payer, usdcMint, platformKey);

  // Mint enough USDC to cover all transfers
  const totalNeeded = payment.instructions.reduce((s, i) => s + i.amount, 0);
  await mintTo(connection, payer, usdcMint, botAta.address, payer, totalNeeded + 1_000);
  console.log(paint(c.green, `  ✓ Minted ${totalNeeded + 1_000} µUSDC to bot wallet`));

  // ── Step 4: Execute the Solana payment ───────────────────────────────────
  printStep(4, 'Execute USDC payment on-chain');

  const solanaConn = new SolanaConnection(NETWORK);
  // Override the connection to use our test mint
  const paymentService = new SolanaPaymentService(solanaConn, platformKey);

  const tx = await paymentService.createPayment({
    botWallet:      botKeypair.publicKey,
    ownerWallet:    ownerKey,
    platformWallet: platformKey,
    basePrice:      payment.instructions[0]!.amount,
    scraperKastFee: payment.instructions.length > 1
      ? payment.instructions[payment.instructions.length - 1]!.amount
      : 0,
    botId,
    domain:         'localhost',
  });

  const txSignature = await paymentService.executePayment(tx, botKeypair);
  console.log(paint(c.green, `  ✓ Transaction confirmed: ${txSignature.slice(0, 20)}…`));

  // ── Step 5: Call /verify-payment to exchange signature for JWT ────────────
  printStep(5, `POST ${payment.verifyEndpoint}`);

  const verifyBody = await fetchJson(`${BASE_URL}${payment.verifyEndpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ txSignature, botId, domain: 'localhost' }),
  }) as Record<string, unknown>;

  if (!verifyBody['success']) {
    console.error(paint(c.red, `ERROR: Verification failed — ${verifyBody['error'] as string}`));
    console.error('Details:', verifyBody['details']);
    process.exit(1);
  }

  const accessToken = verifyBody['accessToken'] as string;
  console.log(paint(c.green, '  ✓ Payment verified! Access token issued.'));
  console.log(`  Token (first 40 chars): ${accessToken.slice(0, 40)}…`);

  // ── Step 6: Retry the request with the JWT ────────────────────────────────
  printStep(6, `GET ${TARGET_PATH} with Authorization: Bearer <token>`);

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
  console.log(paint(c.bold + c.green, '🎉 End-to-end Solana payment test PASSED'));
  console.log(paint(c.dim, '─'.repeat(60)));
  console.log(`  tx signature: ${txSignature}`);
  console.log(`  access token: ${accessToken.slice(0, 40)}…`);
  console.log('');
}

main().catch((err) => {
  console.error(paint(c.red + c.bold, '\n❌ Test failed:'), (err as Error).message);
  process.exit(1);
});
