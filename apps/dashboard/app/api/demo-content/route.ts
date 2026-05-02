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

async function verifyPayment(txHash: string, recipient: string): Promise<boolean> {
  const networkCfg    = getNetworkConfig(NETWORK);
  const usdcAddress   = networkCfg.usdc.toLowerCase();
  const recipientLow  = recipient.toLowerCase();

  try {
    const client = createPublicClient({
      chain:     baseSepolia,
      transport: http(networkCfg.rpc),
    });

    const receipt = await client.getTransactionReceipt({
      hash: txHash as `0x${string}`,
    });

    if (receipt.status !== 'success') return false;

    // Scan Transfer events for USDC sent to our recipient
    const TRANSFER_TOPIC =
      '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef' as const;

    const ERC20_ABI = parseAbi([
      'event Transfer(address indexed from, address indexed to, uint256 value)',
    ]);

    for (const log of receipt.logs) {
      if (log.topics[0] !== TRANSFER_TOPIC) continue;
      if (log.address.toLowerCase() !== usdcAddress) continue;

      try {
        // topic[2] is the `to` address, ABI-encoded (zero-padded to 32 bytes)
        const toRaw = log.topics[2]; // e.g. 0x000...abcdef...
        if (!toRaw) continue;
        const toAddr = `0x${toRaw.slice(-40)}`.toLowerCase();

        if (toAddr === recipientLow) {
          // Confirm amount ≥ expected (6 decimals)
          const minAmount = BigInt(Math.floor(PRICE_USDC * 1_000_000 * 0.99)); // 1% tolerance
          const value = BigInt(log.data);
          if (value >= minAmount) return true;
        }
      } catch {
        // skip malformed log
      }
    }

    return false;
  } catch (err) {
    console.error('[demo-content] verification error:', err);
    return false;
  }
}

// ── Demo context: recipient wallet + site owner ────────────────────────────────
//
// Priority order for the recipient address:
//   1. DEMO_WALLET_ADDRESS env var (explicit override)
//   2. Smart wallet auto-generated for DEMO_USER_EMAIL (default: your account)
//
// Priority order for which DB user gets credited:
//   1. DEMO_USER_EMAIL env var
//   2. Falls back to first site found via DEMO_SITE_ID (legacy)

const DEMO_USER_EMAIL = process.env.DEMO_USER_EMAIL ?? 'chiragchiru51@gmail.com';
const DEMO_SITE_ID_OVERRIDE = process.env.DEMO_SITE_ID ?? '';

type DemoContext = {
  recipientAddress: string;
  userId:           string;
  siteId:           string;
};

async function getDemoContext(): Promise<DemoContext | null> {
  try {
    // 1. Look up the target user by email
    const user = await prisma.user.findFirst({
      where:   { email: DEMO_USER_EMAIL },
      include: { sites: { orderBy: { createdAt: 'asc' }, take: 1 } },
    });

    if (!user) {
      console.warn(`[demo-content] DEMO_USER_EMAIL "${DEMO_USER_EMAIL}" not found in DB`);
      // Last-resort: explicit env vars only
      const addr   = process.env.DEMO_WALLET_ADDRESS ?? '';
      const siteId = DEMO_SITE_ID_OVERRIDE;
      return addr ? { recipientAddress: addr, userId: '', siteId } : null;
    }

    // 2. Auto-provision smart wallet if the user doesn't have one yet
    const wallet = await ensureUserWallet(user.id, prisma);

    // 3. Prefer explicit DEMO_WALLET_ADDRESS override, otherwise use smart wallet
    const recipientAddress =
      process.env.DEMO_WALLET_ADDRESS ?? wallet.address;

    // 4. Use the first site that belongs to this user
    const siteId = DEMO_SITE_ID_OVERRIDE || (user.sites[0]?.id ?? '');

    if (!siteId) {
      console.warn(`[demo-content] User "${DEMO_USER_EMAIL}" has no sites — analytics will be skipped`);
    }

    return { recipientAddress, userId: user.id, siteId };
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
        method:    'x402',
        amount:    PRICE_USDC,
        currency:  'USDC',
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

    const verified = await verifyPayment(txHash, recipient);

    if (verified) {
      console.log(`[demo-content] ✅ Payment verified. txHash=${txHash} ua=${userAgent} recipient=${recipient}`);
      // Fire-and-forget analytics — non-blocking, content served regardless
      if (ctx) void logPaymentToDb(txHash, userAgent, ctx);
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

  // ── Bot without payment — return 402 ─────────────────────────────────────
  return NextResponse.json(
    {
      error:   'Payment Required',
      code:    402,
      message: `This content requires a payment of ${PRICE_USDC} USDC`,
      payment_options: [
        {
          method:        'x402',
          network:       NETWORK,
          chain_id:      networkCfg.chainId,
          price:         PRICE_USDC,
          currency:      'USDC',
          token_address: networkCfg.usdc,
          recipient:     recipient || 'NOT_CONFIGURED — set DEMO_USER_EMAIL in .env.local',
          instructions:  {
            step_1: `Send exactly ${PRICE_USDC} USDC to the recipient address on Base Sepolia`,
            step_2: 'Retry with header: X-Payment-Proof: <txHash>',
            step_3: 'Content is served automatically after on-chain verification',
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
