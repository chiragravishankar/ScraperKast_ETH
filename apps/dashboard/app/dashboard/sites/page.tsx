'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Globe, TrendingUp, AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';
import type { SiteSummary } from '@/app/api/sites/route';
import { formatUsdcDollar, compactNumber } from '@/lib/formatters';
import { cn } from '@/lib/utils';

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ site }: { site: SiteSummary }) {
  if (!site.verified) {
    return (
      <span className="inline-flex items-center gap-1.5 text-2xs font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
        <AlertCircle className="w-3 h-3" />
        Setup required
      </span>
    );
  }
  if (site.status === 'paused') {
    return (
      <span className="inline-flex items-center gap-1.5 text-2xs font-semibold px-2.5 py-1 rounded-full bg-canvas text-ink-3 border border-edge">
        Paused
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-2xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
      <CheckCircle2 className="w-3 h-3" />
      Active
    </span>
  );
}

// ── Block-rate bar ────────────────────────────────────────────────────────────

function BlockRateBar({ pct }: { pct: number }) {
  const color = pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-400';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-edge rounded-full overflow-hidden min-w-[48px]">
        <div className={cn('h-full rounded-full transition-all duration-700', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-2xs tabular text-ink-3 w-8 text-right">{pct}%</span>
    </div>
  );
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function SitesSkeleton() {
  return (
    <div className="card overflow-hidden animate-pulse">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-4 border-b border-edge last:border-0">
          <div className="w-8 h-8 rounded-xl bg-edge shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 bg-edge rounded w-32" />
            <div className="h-2.5 bg-edge rounded w-48" />
          </div>
          <div className="h-5 bg-edge rounded-full w-20" />
          <div className="h-3 bg-edge rounded w-16" />
          <div className="h-3 bg-edge rounded w-16" />
          <div className="h-3 bg-edge rounded w-10" />
        </div>
      ))}
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="card p-16 text-center">
      <div className="w-14 h-14 rounded-2xl bg-accent-muted flex items-center justify-center mx-auto mb-4">
        <Globe className="w-7 h-7 text-accent" />
      </div>
      <h2 className="text-base font-bold text-ink mb-1">No sites yet</h2>
      <p className="text-sm text-ink-3 mb-6 max-w-xs mx-auto">
        Add your first site to start protecting it from unauthorized scraping and monetising bot traffic.
      </p>
      <Link
        href="/dashboard/sites/add"
        className="inline-flex items-center gap-2 bg-accent text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-accent-hover transition-colors"
      >
        <Plus className="w-4 h-4" />
        Add your first site
      </Link>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SitesPage() {
  const router   = useRouter();
  const [sites,   setSites]   = useState<SiteSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const fetchSites = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    else        setRefreshing(true);
    setError('');
    try {
      const res  = await fetch('/api/sites', { cache: 'no-store' });
      if (!res.ok) { setError('Failed to load sites'); return; }
      const data = await res.json() as { sites: SiteSummary[] };
      setSites(data.sites ?? []);
    } catch {
      setError('Network error — check your connection.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void fetchSites(); }, [fetchSites]);

  const totalRevenue = sites.reduce((s, x) => s + x.stats.revenue, 0);
  const totalBlocks  = sites.reduce((s, x) => s + x.stats.botBlocks, 0);
  const activeSites  = sites.filter(s => s.verified).length;

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="page-title">Sites</h1>
          <p className="text-sm text-ink-3 mt-0.5">
            {loading ? 'Loading…' : `${activeSites} active · ${sites.length} total`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchSites(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 text-xs font-semibold border border-edge rounded-xl px-3 py-2 text-ink-2 hover:bg-canvas transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', refreshing && 'animate-spin')} />
            Refresh
          </button>
          <button
            onClick={() => router.push('/dashboard/sites/add')}
            className="inline-flex items-center gap-2 bg-accent text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-accent-hover transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Site
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="card p-4 border-red-200 bg-red-50/40">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Loading */}
      {loading && <SitesSkeleton />}

      {/* Loaded — empty */}
      {!loading && sites.length === 0 && !error && <EmptyState />}

      {/* Loaded — content */}
      {!loading && sites.length > 0 && (
        <>
          {/* Stat strip */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Total Sites',   value: String(sites.length), icon: Globe       },
              { label: 'Total Revenue', value: formatUsdcDollar(totalRevenue), icon: TrendingUp  },
              { label: 'Bot Blocks',    value: compactNumber(totalBlocks),    icon: AlertCircle },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="card p-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-accent-muted flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-accent" />
                </div>
                <div>
                  <p className="text-lg font-bold text-ink tabular">{value}</p>
                  <p className="text-xs text-ink-3">{label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Table */}
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-edge bg-canvas text-left">
                    {['Site', 'Status', 'Bot Blocks', 'Block Rate', 'Revenue', 'Actions'].map(h => (
                      <th key={h} className="px-5 py-3 text-2xs font-semibold text-ink-3 uppercase tracking-wide whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-edge">
                  {sites.map(site => (
                    <tr key={site.id} className="hover:bg-canvas/60 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-accent-muted flex items-center justify-center shrink-0">
                            <span className="text-xs font-bold text-accent">
                              {site.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-ink truncate">{site.name}</p>
                            <p className="text-2xs text-ink-3 truncate">{site.url}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4"><StatusBadge site={site} /></td>
                      <td className="px-5 py-4 tabular text-ink font-medium">
                        {site.verified ? compactNumber(site.stats.botBlocks) : '—'}
                      </td>
                      <td className="px-5 py-4 min-w-[120px]">
                        {site.verified
                          ? <BlockRateBar pct={site.stats.blockRate} />
                          : <span className="text-ink-3 text-2xs">Not configured</span>}
                      </td>
                      <td className="px-5 py-4 tabular font-semibold text-ink">
                        {site.verified ? formatUsdcDollar(site.stats.revenue) : '—'}
                      </td>
                      <td className="px-5 py-4">
                        {site.verified ? (
                          <Link
                            href={`/dashboard/sites/${site.id}/overview`}
                            className="text-xs font-semibold text-accent hover:underline whitespace-nowrap"
                          >
                            View →
                          </Link>
                        ) : (
                          <Link
                            href={`/dashboard/sites/${site.id}/settings`}
                            className="text-xs font-semibold text-amber-600 hover:underline whitespace-nowrap"
                          >
                            Finish setup →
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-3 border-t border-edge bg-canvas flex items-center justify-between">
              <p className="text-xs text-ink-3">{sites.length} site{sites.length !== 1 ? 's' : ''} total</p>
              <Link href="/dashboard/sites/add" className="text-xs font-semibold text-accent hover:underline">
                + Add another site
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
