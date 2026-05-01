/**
 * ScraperKast Autonomous Payment Agent
 *
 * Demonstrates the complete micropayment flow end-to-end:
 *   discover → 402 → decide → pay on Solana → JWT → access
 *
 * Run:  npm start
 * Setup first: npm run setup
 */

import 'dotenv/config';
import axios, { type AxiosResponse } from 'axios';
import { Connection, PublicKey } from '@solana/web3.js';
import chalk from 'chalk';
import { log } from './logger.js';
import { loadKeypair, getTokenBalance, getSolBalance, transferTokens } from './wallet.js';
import { logDecision, type PaymentChallenge } from './decision.js';

// ── Config ────────────────────────────────────────────────────────────────────

const SOLANA_RPC      = process.env.SOLANA_RPC      ?? 'https://api.devnet.solana.com';
const TARGET_ENDPOINT = process.env.TARGET_ENDPOINT  ?? 'http://localhost:3000/api/test-content';
const VERIFY_ENDPOINT = process.env.VERIFY_ENDPOINT  ?? 'http://localhost:3000/api/test-content/verify';
const AGENT_GOAL      = process.env.AGENT_GOAL       ?? 'Find and access content about AI trends';
const MAX_PRICE       = parseInt(process.env.MAX_PRICE_USDC ?? '10000', 10);
const USDC_MINT_STR   = process.env.USDC_MINT ?? '';
const PLATFORM_WALLET = process.env.PLATFORM_WALLET_ADDRESS ?? '';

// ── Step 1: Discover content ──────────────────────────────────────────────────

async function discoverContent(): Promise<AxiosResponse> {
  log.section('CONTENT DISCOVERY');
  log.agent(`Goal: ${chalk.white.bold(AGENT_GOAL)}`);
  log.agent(`Discovered URL: ${chalk.underline(TARGET_ENDPOINT)}`);
  log.agent('Making initial GET request…');

  const response = await axios.get(TARGET_ENDPOINT, {
    validateStatus: () => true, // don't throw on 4xx
    headers: {
      'User-Agent': 'ScraperKast-AutonomousAgent/1.0',
      'Accept':     'application/json',
    },
  });

  log.info(`Response status: ${chalk.bold(response.status.toString())}`);
  return response;
}

// ── Step 2: Parse 402 ─────────────────────────────────────────────────────────

function parseChallenge(response: AxiosResponse): PaymentChallenge {
  if (response.status !== 402) {
    throw new Error(`Expected 402, got ${response.status}`);
  }

  // Prefer response body, fall back to headers
  const body    = response.data as {
    pricing?: { amount?: number; currency?: string; wallet?: string; description?: string };
  };
  const pricing = body?.pricing;

  const amount      = pricing?.amount      ?? parseInt(response.headers['x-price-usdc']   ?? '1000', 10);
  const currency    = pricing?.currency    ?? 'USDC';
  const wallet      = pricing?.wallet      ?? (response.headers['x-wallet-address'] as string) ?? PLATFORM_WALLET;
  const description = pricing?.description ?? 'Unknown content';

  log.section('PAYMENT CHALLENGE RECEIVED (402)');
  log.detail('Price:',       `${amount.toLocaleString()} µUSDC ($${(amount / 1_000_000).toFixed(6)})`);
  log.detail('Currency:',    currency);
  log.detail('Wallet:',      wallet);
  log.detail('Content:',     `"${description}"`);
  log.detail('Network:',     response.headers['x-network'] ?? 'devnet');

  return { amount, currency, wallet, description };
}

// ── Step 3: Execute payment ───────────────────────────────────────────────────

async function executePayment(
  connection: Connection,
  challenge: PaymentChallenge,
  usdcMint: PublicKey
): Promise<{ signature: string; elapsedMs: number }> {
  log.section('SOLANA PAYMENT EXECUTION');

  const keypair   = loadKeypair();
  const recipient = new PublicKey(challenge.wallet);

  log.payment(`Sending ${challenge.amount} µUSDC to ${challenge.wallet.slice(0, 12)}…`);
  log.payment('Building SPL-token transfer transaction…');

  const start = Date.now();

  const signature = await transferTokens(
    connection,
    keypair,
    recipient,
    usdcMint,
    challenge.amount
  );

  const elapsedMs = Date.now() - start;

  log.success(`Transaction submitted: ${chalk.yellow(signature)}`);
  log.chain(`⏳ Waiting for on-chain confirmation…`);
  log.success(chalk.green.bold(`✅ Payment confirmed in ${elapsedMs}ms`));
  log.detail('Explorer:', `https://explorer.solana.com/tx/${signature}?cluster=devnet`);

  return { signature, elapsedMs };
}

