'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  RefreshCw, ArrowDownToLine, Plus, List,
  ExternalLink, Copy, Check, ChevronRight, X,
  ArrowUpRight, ArrowDownLeft, Zap,
} from 'lucide-react';
import { useWallet } from '@/lib/walletStore';
import type { AutoWithdrawSettings } from '@/lib/walletStore';
import { formatUsdcDollar, timeAgo, explorerUrl } from '@/lib/formatters';
import WithdrawModal from '@/components/WithdrawModal';
import AddFundsModal from '@/components/AddFundsModal';
import NetworkBadge from '@/components/NetworkBadge';

// ── Types ─────────────────────────────────────────────────────────────────────

interface HistoryItem {
  id:        string;
  type:      'revenue' | 'withdrawal' | 'deposit';
  amount:    number;
  status:    'confirmed' | 'pending' | 'failed';
  timestamp: string;
  txHash:    string;
  network:   string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const TYPE_ICON: Record<HistoryItem['type'], React.ElementType> = {
  revenue:    ArrowDownLeft,
  deposit:    ArrowDownLeft,
  withdrawal: ArrowUpRight,
};

const TYPE_COLOR: Record<HistoryItem['type'], string> = {
  revenue:    'text-emerald-600',
  deposit:    'text-emerald-600',
  withdrawal: 'text-red-500',
};

const TYPE_LABEL: Record<HistoryItem['type'], string> = {
  revenue:    'Revenue',
  deposit:    'Deposit',
  withdrawal: 'Withdrawal',
};

const STATUS_BADGE: Record<HistoryItem['status'], string> = {
  confirmed: 'bg-emerald-100 text-emerald-700',
  pending:   'bg-amber-100 text-amber-700',
  failed:    'bg-red-100 text-red-600',
};

function AddressDisplay({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(address).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2_000);
  }

