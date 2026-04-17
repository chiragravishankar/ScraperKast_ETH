'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Wallet, RefreshCw, ArrowDownToLine, Plus, List, Zap,
  ExternalLink, Shield, Settings2, CreditCard, Trash2,
  ChevronRight, X,
} from 'lucide-react';
import { useWallet as useAdapterWallet, useConnection } from '@solana/wallet-adapter-react';
import { usePlatformWallet } from '@/lib/walletStore';
import type { AutoWithdrawSettings } from '@/lib/walletStore';
import { formatUsdcDollar, shortenAddress, timeAgo, explorerUrl } from '@/lib/formatters';
import ConnectWallet from '@/components/ConnectWallet';
import WithdrawModal from '@/components/WithdrawModal';
import AddFundsModal from '@/components/AddFundsModal';
import CopyButton from '@/components/CopyButton';
import NetworkBadge from '@/components/NetworkBadge';

// ── Types ─────────────────────────────────────────────────────────────────────

interface HistoryItem {
  id:        string;
  type:      'revenue' | 'withdrawal' | 'deposit';
  amount:    number; // µUSDC (positive for revenue/deposit, negative for withdrawal)
  status:    'confirmed' | 'pending' | 'failed';
  timestamp: string;
  txHash:    string;
  network:   string;
}

