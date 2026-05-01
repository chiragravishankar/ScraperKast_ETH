/**
 * ScraperKast × KeeperHub Autonomous Payment Agent
 *
 * Demonstrates the complete x402 micropayment flow on Ethereum:
 *   discover → 402 → decide → pay via KeeperHub → JWT → access
 *
 * ETHGlobal hackathon submission — ScraperKast payment rail integration
 *
 * Run:  npm start
 * Setup first: npm run setup
 */

import 'dotenv/config';
import axios, { type AxiosResponse } from 'axios';
import { ethers } from 'ethers';
import chalk from 'chalk';
import { log } from './logger.js';
import { loadWallet, getEthBalance, getUsdcBalance } from './wallet.js';
import { KeeperHubClient } from './keeperhub.js';
import { logDecision, type PaymentChallenge } from './decision.js';

// ── Config ────────────────────────────────────────────────────────────────────

const ETHEREUM_RPC    = process.env.ETHEREUM_RPC_URL    ?? 'https://rpc.sepolia.org';
const TARGET_ENDPOINT = process.env.TARGET_ENDPOINT     ?? 'http://localhost:3001/api/test-content-eth';
const VERIFY_ENDPOINT = process.env.VERIFY_ENDPOINT     ?? 'http://localhost:3001/api/test-content-eth/verify';
const AGENT_GOAL      = process.env.AGENT_GOAL          ?? 'Find and access content about AI trends';
const MAX_PRICE       = parseInt(process.env.MAX_PRICE_USDC ?? '10000', 10);
const USDC_CONTRACT   = process.env.USDC_CONTRACT       ?? '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';
const PLATFORM_WALLET = process.env.PLATFORM_WALLET_ADDRESS ?? '';

// ── Step 1: Discover content ──────────────────────────────────────────────────

async function discoverContent(): Promise<AxiosResponse> {
  log.section('CONTENT DISCOVERY');
  log.agent(`Goal: ${chalk.white.bold(AGENT_GOAL)}`);
  log.agent(`Discovered URL: ${chalk.underline(TARGET_ENDPOINT)}`);
  log.agent('Making initial GET request…');

  const response = await axios.get(TARGET_ENDPOINT, {
    validateStatus: () => true, // never throw on 4xx
    headers: {
      'User-Agent': 'ScraperKast-KeeperHub-Agent/1.0',
      'Accept':     'application/json',
      'X-Agent':    'autonomous',
    },
  });

  log.info(`Response status: ${chalk.bold(response.status.toString())}`);
  return response;
}

// ── Step 2: Parse 402 Payment Required ───────────────────────────────────────

function parseChallenge(response: AxiosResponse): PaymentChallenge {
  if (response.status !== 402) {
    throw new Error(`Expected 402, got ${response.status}`);
  }

  const body    = response.data as {
    pricing?: {
      amount?:      number;
      currency?:    string;
      wallet?:      string;
      description?: string;
      network?:     string;
    };
  };
  const pricing = body?.pricing;

  const amount      = pricing?.amount      ?? parseInt(response.headers['x-price-usdc'] ?? '1000', 10);
  const currency    = pricing?.currency    ?? 'USDC';
  const wallet      = pricing?.wallet      ?? (response.headers['x-wallet-address'] as string) ?? PLATFORM_WALLET;
  const description = pricing?.description ?? 'Unknown content';
  const network     = pricing?.network     ?? (response.headers['x-network'] as string) ?? 'ethereum';

  log.section('PAYMENT CHALLENGE RECEIVED (402)');
  log.detail('Protocol:',      response.headers['x-payment-protocol'] as string ?? 'x402');
  log.detail('Price:',         `${amount.toLocaleString()} µUSDC ($${(amount / 1_000_000).toFixed(6)})`);
  log.detail('Currency:',      currency);
  log.detail('Wallet:',        wallet);
  log.detail('Content:',       `"${description}"`);
  log.detail('Network:',       network);
  log.detail('Chain:',         response.headers['x-chain'] as string ?? 'sepolia');
  log.detail('Exec layer:',    response.headers['x-execution-layer'] as string ?? 'keeperhub');

  return { amount, currency, wallet, description, network };
}

// ── Step 3: Execute payment via KeeperHub ─────────────────────────────────────

async function executePayment(
  wallet:    ethers.Wallet,
  challenge: PaymentChallenge,
  keeper:    KeeperHubClient
): Promise<{ txHash: string; executionId: string; elapsedMs: number }> {
  log.section('ETHEREUM PAYMENT EXECUTION (KEEPERHUB)');
  log.payment(`Amount:     ${challenge.amount} µUSDC ($${(challenge.amount / 1_000_000).toFixed(6)})`);
  log.payment(`Recipient:  ${challenge.wallet}`);
  log.payment(`Mode:       ${keeper.mode === 'keeperhub' ? '🔧 KeeperHub relay' : '⚡ Direct on-chain'}`);

  const result = await keeper.executePayment(
    wallet,
    challenge.wallet,
    BigInt(challenge.amount),
    USDC_CONTRACT
  );

  log.success(chalk.green.bold(`✅ Payment confirmed in ${result.elapsedMs}ms`));
  log.detail('Tx hash:',      result.txHash);
  log.detail('Execution ID:', result.executionId);
  log.detail('Mode:',         result.mode);

  const explorerBase = 'https://sepolia.etherscan.io/tx/';
  log.detail('Explorer:', `${explorerBase}${result.txHash}`);

  return {
    txHash:      result.txHash,
    executionId: result.executionId,
    elapsedMs:   result.elapsedMs,
  };
}

