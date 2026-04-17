import RevenueChart from '@/components/RevenueChart';
import RevenueBotChart from '@/components/RevenueBotChart';
import StatCard from '@/components/StatCard';
import { formatUsdcDollar } from '@/lib/formatters';
import type { DailyPoint } from '@/lib/mockData';

async function getRevenueData() {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3001';
  const res  = await fetch(`${base}/api/dashboard/revenue?period=30`, { cache: 'no-store' });
  return res.json() as Promise<{
    daily:   DailyPoint[];
    byBot:   { name: string; revenue: number }[];
    totals:  { total: number; ownerShare: number; platformFees: number; avgPerDay: number };
  }>;
}

export default async function RevenuePage() {
  const { daily, byBot, totals } = await getRevenueData();

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-ink">Revenue</h1>
        <p className="text-sm text-ink-2 mt-0.5">USDC earnings from AI bot access fees</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total (30d)"      value={formatUsdcDollar(totals.total)}        accent />
        <StatCard title="Your Earnings"    value={formatUsdcDollar(totals.ownerShare)}   sub="95% split" />
        <StatCard title="Platform Fees"    value={formatUsdcDollar(totals.platformFees)} sub="5% split" />
        <StatCard title="Avg / Day"        value={formatUsdcDollar(totals.avgPerDay)} />
      </div>

      <div className="card p-5">
        <h2 className="text-sm font-semibold text-ink mb-4">Daily Revenue (Last 30 days)</h2>
        <RevenueChart data={daily} />
      </div>

      <div className="card p-5">
        <h2 className="text-sm font-semibold text-ink mb-4">Revenue by Bot</h2>
        <RevenueBotChart data={byBot} />
      </div>

      <div className="card p-5">
        <h2 className="text-sm font-semibold text-ink mb-3">Revenue Split</h2>
        <div className="flex items-center gap-4">
          <div className="flex-1 bg-canvas rounded-lg p-4 text-center">
            <p className="text-xs text-ink-2 mb-1">Website Owner (95%)</p>
            <p className="text-lg font-bold text-brand-dark">{formatUsdcDollar(totals.ownerShare)}</p>
          </div>
          <div className="text-slate-300 text-xl font-light">+</div>
          <div className="flex-1 bg-canvas rounded-lg p-4 text-center">
            <p className="text-xs text-ink-2 mb-1">ScraperKast Platform (5%)</p>
            <p className="text-lg font-bold text-ink-2">{formatUsdcDollar(totals.platformFees)}</p>
          </div>
          <div className="text-slate-300 text-xl font-light">=</div>
          <div className="flex-1 bg-emerald-50 rounded-lg p-4 text-center">
            <p className="text-xs text-ink-2 mb-1">Total Collected</p>
            <p className="text-lg font-bold text-emerald-700">{formatUsdcDollar(totals.total)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
