import Link from 'next/link';
import {
  ShieldCheck, DollarSign, Bot, BarChart2, CheckCircle2,
  AlertCircle, ArrowRight, Zap,
} from 'lucide-react';
import type { SiteDetail, ActivityItem } from '@/app/api/sites/[siteId]/route';
import { formatUsdcDollar, compactNumber } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import InstallCode from './InstallCode';

async function getSiteDetail(siteId: string): Promise<SiteDetail | null> {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3001';
  try {
    const res = await fetch(`${base}/api/sites/${siteId}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return res.json() as Promise<SiteDetail>;
  } catch {
    return null;
  }
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, sub, accent = false }: {
  icon:    React.ComponentType<{ className?: string }>;
  label:   string;
  value:   string;
  sub?:    string;
  accent?: boolean;
}) {
  return (
    <div className={cn('card p-4', accent && 'border-accent/20 bg-accent-muted/20')}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium text-ink-3">{label}</p>
        <div className={cn(
          'w-8 h-8 rounded-xl flex items-center justify-center',
          accent ? 'bg-accent text-white' : 'bg-canvas',
        )}>
          <Icon className="w-3.5 h-3.5" />
        </div>
      </div>
      <p className="text-2xl font-bold text-ink tabular">{value}</p>
      {sub && <p className="text-2xs text-ink-3 mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Activity feed ─────────────────────────────────────────────────────────────

const STATUS_CFG: Record<ActivityItem['status'], { label: string; cls: string; dot: string }> = {
  blocked: { label: 'BLOCKED', cls: 'bg-red-50 text-red-700 border-red-200',     dot: 'bg-red-500'     },
  paid:    { label: 'PAID',    cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  allowed: { label: 'ALLOWED', cls: 'bg-blue-50 text-blue-700 border-blue-200',  dot: 'bg-blue-500'    },
};

function ActivityRow({ item }: { item: ActivityItem }) {
  const cfg = STATUS_CFG[item.status];
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-edge last:border-0">
      <span className="text-2xs text-ink-3 tabular w-16 shrink-0">{item.timeAgo}</span>
      <span className={cn('w-2 h-2 rounded-full shrink-0', cfg.dot)} />
      <span className="text-sm font-semibold text-ink shrink-0 w-20">{item.bot}</span>
      <span className="text-xs text-ink-3 font-mono truncate flex-1">{item.path}</span>
      <span className={cn('text-2xs font-bold px-2 py-0.5 rounded-full border shrink-0', cfg.cls)}>
        {cfg.label}
      </span>
      {item.status === 'paid' && (
        <span className="text-2xs font-semibold text-emerald-700 tabular shrink-0">
          {formatUsdcDollar(item.amount)}
        </span>
      )}
    </div>
  );
}

// ── Setup checklist ───────────────────────────────────────────────────────────

function ChecklistItem({ label, done, action, siteId }: {
  label:   string;
  done:    boolean;
  action?: string;
  siteId:  string;
}) {
  return (
    <div className="flex items-center gap-3 py-2 border-b border-edge last:border-0">
      {done ? (
        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
      ) : (
        <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
      )}
      <span className={cn('text-sm flex-1', done ? 'text-ink' : 'text-ink-2')}>{label}</span>
      {action && !done && (
        <Link
          href={`/dashboard/sites/${siteId}/settings`}
          className="text-xs font-semibold text-accent hover:underline shrink-0"
        >
          {action}
        </Link>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function SiteOverviewPage({
  params,
}: {
  params: { siteId: string };
}) {
  const detail = await getSiteDetail(params.siteId);

  if (!detail) {
    return (
      <div className="card p-8 text-center">
        <p className="text-sm text-ink-3">Site not found or still loading.</p>
      </div>
    );
  }

  const { summary, activity, topBots, recommendations, setupChecklist, recentTxns } = detail;
  // API key = siteId for now; swap for a real key column once auth is wired
  const apiKey = `sk_live_${params.siteId}`;

  return (
    <div className="space-y-6">

      {/* Install code — expanded for new sites, always accessible */}
      <InstallCode siteId={params.siteId} apiKey={apiKey} />

      {/* Quick stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={ShieldCheck} label="Bot Blocks"  value={compactNumber(summary.stats.botBlocks)}           accent />
        <StatCard icon={DollarSign}  label="Revenue"     value={formatUsdcDollar(summary.stats.revenue)}  sub="this month" />
        <StatCard icon={Bot}         label="Paid Bots"   value={String(summary.stats.paidBots)}          sub="unique bots" />
        <StatCard icon={BarChart2}   label="Block Rate"  value={`${summary.stats.blockRate}%`}           sub="of all requests" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left column: activity + txns */}
        <div className="lg:col-span-2 space-y-6">

          {/* Live activity */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
              <h2 className="text-sm font-bold text-ink">Live Activity</h2>
              <span className="text-2xs text-ink-3 ml-auto">Last 5 minutes</span>
            </div>
            {activity.length === 0 ? (
              <p className="text-sm text-ink-3 py-4 text-center">
                No activity yet — finish setup to start seeing bot requests.
              </p>
            ) : (
              <div>
                {activity.map(item => (
                  <ActivityRow key={item.id} item={item} />
                ))}
              </div>
            )}
            <div className="mt-3 pt-3 border-t border-edge">
              <Link
                href={`/dashboard/sites/${params.siteId}/activity`}
                className="text-xs font-semibold text-accent hover:underline"
              >
                View full activity log →
              </Link>
            </div>
          </div>

          {/* Recent transactions */}
          {recentTxns.length > 0 && (
            <div className="card p-5">
              <h2 className="text-sm font-bold text-ink mb-4">Recent Transactions</h2>
              <div className="space-y-0">
                {recentTxns.map((tx, i) => (
                  <div key={i} className="flex items-center gap-3 py-2.5 border-b border-edge last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-ink">{tx.bot}</p>
                      <p className="text-2xs text-ink-3 font-mono truncate">{tx.path}</p>
                    </div>
                    <span className="text-xs font-semibold text-emerald-700 tabular shrink-0">
                      {formatUsdcDollar(tx.amount)}
                    </span>
                    <a
                      href={`https://sepolia.basescan.org/tx/${tx.txHash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-2xs text-accent hover:underline font-mono shrink-0"
                    >
                      {tx.txHash} ↗
                    </a>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t border-edge">
                <Link
                  href={`/dashboard/sites/${params.siteId}/revenue`}
                  className="text-xs font-semibold text-accent hover:underline"
                >
                  View all revenue →
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Right column: recommendations + setup */}
        <div className="space-y-6">

          {/* Smart recommendations */}
          <div className="card p-5">
            <h2 className="text-sm font-bold text-ink mb-3">💡 Recommendations</h2>
            <div className="space-y-3">
              {recommendations.map(rec => (
                <div key={rec.id} className="bg-canvas rounded-xl p-3 border border-edge">
                  <p className="text-xs font-bold text-ink mb-1">{rec.title}</p>
                  <p className="text-2xs text-ink-3 leading-relaxed mb-2">{rec.body}</p>
                  <Link
                    href={`/dashboard/sites/${params.siteId}/protection`}
                    className="inline-flex items-center gap-1 text-2xs font-semibold text-accent hover:underline"
                  >
                    {rec.cta}
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              ))}
            </div>
          </div>

          {/* Setup checklist */}
          <div className="card p-5">
            <h2 className="text-sm font-bold text-ink mb-3">⚙️ Setup Status</h2>
            <div>
              {setupChecklist.map((item, i) => (
                <ChecklistItem
                  key={i}
                  label={item.label}
                  done={item.done}
                  action={item.action}
                  siteId={params.siteId}
                />
              ))}
            </div>
            {setupChecklist.every(i => i.done) && (
              <div className="mt-3 flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
                <Zap className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <p className="text-2xs font-semibold text-emerald-700">
                  Fully configured — you&apos;re earning from bots!
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
