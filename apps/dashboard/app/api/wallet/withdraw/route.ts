/**
 * POST /api/wallet/withdraw
 *
 * Withdraws USDC from the user's smart wallet to their personal address.
 *
 * Flow:
 *  1. Auth check (Supabase)
 *  2. Resolve Prisma user by email (Supabase UUID ≠ Prisma CUID)
 *  3. Validate amount and destination address
 *  4. Check available balance (balance minus pending withdrawals)
 *  5. Create a pending WalletTransaction (audit trail before chain call)
 *  6. Decrypt smart wallet key + execute on-chain USDC transfer
 *  7. On success → atomic: confirm tx + decrement User.balance
 *  8. On failure → mark tx failed, balance unchanged
 *
 * Body: { amount: number, toAddress: string }
 * Response: { txId, txHash, amount, toAddress }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import {
  ensureUserWallet,
  transferFromSmartWallet,
  validateWithdrawalAmount,
} from '@/lib/wallet/smart-wallet';

export const dynamic = 'force-dynamic';

function isValidEthAddress(addr: string) {
  return /^0x[0-9a-fA-F]{40}$/.test(addr);
}

export async function POST(req: NextRequest) {
  try {
    // ── 1. Auth ───────────────────────────────────────────────────────────────
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ── 2. Resolve Prisma user by email ───────────────────────────────────────
    // Supabase user.id is a UUID; Prisma User.id is a CUID — they don't match.
    // Lookup by email finds the correct row and prevents orphan-user creation.
    const dbUser = await prisma.user.findUnique({
      where:  { email: user.email! },
      select: {
        id:                       true,
        balance:                  true,
        smartWalletEncryptedKey:  true,
        smartWalletAddress:       true,
      },
    });

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // ── 3. Parse + validate body ──────────────────────────────────────────────
    const body = await req.json() as { amount?: unknown; toAddress?: unknown };

    const amount    = typeof body.amount    === 'number' ? body.amount    : parseFloat(String(body.amount ?? ''));
    const toAddress = typeof body.toAddress === 'string' ? body.toAddress.trim() : '';

    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }
    if (!toAddress || !isValidEthAddress(toAddress)) {
      return NextResponse.json({ error: 'Invalid Ethereum address' }, { status: 400 });
    }

    const limitError = validateWithdrawalAmount(amount);
    if (limitError) {
      return NextResponse.json({ error: limitError }, { status: 422 });
    }

    // ── 4. Fetch/provision smart wallet (using Prisma user id) ────────────────
    const wallet = await ensureUserWallet(dbUser.id, prisma);

    if (!dbUser.smartWalletEncryptedKey) {
      return NextResponse.json({ error: 'Smart wallet not found' }, { status: 404 });
    }

    // ── 5. Check available balance ────────────────────────────────────────────
    const pending = await prisma.walletTransaction.aggregate({
      where: { userId: dbUser.id, type: 'withdrawal', status: 'pending' },
      _sum:  { amount: true },
    });
    const pendingAmount    = Number(pending._sum.amount ?? 0);
    const availableBalance = Math.max(0, Number(dbUser.balance) - pendingAmount);

    if (amount > availableBalance) {
      return NextResponse.json(
        { error: `Insufficient balance. Available: $${availableBalance.toFixed(6)} USDC` },
        { status: 422 },
      );
    }

    // ── 6. Create pending transaction record ──────────────────────────────────
    const pendingTx = await prisma.walletTransaction.create({
      data: {
        userId:      dbUser.id,   // Prisma CUID, not Supabase UUID
        type:        'withdrawal',
        amount,
        network:     'base-sepolia',
        fromAddress: wallet.address,
        toAddress,
        status:      'pending',
        verified:    false,
      },
    });

    // ── 7. Execute on-chain transfer from smart wallet ────────────────────────
    let result: Awaited<ReturnType<typeof transferFromSmartWallet>>;
    try {
      result = await transferFromSmartWallet({
        encryptedKey: dbUser.smartWalletEncryptedKey,
        to:           toAddress,
        amount,
        network:      'base-sepolia',
      });
    } catch (chainErr) {
      await prisma.walletTransaction.update({
        where: { id: pendingTx.id },
        data:  { status: 'failed' },
      });
      console.error('[POST /api/wallet/withdraw] chain error', chainErr);
      return NextResponse.json(
        { error: 'On-chain transfer failed. Your balance was not changed.' },
        { status: 502 },
      );
    }

    // ── 8. Atomic: confirm + deduct balance ───────────────────────────────────
    await prisma.$transaction([
      prisma.walletTransaction.update({
        where: { id: pendingTx.id },
        data: {
          status:   'confirmed',
          verified: true,
          txHash:   result.txHash,
        },
      }),
      prisma.user.update({
        where: { id: dbUser.id },   // Prisma CUID, not Supabase UUID
        data:  { balance: { decrement: amount } },
      }),
    ]);

    return NextResponse.json({
      txId:      pendingTx.id,
      txHash:    result.txHash,
      amount,
      toAddress,
    });
  } catch (err) {
    console.error('[POST /api/wallet/withdraw]', err);
    return NextResponse.json({ error: 'Withdrawal failed' }, { status: 500 });
  }
}
