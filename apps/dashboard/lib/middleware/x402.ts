/**
 * lib/middleware/x402.ts
 *
 * x402 "Payment Required" middleware for ScraperKast.
 * Run from API route handlers (Node.js runtime) — NOT from Next.js middleware.ts,
 * which runs on the Edge and cannot use Prisma/Node.js APIs.
 *
 * Supports two payment methods:
 *  • x402   — direct USDC transfer, verified via ERC-20 Transfer log
 *  • uniswap — any ERC-20 → USDC swap, verified via Uniswap Transfer logs
 *
 * Flow:
 *  1. Identify bot via User-Agent (fast-path + 205-bot DB)
 *  2. Load site config + bot rules from Prisma (dynamic, no hardcoded values)
 *  3. action=allow  → null (pass through)
 *     action=block  → 403
 *     action=charge →
 *       • No X-Payment-Proof → 402 with both payment options
 *       • Has X-Payment-Proof → auto-detect method, verify on-chain, log, allow
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  createPublicClient, http, parseAbi, decodeEventLog, type Address,
} from 'viem';
import { baseSepolia, sepolia } from 'viem/chains';
import { prisma } from '@/lib/prisma';
import { getNetworkConfig } from '@/lib/config';
import { getBotByUserAgent } from '@/lib/botDatabase';
import { getTokenList } from '@/lib/tokens';
import { ensureUserWallet } from '@/lib/wallet/smart-wallet';

// ── ABI & constants ───────────────────────────────────────────────────────────

const ERC20_ABI = parseAbi([
  'event Transfer(address indexed from, address indexed to, uint256 value)',
]);

// keccak256('Transfer(address,address,uint256)') — used for quick log pre-filter
const TRANSFER_TOPIC =
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef' as const;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface X402Options {
  siteId: string;
}

interface BotInfo {
  isBot:   boolean;
  botId:   string | null;
  botName: string | null;
}

interface VerifyResult {
  verified:     boolean;
  method?:      'x402' | 'uniswap';
  blockNumber?: number;
  usdcReceived?: number;
  tokenIn?:     string;
  amountIn?:    number;
  error?:       string;
}

// ── Bot detection ─────────────────────────────────────────────────────────────

function detectBot(userAgent: string): BotInfo {
  if (!userAgent) return { isBot: false, botId: null, botName: null };

  // Fast-path: check common AI/scraper bots first
  const quickPatterns: Array<[RegExp, string, string]> = [
    [/GPTBot/i,               'gptbot',          'GPTBot'         ],
    [/ChatGPT-User/i,         'chatgpt-user',     'ChatGPT-User'   ],
    [/OAI-SearchBot/i,        'oai-searchbot',    'OAI-SearchBot'  ],
    [/ClaudeBot|Claude-Web/i, 'claudebot',        'ClaudeBot'      ],
    [/Anthropic-AI/i,         'anthropic-ai',     'Anthropic AI'   ],
    [/Firecrawl/i,            'firecrawl',        'Firecrawl'      ],
    [/PerplexityBot/i,        'perplexitybot',    'PerplexityBot'  ],
    [/Google-Extended/i,      'google-extended',  'Google-Extended'],
    [/Bytespider/i,           'bytespider',       'Bytespider'     ],
    [/AhrefsBot/i,            'ahrefsbot',        'AhrefsBot'      ],
    [/SemrushBot/i,           'semrushbot',       'SemrushBot'     ],
    [/Diffbot/i,              'diffbot',          'Diffbot'        ],
    [/CCBot/i,                'ccbot',            'CCBot'          ],
    [/Applebot/i,             'applebot',         'Applebot'       ],
  ];

  for (const [pattern, id, name] of quickPatterns) {
    if (pattern.test(userAgent)) return { isBot: true, botId: id, botName: name };
  }

  // Full 205-bot database fallback
  const dbEntry = getBotByUserAgent(userAgent);
  if (dbEntry) return { isBot: true, botId: dbEntry.id, botName: dbEntry.name };

  return { isBot: false, botId: null, botName: null };
}

// ── Chain helper ──────────────────────────────────────────────────────────────

function getViemChain(network: string) {
  if (network === 'base-sepolia') return baseSepolia;
  if (network === 'sepolia')      return sepolia;
  throw new Error(`Unsupported network: "${network}"`);
}

// ── Payment verification (auto-detects x402 vs Uniswap) ──────────────────────

async function verifyPaymentAuto({
  txHash,
  network,
  expectedAmount,
  expectedRecipient,
}: {
  txHash:            string;
  network:           string;
  expectedAmount:    number;
  expectedRecipient: string;
}): Promise<VerifyResult> {
  try {
    const networkCfg    = getNetworkConfig(network);
    const usdcAddress   = networkCfg.usdc.toLowerCase();
    const recipientLow  = expectedRecipient.toLowerCase();

    const client = createPublicClient({
      chain:     getViemChain(network),
      transport: http(networkCfg.rpc),
    });

    const receipt = await client.getTransactionReceipt({
      hash: txHash as `0x${string}`,
    });

    if (!receipt) {
      return { verified: false, error: 'Transaction not found on blockchain' };
    }
    if (receipt.status !== 'success') {
      return { verified: false, error: 'Transaction reverted on-chain' };
    }

    let usdcReceived   = 0;
    let hasNonUsdcXfer = false;   // true → swap (Uniswap method)
    let tokenInAddress: string | undefined;
    let tokenInAmountWei: bigint | undefined;

    // Scan all Transfer events in the receipt
    for (const log of receipt.logs) {
      if (log.topics[0] !== TRANSFER_TOPIC) continue;
      try {
        const decoded = decodeEventLog({ abi: ERC20_ABI, data: log.data, topics: log.topics });
        if (decoded.eventName !== 'Transfer') continue;

        const { to, value } = decoded.args as { from: Address; to: Address; value: bigint };

        if (log.address.toLowerCase() === usdcAddress) {
          // USDC Transfer — check if it reaches our recipient
          if (to.toLowerCase() === recipientLow) {
            usdcReceived += Number(value) / 1_000_000; // 6 decimals
          }
        } else {
          // Non-USDC Transfer → indicates a swap was involved
          hasNonUsdcXfer = true;
          if (!tokenInAddress) {
            tokenInAddress   = log.address;
            tokenInAmountWei = value;
          }
        }
      } catch {
        // Different event signature — skip
      }
    }

    if (usdcReceived === 0) {
      return { verified: false, error: 'No USDC Transfer to recipient found in logs' };
    }

    // Tolerance: 1% for swaps (Uniswap slippage), tight for direct transfers
    const tolerance = hasNonUsdcXfer
      ? expectedAmount * 0.01
      : expectedAmount * 0.0001;

    if (Math.abs(usdcReceived - expectedAmount) > tolerance) {
      return {
        verified: false,
        error: `Amount mismatch: expected ${expectedAmount} USDC, received ${usdcReceived.toFixed(6)} USDC`,
      };
    }

    return {
      verified:     true,
      method:       hasNonUsdcXfer ? 'uniswap' : 'x402',
      blockNumber:  Number(receipt.blockNumber),
      usdcReceived,
      tokenIn:      tokenInAddress,
      amountIn:     tokenInAmountWei ? Number(tokenInAmountWei) : undefined,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return { verified: false, error: msg };
  }
}

// ── 402 response builder ──────────────────────────────────────────────────────

function build402Response(site: {
  network:       string;
  walletAddress: string | null;
  defaultPrice:  number;
  enableX402:    boolean;
  enableUniswap: boolean;
}, botInfo: BotInfo, price: number, recipientWallet: string): NextResponse {
  const networkCfg      = getNetworkConfig(site.network);
  const supportedTokens = getTokenList(site.network);
  const quoteEndpoint   = `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001'}/api/payment/quote`;
  const keeperEndpoint  = process.env.KEEPERHUB_ENDPOINT ?? 'https://api.keeperhub.com';

  const paymentOptions = [];

  // ── Option 1: KeeperHub x402 (direct USDC) ───────────────────────────────
  if (site.enableX402) {
    paymentOptions.push({
      method:        'x402',
      protocol:      'KeeperHub x402',
      network:       site.network,
      network_name:  networkCfg.name,
      chain_id:      networkCfg.chainId,
      price,
      currency:      'USDC',
      usdc_address:  networkCfg.usdc,
      recipient:     recipientWallet,    // platform hot wallet
      instructions: {
        step_1:          `Send exactly ${price} USDC to the recipient address`,
        step_2:          'Retry this request with header: X-Payment-Proof: <txHash>',
        step_3:          'Balance is credited to the site owner automatically',
        keeper_endpoint: `${keeperEndpoint}/v1/execute`,
        autonomous:      true,
      },
    });
  }

  // ── Option 2: Uniswap V3 (any ERC-20 → USDC) ─────────────────────────────
  if (site.enableUniswap) {
    paymentOptions.push({
      method:           'uniswap',
      protocol:         'Uniswap V3 Swap',
      network:          site.network,
      network_name:     networkCfg.name,
      chain_id:         networkCfg.chainId,
      price,
      currency:         'USDC',
      usdc_address:     networkCfg.usdc,
      supported_tokens: supportedTokens,
      instructions: {
        step_1:          `GET ${quoteEndpoint} with { tokenIn, amountOut: ${price}, network: "${site.network}" }`,
        step_2:          'Approve tokenIn spending to the Uniswap router',
        step_3:          `Execute exactOutputSingle swap so ${price} USDC arrives at recipient`,
        step_4:          'Retry this request with header: X-Payment-Proof: <swapTxHash>',
        quote_endpoint:  quoteEndpoint,
        uniswap_router:  networkCfg.uniswapRouter,
        recipient:       recipientWallet, // platform hot wallet
        autonomous:      true,
      },
    });
  }

  return NextResponse.json(
    {
      error:               'Payment Required',
      code:                402,
      bot:                 botInfo.botName,
      message:             `This content requires a payment of ${price} USDC`,
      payment_options:     paymentOptions,
      retry_instructions:  'Retry with header: X-Payment-Proof: <txHash>',
      explorer_url:        networkCfg.explorerUrl,
    },
    { status: 402 },
  );
}

// ── Main middleware ───────────────────────────────────────────────────────────

/**
 * Returns `null` to allow the request through, or a `NextResponse` to
 * short-circuit with 402 / 403 / 404.
 */
