'use client';

/**
 * Full transaction history for a site.
 * GET /api/sites/[siteId]/revenue/transactions
 * Supports filter by method; paginated (20/page).
 */

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ExternalLink, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getTxExplorerUrl } from '@/lib/config';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Transaction {
  id:          string;
  botName:     string;
  botId:       string;
  method:      string;
  amount:      number;
  currency:    string;
  tokenIn:     string | null;
  network:     string;
  txHash:      string;
  verified:    boolean;
  blockNumber: number | null;
  path:        string;
  createdAt:   string;
}

interface TxPage {
  transactions: Transaction[];
  pagination: {
    page:     number;
    limit:    number;
    total:    number;
    hasNext:  boolean;
    hasPrev:  boolean;
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtUsdc(amount: number): string {
  if (amount >= 1)      return `$${amount.toFixed(2)}`;
  if (amount >= 0.0001) return `$${amount.toFixed(4)}`;
  return `$${amount.toFixed(6)}`;
}

function shortenHash(h: string, chars = 6): string {
  return h.length > chars * 2 + 3 ? `${h.slice(0, chars)}…${h.slice(-chars)}` : h;
}

function fmtDate(d: string): string {
  return new Date(d).toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

// ── Method badge ──────────────────────────────────────────────────────────────

const METHOD_CFG: Record<string, { label: string; cls: string }> = {
  x402:    { label: '🤖 x402',    cls: 'method-badge-x402'    },
  uniswap: { label: '🦄 Uniswap', cls: 'method-badge-uniswap' },
  direct:  { label: '💵 Direct',  cls: 'method-badge-direct'  },
};

function MethodBadge({ method }: { method: string }) {
  const { label, cls } = METHOD_CFG[method] ?? { label: method, cls: '' };
  return <span className={cn('method-badge', cls)}>{label}</span>;
}

// ── Filter tab ────────────────────────────────────────────────────────────────

type Filter = 'all' | 'x402' | 'uniswap' | 'direct';

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: 'all',     label: 'All'         },
  { key: 'x402',    label: '🤖 x402'     },
  { key: 'uniswap', label: '🦄 Uniswap'  },
  { key: 'direct',  label: '💵 Direct'   },
];

// ── Skeleton row ──────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr>
      {[3, 2, 2, 1.5, 2, 1].map((w, i) => (
        <td key={i} className="px-4 py-3">
          <div className={`skeleton-line h-3 w-${w * 8}`} style={{ width: `${w * 32}px` }} />
        </td>
      ))}
    </tr>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TransactionsPage() {
  const { siteId } = useParams<{ siteId: string }>();

  const [data,    setData]    = useState<TxPage | null>(null);
  const [filter,  setFilter]  = useState<Filter>('all');
  const [page,    setPage]    = useState(1);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const load = useCallback(async (f: Filter, p: number) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page:  String(p),
        limit: '20',
        ...(f !== 'all' && { method: f }),
      });
      const res = await fetch(`/api/sites/${siteId}/revenue/transactions?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json() as TxPage;
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [siteId]);

  useEffect(() => {
    setPage(1);
    void load(filter, 1);
  }, [filter, load]);

  const goPage = (p: number) => {
    setPage(p);
    void load(filter, p);
  };

  const txns   = data?.transactions ?? [];
  const pag    = data?.pagination;

  return (
    <div className="space-y-5 animate-fade-in">

      {/* Back + header */}
      <div className="flex items-center gap-3">
        <Link href={`/dashboard/sites/${siteId}/revenue`}
          className="text-ink-3 hover:text-ink transition-colors p-1 rounded-lg hover:bg-canvas">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h2 className="text-base font-bold text-ink">Transactions</h2>
          <p className="text-xs text-ink-3 mt-0.5">
            {pag ? `${pag.total} verified payment${pag.total !== 1 ? 's' : ''}` : 'Loading…'}
          </p>
        </div>
        <button onClick={() => void load(filter, page)}
          className="ml-auto text-ink-3 hover:text-ink transition-colors p-1.5 rounded-lg hover:bg-canvas"
          title="Refresh">
          <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 border-b border-edge pb-px overflow-x-auto scrollbar-thin">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium whitespace-nowrap rounded-t-lg border-b-2 -mb-px transition-colors',
              filter === f.key
                ? 'text-accent border-accent font-semibold'
                : 'text-ink-3 border-transparent hover:text-ink hover:border-edge',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="card p-6 text-center space-y-2">
          <p className="text-sm font-semibold text-ink">Failed to load transactions</p>
          <p className="text-xs text-ink-3">{error}</p>
          <button onClick={() => void load(filter, page)}
            className="text-xs font-semibold text-accent hover:underline">
            Retry
          </button>
        </div>
      )}

      {/* Table */}
      {!error && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>Bot</th>
                  <th>Method</th>
                  <th>Amount</th>
                  <th>Path</th>
                  <th>Date</th>
                  <th>Tx Hash</th>
                </tr>
              </thead>
              <tbody>
                {loading
                  ? [...Array(5)].map((_, i) => <SkeletonRow key={i} />)
                  : txns.length === 0
                    ? (
                      <tr>
                        <td colSpan={6} className="text-center py-12 text-ink-3 text-sm">
                          No transactions found
                          {filter !== 'all' && (
                            <button onClick={() => setFilter('all')}
                              className="ml-2 text-accent font-semibold hover:underline">
                              Clear filter
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                    : txns.map(tx => (
                      <tr key={tx.id}>

                        {/* Bot */}
                        <td>
                          <span className="text-sm font-semibold text-ink">{tx.botName}</span>
                        </td>

                        {/* Method */}
                        <td>
                          <MethodBadge method={tx.method} />
                          {tx.tokenIn && (
                            <div className="text-2xs text-ink-3 mt-0.5 font-mono">
                              via {tx.tokenIn.slice(0, 6)}…
                            </div>
                          )}
                        </td>

                        {/* Amount */}
                        <td>
                          <span className="text-sm font-bold text-emerald-700 tabular">
                            {fmtUsdc(tx.amount)}
                          </span>
                          <span className="ml-1 text-2xs text-ink-3">{tx.currency}</span>
                        </td>

                        {/* Path */}
                        <td>
                          <code className="text-2xs font-mono text-ink-3 bg-canvas px-1.5 py-0.5 rounded">
                            {tx.path}
                          </code>
                        </td>

                        {/* Date */}
                        <td>
                          <span className="text-xs text-ink-3 tabular whitespace-nowrap">
                            {fmtDate(tx.createdAt)}
                          </span>
                          {tx.blockNumber && (
                            <div className="text-2xs text-ink-3 mt-0.5">
                              block #{tx.blockNumber.toLocaleString()}
                            </div>
                          )}
                        </td>

                        {/* Tx hash */}
                        <td>
                          <a
                            href={getTxExplorerUrl(tx.txHash, tx.network)}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1.5 group"
                            title="View on blockchain explorer"
                          >
                            <code className="text-2xs font-mono text-ink-3 group-hover:text-accent transition-colors">
                              {shortenHash(tx.txHash)}
                            </code>
                            <ExternalLink className="w-3 h-3 text-ink-3 group-hover:text-accent transition-colors shrink-0" />
                          </a>
                        </td>

                      </tr>
                    ))
                }
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pag && pag.total > pag.limit && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-edge bg-canvas/50">
              <span className="text-xs text-ink-3">
                Showing {((pag.page - 1) * pag.limit) + 1}–{Math.min(pag.page * pag.limit, pag.total)} of {pag.total}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => goPage(page - 1)}
                  disabled={!pag.hasPrev || loading}
                  className={cn(
                    'p-1.5 rounded-lg transition-colors',
                    pag.hasPrev && !loading
                      ? 'text-ink hover:bg-edge'
                      : 'text-edge cursor-not-allowed',
                  )}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs font-semibold text-ink px-2 tabular">
                  {pag.page} / {Math.ceil(pag.total / pag.limit)}
                </span>
                <button
                  onClick={() => goPage(page + 1)}
                  disabled={!pag.hasNext || loading}
                  className={cn(
                    'p-1.5 rounded-lg transition-colors',
                    pag.hasNext && !loading
                      ? 'text-ink hover:bg-edge'
                      : 'text-edge cursor-not-allowed',
                  )}
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
