import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// ── GET /api/sites/[siteId]/revenue/stats ────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { siteId: string } },
) {
  try {
    // Supabase auth (same pattern as existing routes)
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Verify site exists
    const site = await prisma.site.findUnique({ where: { id: params.siteId } });
    if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 });

    // All verified transactions for this site
    const transactions = await prisma.transaction.findMany({
      where: { siteId: params.siteId, verified: true },
      orderBy: { createdAt: 'desc' },
    });

    // ── Totals ────────────────────────────────────────────────────────────────

    const totalEarnings = transactions.reduce((s, tx) => s + tx.amount, 0);

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonthEarnings = transactions
      .filter(tx => new Date(tx.createdAt) >= startOfMonth)
      .reduce((s, tx) => s + tx.amount, 0);

    // ── Payment methods breakdown ─────────────────────────────────────────────

    const methodBreakdown = (['x402', 'uniswap', 'direct'] as const).reduce(
      (acc, method) => {
        const subset = transactions.filter(tx => tx.method === method);
        acc[method] = {
          amount: parseFloat(subset.reduce((s, tx) => s + tx.amount, 0).toFixed(6)),
          count:  subset.length,
        };
        return acc;
      },
      {} as Record<string, { amount: number; count: number }>,
    );

    // ── Top paying bots ───────────────────────────────────────────────────────

    const botMap = new Map<string, { botId: string; botName: string; amount: number; count: number }>();
    for (const tx of transactions) {
      const entry = botMap.get(tx.botId) ?? { botId: tx.botId, botName: tx.botName, amount: 0, count: 0 };
      entry.amount += tx.amount;
      entry.count  += 1;
      botMap.set(tx.botId, entry);
    }
    const topBots = Array.from(botMap.values())
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5)
      .map(b => ({ ...b, amount: parseFloat(b.amount.toFixed(6)) }));

    // ── Revenue trend — last 30 days, grouped by date ─────────────────────────

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const dailyMap = new Map<string, number>();
    for (const tx of transactions) {
      if (new Date(tx.createdAt) < thirtyDaysAgo) continue;
      const date = new Date(tx.createdAt).toISOString().split('T')[0];
      dailyMap.set(date, (dailyMap.get(date) ?? 0) + tx.amount);
    }
    const revenueTrend = Array.from(dailyMap.entries())
      .map(([date, amount]) => ({ date, amount: parseFloat(amount.toFixed(6)) }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // ── Network breakdown ─────────────────────────────────────────────────────

    const networkMap = new Map<string, { amount: number; count: number }>();
    for (const tx of transactions) {
      const entry = networkMap.get(tx.network) ?? { amount: 0, count: 0 };
      entry.amount += tx.amount;
      entry.count  += 1;
      networkMap.set(tx.network, entry);
    }
    const byNetwork = Object.fromEntries(
      Array.from(networkMap.entries()).map(([net, v]) => [
        net,
        { amount: parseFloat(v.amount.toFixed(6)), count: v.count },
      ]),
    );

    return NextResponse.json({
      totalEarnings:           parseFloat(totalEarnings.toFixed(6)),
      thisMonthEarnings:       parseFloat(thisMonthEarnings.toFixed(6)),
      totalTransactions:       transactions.length,
      averagePerTransaction:   transactions.length > 0
        ? parseFloat((totalEarnings / transactions.length).toFixed(6))
        : 0,
      paymentMethods:  methodBreakdown,
      topBots,
      revenueTrend,
      byNetwork,
    });
  } catch (err) {
    console.error('[GET /api/sites/[siteId]/revenue/stats]', err);
    return NextResponse.json({ error: 'Failed to fetch revenue stats' }, { status: 500 });
  }
}
