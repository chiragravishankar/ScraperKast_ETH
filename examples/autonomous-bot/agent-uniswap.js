#!/usr/bin/env node
/**
 * ScraperKast — Autonomous Agent Demo (Uniswap Multi-Token Payment)
 *
 * Same x402 flow as agent.js, but the bot pays in WETH instead of USDC.
 * Uniswap V3 exactOutputSingle swaps WETH → USDC and delivers the USDC
 * DIRECTLY to the publisher's smart wallet — no intermediate steps.
 *
 * Why this matters:
 *  • Publishers always receive USDC (predictable revenue)
 *  • Bots can pay in any liquid ERC-20 they hold
 *  • Zero extra steps for the publisher — just a Transfer event in the logs
 *
 * Flow:
 *  1. Request content → HTTP 402 with two payment_options
 *  2. Pick the "uniswap" option from the response
 *  3. Approve WETH spend on the Uniswap V3 router
 *  4. Call exactOutputSingle: WETH in, USDC out, recipient = publisher wallet
 *  5. Retry with X-Payment-Proof: <txHash>
 *  6. Server sees the USDC Transfer event → same verification path as x402
 *
 * Usage:
 *   cp .env.example .env
 *   # add BOT_PRIVATE_KEY (wallet needs Base Sepolia ETH + WETH)
 *   npm run demo:uniswap
 */

require('dotenv').config();

const {
  createWalletClient,
  createPublicClient,
  http,
  parseUnits,
  formatUnits,
  parseAbi,
} = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const { baseSepolia } = require('viem/chains');

// ── Config ────────────────────────────────────────────────────────────────────

const BOT_PRIVATE_KEY = process.env.BOT_PRIVATE_KEY;
const TARGET_URL      = process.env.TARGET_URL || 'http://localhost:3001/api/demo-content';
const RPC_URL         = process.env.BASE_SEPOLIA_RPC || 'https://sepolia.base.org';

// ── Uniswap V3 ABIs ───────────────────────────────────────────────────────────

// SwapRouter V3 — exactOutputSingle
// Delivers exact USDC out, variable WETH in, USDC goes straight to `recipient`
const SWAP_ROUTER_ABI = [
  {
    name:            'exactOutputSingle',
    type:            'function',
    stateMutability: 'payable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'tokenIn',           type: 'address' }, // WETH
          { name: 'tokenOut',          type: 'address' }, // USDC
          { name: 'fee',               type: 'uint24'  }, // 3000 = 0.3%
          { name: 'recipient',         type: 'address' }, // publisher wallet
          { name: 'deadline',          type: 'uint256' }, // unix timestamp
          { name: 'amountOut',         type: 'uint256' }, // exact USDC (6 dec)
          { name: 'amountInMaximum',   type: 'uint256' }, // max WETH willing to spend
          { name: 'sqrtPriceLimitX96', type: 'uint160' }, // 0 = no price limit
        ],
      },
    ],
    outputs: [{ name: 'amountIn', type: 'uint256' }],
  },
];

