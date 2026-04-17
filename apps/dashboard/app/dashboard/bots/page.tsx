import Link from 'next/link';
import { Settings2, Users, Shield } from 'lucide-react';
import { formatUsdcDollar, timeAgo, compactNumber } from '@/lib/formatters';
import type { BotSummary } from '@/lib/mockData';

const TYPE_LABELS: Record<string, string> = {
  ai_training:  'AI Training',
  ai_inference: 'AI Inference',
  search:       'Search',
  crawler:      'Crawler',
};

const TYPE_COLORS: Record<string, string> = {
  ai_training:  'bg-violet-100 text-violet-700',
  ai_inference: 'bg-sky-100 text-sky-700',
  search:       'bg-amber-100 text-amber-700',
  crawler:      'bg-slate-100 text-slate-600',
};

async function getBots(): Promise<BotSummary[]> {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3001';
  const res  = await fetch(`${base}/api/dashboard/bots`, { cache: 'no-store' });
  const data = await res.json() as { bots: BotSummary[] };
  return data.bots;
}

export default async function BotsPage() {
  const bots = await getBots();

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Bots</h1>
          <p className="text-sm text-slate-500 mt-0.5">{bots.length} bots detected on your site</p>
        </div>
        {/* Quick links to management sub-pages */}
        <div className="flex items-center gap-2">
          <Link href="/dashboard/bots/manage"
            className="flex items-center gap-1.5 text-sm font-semibold bg-brand-dark text-white px-3 py-2 rounded-xl hover:bg-brand-mid transition-colors">
            <Settings2 className="w-4 h-4" /> Manage
          </Link>
          <Link href="/dashboard/bots/groups"
            className="flex items-center gap-1.5 text-sm font-medium border border-slate-200 rounded-xl px-3 py-2 text-slate-600 hover:bg-slate-50 transition-colors">
            <Users className="w-4 h-4" /> Groups
          </Link>
          <Link href="/dashboard/bots/whitelist"
            className="flex items-center gap-1.5 text-sm font-medium border border-slate-200 rounded-xl px-3 py-2 text-slate-600 hover:bg-slate-50 transition-colors">
            <Shield className="w-4 h-4" /> Lists
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left bg-slate-50">
                <th className="px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Bot</th>
                <th className="px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Type</th>
                <th className="px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide text-right">Requests</th>
                <th className="px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide text-right">Paid</th>
                <th className="px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide text-right">Revenue</th>
                <th className="px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide text-right">Success</th>
                <th className="px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Last Seen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {bots.map((bot) => (
                <tr key={bot.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3.5">
                    <div className="font-semibold text-slate-900">{bot.name}</div>
                    <div className="text-xs text-slate-400 truncate max-w-xs mt-0.5">{bot.userAgent}</div>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${TYPE_COLORS[bot.type] ?? ''}`}>
                      {TYPE_LABELS[bot.type] ?? bot.type}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono text-slate-700">
                    {compactNumber(bot.totalRequests)}
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <span className="text-emerald-600 font-mono">{compactNumber(bot.paidRequests)}</span>
                    <span className="text-slate-400 text-xs"> / {compactNumber(bot.freeRequests)} free</span>
                  </td>
                  <td className="px-4 py-3.5 text-right font-semibold text-brand-dark font-mono">
                    {formatUsdcDollar(bot.revenueEarned)}
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <span className={bot.successRate >= 0.95 ? 'text-emerald-600' : 'text-amber-500'}>
                      {(bot.successRate * 100).toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-slate-400 text-xs">
                    {timeAgo(new Date(bot.lastSeen))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-slate-100 bg-slate-50">
          <Link href="/dashboard/bots/manage"
            className="text-sm font-semibold text-brand-dark hover:text-brand-mid transition-colors">
            Manage bot permissions &amp; pricing →
          </Link>
        </div>
      </div>
    </div>
  );
}