// ── Step 4: Get access token ──────────────────────────────────────────────────

async function getAccessToken(
  signature: string,
  walletAddress: string
): Promise<string> {
  log.section('ACCESS TOKEN RETRIEVAL');
  log.token(`Submitting tx signature to ScraperKast…`);

  const response = await axios.post<{ token: string; message: string }>(
    VERIFY_ENDPOINT,
    { signature, walletAddress },
    { headers: { 'Content-Type': 'application/json' } }
  );

  if (!response.data.token) {
    throw new Error('No token in verify response');
  }

  const token = response.data.token;
  log.success(`JWT token received (${token.length} chars)`);
  log.detail('Token preview:', `${token.slice(0, 32)}…`);

  return token;
}

// ── Step 5: Access content ────────────────────────────────────────────────────

async function accessContent(token: string): Promise<string> {
  log.section('AUTHENTICATED CONTENT ACCESS');
  log.content(`Making authenticated GET request…`);
  log.detail('Authorization:', 'Bearer [JWT]');

  const response = await axios.get<{
    success: boolean;
    content: string;
    metadata: Record<string, unknown>;
  }>(TARGET_ENDPOINT, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'User-Agent':    'ScraperKast-AutonomousAgent/1.0',
    },
  });

  const { content, metadata } = response.data;

  log.success(chalk.green.bold(`✅ Content retrieved successfully (HTTP ${response.status})`));
  log.detail('Title:',  String(metadata?.title   ?? 'N/A'));
  log.detail('Author:', String(metadata?.author  ?? 'N/A'));
  log.detail('Date:',   String(metadata?.date    ?? 'N/A'));
  log.content(`Preview: "${content.slice(0, 120)}…"`);

  return content;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function run() {
  const runStart = Date.now();
  log.banner();

  // ── Validate env ──
  if (!USDC_MINT_STR) {
    log.error('USDC_MINT not set. Run `npm run setup` first.');
    process.exit(1);
  }
  if (!PLATFORM_WALLET) {
    log.error('PLATFORM_WALLET_ADDRESS not set. Run `npm run setup` first.');
    process.exit(1);
  }

  const connection = new Connection(SOLANA_RPC, 'confirmed');
  const usdcMint   = new PublicKey(USDC_MINT_STR);
  const keypair    = loadKeypair();

  // ── Show agent identity ──
  log.section('AGENT INITIALISATION');
  log.detail('Wallet address:', keypair.publicKey.toBase58());
  const solBal   = await getSolBalance(connection, keypair.publicKey);
  const tokenBal = await getTokenBalance(connection, keypair.publicKey, usdcMint);
  log.detail('SOL balance:',  `${solBal.toFixed(4)} SOL`);
  log.detail('USDC balance:', `${tokenBal.toLocaleString()} µUSDC ($${(tokenBal / 1_000_000).toFixed(4)})`);
  log.detail('Goal:',         AGENT_GOAL);
  log.detail('Max price:',    `${MAX_PRICE.toLocaleString()} µUSDC`);

  // ── Step 1: Discover ──
  let response: AxiosResponse;
  try {
    response = await discoverContent();
  } catch (err) {
    log.error(`Cannot reach ${TARGET_ENDPOINT}. Is the dashboard running? (npm run dev)`);
    log.error(String(err));
    process.exit(1);
  }

  if (response.status === 200) {
    log.success('Content already accessible — no payment required.');
    return;
  }

  // ── Step 2: Parse challenge ──
  const challenge = parseChallenge(response);

  // ── Step 3: Decide ──
  const decision = logDecision(tokenBal, challenge, AGENT_GOAL, MAX_PRICE);
  if (!decision.proceed) {
    log.agent('Agent decided not to pay. Exiting.');
    process.exit(0);
  }

  // ── Step 4: Pay ──
  const { signature, elapsedMs } = await executePayment(connection, challenge, usdcMint);

  // ── Step 5: Token ──
  const jwt = await getAccessToken(signature, keypair.publicKey.toBase58());

  // ── Step 6: Access ──
  await accessContent(jwt);

  // ── Summary ──
  const totalMs = Date.now() - runStart;
  log.summary(totalMs, challenge.amount, signature);
}

run().catch(err => {
  log.error(`Fatal error: ${String(err)}`);
  console.error(err);
  process.exit(1);
});