// ERC-20 — approve + allowance + balanceOf
const ERC20_ABI = [
  {
    name:            'approve',
    type:            'function',
    stateMutability: 'nonpayable',
    inputs:  [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name:            'balanceOf',
    type:            'function',
    stateMutability: 'view',
    inputs:  [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function divider(char = '─', len = 60) { return char.repeat(len); }

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Main ──────────────────────────────────────────────────────────────────────

async function autonomousAgentUniswap() {
  console.log('\n' + divider('═'));
  console.log('  🦄  SCRAPERKAST — UNISWAP AUTONOMOUS AGENT DEMO');
  console.log(divider('═'));
  console.log(`  Agent:   CustomAIBot/1.0 (Uniswap Research Agent)`);
  console.log(`  Target:  ${TARGET_URL}`);
  console.log(`  Payment: WETH → USDC via Uniswap V3 exactOutputSingle`);
  console.log(`  Network: Base Sepolia Testnet`);
  console.log(divider('═') + '\n');

  // ── STEP 1: Initial request ───────────────────────────────────────────────
  console.log('📡  STEP 1: Requesting content (expecting 402)...\n');

  const response1 = await fetch(TARGET_URL, {
    headers: {
      'User-Agent': 'CustomAIBot/1.0 (Uniswap Research Agent)',
      'Accept':     'application/json',
    },
  });

  console.log(`    Response: ${response1.status} ${response1.statusText}`);

  if (response1.status !== 402) {
    if (response1.status === 200) {
      console.log('\n✅  No payment required — content served directly.');
    } else {
      console.error(`\n❌  Unexpected status: ${response1.status}`);
    }
    return;
  }

  // ── STEP 2: Parse 402 and pick Uniswap option ─────────────────────────────
  console.log('\n💳  STEP 2: Parsing payment options...\n');

  const paymentData = await response1.json();
  const allOptions = paymentData.payment_options ?? [];

  console.log(`    Available methods: ${allOptions.map(o => o.method).join(', ')}`);

  // Prefer Uniswap, fall back to x402 if Uniswap not offered
  const uniswapOpt = allOptions.find(o => o.method === 'uniswap');
  const x402Opt    = allOptions.find(o => o.method === 'x402');
  const option     = uniswapOpt ?? x402Opt;

  if (!option) {
    console.error('❌  No payment option found in 402 response');
    process.exit(1);
  }

  if (!uniswapOpt) {
    console.warn('    ⚠️  No Uniswap option — falling back to x402 USDC payment');
  }

  const { recipient, price, swap_router, fee_tier, accepted_tokens } = option;
  const wethToken = (accepted_tokens ?? [])[0]; // first accepted = WETH

  console.log('    📋 Payment instructions received:');
  console.log(`       Method:    ${option.method}`);
  console.log(`       Amount:    ${price} USDC (output)`);
  console.log(`       Recipient: ${recipient}`);
  if (uniswapOpt) {
    console.log(`       Router:    ${swap_router}`);
    console.log(`       Fee tier:  ${fee_tier / 10000}%`);
    console.log(`       Pay with:  ${wethToken?.symbol ?? 'WETH'} (~${wethToken?.estimated_amount ?? '0.0000035'})`);
  }
  console.log();

  // ── STEP 3: Set up viem clients ───────────────────────────────────────────
  if (!BOT_PRIVATE_KEY) {
    console.error('❌  BOT_PRIVATE_KEY is not set. Add it to .env');
    process.exit(1);
  }

  const account = privateKeyToAccount(
    BOT_PRIVATE_KEY.startsWith('0x') ? BOT_PRIVATE_KEY : `0x${BOT_PRIVATE_KEY}`,
  );

  const walletClient = createWalletClient({
    account,
    chain:     baseSepolia,
    transport: http(RPC_URL),
  });

  const publicClient = createPublicClient({
    chain:     baseSepolia,
    transport: http(RPC_URL),
  });

  console.log(`    Bot wallet: ${account.address}`);

  let txHash;

  if (uniswapOpt && swap_router && wethToken) {
    // ── STEP 3a: Uniswap swap path ──────────────────────────────────────────
    console.log('\n⛓️   STEP 3: Executing Uniswap V3 exactOutputSingle swap...');
    console.log(`    Swapping WETH → ${price} USDC, USDC delivered to publisher\n`);

    const WETH_ADDRESS    = wethToken.address;
    const USDC_AMOUNT_OUT = parseUnits(String(price), 6);   // exact USDC out (6 dec)
    const DEADLINE        = BigInt(Math.floor(Date.now() / 1000) + 300); // +5 min

    // Slippage: allow up to 2× the estimated WETH input
    const estimatedWeth   = parseUnits(wethToken.estimated_amount ?? '0.0000035', 18);
    const amountInMaximum = estimatedWeth * 2n; // 100% slippage buffer for testnet

    // Check WETH balance
    const wethBalance = await publicClient.readContract({
      address:      WETH_ADDRESS,
      abi:          ERC20_ABI,
      functionName: 'balanceOf',
      args:         [account.address],
    });

    console.log(`    WETH balance: ${formatUnits(wethBalance, 18)} WETH`);
    if (wethBalance < amountInMaximum) {
      console.error(
        `\n❌  Insufficient WETH. Need ~${formatUnits(amountInMaximum, 18)} WETH.` +
        `\n    Wrap ETH on Base Sepolia: https://sepolia.basescan.org/address/${WETH_ADDRESS}`,
      );
      process.exit(1);
    }

    // Approve WETH spending to the router
    console.log(`    📤 Approving WETH spend on router (${swap_router})...`);
    const approveTx = await walletClient.writeContract({
      address:      WETH_ADDRESS,
      abi:          ERC20_ABI,
      functionName: 'approve',
      args:         [swap_router, amountInMaximum],
    });
    await publicClient.waitForTransactionReceipt({ hash: approveTx });
    console.log(`    ✅ Approved!\n`);

    // Execute the swap — USDC lands directly in publisher's wallet
    console.log(`    📤 Calling exactOutputSingle (WETH → ${price} USDC → ${recipient})...`);
    txHash = await walletClient.writeContract({
      address:      swap_router,
      abi:          SWAP_ROUTER_ABI,
      functionName: 'exactOutputSingle',
      args: [{
        tokenIn:           WETH_ADDRESS,
        tokenOut:          option.token_address ?? x402Opt?.token_address,
        fee:               fee_tier ?? 3000,
        recipient,
        deadline:          DEADLINE,
        amountOut:         USDC_AMOUNT_OUT,
        amountInMaximum,
        sqrtPriceLimitX96: 0n,
      }],
    });

  } else {
    // ── STEP 3b: Fallback — direct USDC transfer (x402) ─────────────────────
    console.log('\n⛓️   STEP 3: Executing fallback x402 USDC transfer...');
    const USDC_ADDRESS = x402Opt?.token_address;
    const amountWei    = parseUnits(String(price), 6);

    txHash = await walletClient.writeContract({
      address:      USDC_ADDRESS,
      abi:          [{ name:'transfer', type:'function', stateMutability:'nonpayable',
                       inputs:[{name:'to',type:'address'},{name:'amount',type:'uint256'}],
                       outputs:[{name:'',type:'bool'}] }],
      functionName: 'transfer',
      args:         [recipient, amountWei],
    });
  }

  console.log(`\n    ✅ Transaction submitted!`);
  console.log(`       Hash: ${txHash}`);
  console.log(`       View: https://sepolia.basescan.org/tx/${txHash}\n`);

  console.log('    ⏳ Waiting for on-chain confirmation...');
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  console.log(`    ✅ Confirmed in block ${receipt.blockNumber}!\n`);

  await sleep(1500);

  // ── STEP 4: Retry with payment proof ─────────────────────────────────────
  console.log('🔄  STEP 4: Retrying with payment proof...');
  console.log(`    X-Payment-Proof: ${txHash}\n`);

  const response2 = await fetch(TARGET_URL, {
    headers: {
      'User-Agent':      'CustomAIBot/1.0 (Uniswap Research Agent)',
      'X-Payment-Proof': txHash,
      'Accept':          'text/html',
    },
  });

  console.log(`    Response: ${response2.status} ${response2.statusText}\n`);

  // ── STEP 5: Result ────────────────────────────────────────────────────────
  if (response2.status === 200) {
    const body       = await response2.text();
    const titleMatch = body.match(/<h2>(.*?)<\/h2>/s);
    const title      = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '') : 'Content';
    const text       = body.replace(/<[^>]+>/g, ' ').replace(/\s{2,}/g, ' ').trim().slice(0, 500);

    console.log(divider('═'));
    console.log('🎉  SUCCESS — Content retrieved via Uniswap payment!');
    console.log(divider('═'));
    console.log(`📄  ${title}`);
    console.log(divider());
    console.log(text + '…\n');
    console.log(divider('═'));
    console.log('✅  Uniswap autonomous payment flow complete!');
    console.log(`💱  Path:  WETH → USDC (Uniswap V3 exactOutputSingle)`);
    console.log(`💰  Value: ${price} USDC delivered to publisher`);
    console.log(`🔗  Tx:    https://sepolia.basescan.org/tx/${txHash}`);
    console.log(divider('═') + '\n');
  } else {
    const body = await response2.text();
    console.error(`❌  Failed to retrieve content after payment (${response2.status})`);
    console.error(body.slice(0, 400));
    process.exit(1);
  }
}

// ── Entry point ───────────────────────────────────────────────────────────────

autonomousAgentUniswap().catch(err => {
  console.error('\n❌  Unhandled error:', err.message ?? err);
  process.exit(1);
});
