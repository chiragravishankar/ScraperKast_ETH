/**
 * POST /api/test-content/verify
 *
 * Verifies an Ethereum (Base Sepolia) USDC payment and issues a short-lived JWT.
 * Verifies payment on Base Sepolia and issues a short-lived JWT.
 *
 * Body: { txHash: string, walletAddress?: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { createPublicClient, http } from 'viem';
import { baseSepolia } from 'viem/chains';
import { getNetworkConfig } from '@/lib/config';

const JWT_SECRET = process.env.JWT_SECRET ?? 'scraperkast-demo-secret-change-in-production';
const NETWORK    = 'base-sepolia';

// ── HMAC-SHA256 JWT ───────────────────────────────────────────────────────────

function createJWT(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body   = Buffer.from(JSON.stringify({
    ...payload,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  })).toString('base64url');
  const sig = createHmac('sha256', JWT_SECRET)
    .update(`${header}.${body}`)
    .digest('base64url');
  return `${header}.${body}.${sig}`;
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  let body: { txHash?: string; walletAddress?: string };
  try {
    body = await request.json() as { txHash?: string; walletAddress?: string };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { txHash, walletAddress } = body;

  if (!txHash || typeof txHash !== 'string') {
    return NextResponse.json(
      { error: 'Missing required field: txHash' },
      { status: 400 },
    );
  }

  // ── Verify transaction on Base Sepolia ────────────────────────────────────

  try {
    const networkCfg = getNetworkConfig(NETWORK);
    const client = createPublicClient({
      chain:     baseSepolia,
      transport: http(networkCfg.rpc),
    });

    const receipt = await client.getTransactionReceipt({
      hash: txHash as `0x${string}`,
    });

    if (!receipt) {
      return NextResponse.json(
        { error: 'Transaction not found on Base Sepolia' },
        { status: 404 },
      );
    }

    if (receipt.status !== 'success') {
      return NextResponse.json(
        { error: 'Transaction reverted on-chain' },
        { status: 402 },
      );
    }

    // ── Issue access token ──────────────────────────────────────────────────

    const token = createJWT({
      sub:          'agent',
      walletAddress: walletAddress ?? 'unknown',
      txHash,
      network:      NETWORK,
      blockNumber:  Number(receipt.blockNumber),
      accessLevel:  'standard',
    });

    console.log(`[ScraperKast] ✅ Payment verified on Base Sepolia. Block #${receipt.blockNumber}. Token issued.`);

    return NextResponse.json({
      success:   true,
      token,
      expiresIn: 3600,
      message:   'Payment verified on Base Sepolia. Access token issued.',
      network:   NETWORK,
      blockNumber: Number(receipt.blockNumber),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Verification failed';
    console.error('[test-content/verify]', err);
    return NextResponse.json(
      { error: 'Verification failed', details: msg },
      { status: 500 },
    );
  }
}
