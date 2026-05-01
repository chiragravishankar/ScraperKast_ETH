'use client';

import { useState, useEffect } from 'react';
import { Download, TrendingUp, Shield, DollarSign, Activity } from 'lucide-react';
import { compactNumber, formatUsdcDollar } from '@/lib/formatters';
import { cn } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

type BotRow = {
  name: string;
  type: string;
  requests: number;
  paid: number;
  blocked: number;
  revenue: number; // µUSDC, for formatUsdcDollar
};

type RevenueStats = {
  totalEarnings: number;
  totalTransactions: number;
  topBots: Array<{ botId: string; botName: string; amount: number; count: number }>;
};

// ── Bot type classifier ───────────────────────────────────────────────────────

function classifyBotType(name: string): string {
  if (/gptbot|claudebot|perplexity|chatgpt|gemini|customaibot/i.test(name)) return 'AI';
  if (/firecrawl|diffbot|semrush|ahrefs|bytespider/i.test(name)) return 'Commercial';
  return 'Open Source';
}

// ── Fallback mock data (shown when no real transactions exist yet) ─────────────

const MOCK_BOTS: BotRow[] = [
  { name: 'GPTBot',    type: 'AI',          requests: 245, paid: 12,  blocked: 233, revenue: 600_000   },
  { name: 'Firecrawl', type: 'Commercial',  requests: 187, paid: 45,  blocked: 142, revenue: 2_250_000 },
  { name: 'ClaudeBot', type: 'AI',          requests: 156, paid: 0,   blocked: 156, revenue: 0         },
  { name: 'Scrapy',    type: 'Open Source', requests: 120, paid: 0,   blocked: 120, revenue: 0         },
  { name: 'Diffbot',   type: 'Commercial',  requests: 98,  paid: 23,  blocked: 75,  revenue: 1_150_000 },
  { name: 'ChatGPT',   type: 'AI',          requests: 87,  paid: 31,  blocked: 56,  revenue: 1_550_000 },
];

const TOP_PAGES = [
  { path: '/blog/ai-2026',           hits: 312, bots: 8  },
  { path: '/articles/llm-scaling',   hits: 198, bots: 6  },
  { path: '/blog/tariffs-impact',    hits: 156, bots: 5  },
  { path: '/blog/agents-autonomous', hits: 134, bots: 4  },
  { path: '/sitemap.xml',            hits: 89,  bots: 12 },
];

// ── Mini bar chart (CSS only, no library needed) ──────────────────────────────

function MiniBar({ label, value, max, color }: {
  label: string; value: number; max: number; color: string;
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-ink-3 w-8 shrink-0 tabular">{label}</span>
      <div className="flex-1 h-2 bg-edge rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full transition-all duration-700', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-semibold text-ink tabular w-8 text-right">{value}</span>
    </div>
  );
}

// ── Activity sparkline (SVG) ──────────────────────────────────────────────────

