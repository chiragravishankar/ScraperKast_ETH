import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET ?? 'scraperkast-demo-secret-change-in-production';
const PLATFORM_WALLET = process.env.PLATFORM_WALLET_ADDRESS ?? 'PLATFORM_WALLET_NOT_SET';

// ── Minimal real JWT verification ────────────────────────────────────────────
function verifyJWT(token: string): boolean {
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [header, body, sig] = parts;
  const expected = createHmac('sha256', JWT_SECRET)
    .update(`${header}.${body}`)
    .digest('base64url');
  return sig === expected;
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');

  // ── Unauthenticated → 402 Payment Required ───────────────────────────────
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json(
      {
        error:   'Payment Required',
        message: 'This content requires a micropayment to access',
        pricing: {
          amount:      1000, // µUSDC (= $0.001)
          currency:    'USDC',
          wallet:      PLATFORM_WALLET,
          description: 'Latest AI trends and analysis — ScraperKast Research 2026',
        },
        paymentMethods: ['x402', 'uniswap'],
        instructions: {
          step1: 'Transfer exactly 1000 µUSDC to the wallet address above on Base Sepolia',
          step2: `POST /api/test-content/verify with { txHash: "<tx_hash>" }`,
          step3: 'Use returned JWT as Authorization: Bearer <token>',
        },
      },
      {
        status: 402,
        headers: {
          'Content-Type':       'application/json',
          'WWW-Authenticate':   'Bearer realm="ScraperKast"',
          'X-Payment-Required': 'true',
          'X-Price-USDC':       '1000',
          'X-Wallet-Address':   PLATFORM_WALLET,
          'X-Network':          'devnet',
        },
      }
    );
  }

  // ── Authenticated → verify token and serve content ───────────────────────
  const token = authHeader.replace('Bearer ', '');

  if (!verifyJWT(token)) {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
  }

  // Decode payload for logging (no verification needed — already done above)
  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
  } catch { /* ignore */ }

  return NextResponse.json({
    success: true,
    content:
      'AI Trends Report 2026: The rise of autonomous agents in Web3 payment infrastructure. ' +
      'ScraperKast enables a new economy where AI systems autonomously pay for the data they consume, ' +
      'creating sustainable revenue streams for content creators without human intermediaries. ' +
      'Early adopters report $127/day in passive income from bot traffic alone. ' +
      'The protocol uses Ethereum x402 on Base Sepolia and processes payments in under 2s.',
    metadata: {
      title:     'AI Trends 2026',
      author:    'ScraperKast Research',
      date:      '2026-04-21',
      wordCount: 412,
      accessedAt: new Date().toISOString(),
      paidBy:    (payload.walletAddress as string | undefined) ?? 'unknown',
    },
  });
}
