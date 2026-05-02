/**
 * GET /api/demo-content
 *
 * Self-contained x402 demo endpoint for ETHGlobal judges.
 *
 * Flow:
 *  • Regular browser  → serves HTML directly (no payment needed)
 *  • Bot / AI agent   → 402 Payment Required with USDC payment instructions
 *  • Bot + proof      → verifies txHash on-chain, serves content on success
 *
 * Recipient address: DEMO_WALLET_ADDRESS env var (or first user's smart wallet).
 * Verified payments are logged to the analytics DB so bots appear in the dashboard.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http, parseAbi } from 'viem';
import { baseSepolia } from 'viem/chains';
import { getNetworkConfig } from '@/lib/config';
import { prisma } from '@/lib/prisma';
import { ensureUserWallet } from '@/lib/wallet/smart-wallet';

export const dynamic = 'force-dynamic';

// ── Constants ─────────────────────────────────────────────────────────────────

const NETWORK    = 'base-sepolia';
const PRICE_USDC = 0.01; // $0.01 per request

const CONTENT_HTML = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Premium AI Research — ScraperKast</title></head>
<body>
  <h1>🧠 Premium AI Research — Daily Insights</h1>
  <article>
    <h2>Autonomous Agent Economy: 2026 State of the Market</h2>
    <p>AI agents now generate 38% of all web traffic. Publishers who adopted
       per-request micropayment infrastructure via HTTP 402 report $12–40/month
       in incremental revenue per high-traffic page.</p>
    <p>Key findings: KeeperHub's x402 execution layer processes 2.4M autonomous
       payments per day with sub-20-second settlement on Base. Uniswap V3 routing
       lets agents pay in any ERC-20 token — ETH, DAI, WETH — with automatic
       conversion to USDC at the recipient.</p>
    <p>ScraperKast is the first middleware platform to combine bot fingerprinting
       (200+ signatures), x402, and Uniswap into a single drop-in library for
       Node.js and Next.js publishers.</p>
  </article>
</body>
</html>`;

// ── Bot detection ─────────────────────────────────────────────────────────────

const BOT_PATTERNS = [
  /GPTBot/i, /ClaudeBot/i, /PerplexityBot/i, /CustomAIBot/i,
  /AIBot/i, /Firecrawl/i, /Diffbot/i, /CCBot/i, /Bytespider/i,
  /Google-Extended/i, /AhrefsBot/i, /SemrushBot/i,
];

function isBot(userAgent: string): boolean {
  return BOT_PATTERNS.some(p => p.test(userAgent));
}

// ── On-chain verification ─────────────────────────────────────────────────────

const TRANSFER_TOPIC =
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef' as const;

interface PaymentResult {
  verified:  boolean;
  method:    'x402' | 'uniswap';
  tokenIn?:  string;  // non-USDC input token address (swap payments only)
}

/**
 * Verify that txHash delivered ≥ PRICE_USDC to recipient on-chain.
 * Works for both:
 *   • x402  — direct ERC-20 USDC transfer from bot to recipient
 *   • uniswap — token swap where Uniswap sends USDC to recipient as output
 *
 * Method is inferred from whether any non-USDC Transfer events appear in
 * the same receipt (i.e. the input token was transferred out of the bot).
 */
async function verifyPayment(txHash: string, recipient: string): Promise<PaymentResult> {
  const networkCfg   = getNetworkConfig(NETWORK);
  const usdcAddress  = networkCfg.usdc.toLowerCase();
  const recipientLow = recipient.toLowerCase();

  try {
    const client = createPublicClient({
      chain:     baseSepolia,
      transport: http(networkCfg.rpc),
    });

    const receipt = await client.getTransactionReceipt({
      hash: txHash as `0x${string}`,
    });

    if (receipt.status !== 'success') return { verified: false, method: 'x402' };

    let usdcFound  = false;
    let tokenIn: string | undefined;

    for (const log of receipt.logs) {
      if (log.topics[0] !== TRANSFER_TOPIC) continue;

      const contractAddr = log.address.toLowerCase();
      const toRaw        = log.topics[2];
      if (!toRaw) continue;
      const toAddr = `0x${toRaw.slice(-40)}`.toLowerCase();

      if (contractAddr === usdcAddress) {
        // USDC Transfer → check it's going to our recipient with ≥ expected amount
        if (toAddr === recipientLow) {
          try {
            const minAmount = BigInt(Math.floor(PRICE_USDC * 1_000_000 * 0.99)); // 1% slippage
            if (BigInt(log.data) >= minAmount) usdcFound = true;
          } catch { /* malformed data */ }
        }
      } else {
        // Non-USDC Transfer → this is the swap input token (e.g. WETH leaving the bot)
        if (!tokenIn) tokenIn = log.address;
      }
    }

    if (!usdcFound) return { verified: false, method: 'x402' };

    // If a non-USDC token was transferred in the same tx, it was a swap payment
    const method: 'x402' | 'uniswap' = tokenIn ? 'uniswap' : 'x402';
    return { verified: true, method, tokenIn };
  } catch (err) {
    console.error('[demo-content] verification error:', err);
    return { verified: false, method: 'x402' };
  }
}