// ── Step 4: Get access token ──────────────────────────────────────────────────

async function getAccessToken(
  txHash:        string,
  walletAddress: string
): Promise<string> {
  log.section('ACCESS TOKEN RETRIEVAL');
  log.token('Submitting tx hash to ScraperKast for verification…');

  const response = await axios.post<{ token: string; message: string }>(
    VERIFY_ENDPOINT,
    { txHash, walletAddress },
    { headers: { 'Content-Type': 'application/json' } }
  );

  if (!response.data.token) {
    throw new Error('No token in verify response');
  }

  const token = response.data.token;
  log.success(`JWT token received (${token.length} chars)`);
  log.detail('Token preview:', `${token.slice(0, 36)}…`);

  return token;
}

// ── Step 5: Access content ────────────────────────────────────────────────────

async function accessContent(token: string): Promise<string> {
  log.section('AUTHENTICATED CONTENT ACCESS');
  log.content('Making authenticated GET request with JWT…');

  const response = await axios.get<{
    success:  boolean;
    content:  string;
    metadata: Record<string, unknown>;
  }>(TARGET_ENDPOINT, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'User-Agent':    'ScraperKast-KeeperHub-Agent/1.0',
    },
  });

  const { content, metadata } = response.data;

  log.success(chalk.green.bold(`✅ Content retrieved successfully (HTTP ${response.status})`));
  log.detail('Title:',          String(metadata?.title          ?? 'N/A'));
  log.detail('Author:',         String(metadata?.author         ?? 'N/A'));
  log.detail('Date:',           String(metadata?.date           ?? 'N/A'));
  log.detail('Exec layer:',     String(metadata?.executionLayer ?? 'N/A'));
  log.content(`Preview: "${content.slice(0, 120)}…"`);

  return content;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function run() {
  const runStart = Date.now();
  log.banner();

  // ── Validate env ────────────────────────────────────────────────────────────
  if (!PLATFORM_WALLET) {
    log.error('PLATFORM_WALLET_ADDRESS not set. Run `npm run setup` first and edit .env.');
    process.exit(1);
  }

  // ── Connect provider and wallet ─────────────────────────────────────────────
  const provider = new ethers.JsonRpcProvider(ETHEREUM_RPC);
  const wallet   = loadWallet(provider);
  const keeper   = new KeeperHubClient();

  // ── Show agent identity ─────────────────────────────────────────────────────
  log.section('AGENT INITIALISATION');
  log.detail('Wallet address:', wallet.address);
  log.detail('Network:',        'Ethereum Sepolia');
  log.detail('Exec layer:',     keeper.mode === 'keeperhub' ? 'KeeperHub' : 'Direct (no KeeperHub)');
  log.detail('Goal:',           AGENT_GOAL);
  log.detail('Max price:',      `${MAX_PRICE.toLocaleString()} µUSDC`);

  try {
    const ethBal  = await getEthBalance(wallet);
    const usdcBal = await getUsdcBalance(wallet, USDC_CONTRACT);
    log.detail('ETH balance:',  `${ethers.formatEther(ethBal)} ETH`);
    log.detail('USDC balance:', `${usdcBal.toString()} µUSDC ($${(Number(usdcBal) / 1_000_000).toFixed(4)})`);
  } catch {
    log.info('Could not fetch balances — continuing anyway');
  }

  // ── Step 1: Discover ────────────────────────────────────────────────────────
  let response: AxiosResponse;
  try {
    response = await discoverContent();
  } catch (err) {
    log.error(`Cannot reach ${TARGET_ENDPOINT}. Is the dashboard running?`);
    log.error(`  → cd apps/dashboard && npm run dev`);
    log.error(String(err));
    process.exit(1);
  }

  if (response.status === 200) {
    log.success('Content already accessible — no payment required.');
    return;
  }

  // ── Step 2: Parse challenge ─────────────────────────────────────────────────
  const challenge = parseChallenge(response);

  // ── Step 3: Decide ──────────────────────────────────────────────────────────
  let usdcBalance = 0n;
  try {
    usdcBalance = await getUsdcBalance(wallet, USDC_CONTRACT);
  } catch { /* 0 */ }

  const decision = logDecision(Number(usdcBalance), challenge, AGENT_GOAL, MAX_PRICE);
  if (!decision.proceed) {
    log.agent('Agent decided not to pay. Exiting.');
    process.exit(0);
  }

  // ── Step 4: Pay via KeeperHub ───────────────────────────────────────────────
  const { txHash, executionId, elapsedMs: payMs } = await executePayment(
    wallet,
    challenge,
    keeper
  );

  // ── Step 5: Get JWT ─────────────────────────────────────────────────────────
  const jwt = await getAccessToken(txHash, wallet.address);

  // ── Step 6: Access content ──────────────────────────────────────────────────
  await accessContent(jwt);

  // ── Summary ─────────────────────────────────────────────────────────────────
  const totalMs = Date.now() - runStart;
  log.summary(totalMs, challenge.amount, txHash, executionId);
}

run().catch(err => {
  log.error(`Fatal error: ${String(err)}`);
  console.error(err);
  process.exit(1);
});
