#!/usr/bin/env node
/**
 * ScraperKast — Autonomous AI Agent Demo
 *
 * Shows the full x402 payment flow without any human intervention:
 *  1. Request protected content → get HTTP 402
 *  2. Parse payment instructions from 402 response
 *  3. Send USDC on-chain (Base Sepolia)
 *  4. Retry with X-Payment-Proof: <txHash>
 *  5. Receive content
 *
 * Usage:
 *   cp .env.example .env
 *   # fill in BOT_PRIVATE_KEY
 *   npm run demo
 */

require('dotenv').config();

const { createWalletClient, createPublicClient, http, parseUnits } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const { baseSepolia } = require('viem/chains');

// ── Config ────────────────────────────────────────────────────────────────────

const BOT_PRIVATE_KEY = process.env.BOT_PRIVATE_KEY;
const TARGET_URL      = process.env.TARGET_URL || 'http://localhost:3001/api/demo-content';
const RPC_URL         = process.env.BASE_SEPOLIA_RPC || 'https://sepolia.base.org';

const USDC_ABI = [
  {
    name:            'transfer',
    type:            'function',
    stateMutability: 'nonpayable',
    inputs:  [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }],
    outputs: [{ name: '', type: 'bool' }],
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function divider(char = '─', len = 60) {
  return char.repeat(len);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function autonomousAgent() {
  console.log('\n' + divider('═'));
  console.log('  🤖  SCRAPERKAST — AUTONOMOUS AGENT DEMO');
  console.log(divider('═'));
  console.log(`  Agent:   CustomAIBot/1.0 (Research Agent)`);
  console.log(`  Target:  ${TARGET_URL}`);
  console.log(`  Network: Base Sepolia Testnet`);
  console.log(divider('═') + '\n');

  // ── STEP 1: Initial request ───────────────────────────────────────────────
  console.log('📡  STEP 1: Requesting content...');
  console.log(`    GET ${TARGET_URL}\n`);

  let response = await fetch(TARGET_URL, {
    headers: {
      'User-Agent': 'CustomAIBot/1.0 (Research Agent)',
      'Accept':     'application/json, text/html',
    },
  });

  console.log(`    Response: ${response.status} ${response.statusText}`);

  // ── STEP 2: Parse 402 ─────────────────────────────────────────────────────
  if (response.status !== 402) {
    if (response.status === 200) {
      console.log('\n✅  No payment required — content served directly.');
    } else {
      console.error(`\n❌  Unexpected status: ${response.status}`);
    }
    return;
  }

  console.log('\n💳  STEP 2: HTTP 402 Payment Required detected!');
  console.log('    Parsing x402 payment instructions...\n');

  const paymentData = await response.json();
  const option = (paymentData.payment_options ?? []).find(o => o.method === 'x402');

  if (!option) {
    console.error('❌  No x402 option in response:', paymentData);
    process.exit(1);
  }

  const { recipient, price, currency, token_address } = option;

  console.log('    📋 Payment instructions received:');
  console.log(`       Amount:    ${price} ${currency}`);
  console.log(`       Recipient: ${recipient}`);
  console.log(`       Token:     ${token_address}`);
  console.log(`       Network:   ${option.network}\n`);

  // ── STEP 3: Execute payment ───────────────────────────────────────────────
  console.log('⛓️   STEP 3: Executing autonomous on-chain payment...');

  if (!BOT_PRIVATE_KEY) {
    console.error('\n❌  BOT_PRIVATE_KEY is not set.');
    console.error('    Copy .env.example → .env and add your testnet private key.');
    process.exit(1);
  }

  const account = privateKeyToAccount(
    BOT_PRIVATE_KEY.startsWith('0x') ? BOT_PRIVATE_KEY : `0x${BOT_PRIVATE_KEY}`
  );
  console.log(`    From:    ${account.address}`);
  console.log(`    To:      ${recipient}`);

  const walletClient = createWalletClient({
    account,
    chain:     baseSepolia,
    transport: http(RPC_URL),
  });

  const publicClient = createPublicClient({
    chain:     baseSepolia,
    transport: http(RPC_URL),
  });

  const amountWei = parseUnits(String(price), 6); // USDC has 6 decimals

  console.log('\n    📤 Broadcasting USDC transfer...');

  let txHash;
  try {
    txHash = await walletClient.writeContract({
      address:      token_address,
      abi:          USDC_ABI,
      functionName: 'transfer',
      args:         [recipient, amountWei],
    });
  } catch (err) {
    console.error('\n❌  Transaction failed:', err.shortMessage ?? err.message);
    console.error('    Make sure the bot wallet has Base Sepolia USDC.');
    console.error('    Faucet: https://faucet.circle.com');
    process.exit(1);
  }

  console.log(`\n    ✅ Transaction submitted!`);
  console.log(`       Hash: ${txHash}`);
  console.log(`       View: https://sepolia.basescan.org/tx/${txHash}\n`);

  console.log('    ⏳ Waiting for on-chain confirmation (1 block)...');
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  console.log(`    ✅ Confirmed in block ${receipt.blockNumber}!\n`);

  // Short pause so the server has time to index if needed
  await sleep(1500);

  // ── STEP 4: Retry with proof ──────────────────────────────────────────────
  console.log('🔄  STEP 4: Retrying request with payment proof...');
  console.log(`    X-Payment-Proof: ${txHash}\n`);

  response = await fetch(TARGET_URL, {
    headers: {
      'User-Agent':      'CustomAIBot/1.0 (Research Agent)',
      'X-Payment-Proof': txHash,
      'Accept':          'text/html',
    },
  });

  console.log(`    Response: ${response.status} ${response.statusText}\n`);

  // ── STEP 5: Result ────────────────────────────────────────────────────────
  if (response.status === 200) {
    const body = await response.text();

    // Pull the article title out of the HTML
    const titleMatch = body.match(/<h2>(.*?)<\/h2>/s);
    const title      = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '') : 'Content';

    console.log(divider('═'));
    console.log('🎉  SUCCESS — Content retrieved!');
    console.log(divider('═'));
    console.log(`📄  ${title}`);
    console.log(divider());

    // Strip HTML tags for console display
    const text = body
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim()
      .slice(0, 500);
    console.log(text + '…\n');

    console.log(divider('═'));
    console.log('✅  Autonomous payment flow complete!');
    console.log(`💰  Spent: ${price} ${currency}`);
    console.log(`🔗  Tx:    https://sepolia.basescan.org/tx/${txHash}`);
    console.log(divider('═') + '\n');

  } else {
    const body = await response.text();
    console.error(`❌  Failed to retrieve content after payment (${response.status})`);
    console.error(body.slice(0, 400));
    process.exit(1);
  }
}

// ── Entry point ───────────────────────────────────────────────────────────────

autonomousAgent().catch(err => {
  console.error('\n❌  Unhandled error:', err.message ?? err);
  process.exit(1);
});