// ── Demo context: recipient wallet + dedicated demo site ──────────────────────
//
// The demo site (id: 'demo_site', url: demo-content.scraperkast.com) is a
// dedicated site owned by DEMO_USER_EMAIL. All bot payments are attributed
// to it, keeping the user's personal sites clean.

const DEMO_USER_EMAIL = process.env.DEMO_USER_EMAIL ?? 'chiragchiru51@gmail.com';
const DEMO_SITE_ID    = 'demo_site'; // fixed — created by seed/migration

type DemoContext = {
  recipientAddress: string;
  userId:           string;
  siteId:           string;
};

async function getDemoContext(): Promise<DemoContext | null> {
  try {
    // 1. Look up the target user by email
    const user = await prisma.user.findFirst({
      where: { email: DEMO_USER_EMAIL },
    });

    if (!user) {
      console.warn(`[demo-content] DEMO_USER_EMAIL "${DEMO_USER_EMAIL}" not found in DB`);
      return null;
    }

    // 2. Auto-provision smart wallet if the user doesn't have one yet
    const wallet = await ensureUserWallet(user.id, prisma);

    // 3. Always use the user's deterministic smart wallet as the payment recipient
    const recipientAddress = wallet.address;

    // 4. Use the dedicated demo site (not the user's first personal site)
    const site = await prisma.site.findUnique({ where: { id: DEMO_SITE_ID } });
    if (!site) {
      console.warn(`[demo-content] demo_site not found in DB — run the seed script`);
      return null;
    }

    return { recipientAddress, userId: user.id, siteId: DEMO_SITE_ID };
  } catch (err) {
    console.error('[demo-content] getDemoContext error:', err);
    return null;
  }
}

// ── Analytics: log verified payment to DB ─────────────────────────────────────

