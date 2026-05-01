'use client';

/**
 * /dashboard/wallet
 *
 * Platform wallet dashboard — shows USDC balance, recent WalletTransactions,
 * quick stats, and a deposit instructions modal.
 *
 * Data: GET /api/wallet/balance  +  GET /api/wallet/transactions
 */

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ExternalLink, RefreshCw, Copy, Check, ArrowUpRight, ArrowDownLeft, DollarSign, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getTxExplorerUrl } from '@/lib/config';

// ── Types ─────────────────────────────────────────────────────────────────────

interface WalletBalance {
  balance:            number;
  availableBalance:   number;
  pendingWithdrawals: number;
  smartWalletAddress: string | null;
  withdrawalAddress:  string | null;
  currency:           string;
}

interface WalletTx {
  id:        string;
  type:      'deposit' | 'withdrawal' | 'revenue';
  amount:    number;
  network:   string;
  txHash:    string | null;
  verified:  boolean;
  status:    string;
  siteId:    string | null;
  createdAt: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtUsdc(n: number) {
  if (n >= 1)      return `$${n.toFixed(2)}`;
  if (n >= 0.0001) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(6)}`;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

function shortenHash(h: string) {
  return h.length > 16 ? `${h.slice(0, 8)}…${h.slice(-6)}` : h;
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, string> = {
    confirmed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    pending:   'bg-amber-50 text-amber-700 border-amber-200',
    failed:    'bg-red-50 text-red-700 border-red-200',
  };
  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-semibold border capitalize',
      cfg[status] ?? cfg.pending,
    )}>
      {status}
    </span>
  );
}

// ── Tx type display ───────────────────────────────────────────────────────────

const TX_CFG: Record<string, { label: string; icon: React.ReactNode; sign: string; color: string }> = {
  revenue:    { label: 'Revenue',    icon: <DollarSign className="w-4 h-4" />,     sign: '+', color: 'text-emerald-700' },
  deposit:    { label: 'Deposit',    icon: <ArrowDownLeft className="w-4 h-4" />,  sign: '+', color: 'text-blue-600'    },
  withdrawal: { label: 'Withdrawal', icon: <ArrowUpRight className="w-4 h-4" />,   sign: '-', color: 'text-orange-600'  },
};

// ── Copy button ───────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy}
      className="flex items-center gap-1 text-2xs font-semibold px-2 py-1 rounded-lg bg-white/20 hover:bg-white/30 transition-colors text-white border border-white/20">
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

// ── Deposit modal ─────────────────────────────────────────────────────────────

function DepositModal({ onClose, smartWalletAddress }: { onClose: () => void; smartWalletAddress: string | null }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative card max-w-lg w-full mx-4 p-0 overflow-hidden animate-fade-in z-10">

        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-edge">
          <h2 className="text-base font-bold text-ink">Add Testnet USDC</h2>
          <button onClick={onClose}
            className="text-ink-3 hover:text-ink transition-colors text-lg font-light w-8 h-8 rounded-lg hover:bg-canvas flex items-center justify-center">
            ✕
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Warning */}
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <span className="text-lg">⚠️</span>
            <p className="text-xs text-amber-800 leading-relaxed">
              <strong>Testnet only.</strong> Send Base Sepolia USDC directly to <strong>your smart wallet</strong>.
              Real funds sent here will be lost.
            </p>
          </div>

          {/* Address */}
          <div>
            <p className="text-xs font-semibold text-ink-3 uppercase tracking-wide mb-2">
              Your Smart Wallet Address
            </p>
            {smartWalletAddress ? (
              <div className="flex items-center gap-2 bg-canvas border border-edge rounded-xl px-3 py-2.5">
                <code className="text-xs font-mono text-ink flex-1 break-all">{smartWalletAddress}</code>
                <button
                  onClick={() => navigator.clipboard.writeText(smartWalletAddress)}
                  className="shrink-0 text-xs font-semibold text-accent hover:underline"
                >
                  Copy
                </button>
              </div>
            ) : (
              <p className="text-xs text-ink-3 italic">Generating your smart wallet…</p>
            )}
            <p className="text-2xs text-ink-3 mt-1.5">
              ✅ This is your unique wallet. Bots pay here automatically.
            </p>
          </div>

          {/* Steps */}
          <div>
            <p className="text-xs font-semibold text-ink-3 uppercase tracking-wide mb-3">How to get testnet USDC</p>
            <ol className="space-y-2.5">
              {[
                <>Get Base Sepolia ETH from the{' '}
                  <a href="https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet"
                    target="_blank" rel="noreferrer"
                    className="text-accent hover:underline font-semibold">
                    Coinbase Faucet
                  </a>
                </>,
                <>Get testnet USDC from{' '}
                  <a href="https://faucet.circle.com" target="_blank" rel="noreferrer"
                    className="text-accent hover:underline font-semibold">
                    Circle Faucet
                  </a>
                </>,
                'Send USDC to the platform wallet address above',
                'Balance appears automatically after 1–2 block confirmations',
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-3 text-xs text-ink-2">
                  <span className="w-5 h-5 rounded-full bg-accent text-white flex items-center justify-center text-2xs font-bold shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <span className="leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>

        <div className="px-6 pb-5">
          <button onClick={onClose}
            className="w-full btn-primary">
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="rounded-2xl h-52 skeleton-line" />
      <div className="grid grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="card p-4">
            <div className="skeleton-line h-3 w-20 mb-3" />
            <div className="skeleton-line h-7 w-24" />
          </div>
        ))}
      </div>
      <div className="card p-5">
        <div className="skeleton-line h-5 w-40 mb-4" />
        {[...Array(4)].map((_, i) => <div key={i} className="skeleton-line h-14 mb-2 rounded-xl" />)}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function WalletPage() {
  const searchParams                = useSearchParams();
  const successMsg                  = searchParams.get('success');

  const [balance, setBalance]       = useState<WalletBalance | null>(null);
  const [txns,    setTxns]          = useState<WalletTx[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error,   setError]         = useState<string | null>(null);
  const [deposit, setDeposit]       = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [balRes, txRes] = await Promise.all([
        fetch('/api/wallet/balance'),
        fetch('/api/wallet/transactions?limit=5'),
      ]);
      if (!balRes.ok) throw new Error(`Balance: ${balRes.status}`);
      const balData = await balRes.json() as WalletBalance;
      setBalance(balData);

      if (txRes.ok) {
        const txData = await txRes.json() as { transactions: WalletTx[] };
        setTxns(txData.transactions ?? []);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (loading) return <Skeleton />;

  if (error) {
    return (
      <div className="card p-8 text-center space-y-3">
        <p className="text-sm font-semibold text-ink">Could not load wallet</p>
        <p className="text-xs text-ink-3">{error}</p>
        <button onClick={() => void load()}
          className="text-xs font-semibold text-accent hover:underline flex items-center gap-1 mx-auto">
          <RefreshCw className="w-3 h-3" /> Retry
        </button>
      </div>
    );
  }

  // ── Derived stats ───────────────────────────────────────────────────────────
  const totalRevenue   = txns.filter(t => t.type === 'revenue').reduce((s, t) => s + t.amount, 0);
  const totalWithdrawn = txns.filter(t => t.type === 'withdrawal' && t.status === 'confirmed').reduce((s, t) => s + t.amount, 0);
  const bal            = balance?.balance ?? 0;
  const available      = balance?.availableBalance ?? 0;
  const pending        = balance?.pendingWithdrawals ?? 0;

  return (
    <>
      <div className="space-y-6 animate-fade-in">

        {/* Success banner */}
        {successMsg === 'withdrawal' && (
          <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 animate-fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <p className="text-sm font-semibold text-emerald-800">
              Withdrawal submitted successfully! Funds should arrive within ~30 seconds.
            </p>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-ink">Wallet</h2>
            <p className="text-xs text-ink-3 mt-0.5">Platform USDC balance · Base Sepolia testnet</p>
          </div>
          <button onClick={() => void load()}
            className="p-1.5 rounded-lg text-ink-3 hover:text-ink hover:bg-canvas transition-colors"
            title="Refresh">
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          </button>
        </div>

        {/* ── Balance card ── */}
        <div className="wallet-balance-card">
          <div className="flex items-start justify-between mb-5">
            <div>
              <p className="text-sm font-semibold opacity-80">USDC Balance</p>
              <p className="text-2xs opacity-60 mt-0.5">Base Sepolia Testnet</p>
            </div>
            <div className="wallet-balance-icon">💰</div>
          </div>

          <div className="mb-1">
            <span className="wallet-balance-amount">{fmtUsdc(bal)}</span>
            <span className="text-lg font-semibold opacity-70 ml-2">USDC</span>
          </div>

          {pending > 0 && (
            <p className="text-xs opacity-75 mb-1">
              {fmtUsdc(pending)} pending withdrawal
            </p>
          )}
          <p className="text-sm opacity-80 mb-6">
            Available: <strong>{fmtUsdc(available)}</strong>
          </p>

          {/* Smart wallet address strip */}
          {balance?.smartWalletAddress && (
            <div className="mb-5 flex items-center gap-2 bg-white/10 border border-white/20 rounded-xl px-3 py-2">
              <div className="flex-1 min-w-0">
                <p className="text-2xs opacity-60 font-semibold uppercase tracking-wide mb-0.5">Your Smart Wallet</p>
                <code className="text-xs font-mono opacity-90 truncate block">{balance.smartWalletAddress}</code>
              </div>
              <CopyButton text={balance.smartWalletAddress} />
            </div>
          )}

          <div className="flex items-center gap-3">
            <Link href="/dashboard/wallet/withdraw" className="flex-1">
              <button
                className="wallet-btn-withdraw w-full"
                disabled={available <= 0}
              >
                Withdraw Funds
              </button>
            </Link>
            <button onClick={() => setDeposit(true)} className="wallet-btn-deposit flex-1">
              Add Funds
            </button>
          </div>
        </div>

        {/* ── Quick stats ── */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total Revenue',   value: fmtUsdc(totalRevenue)   },
            { label: 'Total Withdrawn', value: fmtUsdc(totalWithdrawn) },
            { label: 'Transactions',    value: String(txns.length)      },
          ].map(s => (
            <div key={s.label} className="card p-4">
              <p className="text-2xs text-ink-3 font-semibold uppercase tracking-wide mb-2">{s.label}</p>
              <p className="text-xl font-bold text-ink tabular">{s.value}</p>
            </div>
          ))}
        </div>

        {/* ── Recent transactions ── */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-edge">
            <h3 className="text-sm font-bold text-ink">Recent Transactions</h3>
            <Link href="/dashboard/wallet/transactions"
              className="text-2xs font-semibold text-accent hover:underline">
              View all
            </Link>
          </div>

          {txns.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon text-2xl">📭</div>
              <p className="text-sm font-semibold text-ink">No transactions yet</p>
              <p className="text-xs text-ink-3">Revenue credits and withdrawals will appear here</p>
            </div>
          ) : (
            <div className="divide-y divide-edge">
              {txns.map(tx => {
                const cfg = TX_CFG[tx.type] ?? TX_CFG.revenue;
                return (
                  <div key={tx.id} className="flex items-center gap-4 px-5 py-3 hover:bg-canvas/60 transition-colors">
                    {/* Icon */}
                    <div className={cn(
                      'w-9 h-9 rounded-xl flex items-center justify-center shrink-0',
                      tx.type === 'revenue'    && 'bg-emerald-50 text-emerald-600',
                      tx.type === 'deposit'    && 'bg-blue-50 text-blue-600',
                      tx.type === 'withdrawal' && 'bg-orange-50 text-orange-600',
                    )}>
                      {cfg.icon}
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-ink">{cfg.label}</p>
                      <p className="text-2xs text-ink-3">{fmtDate(tx.createdAt)}</p>
                    </div>

                    {/* Amount + status */}
                    <div className="flex items-center gap-3 shrink-0">
                      <span className={cn('text-sm font-bold tabular', cfg.color)}>
                        {cfg.sign}{fmtUsdc(tx.amount)}
                      </span>
                      <StatusBadge status={tx.status} />
                      {tx.txHash && (
                        <a
                          href={getTxExplorerUrl(tx.txHash, tx.network)}
                          target="_blank"
                          rel="noreferrer"
                          className="text-ink-3 hover:text-accent transition-colors"
                          title="View on explorer"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Withdrawal address note ── */}
        {balance?.withdrawalAddress ? (
          <div className="card p-4 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
              <Check className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-ink">Withdrawal address configured</p>
              <code className="text-2xs font-mono text-ink-3">{balance.withdrawalAddress}</code>
            </div>
            <Link href="/dashboard/settings"
              className="text-2xs font-semibold text-accent hover:underline shrink-0">
              Edit
            </Link>
          </div>
        ) : (
          <div className="card p-4 flex items-center gap-3 border-amber-200 bg-amber-50/50">
            <span className="text-lg shrink-0">⚠️</span>
            <div className="flex-1">
              <p className="text-xs font-semibold text-ink">No withdrawal address set</p>
              <p className="text-2xs text-ink-3">Add your Ethereum address in Settings to enable withdrawals</p>
            </div>
            <Link href="/dashboard/settings"
              className="text-2xs font-semibold text-accent hover:underline shrink-0">
              Configure
            </Link>
          </div>
        )}
      </div>

      {deposit && (
        <DepositModal
          onClose={() => setDeposit(false)}
          smartWalletAddress={balance?.smartWalletAddress ?? null}
        />
      )}
    </>
  );
}
