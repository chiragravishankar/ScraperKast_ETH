'use client';

/**
 * Revenue overview for a single site.
 * Data comes from GET /api/sites/[siteId]/revenue/stats (real Prisma).
 * Amounts from the API are already plain USDC (not µUSDC).
 */

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { TrendingUp, DollarSign, Zap, ArrowRight, ExternalLink, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getTxExplorerUrl } from '@/lib/config';

// ── Format helpers (amounts are plain USDC floats from API) ──────────────────

function fmtUsdc(amount: number): string {
  if (amount >= 1)      return `$${amount.toFixed(2)}`;
  if (amount >= 0.0001) return `$${amount.toFixed(4)}`;
  return `$${amount.toFixed(6)}`;
}

function fmtPct(v: number): string {
  return `${v.toFixed(1)}%`;
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface MethodBreakdown {
  amount: number;
  count:  number;
}

interface StatsData {
  totalEarnings:      number;
  thisMonthEarnings:  number;
  transactionCount:   number;
  averagePayment:     number;
  paymentMethods: {
    x402:    MethodBreakdown;
    uniswap: MethodBreakdown;
    direct:  MethodBreakdown;
  };
  topBots: Array<{ botId: string; botName: string; amount: number; count: number }>;
  revenueTrend: Array<{ date: string; amount: number }>;
  byNetwork: Record<string, number>;
}

interface RecentTx {
  id:          string;
  botName:     string;
  method:      string;
  amount:      number;
  path:        string;
  txHash:      string;
  network:     string;
  createdAt:   string;
}

// ── SVG sparkline (30-day trend) ──────────────────────────────────────────────

function TrendChart({ data }: { data: Array<{ date: string; amount: number }> }) {
  if (data.length === 0) {
    return (
      <div className="h-24 flex items-center justify-center text-xs text-ink-3">
        No data yet
      </div>
    );
  }

  const values  = data.map(d => d.amount);
  const max     = Math.max(...values, 0.001);
  const w       = 600;
  const h       = 80;
  const pts     = values.map((v, i) => {
    const x = values.length === 1 ? w / 2 : (i / (values.length - 1)) * w;
    const y = h - Math.max((v / max) * (h - 4), 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const linePath = `M ${pts.join(' L ')}`;
  const fillPath = `M ${pts[0]} L ${pts.join(' L ')} L ${w},${h} L 0,${h} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-24" preserveAspectRatio="none">
      <defs>
        <linearGradient id="rev-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="var(--color-accent, #ff5722)" stopOpacity="0.18" />
          <stop offset="100%" stopColor="var(--color-accent, #ff5722)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fillPath} fill="url(#rev-grad)" />
      <path d={linePath} fill="none" stroke="var(--color-accent, #ff5722)" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Payment method badge ──────────────────────────────────────────────────────

function MethodBadge({ method }: { method: string }) {
  const cfg: Record<string, { label: string; cls: string }> = {
    x402:    { label: '🤖 x402',    cls: 'method-badge-x402'    },
    uniswap: { label: '🦄 Uniswap', cls: 'method-badge-uniswap' },
    direct:  { label: '💵 Direct',  cls: 'method-badge-direct'  },
  };
  const { label, cls } = cfg[method] ?? { label: method, cls: '' };
  return <span className={cn('method-badge', cls)}>{label}</span>;
}

// ── Breakdown bar ─────────────────────────────────────────────────────────────

function BreakdownBar({ label, amount, count, pct, fillCls }: {
  label:   string;
  amount:  number;
  count:   number;
  pct:     number;
  fillCls: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-semibold text-ink">{label}</span>
        <div className="flex items-center gap-3">
          <span className="text-2xs text-ink-3 tabular">{count} txn{count !== 1 ? 's' : ''}</span>
          <span className="text-xs font-bold text-ink tabular">{fmtUsdc(amount)}</span>
          <span className="text-2xs text-ink-3 tabular w-10 text-right">{fmtPct(pct)}</span>
        </div>
      </div>
      <div className="breakdown-track">
        <div className={cn('breakdown-fill', fillCls)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, accent, icon }: {
  label:   string;
  value:   string;
  sub?:    string;
  accent?: boolean;
  icon?:   React.ReactNode;
}) {
  return (
    <div className={cn('card p-4', accent && 'border-accent/20 bg-[rgba(255,87,34,0.04)]')}>
      <div className="flex items-start justify-between mb-2">
        <p className="text-xs text-ink-3">{label}</p>
        {icon && <span className="text-ink-3">{icon}</span>}
      </div>
      <p className={cn('text-2xl font-bold tabular', accent ? 'text-accent' : 'text-ink')}>{value}</p>
      {sub && <p className="text-2xs text-ink-3 mt-1">{sub}</p>}
    </div>
  );
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="card p-4">
            <div className="skeleton-line h-3 w-20 mb-3" />
            <div className="skeleton-line h-7 w-24 mb-1" />
            <div className="skeleton-line h-2.5 w-16" />
          </div>
        ))}
      </div>
      <div className="card p-5">
        <div className="skeleton-line h-5 w-32 mb-4" />
        <div className="skeleton-line h-24 w-full" />
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function RevenuePage() {
  const { siteId } = useParams<{ siteId: string }>();

  const [stats,   setStats]   = useState<StatsData | null>(null);
  const [recents, setRecents] = useState<RecentTx[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsRes, txRes] = await Promise.all([
        fetch(`/api/sites/${siteId}/revenue/stats`),
        fetch(`/api/sites/${siteId}/revenue/transactions?limit=5`),
      ]);

      if (!statsRes.ok) throw new Error(`Stats: ${statsRes.status}`);
      const statsData = await statsRes.json() as StatsData;
      setStats(statsData);

      if (txRes.ok) {
        const txData = await txRes.json() as { transactions: RecentTx[] };
        setRecents(txData.transactions ?? []);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [siteId]);

  useEffect(() => { void load(); }, [load]);

  // ── Loading / error states ────────────────────────────────────────────────

  if (loading) return <Skeleton />;

  if (error) {
    return (
      <div className="card p-8 text-center space-y-3">
        <p className="text-sm font-semibold text-ink">Could not load revenue data</p>
        <p className="text-xs text-ink-3">{error}</p>
        <button onClick={() => void load()}
          className="text-xs font-semibold text-accent hover:underline flex items-center gap-1 mx-auto">
          <RefreshCw className="w-3 h-3" /> Retry
        </button>
      </div>
    );
  }

  if (!stats) return null;

  // ── Derived values ────────────────────────────────────────────────────────

  const { totalEarnings, thisMonthEarnings, transactionCount, averagePayment,
          paymentMethods, topBots, revenueTrend } = stats;

  const totalMethodAmount = paymentMethods.x402.amount +
                            paymentMethods.uniswap.amount +
                            paymentMethods.direct.amount;

  const methodPct = (amt: number) =>
    totalMethodAmount > 0 ? (amt / totalMethodAmount) * 100 : 0;

  const totalCount = paymentMethods.x402.count +
                     paymentMethods.uniswap.count +
                     paymentMethods.direct.count;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-ink">Revenue</h2>
          <p className="text-xs text-ink-3 mt-0.5">USDC earnings from bot access fees · Base Sepolia testnet</p>
        </div>
        <Link
          href={`/dashboard/sites/${siteId}/revenue/transactions`}
          className="flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
        >
          All transactions <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Earnings"
          value={fmtUsdc(totalEarnings)}
          sub={`${totalCount} verified payment${totalCount !== 1 ? 's' : ''}`}
          accent
          icon={<DollarSign className="w-4 h-4" />}
        />
        <StatCard
          label="This Month"
          value={fmtUsdc(thisMonthEarnings)}
          sub="USDC · testnet"
        />
        <StatCard
          label="Total Payments"
          value={String(transactionCount)}
          sub="verified on-chain"
          icon={<Zap className="w-4 h-4" />}
        />
        <StatCard
          label="Avg Payment"
          value={fmtUsdc(averagePayment ?? 0)}
          sub="per transaction"
        />
      </div>

      {/* Revenue trend */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-4 h-4 text-accent" />
          <h3 className="text-sm font-bold text-ink">30-Day Revenue Trend</h3>
          <span className="ml-auto text-2xs text-ink-3">
            {revenueTrend.length} active day{revenueTrend.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="sparkline-wrap">
          <TrendChart data={revenueTrend} />
        </div>
        {revenueTrend.length > 0 && (
          <div className="flex items-center justify-between mt-2">
            <span className="text-2xs text-ink-3">{revenueTrend[0]?.date}</span>
            <span className="text-2xs text-ink-3">{revenueTrend[revenueTrend.length - 1]?.date}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Recent transactions */}
        <div className="lg:col-span-2 card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-edge">
            <h3 className="text-sm font-bold text-ink">Recent Payments</h3>
            <Link href={`/dashboard/sites/${siteId}/revenue/transactions`}
              className="text-2xs font-semibold text-accent hover:underline">
              View all
            </Link>
          </div>

          {recents.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">
                <DollarSign className="w-5 h-5 text-ink-3" />
              </div>
              <p className="text-sm font-semibold text-ink">No payments yet</p>
              <p className="text-xs text-ink-3">Verified bot payments will appear here</p>
            </div>
          ) : (
            <div className="divide-y divide-edge">
              {recents.map(tx => (
                <div key={tx.id} className="px-5 py-3 flex items-center gap-3 hover:bg-canvas/60 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-ink">{tx.botName}</span>
                      <MethodBadge method={tx.method} />
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-2xs text-ink-3">
                        {new Date(tx.createdAt).toLocaleDateString('en-US', {
                          month: 'short', day: 'numeric',
                          hour: '2-digit', minute: '2-digit', hour12: false,
                        })}
                      </span>
                      <span className="text-2xs font-mono text-ink-3 truncate">{tx.path}</span>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-emerald-700 tabular shrink-0">
                    {fmtUsdc(tx.amount)}
                  </span>
                  <a
                    href={getTxExplorerUrl(tx.txHash, tx.network)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-ink-3 hover:text-accent transition-colors shrink-0"
                    title="View on explorer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-5">

          {/* Payment methods */}
          <div className="card p-5 space-y-4">
            <h3 className="text-sm font-bold text-ink">Payment Methods</h3>
            <div className="space-y-4">
              <BreakdownBar
                label="🤖 x402 (Direct USDC)"
                amount={paymentMethods.x402.amount}
                count={paymentMethods.x402.count}
                pct={methodPct(paymentMethods.x402.amount)}
                fillCls="breakdown-fill-x402"
              />
              <BreakdownBar
                label="🦄 Uniswap (ERC-20 → USDC)"
                amount={paymentMethods.uniswap.amount}
                count={paymentMethods.uniswap.count}
                pct={methodPct(paymentMethods.uniswap.amount)}
                fillCls="breakdown-fill-uniswap"
              />
              <BreakdownBar
                label="💵 Direct"
                amount={paymentMethods.direct.amount}
                count={paymentMethods.direct.count}
                pct={methodPct(paymentMethods.direct.amount)}
                fillCls="breakdown-fill-direct"
              />
            </div>
          </div>

          {/* Top bots */}
          <div className="card p-5">
            <h3 className="text-sm font-bold text-ink mb-4">Top Paying Bots</h3>
            {topBots.length === 0 ? (
              <p className="text-xs text-ink-3 text-center py-4">No payments yet</p>
            ) : (
              <div className="space-y-3">
                {topBots.map((bot, i) => {
                  const maxAmt = topBots[0]?.amount ?? 1;
                  const pct    = maxAmt > 0 ? (bot.amount / maxAmt) * 100 : 0;
                  return (
                    <div key={bot.botId}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-2xs text-ink-3 font-bold w-4 tabular">{i + 1}</span>
                          <span className="text-xs font-semibold text-ink">{bot.botName}</span>
                          <span className="text-2xs text-ink-3">{bot.count}×</span>
                        </div>
                        <span className="text-xs font-bold text-ink tabular">{fmtUsdc(bot.amount)}</span>
                      </div>
                      <div className="breakdown-track">
                        <div className="breakdown-fill breakdown-fill-bot"
                             style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
