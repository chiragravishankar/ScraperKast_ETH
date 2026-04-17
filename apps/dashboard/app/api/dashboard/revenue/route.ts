import { NextResponse } from 'next/server';
import { generateDailyRevenue, generateBots } from '@/lib/mockData';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const period = searchParams.get('period') ?? '7d'; // '1d'|'7d'|'30d'|'all'

  const days = period === '1d' ? 1 : period === '30d' ? 30 : period === 'all' ? 90 : 7;
  const daily = generateDailyRevenue(days);
  const bots  = generateBots();

  const totalRevenue = daily.reduce((s, d) => s + d.revenue, 0);
  const ownerShare   = Math.floor(totalRevenue * 0.95);
  const platformFee  = Math.ceil(totalRevenue * 0.05);

  // Revenue per bot (for stacked bar)
  const byBot = bots.map(b => ({
    name:    b.name,
    revenue: b.revenueEarned,
    share:   Math.floor(b.revenueEarned * 0.95),
  }));

  return NextResponse.json({
    daily,
    byBot,
    totals: {
      total:       totalRevenue,
      ownerShare,
      platformFees: platformFee,
      avgPerDay:   days > 0 ? Math.floor(totalRevenue / days) : 0,
    },
  });
}