  return (
    <div className="flex items-center gap-2 bg-white/10 rounded-xl px-3 py-2 mt-3 max-w-full">
      <span className="font-mono text-xs text-white/80 truncate flex-1">
        {address.slice(0, 20)}…{address.slice(-8)}
      </span>
      <button
        onClick={copy}
        className="shrink-0 p-1 rounded hover:bg-white/20 transition-colors"
        title="Copy address"
      >
        {copied
          ? <Check className="w-3.5 h-3.5 text-emerald-300" />
          : <Copy className="w-3.5 h-3.5 text-white/60" />
        }
      </button>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function WalletPage() {
  const {
    smartWalletAddress, balance, network,
    isLoading, autoWithdraw, refreshBalance, setAutoWithdraw,
  } = useWallet();

  const [history,      setHistory]      = useState<HistoryItem[]>([]);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [showAddFunds, setShowAddFunds] = useState(false);

  const [awForm, setAwForm]   = useState<AutoWithdrawSettings>(autoWithdraw);
  const [awSaved, setAwSaved] = useState(false);

  const fetchHistory = useCallback(async () => {
    try {
      const res  = await fetch('/api/wallet/history');
      const data = await res.json() as { history: HistoryItem[] };
      setHistory(data.history);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchHistory();
    const id = setInterval(() => { void refreshBalance(); }, 30_000);
    return () => clearInterval(id);
  }, [fetchHistory, refreshBalance]);

  useEffect(() => { setAwForm(autoWithdraw); }, [autoWithdraw]);

  async function saveAutoWithdraw() {
    setAutoWithdraw(awForm);
    await fetch('/api/wallet/auto-withdraw', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(awForm),
    });
    setAwSaved(true);
    setTimeout(() => setAwSaved(false), 2_000);
  }

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Wallet</h1>
          <p className="text-sm text-slate-500 mt-0.5">Your ScraperKast platform wallet</p>
        </div>
        <button
          onClick={() => { void refreshBalance(); }}
          disabled={isLoading}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-brand-dark transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* ── Balance hero + Quick Actions ────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Balance hero */}
        <div className="lg:col-span-2 bg-brand-dark rounded-2xl p-6 text-white">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-white/60">
                USDC Balance
              </p>
              <div className="flex items-end gap-3 mt-2">
                {isLoading ? (
                  <span className="text-4xl font-bold opacity-40">···</span>
                ) : (
                  <>
                    <span className="text-4xl lg:text-5xl font-bold tabular-nums leading-none">
                      {(balance / 1_000_000).toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                    <span className="text-lg font-medium text-white/60 mb-1">USDC</span>
                  </>
                )}
              </div>
              <p className="text-sm text-white/40 mt-1">
                ≈ ${(balance / 1_000_000).toFixed(2)} USD
              </p>
            </div>
            <NetworkBadge />
          </div>

          {/* Smart wallet address */}
          <div className="mt-4 pt-4 border-t border-white/20">
            <p className="text-xs text-white/50 font-medium uppercase tracking-wide">
              Your deposit address
            </p>
            <AddressDisplay address={smartWalletAddress} />
            <p className="text-xs text-white/30 mt-2">
              Send USDC on Solana to this address to fund your account
            </p>
          </div>
        </div>

        {/* Quick actions */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-slate-700">Quick Actions</h2>

          <button
            onClick={() => setShowAddFunds(true)}
            className="w-full flex items-center gap-3 px-4 py-3 bg-brand-dark text-white rounded-xl font-semibold hover:bg-brand-mid transition-colors text-sm"
          >
            <Plus className="w-4 h-4 shrink-0" />
            Add Funds
          </button>

          <button
            onClick={() => setShowWithdraw(true)}
            className="w-full flex items-center gap-3 px-4 py-3 border border-slate-200 text-slate-700 rounded-xl font-semibold hover:bg-slate-50 transition-colors text-sm"
          >
            <ArrowDownToLine className="w-4 h-4 shrink-0" />
            Withdraw
          </button>

          <Link
            href="/dashboard/transactions"
            className="w-full flex items-center gap-3 px-4 py-3 border border-slate-200 text-slate-600 rounded-xl font-semibold hover:bg-slate-50 transition-colors text-sm"
          >
            <List className="w-4 h-4 shrink-0" />
            All Transactions
            <ChevronRight className="w-4 h-4 ml-auto" />
          </Link>

          {/* Explorer link */}
          <a
            href={`https://explorer.solana.com/address/${smartWalletAddress}?cluster=${network}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center gap-3 px-4 py-3 border border-slate-200 text-slate-600 rounded-xl font-semibold hover:bg-slate-50 transition-colors text-sm"
          >
            <ExternalLink className="w-4 h-4 shrink-0" />
            View on Explorer
          </a>
        </div>
      </div>

      {/* ── Auto-withdraw settings ───────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-700">Auto-Withdraw</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Automatically sweep your balance when it exceeds a threshold
            </p>
          </div>
          <button
            type="button"
            onClick={() => setAwForm(s => ({ ...s, enabled: !s.enabled }))}
            className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${awForm.enabled ? 'bg-brand-dark' : 'bg-slate-200'}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${awForm.enabled ? 'translate-x-5' : ''}`} />
          </button>
        </div>

        {awForm.enabled && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-100">
            <div>
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                Threshold (USDC)
              </label>
              <div className="mt-1.5 relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                <input
                  type="number" min="1"
                  value={awForm.threshold / 1_000_000}
                  onChange={e => setAwForm(s => ({
                    ...s,
                    threshold: Math.max(0, Math.floor(parseFloat(e.target.value || '0') * 1_000_000)),
                  }))}
                  className="w-full pl-7 pr-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-dark/30 focus:border-brand-dark text-slate-900 font-mono"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                Destination Wallet
              </label>
              <input
                type="text"
                placeholder="Solana address (base58)"
                value={awForm.destination}
                onChange={e => setAwForm(s => ({ ...s, destination: e.target.value }))}
                className="mt-1.5 w-full px-3 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-dark/30 focus:border-brand-dark text-slate-900 font-mono text-sm"
              />
            </div>
          </div>
        )}

        <div className="flex justify-end mt-4">
          <button
            onClick={() => { void saveAutoWithdraw(); }}
            className="px-4 py-2 bg-brand-dark text-white font-semibold rounded-xl hover:bg-brand-mid transition-colors text-sm"
          >
            {awSaved ? '✓ Saved!' : 'Save Settings'}
          </button>
        </div>
      </div>

      {/* ── Recent Transactions ──────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">Recent Transactions</h2>
          <Link
            href="/dashboard/transactions"
            className="text-xs font-semibold text-brand-dark hover:text-brand-mid transition-colors flex items-center gap-1"
          >
            View All <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-50 text-left">
                <th className="px-4 py-3 font-medium text-slate-400 text-xs uppercase tracking-wide">Type</th>
                <th className="px-4 py-3 font-medium text-slate-400 text-xs uppercase tracking-wide text-right">Amount</th>
                <th className="px-4 py-3 font-medium text-slate-400 text-xs uppercase tracking-wide">Status</th>
                <th className="px-4 py-3 font-medium text-slate-400 text-xs uppercase tracking-wide">When</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {history.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center">
                    <Zap className="w-6 h-6 text-slate-200 mx-auto mb-2" />
                    <p className="text-sm text-slate-400">No transactions yet</p>
                    <button
                      onClick={() => setShowAddFunds(true)}
                      className="mt-2 text-sm font-semibold text-brand-dark hover:underline"
                    >
                      Add funds to get started
                    </button>
                  </td>
                </tr>
              ) : (
                history.slice(0, 10).map(item => {
                  const Icon = TYPE_ICON[item.type];
                  return (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <span className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                            item.type === 'withdrawal' ? 'bg-red-100' : 'bg-emerald-100'
                          }`}>
                            <Icon className={`w-3.5 h-3.5 ${TYPE_COLOR[item.type]}`} />
                          </span>
                          <span className={`font-medium ${TYPE_COLOR[item.type]}`}>
                            {TYPE_LABEL[item.type]}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono font-semibold whitespace-nowrap">
                        <span className={TYPE_COLOR[item.type]}>
                          {item.type === 'withdrawal' ? '−' : '+'}
                          {formatUsdcDollar(Math.abs(item.amount))}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_BADGE[item.status]}`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-400 whitespace-nowrap">
                        {timeAgo(new Date(item.timestamp))}
                      </td>
                      <td className="px-4 py-3.5">
                        <a
                          href={explorerUrl(item.txHash, item.network as 'devnet' | 'mainnet')}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-slate-300 hover:text-brand-dark transition-colors"
                          title="View on Explorer"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Debug panel (dev only) ───────────────────────────────────────────── */}
      {process.env.NODE_ENV === 'development' && (
        <details className="bg-slate-900 rounded-xl text-xs font-mono text-slate-300 overflow-hidden">
          <summary className="px-4 py-2.5 cursor-pointer text-slate-400 hover:text-slate-200 select-none">
            🔍 Debug Info
          </summary>
          <div className="px-4 pb-4 pt-3 space-y-1 border-t border-slate-700">
            <div><span className="text-slate-500">smart wallet :</span> {smartWalletAddress}</div>
            <div><span className="text-slate-500">balance (µ)  :</span> {balance}</div>
            <div><span className="text-slate-500">balance USDC :</span> {(balance / 1_000_000).toFixed(6)}</div>
            <div><span className="text-slate-500">network      :</span> {network}</div>
            <button
              onClick={() => { void refreshBalance(); }}
              className="mt-2 px-3 py-1.5 bg-brand-dark text-white rounded-lg text-xs"
            >
              Force Refresh
            </button>
          </div>
        </details>
      )}

      {/* ── Modals ───────────────────────────────────────────────────────────── */}
      {showWithdraw && <WithdrawModal onClose={() => setShowWithdraw(false)} />}
      {showAddFunds && <AddFundsModal onClose={() => setShowAddFunds(false)} />}

    </div>
  );
}
