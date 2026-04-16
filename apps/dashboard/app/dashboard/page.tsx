import { Suspense } from 'react';
import { CardSkeleton, ChartSkeleton } from '@/components/LoadingSkeleton';
import StatCard from '@/components/StatCard';
import RevenueChart from '@/components/RevenueChart';
import RequestsChart from '@/components/RequestsChart';
import BotPieChart from '@/components/BotPieChart';
import ActivityFeed from '@/components/ActivityFeed';
import { formatUsdcDollar, formatPctChange, compactNumber } from '@/lib/formatters';
import type { DashboardStats, HourlyPoint, DailyPoint, BotShare } from '@/lib/mockData';

async function getDashboardData() {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3001';
  const res  = await fetch(`${base}/api/dashboard/stats`, { cache: 'no-store' });
  return res.json() as Promise<{
    stats:   DashboardStats;
    hourly:  HourlyPoint[];
    daily:   DailyPoint[];
    botDist: BotShare[];
  }>;
}

export default async function DashboardPage() {
  const { stats, hourly, daily, botDist } = await getDashboardData();

  const revChange = formatPctChange(stats.revenueToday, stats.revenueYesterday);
  const reqChange = formatPctChange(stats.requestsToday, stats.requestsYesterday);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Overview</h1>
        <p className="text-sm text-slate-500 mt-0.5">Today's bot activity and revenue across your site</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Revenue Today"
          value={formatUsdcDollar(stats.revenueToday)}
          change={revChange}
          accent
        />
        <StatCard
          title="Requests Today"
          value={compactNumber(stats.requestsToday)}
          change={reqChange}
        />
        <StatCard
          title="Paid Requests"
          value={compactNumber(stats.paidToday)}
          sub={`${compactNumber(stats.freeToday)} free`}
        />
        <StatCard
          title="Unique Bots"
          value={String(stats.uniqueBots)}
          sub={`${stats.activeBotsLastHour} active last hour`}
        />
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Monthly Revenue"   value={formatUsdcDollar(stats.revenueThisMonth)} />
        <StatCard title="Your Earnings"     value={formatUsdcDollar(stats.ownerRevenue)} sub="95% split" />
        <StatCard title="Platform Fees"     value={formatUsdcDollar(stats.platformFees)} sub="5% split" />
        <StatCard title="Success Rate"      value={`${(stats.successRate * 100).toFixed(1)}%`} />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Revenue (Last 7 days)</h2>
          <Suspense fallback={<ChartSkeleton />}>
            <RevenueChart data={daily} />
          </Suspense>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Bot Traffic Share</h2>
          <Suspense fallback={<ChartSkeleton />}>
            <BotPieChart data={botDist} />
          </Suspense>
        </div>
      </div>

      {/* Requests chart + activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Requests (Last 24h)</h2>
          <Suspense fallback={<ChartSkeleton />}>
            <RequestsChart data={hourly} />
          </Suspense>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Live Activity</h2>
          <Suspense fallback={<CardSkeleton />}>
            <ActivityFeed />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
