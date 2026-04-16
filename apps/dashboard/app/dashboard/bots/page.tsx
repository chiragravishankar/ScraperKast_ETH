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
      <div>
        <h1 className="text-xl font-bold text-slate-900">Bots</h1>
        <p className="text-sm text-slate-500 mt-0.5">{bots.length} bots detected on your site</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left">
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
      </div>
    </div>
  );
}