async function logPaymentToDb(
  txHash:    string,
  userAgent: string,
  ctx:       DemoContext,
  payment:   Pick<PaymentResult, 'method' | 'tokenIn'>,
): Promise<void> {
  if (!ctx.siteId || !ctx.userId) {
    console.warn('[demo-content] Skipping analytics — no siteId/userId in context');
    return;
  }

  try {
    // Parse bot name from UA: "CustomAIBot/1.0 (Research Agent)" → "CustomAIBot"
    const botName = userAgent.match(/^([A-Za-z0-9\-\.]+)/)?.[1] ?? 'CustomAIBot';
    const botId   = botName.toLowerCase();

    // Transaction is @unique on txHash — upsert so duplicate proofs are no-ops
    await prisma.transaction.upsert({
      where:  { txHash },
      create: {
        siteId:    ctx.siteId,
        botId,
        botName,
        userAgent,
        method:    payment.method,           // 'x402' or 'uniswap'
        amount:    PRICE_USDC,
        currency:  'USDC',
        tokenIn:   payment.tokenIn ?? null,  // input token address for swaps
        network:   NETWORK,
        txHash,
        verified:  true,
        path:      '/api/demo-content',
      },
      update: {}, // idempotent — nothing to change on replay
    });

    // WalletTransaction — credit revenue to the site owner's balance
    const existing = await prisma.walletTransaction.findFirst({ where: { txHash } });
    if (!existing) {
      await prisma.walletTransaction.create({
        data: {
          userId:    ctx.userId,
          type:      'revenue',
          amount:    PRICE_USDC,
          network:   NETWORK,
          txHash,
          verified:  true,
          toAddress: ctx.recipientAddress || undefined,
          siteId:    ctx.siteId,
          status:    'confirmed',
        },
      });

      // Increment custodial balance for the site owner
      await prisma.user.update({
        where: { id: ctx.userId },
        data:  { balance: { increment: PRICE_USDC } },
      });
    }

    console.log(
      `[demo-content] 📊 Analytics logged: bot=${botName} site=${ctx.siteId} ` +
      `user=${ctx.userId} amount=${PRICE_USDC} USDC`,
    );
  } catch (err) {
    // Non-fatal — content is still served even if analytics fail
    console.error('[demo-content] Analytics logging failed (non-fatal):', err);
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const userAgent   = request.headers.get('user-agent') ?? '';
  const proofHeader = request.headers.get('x-payment-proof');

  // ── Regular browser — no payment needed ──────────────────────────────────
  if (!isBot(userAgent)) {
    return new NextResponse(CONTENT_HTML, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  // Resolve who receives the payment (runs once per bot request)
  const ctx        = await getDemoContext();
  const recipient  = ctx?.recipientAddress ?? '';
  const networkCfg = getNetworkConfig(NETWORK);

  // ── Bot with payment proof — verify and serve ─────────────────────────────
  if (proofHeader) {
    const txHash = proofHeader.replace(/^base-sepolia:/, '').trim();

    if (!recipient) {
      return NextResponse.json(
        { error: 'Demo wallet not configured — set DEMO_USER_EMAIL or DEMO_WALLET_ADDRESS in .env.local' },
        { status: 500 },
      );
    }

    const payment = await verifyPayment(txHash, recipient);

    if (payment.verified) {
      console.log(
        `[demo-content] ✅ Payment verified. method=${payment.method} ` +
        `tokenIn=${payment.tokenIn ?? 'USDC'} txHash=${txHash}`,
      );
      // Fire-and-forget analytics — non-blocking, content served regardless
      if (ctx) void logPaymentToDb(txHash, userAgent, ctx, payment);
      return new NextResponse(
        CONTENT_HTML.replace(
          '</article>',
          `  <p><strong>✅ Payment verified — tx: <a href="https://sepolia.basescan.org/tx/${txHash}">${txHash.slice(0, 12)}…</a></strong></p>\n</article>`,
        ),
        { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
      );
    }

    return NextResponse.json(
      { error: 'Payment verification failed', txHash },
      { status: 402 },
    );
  }

  // ── Bot without payment — return 402 with both payment options ───────────
  // WETH estimate: $0.01 ÷ ~$3,000/ETH = 0.00000333 WETH + 5% buffer ≈ 0.0000035
  const WETH_ADDRESS = '0x4200000000000000000000000000000000000006';
  const WETH_ESTIMATED = '0.0000035'; // ~$0.01 worth at current prices

  return NextResponse.json(
    {
      error:   'Payment Required',
      code:    402,
      message: `This content requires a payment of ${PRICE_USDC} USDC`,
      payment_options: [
        // ── Option 1: direct USDC transfer (x402) ──────────────────────────
        {
          method:        'x402',
          network:       NETWORK,
          chain_id:      networkCfg.chainId,
          price:         PRICE_USDC,
          currency:      'USDC',
          token_address: networkCfg.usdc,
          recipient:     recipient || 'NOT_CONFIGURED — set DEMO_USER_EMAIL in .env.local',
          instructions:  {
            step_1: `Send exactly ${PRICE_USDC} USDC to the recipient address on ${NETWORK}`,
            step_2: 'Retry with header: X-Payment-Proof: <txHash>',
            step_3: 'Content is served after on-chain verification',
          },
        },
        // ── Option 2: Uniswap token swap → USDC (any ERC-20 input) ─────────
        {
          method:      'uniswap',
          network:     NETWORK,
          chain_id:    networkCfg.chainId,
          price:       PRICE_USDC,
          currency:    'USDC',
          recipient,
          swap_router: networkCfg.uniswapRouter,
          fee_tier:    3000, // 0.3% — standard WETH/USDC pool
          accepted_tokens: [
            {
              symbol:           'WETH',
              address:          WETH_ADDRESS,
              decimals:         18,
              estimated_amount: WETH_ESTIMATED,
            },
          ],
          instructions: {
            step_1: `Approve WETH spend on the swap_router`,
            step_2: `Call exactOutputSingle: WETH → USDC, amountOut=${PRICE_USDC * 1_000_000} (6 dec), recipient=<above>`,
            step_3: 'Retry with header: X-Payment-Proof: <txHash>',
            step_4: 'Server verifies USDC Transfer event to recipient in tx logs',
          },
        },
      ],
      explorer: networkCfg.explorerUrl,
    },
    {
      status: 402,
      headers: {
        'X-Payment-Method':   'x402',
        'X-Payment-Price':    String(PRICE_USDC),
        'X-Payment-Currency': 'USDC',
        'X-Payment-Network':  NETWORK,
      },
    },
  );
}
