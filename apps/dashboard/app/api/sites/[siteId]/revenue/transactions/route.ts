import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// ── GET /api/sites/[siteId]/revenue/transactions ──────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: { siteId: string } },
) {
  try {
    // Supabase auth
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Verify site exists
    const site = await prisma.site.findUnique({ where: { id: params.siteId } });
    if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 });

    // Parse query params
    const { searchParams } = new URL(req.url);
    const page   = Math.max(1, parseInt(searchParams.get('page')  ?? '1', 10));
    const limit  = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)));
    const method = searchParams.get('method'); // "x402" | "uniswap" | "direct" | null/"all"
    const botId  = searchParams.get('botId');  // filter by specific bot

    // Build where clause
    const where = {
      siteId:   params.siteId,
      verified: true,
      ...(method && method !== 'all' && { method }),
      ...(botId  && botId  !== 'all' && { botId  }),
    };

    // Parallel fetch for data + count
    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip:  (page - 1) * limit,
        take:  limit,
      }),
      prisma.transaction.count({ where }),
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
    console.error('[GET /api/sites/[siteId]/revenue/transactions]', err);
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
  }
}
