import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http, parseAbi, type Address } from 'viem';
import { baseSepolia, sepolia } from 'viem/chains';
import { getNetworkConfig } from '@/lib/config';
import { prisma } from '@/lib/prisma';

// ── POST /api/payment/verify ──────────────────────────────────────────────────
//
// Verifies a blockchain transaction (testnet!) and marks the DB record verified.
// Called by middleware — NO Supabase auth.
//
// Body: { txHash, network, expectedAmount, expectedRecipient, siteId? }

// ERC-20 Transfer event ABI (subset — only what we need)
const ERC20_ABI = parseAbi([
  'event Transfer(address indexed from, address indexed to, uint256 value)',
]);

function getViemChain(network: string) {
  if (network === 'base-sepolia') return baseSepolia;
  if (network === 'sepolia')      return sepolia;
  throw new Error(`Unsupported network: ${network}`);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      txHash:             string;
      network:            string;
      expectedAmount:     number;  // USDC amount (human-readable, e.g. 0.05)
      expectedRecipient:  string;  // Wallet address that should receive payment
      siteId?:            string;  // Optional — update DB record if provided
    };

    const { txHash, network, expectedAmount, expectedRecipient, siteId } = body;

    // ── Input validation ──────────────────────────────────────────────────────

    if (!txHash || !network || expectedAmount === undefined || !expectedRecipient) {
      return NextResponse.json(
        { error: 'Missing required fields: txHash, network, expectedAmount, expectedRecipient' },
        { status: 400 },
      );
    }

    // ── Resolve network config (all values from env) ──────────────────────────

    const networkCfg = getNetworkConfig(network); // throws if unknown network

    // ── Create viem public client (testnet RPC from env) ─────────────────────

    const client = createPublicClient({
      chain:     getViemChain(network),
      transport: http(networkCfg.rpc),
    });

    // ── Fetch transaction receipt ─────────────────────────────────────────────

    const receipt = await client.getTransactionReceipt({ hash: txHash as `0x${string}` });

    if (!receipt) {
      return NextResponse.json({ verified: false, error: 'Transaction not found or not mined yet' }, { status: 404 });
    }

    if (receipt.status !== 'success') {
      return NextResponse.json({ verified: false, error: 'Transaction reverted' }, { status: 400 });
    }

    // ── Decode ERC-20 Transfer logs ───────────────────────────────────────────
    //
    // We look for a Transfer(from, to, value) where:
    //   to    = expectedRecipient  (normalised to lowercase)
    //   token = USDC contract on the given network

    const usdcAddress = networkCfg.usdc.toLowerCase() as Address;
    // USDC uses 6 decimals
    const expectedRaw = BigInt(Math.round(expectedAmount * 1_000_000));

    let paymentVerified = false;

    for (const log of receipt.logs) {
      // Filter: must be from the USDC contract on this network
      if (log.address.toLowerCase() !== usdcAddress) continue;

      try {
        const { decodeEventLog } = await import('viem');
        const decoded = decodeEventLog({
          abi:    ERC20_ABI,
          data:   log.data,
          topics: log.topics,
        });

        if (decoded.eventName !== 'Transfer') continue;

        const { to, value } = decoded.args as { from: Address; to: Address; value: bigint };

        if (
          to.toLowerCase()     === expectedRecipient.toLowerCase() &&
          value                >= expectedRaw // allow slight over-payment
        ) {
          paymentVerified = true;
          break;
        }
      } catch {
        // Log decoding failed (different event) — skip
        continue;
      }
    }

    // ── Update DB record if siteId is provided ────────────────────────────────

    if (siteId && paymentVerified) {
      try {
        await prisma.transaction.update({
          where: { txHash },
          data: {
            verified:    true,
            blockNumber: Number(receipt.blockNumber),
          },
        });
      } catch {
        // DB update failure should not fail the verification response
        console.warn('[payment/verify] Could not update DB record for txHash', txHash);
      }
    }

    return NextResponse.json({
      verified:    paymentVerified,
      txHash,
      blockNumber: Number(receipt.blockNumber),
      network,
      explorerUrl: `${networkCfg.explorerTxUrl}/${txHash}`,
      timestamp:   new Date().toISOString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[POST /api/payment/verify]', err);
    return NextResponse.json(
      { error: `Failed to verify payment: ${message}` },
      { status: 500 },
    );
  }
}
