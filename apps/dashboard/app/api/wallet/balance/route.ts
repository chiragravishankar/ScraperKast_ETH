/**
 * GET /api/wallet/balance
 *
 * Returns the authenticated user's wallet balance and smart wallet address.
 * Auto-generates the smart wallet on first call if it doesn't exist yet.
 *
 * Response:
 *   { balance, availableBalance, pendingWithdrawals,
 *     smartWalletAddress, withdrawalAddress, currency }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { ensureUserWallet } from '@/lib/wallet/smart-wallet';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest) {
  try {
    // ── Auth ──────────────────────────────────────────────────────────────────
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ── Ensure smart wallet exists (idempotent) ───────────────────────────────
    const wallet = await ensureUserWallet(user.id, prisma);

    // ── Fetch user record ─────────────────────────────────────────────────────
    const dbUser = await prisma.user.findUnique({
      where:  { id: user.id },
      select: { balance: true, withdrawalAddress: true, smartWalletAddress: true },
    });

    if (!dbUser) {
      // Should not happen after ensureUserWallet, but guard anyway
      return NextResponse.json({
        balance:             0,
        availableBalance:    0,
        pendingWithdrawals:  0,
        smartWalletAddress:  wallet.address,
        withdrawalAddress:   null,
        currency:            'USDC',
      });
    }

    // ── Pending withdrawals ───────────────────────────────────────────────────
    const pending = await prisma.walletTransaction.aggregate({
      where: { userId: user.id, type: 'withdrawal', status: 'pending' },
      _sum:  { amount: true },
    });

    const pendingAmount    = Number(pending._sum.amount ?? 0);
    const balance          = Number(dbUser.balance);
    const availableBalance = Math.max(0, balance - pendingAmount);

    return NextResponse.json({
      balance,
      availableBalance,
      pendingWithdrawals:  pendingAmount,
      smartWalletAddress:  dbUser.smartWalletAddress ?? wallet.address,
      withdrawalAddress:   dbUser.withdrawalAddress ?? null,
      currency:            'USDC',
    });
  } catch (err) {
    console.error('[GET /api/wallet/balance]', err);
    return NextResponse.json({ error: 'Failed to fetch balance' }, { status: 500 });
  }
}
