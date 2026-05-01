import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';

const JWT_SECRET      = process.env.JWT_SECRET ?? 'scraperkast-demo-secret-change-in-production';
const ETHEREUM_RPC    = process.env.ETHEREUM_RPC_URL ?? 'https://rpc.sepolia.org';
const PLATFORM_WALLET = process.env.PLATFORM_WALLET_ADDRESS ?? '';

// ── Real HMAC-SHA256 JWT ──────────────────────────────────────────────────────
function createJWT(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body   = Buffer.from(JSON.stringify({
    ...payload,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
  })).toString('base64url');
  const sig = createHmac('sha256', JWT_SECRET)
    .update(`${header}.${body}`)
    .digest('base64url');
  return `${header}.${body}.${sig}`;
}

// ── Ethereum JSON-RPC helpers (no ethers dependency in dashboard) ─────────────

interface EthTxReceipt {
  status: string;           // '0x1' = success, '0x0' = reverted
  transactionHash: string;
  blockNumber: string;
  from: string;
  to: string;
  gasUsed: string;
}

async function getTransactionReceipt(
  txHash: string,
  rpcUrl: string
): Promise<EthTxReceipt | null> {
  const res = await fetch(rpcUrl, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id:      1,
      method:  'eth_getTransactionReceipt',
      params:  [txHash],
    }),
  });

  if (!res.ok) {
    throw new Error(`RPC HTTP error ${res.status}`);
  }

  const json = await res.json() as { result: EthTxReceipt | null; error?: { message: string } };

  if (json.error) {
    throw new Error(`RPC error: ${json.error.message}`);
  }

  return json.result;
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
      { status: 400 }
    );
  }

  // Normalise: ensure 0x prefix
  const normalised = txHash.startsWith('0x') ? txHash : `0x${txHash}`;

  // ── Verify transaction on Ethereum ────────────────────────────────────────
  let confirmed = false;
  let receipt:  EthTxReceipt | null = null;
  let attempts  = 0;

  while (!confirmed && attempts < 6) {
    try {
      receipt = await getTransactionReceipt(normalised, ETHEREUM_RPC);

      if (receipt !== null) {
        if (receipt.status !== '0x1') {
          return NextResponse.json(
            {
              error:  'Transaction reverted on-chain',
              txHash: normalised,
              status: receipt.status,
            },
            { status: 402 }
          );
        }
        confirmed = true;
      } else {
        // Not yet indexed — back off and retry
        await new Promise(r => setTimeout(r, 2000));
        attempts++;
      }
    } catch (err) {
      console.error('[test-content-eth/verify] RPC error:', err);
      await new Promise(r => setTimeout(r, 2000));
      attempts++;
    }
  }

  if (!confirmed) {
    return NextResponse.json(
      {
        error:   'Transaction not confirmed',
        message: 'Could not find a confirmed receipt. Please wait a moment and retry.',
        txHash:  normalised,
      },
      { status: 404 }
    );
  }

  // ── Issue access token ────────────────────────────────────────────────────
  const token = createJWT({
    sub:             'agent',
    walletAddress:   walletAddress ?? receipt?.from ?? 'unknown',
    txHash:          normalised,
    platformWallet:  PLATFORM_WALLET,
    accessLevel:     'standard',
    network:         'ethereum',
    chain:           'sepolia',
    executionLayer:  'keeperhub',
    blockNumber:     receipt?.blockNumber,
  });

  console.log(
    `[ScraperKast] ✅ Ethereum payment verified. Token issued. ` +
    `tx=${normalised.slice(0, 18)}… block=${receipt?.blockNumber}`
  );

  return NextResponse.json({
    success:   true,
    token,
    expiresIn: 3600,
    message:   'Ethereum payment verified. Access token issued.',
    meta: {
      txHash:      normalised,
      blockNumber: receipt?.blockNumber,
      network:     'sepolia',
      gasUsed:     receipt?.gasUsed,
    },
  });
}