export async function x402Middleware(
  request: NextRequest,
  options: X402Options,
): Promise<NextResponse | null> {
  try {
    // 1. Bot detection
    const userAgent = request.headers.get('user-agent') ?? '';
    const botInfo   = detectBot(userAgent);
    if (!botInfo.isBot) return null;

    // 2. Site + bot-rule lookup
    const site = await prisma.site.findUnique({
      where:   { id: options.siteId },
      include: { botRules: true },
    });

    if (!site) return NextResponse.json({ error: 'Site not configured' }, { status: 404 });
    if (!site.active) return null; // paused → fail open

    // 3. Resolve bot rule
    const rule   = site.botRules.find(r => r.botId === botInfo.botId && r.enabled);
    const action = rule?.action ?? 'charge';
    const price  = rule?.price  ?? site.defaultPrice;

    if (action === 'allow') return null;
    if (action === 'block') {
      return NextResponse.json({ error: 'Bot access denied', bot: botInfo.botName }, { status: 403 });
    }

    // 4. charge — resolve recipient wallet (user's auto-generated smart wallet)
    let recipientWallet: string;
    try {
      const userWallet = await ensureUserWallet(site.userId, prisma);
      recipientWallet  = userWallet.address;
    } catch (walletErr) {
      console.warn(`[x402] Site ${site.id}: could not ensure smart wallet — failing open.`, walletErr);
      return null;
    }

    const paymentProof = request.headers.get('x-payment-proof');
    if (!paymentProof) {
      return build402Response(site, botInfo, price, recipientWallet);
    }

    // 5. Verify payment on-chain (auto-detects x402 vs Uniswap)
    const verification = await verifyPaymentAuto({
      txHash:            paymentProof,
      network:           site.network,
      expectedAmount:    price,
      expectedRecipient: recipientWallet, // platform wallet (or site fallback)
    });

    if (!verification.verified) {
      return NextResponse.json(
        { error: 'Payment verification failed', details: verification.error },
        { status: 402 },
      );
    }

    // 6. Dual-log: site Transaction + WalletTransaction + credit user balance
    try {
      await prisma.$transaction(async tx => {
        // a) Per-site payment record
        await tx.transaction.create({
          data: {
            siteId:      site.id,
            botId:       botInfo.botId!,
            botName:     botInfo.botName!,
            userAgent,
            method:      verification.method ?? 'x402',
            amount:      price,
            currency:    'USDC',
            tokenIn:     verification.tokenIn  ?? null,
            amountIn:    verification.amountIn ?? null,
            network:     site.network,
            txHash:      paymentProof,
            verified:    true,
            blockNumber: verification.blockNumber ?? null,
            path:        request.nextUrl.pathname,
          },
        });

        // b) Platform wallet ledger entry
        await tx.walletTransaction.create({
          data: {
            userId:    site.userId,
            type:      'revenue',
            amount:    price,
            network:   site.network,
            txHash:    paymentProof,
            verified:  true,
            status:    'confirmed',
            siteId:    site.id,
          },
        });

        // c) Credit site owner's balance
        await tx.user.update({
          where: { id: site.userId },
          data:  { balance: { increment: price } },
        });
      });

      console.log(`[x402] ✅ $${price} USDC credited to user ${site.userId} (site: ${site.id})`);
    } catch (logErr: unknown) {
      const code = (logErr as { code?: string }).code;
      if (code === 'P2002') {
        // Duplicate txHash — already logged & credited. Allow through.
      } else {
        console.error('[x402] Failed to log/credit transaction:', logErr);
      }
    }

    // 7. Allow request
    return null;
  } catch (err) {
    // Fail open — never break a site on middleware error
    console.error('[x402] Unhandled error:', err);
    return null;
  }
}
