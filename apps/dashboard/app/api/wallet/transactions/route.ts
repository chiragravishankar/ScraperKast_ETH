/**
 * GET /api/wallet/transactions
 *
 * Returns paginated WalletTransactions for the authenticated user.
 * Supports optional filter by type: "revenue" | "deposit" | "withdrawal"
 *
 * Query params: page (default 1), limit (default 20, max 100), type
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    // ── Auth ──────────────────────────────────────────────────────────────────
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ── Parse query params ────────────────────────────────────────────────────
    const { searchParams } = new URL(req.url);
    const page  = Math.max(1, parseInt(searchParams.get('page')  ?? '1',  10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)));
    const type  = searchParams.get('type'); // "revenue" | "deposit" | "withdrawal" | null/all

    // ── Build where clause ────────────────────────────────────────────────────
    const where = {
      userId: user.id,
      ...(type && type !== 'all' ? { type } : {}),
    };

    // ── Parallel fetch ────────────────────────────────────────────────────────
    const [transactions, total] = await Promise.all([
      prisma.walletTransaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip:    (page - 1) * limit,
        take:    limit,
      }),
      prisma.walletTransaction.count({ where }),
    ]);

    return NextResponse.json({
      transactions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext:    page * limit < total,
        hasPrev:    page > 1,
      },
    });
  } catch (err) {
    console.error('[GET /api/wallet/transactions]', err);
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
  }
}
