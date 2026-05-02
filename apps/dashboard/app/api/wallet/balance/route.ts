/**
 * GET /api/wallet/balance
 *
 * Returns the authenticated user's wallet balance and smart wallet address.
 * Auto-generates the smart wallet on first call if it doesn't exist yet.
 *
 * Response:
 *   { balance, availableBalance, pendingWithdrawals,
 *     smartWalletAddress, withdrawalAddress, currency }
 *
 * NOTE: Supabase auth user.id (UUID) ≠ Prisma User.id (CUID).
 * We always resolve the Prisma row by email to avoid creating orphan users.
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

    // ── Resolve Prisma user by email ──────────────────────────────────────────
    // Supabase user.id is a UUID; Prisma User.id is a CUID — they don't match.
    // Lookup by email finds the correct row every time.
    const dbUser = await prisma.user.findUnique({
      where:  { email: user.email! },
      select: {
        id:                  true,
        balance:             true,
        withdrawalAddress:   true,
        smartWalletAddress:  true,
      },
    });

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // ── Ensure smart wallet exists (idempotent) ───────────────────────────────
    // Pass the PRISMA user id, not the Supabase UUID
    const wallet = await ensureUserWallet(dbUser.id, prisma);

    // ── Pending withdrawals ───────────────────────────────────────────────────
    const pending = await prisma.walletTransaction.aggregate({
      where: { userId: dbUser.id, type: 'withdrawal', status: 'pending' },
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