interface MockCard {
  id:        string;
  brand:     string;
  last4:     string;
  expiry:    string;
  isDefault: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatBalance(µUsdc: number): string {
  return (µUsdc / 1_000_000).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const TYPE_LABEL: Record<HistoryItem['type'], string> = {
  revenue:    'Revenue',
  withdrawal: 'Withdrawal',
  deposit:    'Deposit',
};

const TYPE_COLOR: Record<HistoryItem['type'], string> = {
  revenue:    'text-emerald-600',
  withdrawal: 'text-red-500',
  deposit:    'text-sky-600',
};

const STATUS_BADGE: Record<HistoryItem['status'], string> = {
  confirmed: 'bg-emerald-100 text-emerald-700',
  pending:   'bg-amber-100 text-amber-700',
  failed:    'bg-red-100 text-red-600',
};

const WALLET_BADGE: Record<string, string> = {
  phantom:  'bg-purple-100 text-purple-700',
  solflare: 'bg-orange-100 text-orange-700',
  backpack: 'bg-red-100 text-red-700',
};

// ── Mock payment methods (demo) ───────────────────────────────────────────────

const INITIAL_CARDS: MockCard[] = [
  { id: 'c-1', brand: 'Visa',       last4: '4242', expiry: '08/26', isDefault: true  },
  { id: 'c-2', brand: 'Mastercard', last4: '5555', expiry: '03/27', isDefault: false },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function WalletPage() {
  const {
    address, walletType, balance, pending, lifetime, today, network,
    isConnected, isLoading, autoWithdraw, refreshBalance, setAutoWithdraw,
  } = usePlatformWallet();

  // Adapter gives us real disconnect + wallet metadata
  const {
    disconnect: adapterDisconnect, wallet: activeWallet,
    publicKey, connected: adapterConnected,
  } = useAdapterWallet();
  const { connection } = useConnection();

  function disconnect() {
    void adapterDisconnect();
  }

  const [history,      setHistory]      = useState<HistoryItem[]>([]);
  const [cards,        setCards]        = useState<MockCard[]>(INITIAL_CARDS);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [showAddFunds, setShowAddFunds] = useState(false);
  const [showConnect,  setShowConnect]  = useState(false);

  // Local copy of auto-withdraw settings so form edits don't immediately persist
  const [awForm, setAwForm]   = useState<AutoWithdrawSettings>(autoWithdraw);
  const [awSaved, setAwSaved] = useState(false);

  const fetchHistory = useCallback(async () => {
    try {
      const res  = await fetch('/api/wallet/history');
      const data = await res.json() as { history: HistoryItem[] };
      setHistory(data.history);
    } catch { /* ignore */ }
  }, []);

  // Initial load + poll balance every 10 s
  useEffect(() => {
    refreshBalance();
    fetchHistory();
    const id = setInterval(() => { void refreshBalance(); }, 10_000);
    return () => clearInterval(id);
  }, [refreshBalance, fetchHistory]);

  // Sync auto-withdraw form when context changes (e.g., after connect)
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

  function setDefaultCard(id: string) {
    setCards(cs => cs.map(c => ({ ...c, isDefault: c.id === id })));
  }

  function removeCard(id: string) {
    setCards(cs => cs.filter(c => c.id !== id));
  }

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Wallet &amp; Payments</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage your USDC balance, withdrawals, and payment methods
          </p>
        </div>
        <button
          onClick={() => { void refreshBalance(); }}
          disabled={isLoading}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-brand-dark transition-colors"
          title="Refresh balance"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* ── Debug Panel (remove once balance is confirmed working) ─────────── */}
      <details className="bg-slate-900 rounded-xl text-xs font-mono text-slate-300 overflow-hidden">
        <summary className="px-4 py-2.5 cursor-pointer text-slate-400 hover:text-slate-200 select-none">
          🔍 Debug: Wallet &amp; Balance Info
        </summary>
        <div className="px-4 pb-4 space-y-1 border-t border-slate-700 pt-3">
          <div><span className="text-slate-500">adapter connected :</span> {adapterConnected ? '✅ true' : '❌ false'}</div>
          <div><span className="text-slate-500">store isConnected :</span> {isConnected ? '✅ true' : '❌ false'}</div>
          <div><span className="text-slate-500">publicKey        :</span> {publicKey?.toBase58() ?? 'none'}</div>
          <div><span className="text-slate-500">wallet name      :</span> {activeWallet?.adapter.name ?? 'none'}</div>
          <div><span className="text-slate-500">rpc endpoint     :</span> {connection.rpcEndpoint}</div>
          <div><span className="text-slate-500">balance (µUSDC)  :</span> {balance}</div>
          <div><span className="text-slate-500">balance (USDC)   :</span> {(balance / 1_000_000).toFixed(6)}</div>
          <div><span className="text-slate-500">network          :</span> {network}</div>
          <div className="pt-2">
            <button
              onClick={() => {
                console.log('🔄 Manual refresh triggered from debug panel');
                void refreshBalance();
              }}
              className="px-3 py-1.5 bg-brand-dark text-white rounded-lg hover:bg-brand-mid transition-colors text-xs"
            >
              🔄 Force Refresh Balance
            </button>
          </div>
        </div>
      </details>

      {/* ── Section 1: Balance Hero + Quick Actions ──────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Balance hero card */}
        <div className="lg:col-span-2 bg-brand-dark rounded-2xl p-6 text-white">
          <div className="flex items-start justify-between mb-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-white/60">
                USDC Balance
              </p>
              <div className="flex items-end gap-3 mt-2">
                <span className="text-4xl lg:text-5xl font-bold tabular-nums leading-none">
                  {formatBalance(balance)}
                </span>
                <span className="text-lg font-medium text-white/60 mb-1">USDC</span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2 shrink-0">
              <NetworkBadge />
              <span className="p-2.5 rounded-xl bg-white/15">
                <Wallet className="w-5 h-5 text-white" />
              </span>
            </div>
          </div>

          {/* Sub-stats row */}
          <div className="grid grid-cols-3 gap-4 pt-4 border-t border-white/20">
            <div>
              <p className="text-xs text-white/50 font-medium">Pending</p>
              <p className="text-sm font-semibold mt-0.5 text-white/90 tabular-nums">
                {formatUsdcDollar(pending)}
              </p>
            </div>
            <div>
              <p className="text-xs text-white/50 font-medium">Today</p>
              <p className="text-sm font-semibold mt-0.5 text-emerald-300 tabular-nums">
                +{formatUsdcDollar(today)}
              </p>
            </div>
            <div>
              <p className="text-xs text-white/50 font-medium">All Time</p>
              <p className="text-sm font-semibold mt-0.5 text-white/90 tabular-nums">
                {formatUsdcDollar(lifetime)}
              </p>
            </div>
          </div>
        </div>

        {/* Quick actions card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-slate-700">Quick Actions</h2>

          <button
            onClick={() => setShowWithdraw(true)}
            className="w-full flex items-center gap-3 px-4 py-3 bg-brand-dark text-white rounded-xl font-semibold hover:bg-brand-mid transition-colors text-sm"
          >
            <ArrowDownToLine className="w-4 h-4 shrink-0" />
            Withdraw to Wallet
          </button>

          <button
            onClick={() => setShowAddFunds(true)}
            className="w-full flex items-center gap-3 px-4 py-3 border border-violet-200 bg-violet-50 text-violet-700 rounded-xl font-semibold hover:bg-violet-100 transition-colors text-sm"
          >
            <Plus className="w-4 h-4 shrink-0" />
            Add Funds
          </button>

          {!isConnected && (
            <button
              onClick={() => setShowConnect(true)}
              className="w-full flex items-center gap-3 px-4 py-3 border border-slate-200 text-slate-600 rounded-xl font-semibold hover:bg-slate-50 transition-colors text-sm"
            >
              <Zap className="w-4 h-4 shrink-0" />
              Connect Wallet
            </button>
          )}

          <Link
            href="/dashboard/transactions"
            className="w-full flex items-center gap-3 px-4 py-3 border border-slate-200 text-slate-600 rounded-xl font-semibold hover:bg-slate-50 transition-colors text-sm"
          >
            <List className="w-4 h-4 shrink-0" />
            View All Transactions
            <ChevronRight className="w-4 h-4 ml-auto" />
          </Link>

          {/* Trust signal */}
          <div className="mt-auto pt-3 border-t border-slate-100 flex items-center gap-2 text-xs text-slate-400">
            <Shield className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            Secured by Solana · Non-custodial
          </div>
        </div>
      </div>

      {/* ── Section 2: Connected Wallet + Auto-Withdraw ──────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Connected wallet card */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Connected Wallet</h2>

          {isConnected && address ? (
            <div className="space-y-4">
              {/* Status row */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                <span className="text-xs font-medium text-emerald-600">Connected</span>
                {walletType && (
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${WALLET_BADGE[walletType] ?? 'bg-slate-100 text-slate-600'}`}>
                    {walletType}
                  </span>
                )}
              </div>

              {/* Address */}
              <div className="bg-slate-50 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
                <span className="font-mono text-sm text-slate-700 truncate">
                  {shortenAddress(address)}
                </span>
                <CopyButton text={address} />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between text-sm">
                <a
                  href={`https://explorer.solana.com/address/${address}?cluster=${network}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-dark hover:underline inline-flex items-center gap-1 text-sm"
                >
                  View on Explorer <ExternalLink className="w-3 h-3" />
                </a>
                <button
                  onClick={disconnect}
                  className="text-red-500 hover:text-red-700 font-medium transition-colors text-sm"
                >
                  Disconnect
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-slate-500">
                No wallet connected. Connect a Solana wallet to enable on-chain withdrawals.
              </p>
              <button
                onClick={() => setShowConnect(true)}
                className="w-full py-3 border-2 border-dashed border-slate-200 rounded-xl text-sm font-medium text-slate-500 hover:border-brand-dark hover:text-brand-dark transition-colors"
              >
                + Connect Wallet
              </button>
            </div>
          )}
        </div>

        {/* Auto-withdraw settings card */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-700">Auto-Withdraw</h2>
            <Settings2 className="w-4 h-4 text-slate-400" />
          </div>

          <div className="space-y-4">
            {/* Enable toggle */}
            <label className="flex items-center justify-between cursor-pointer gap-3">
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-700">Enable auto-withdraw</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Automatically withdraw when balance exceeds threshold
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAwForm(s => ({ ...s, enabled: !s.enabled }))}
                className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${awForm.enabled ? 'bg-brand-dark' : 'bg-slate-200'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${awForm.enabled ? 'translate-x-5' : ''}`} />
              </button>
            </label>

            {/* Threshold */}
            <div>
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                Threshold (USDC)
              </label>
              <div className="mt-1.5 relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                <input
                  type="number"
                  min="1"
                  value={awForm.threshold / 1_000_000}
                  onChange={e => setAwForm(s => ({
                    ...s,
                    threshold: Math.max(0, Math.floor(parseFloat(e.target.value || '0') * 1_000_000)),
                  }))}
                  disabled={!awForm.enabled}
                  className="w-full pl-7 pr-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-dark/30 focus:border-brand-dark text-slate-900 font-mono disabled:opacity-50 disabled:bg-slate-50"
                />
              </div>
            </div>

            {/* Destination */}
            <div>
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                Destination Wallet
              </label>
              <input
                type="text"
                placeholder={address ?? 'Solana address (base58)'}
                value={awForm.destination}
                onChange={e => setAwForm(s => ({ ...s, destination: e.target.value }))}
                disabled={!awForm.enabled}
                className="mt-1.5 w-full px-3 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-dark/30 focus:border-brand-dark text-slate-900 font-mono text-sm disabled:opacity-50 disabled:bg-slate-50"
              />
            </div>

            <button
              onClick={() => { void saveAutoWithdraw(); }}
              className="w-full py-2.5 bg-brand-dark text-white font-semibold rounded-xl hover:bg-brand-mid transition-colors text-sm"
            >
              {awSaved ? '✓ Saved!' : 'Save Settings'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Section 2b: Devnet Faucet Helper ────────────────────────────────── */}
      {isConnected && network === 'devnet' && (
        <div className="bg-sky-50 border border-sky-200 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-sky-900 mb-3 flex items-center gap-2">
            <Zap className="w-4 h-4 text-sky-600" />
            Get Devnet Test Tokens
          </h2>
          <p className="text-xs text-sky-700 mb-3">
            You&apos;re on <strong>Devnet</strong> — all tokens are free test tokens with no real value.
          </p>
          <ol className="text-sm text-sky-800 space-y-2">
            <li>
              <span className="font-semibold">1. Get devnet SOL</span> (needed for transaction fees){' '}
              <a
                href="https://faucet.solana.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-dark hover:underline inline-flex items-center gap-0.5 font-medium"
              >
                Solana Faucet <ExternalLink className="w-3 h-3" />
              </a>
            </li>
            <li>
              <span className="font-semibold">2. Get devnet USDC</span>{' '}
              <a
                href="https://spl-token-faucet.com/?token-name=USDC-Dev"
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-dark hover:underline inline-flex items-center gap-0.5 font-medium"
              >
                SPL Token Faucet <ExternalLink className="w-3 h-3" />
              </a>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="font-semibold shrink-0">3. Your address:</span>
              <span className="font-mono text-xs break-all text-sky-700">{address}</span>
              {address && <CopyButton text={address} />}
            </li>
          </ol>
        </div>
      )}

      {/* ── Section 3: Payment Methods ───────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">Payment Methods</h2>
          <button
            onClick={() => setShowAddFunds(true)}
            className="text-xs font-semibold text-brand-dark hover:text-brand-mid transition-colors flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> Add Card
          </button>
        </div>

        {cards.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <CreditCard className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500">No payment methods added yet</p>
            <button
              onClick={() => setShowAddFunds(true)}
              className="mt-3 text-sm font-semibold text-brand-dark hover:underline"
            >
              Add a card
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {cards.map(card => (
              <div key={card.id} className="px-5 py-3.5 flex items-center gap-3 hover:bg-slate-50 transition-colors">
                {/* Card icon */}
                <div className="w-10 h-7 rounded bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                  <CreditCard className="w-4 h-4 text-slate-400" />
                </div>

                {/* Card info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 flex items-center gap-2 flex-wrap">
                    {card.brand} •••• {card.last4}
                    {card.isDefault && (
                      <span className="text-xs font-medium text-brand-dark bg-brand-dark/10 px-1.5 py-0.5 rounded-full">
                        Default
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-slate-400">Expires {card.expiry}</p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3 shrink-0">
                  {!card.isDefault && (
                    <button
                      onClick={() => setDefaultCard(card.id)}
                      className="text-xs text-slate-500 hover:text-brand-dark font-medium transition-colors"
                    >
                      Set default
                    </button>
                  )}
                  <button
                    onClick={() => removeCard(card.id)}
                    className="text-slate-300 hover:text-red-500 transition-colors"
                    title="Remove card"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Section 4: Recent Transactions ──────────────────────────────────── */}
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
                <th className="px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Date</th>
                <th className="px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Type</th>
                <th className="px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide text-right">Amount</th>
                <th className="px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {history.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-slate-400 text-sm">
                    No transactions yet
                  </td>
                </tr>
              ) : (
                history.slice(0, 10).map(item => (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3.5 text-xs text-slate-400 whitespace-nowrap">
                      {timeAgo(new Date(item.timestamp))}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`font-medium ${TYPE_COLOR[item.type]}`}>
                        {TYPE_LABEL[item.type]}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono font-semibold whitespace-nowrap">
                      <span className={item.type === 'withdrawal' ? 'text-red-500' : 'text-emerald-600'}>
                        {item.type === 'withdrawal' ? '−' : '+'}
                        {formatUsdcDollar(Math.abs(item.amount))}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_BADGE[item.status]}`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <a
                        href={explorerUrl(item.txHash, item.network as 'devnet' | 'mainnet')}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-slate-300 hover:text-brand-dark transition-colors"
                        title="View on Solana Explorer"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Modals ───────────────────────────────────────────────────────────── */}
      {showWithdraw && <WithdrawModal onClose={() => setShowWithdraw(false)} />}
      {showAddFunds && <AddFundsModal onClose={() => setShowAddFunds(false)} />}

      {showConnect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900">Connect Wallet</h2>
              <button
                onClick={() => setShowConnect(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-5">
              <ConnectWallet onConnected={() => setShowConnect(false)} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