function Sparkline({ data }: { data: number[] }) {
  const max = Math.max(...data, 1);
  const w   = 600;
  const h   = 80;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - (v / max) * h;
    return `${x},${y}`;
  });
  const path = `M ${pts.join(' L ')}`;
  const fill = `M ${pts[0]} L ${pts.join(' L ')} L ${w},${h} L 0,${h} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-20" preserveAspectRatio="none">
      <defs>
        <linearGradient id="spark-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#FF5722" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#FF5722" stopOpacity="0"    />
        </linearGradient>
      </defs>
      <path d={fill} fill="url(#spark-grad)" />
      <path d={path} fill="none" stroke="#FF5722" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Deterministic mock data for the last 24 hours
const HOURLY_DATA = Array.from({ length: 24 }, (_, i) => {
  const seed = Math.sin(i * 0.7) * 50 + Math.cos(i * 0.3) * 30 + 60;
  return Math.max(0, Math.round(seed));
});

// ── Bot type badge ────────────────────────────────────────────────────────────

const TYPE_COLORS: Record<string, string> = {
  'AI':          'bg-blue-50 text-blue-700 border-blue-200',
  'Commercial':  'bg-violet-50 text-violet-700 border-violet-200',
  'Open Source': 'bg-sky-50 text-sky-700 border-sky-200',
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default function BotActivityPage({
  params,
}: {
  params: { siteId: string };
}) {
  const [timeRange, setTimeRange] = useState('7d');
  const [filter,    setFilter]    = useState<'all' | 'ai' | 'commercial' | 'oss'>('all');
  const [stats,     setStats]     = useState<RevenueStats | null>(null);

  // Fetch real analytics on mount and when siteId changes
  useEffect(() => {
    fetch(`/api/sites/${params.siteId}/revenue/stats`)
      .then(r => r.ok ? r.json() as Promise<RevenueStats> : null)
      .then(data => { if (data) setStats(data); })
      .catch(() => { /* non-fatal — falls back to mock */ });
  }, [params.siteId]);

  // Use real top-bots data when available; fall back to mock for demo sites with no history
  const TOP_BOTS: BotRow[] = stats?.topBots && stats.topBots.length > 0
    ? stats.topBots.map(b => ({
        name:     b.botName,
        type:     classifyBotType(b.botName),
        requests: b.count,
        paid:     b.count,  // all DB transactions are verified (paid)
        blocked:  0,
        revenue:  Math.round(b.amount * 1_000_000), // USDC → µUSDC
      }))
    : MOCK_BOTS;

  const filtered = TOP_BOTS.filter(b => {
    if (filter === 'ai')         return b.type === 'AI';
    if (filter === 'commercial') return b.type === 'Commercial';
    if (filter === 'oss')        return b.type === 'Open Source';
    return true;
  });

  const totalRequests = filtered.reduce((s, b) => s + b.requests, 0);
  const totalRevenue  = filtered.reduce((s, b) => s + b.revenue,  0);
  const totalBlocked  = filtered.reduce((s, b) => s + b.blocked,  0);
  const maxRequests   = Math.max(...filtered.map(b => b.requests), 1);

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-base font-bold text-ink">Bot Activity</h2>
          <p className="text-xs text-ink-3 mt-0.5">Requests, blocks, and revenue by bot</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={timeRange}
            onChange={e => setTimeRange(e.target.value)}
            className="text-xs border border-edge rounded-lg px-3 py-2 bg-surface text-ink focus:outline-none focus:ring-2 focus:ring-accent/30"
          >
            <option value="24h">Last 24 hours</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
          </select>
          <button className="flex items-center gap-1.5 text-xs font-semibold border border-edge rounded-lg px-3 py-2 text-ink-2 hover:bg-canvas transition-colors">
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Requests', value: compactNumber(totalRequests), icon: Activity,    color: 'text-ink'         },
          { label: 'Blocked',        value: compactNumber(totalBlocked),  icon: Shield,      color: 'text-red-600'     },
          { label: 'Revenue',        value: formatUsdcDollar(totalRevenue), icon: DollarSign, color: 'text-emerald-700' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="card p-4 flex items-center gap-3">
            <Icon className={cn('w-5 h-5 shrink-0', color)} />
            <div>
              <p className={cn('text-lg font-bold tabular', color)}>{value}</p>
              <p className="text-2xs text-ink-3">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Activity chart */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-ink flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-accent" />
            Requests over time
          </h3>
          <div className="flex items-center gap-3 text-2xs text-ink-3">
            <span className="flex items-center gap-1">
              <span className="w-2 h-0.5 bg-accent rounded-full inline-block" />
              Requests
            </span>
          </div>
        </div>

        {/* X-axis labels */}
        <Sparkline data={HOURLY_DATA} />
        <div className="flex justify-between mt-1">
          {['0:00', '6:00', '12:00', '18:00', '24:00'].map(t => (
            <span key={t} className="text-2xs text-ink-3">{t}</span>
          ))}
        </div>

        {/* Mini bars for quick visual */}
        <div className="mt-4 space-y-2">
          {['blocked', 'paid', 'allowed'].map((type, i) => (
            <MiniBar
              key={type}
              label={type.charAt(0).toUpperCase() + type.slice(1)}
              value={[totalBlocked, filtered.reduce((s, b) => s + b.paid, 0), 20][i]!}
              max={totalRequests}
              color={['bg-red-400', 'bg-emerald-500', 'bg-blue-400'][i]!}
            />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Top bots table */}
        <div className="lg:col-span-2 card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-edge">
            <h3 className="text-sm font-bold text-ink">Top Bots</h3>
            <div className="flex items-center gap-1">
              {([
                { key: 'all',         label: 'All'        },
                { key: 'ai',          label: 'AI'         },
                { key: 'commercial',  label: 'Commercial' },
                { key: 'oss',         label: 'Open Source'},
              ] as const).map(f => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={cn(
                    'px-2.5 py-1 rounded-lg text-2xs font-semibold transition-colors',
                    filter === f.key
                      ? 'bg-accent text-white'
                      : 'text-ink-3 hover:text-ink hover:bg-edge-2',
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-edge bg-canvas">
                  {['Bot', 'Type', 'Requests', 'Paid', 'Blocked', 'Revenue'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-2xs font-semibold text-ink-3 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-edge">
                {filtered.map(bot => (
                  <tr key={bot.name} className="hover:bg-canvas/60 transition-colors">
                    <td className="px-4 py-3 font-semibold text-ink">{bot.name}</td>
                    <td className="px-4 py-3">
                      <span className={cn('text-2xs font-semibold px-2 py-0.5 rounded-full border', TYPE_COLORS[bot.type] ?? '')}>
                        {bot.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 tabular text-ink">{compactNumber(bot.requests)}</td>
                    <td className="px-4 py-3 tabular text-emerald-700 font-semibold">{bot.paid}</td>
                    <td className="px-4 py-3 tabular text-red-600">{bot.blocked}</td>
                    <td className="px-4 py-3 tabular font-semibold text-ink">
                      {bot.revenue > 0 ? formatUsdcDollar(bot.revenue) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top pages */}
        <div className="card p-5">
          <h3 className="text-sm font-bold text-ink mb-4">Most Targeted Pages</h3>
          <div className="space-y-3">
            {TOP_PAGES.map((p, i) => (
              <div key={p.path}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-2xs font-mono text-ink-2 truncate flex-1 mr-2">{p.path}</span>
                  <span className="text-2xs text-ink-3 tabular shrink-0">{p.hits} hits</span>
                </div>
                <div className="h-1.5 bg-edge rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent rounded-full transition-all duration-700"
                    style={{ width: `${Math.round((p.hits / TOP_PAGES[0]!.hits) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
