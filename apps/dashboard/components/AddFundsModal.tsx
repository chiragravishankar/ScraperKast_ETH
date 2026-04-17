'use client';

import { useState } from 'react';
import {
  X, CreditCard, Loader2, CheckCircle, AlertCircle,
  Wallet, Copy, Check,
} from 'lucide-react';
import { useWallet } from '@/lib/walletStore';

// ── Constants ─────────────────────────────────────────────────────────────────

const PRESETS = [10, 25, 50, 100, 250, 500];
const CARD_FEE_PCT  = 0.029;
const CARD_FEE_FLAT = 0.30;

// ── Helpers ───────────────────────────────────────────────────────────────────

function cardNet(amount: number) {
  return Math.max(0, amount - amount * CARD_FEE_PCT - CARD_FEE_FLAT);
}

// ── AddFundsModal ─────────────────────────────────────────────────────────────

type Tab  = 'crypto' | 'card';
type Step = 'form' | 'loading' | 'success';

interface AddFundsModalProps {
  onClose: () => void;
}

export default function AddFundsModal({ onClose }: AddFundsModalProps) {
  const { smartWalletAddress } = useWallet();
  const [tab,       setTab]       = useState<Tab>('crypto');
  const [amountStr, setAmountStr] = useState('');
  const [step,      setStep]      = useState<Step>('form');
  const [copied,    setCopied]    = useState(false);
  const [sessionId, setSessionId] = useState('');

  const amount  = parseFloat(amountStr) || 0;

  function copyAddress() {
    navigator.clipboard.writeText(smartWalletAddress).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2_000);
  }

  async function handleCardDeposit() {
    if (amount < 1) return;
    setStep('loading');
    try {
      const res  = await fetch('/api/wallet/deposit/card', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ amountUsd: amount }),
      });
      const data = await res.json() as { sessionId?: string };
      setSessionId(data.sessionId ?? '');
      setStep('success');
    } catch {
      setStep('form');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Add Funds</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100">
          {([
            { id: 'crypto', label: 'Crypto (USDC)',  icon: Wallet     },
            { id: 'card',   label: 'Credit / Debit', icon: CreditCard },
          ] as { id: Tab; label: string; icon: React.ElementType }[]).map(t => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setStep('form'); setAmountStr(''); }}
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t.id
                  ? 'border-brand-dark text-brand-dark'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
            </button>
          ))}
        </div>

        <div className="px-6 py-5">

          {/* ══ CRYPTO TAB ══════════════════════════════════════════════════ */}
          {tab === 'crypto' && (
            <div className="space-y-5">
              <p className="text-sm text-slate-500">
                Send USDC to your ScraperKast wallet address below. Funds appear
                within ~30 seconds after on-chain confirmation.
              </p>

              {/* Address card */}
              <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Your Deposit Address
                  </span>
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-sky-100 text-sky-700">
                    Devnet · USDC
                  </span>
                </div>

                <div className="flex items-center gap-2 bg-white rounded-lg border border-slate-200 px-3 py-2.5">
                  <span className="flex-1 font-mono text-xs text-slate-700 break-all leading-relaxed">
                    {smartWalletAddress}
                  </span>
                  <button
                    onClick={copyAddress}
                    className="shrink-0 p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-brand-dark transition-colors"
                    title="Copy address"
                  >
                    {copied
                      ? <Check className="w-4 h-4 text-emerald-500" />
                      : <Copy className="w-4 h-4" />
                    }
                  </button>
                </div>

                {copied && (
                  <p className="text-xs text-emerald-600 font-medium">Address copied!</p>
                )}
              </div>

              {/* Instructions */}
              <div className="space-y-2 text-sm text-slate-600">
                <div className="flex gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-brand-dark/10 text-brand-dark text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
                  <p>Open your Solana wallet (Phantom, Solflare, etc.)</p>
                </div>
                <div className="flex gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-brand-dark/10 text-brand-dark text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
                  <p>Send USDC to the address above on the Solana network</p>
                </div>
                <div className="flex gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-brand-dark/10 text-brand-dark text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">3</span>
                  <p>Your balance updates automatically after ~30 seconds</p>
                </div>
              </div>

              <div className="flex gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <p><strong>Only send USDC on Solana.</strong> Sending other tokens or using other networks will result in permanent loss.</p>
              </div>

              <button onClick={onClose} className="w-full py-2.5 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 transition-colors">
                Done
              </button>
            </div>
          )}

          {/* ══ CARD TAB ════════════════════════════════════════════════════ */}
          {tab === 'card' && step === 'form' && (
            <div className="space-y-5">
              <p className="text-sm text-slate-500">
                Purchase USDC with your credit or debit card. Funds settle instantly to your wallet.
              </p>

              {/* Presets */}
              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  Amount (USD)
                </label>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {PRESETS.map(p => (
                    <button
                      key={p}
                      onClick={() => setAmountStr(String(p))}
                      className={`py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                        amountStr === String(p)
                          ? 'bg-violet-600 text-white border-violet-600'
                          : 'border-slate-200 text-slate-600 hover:border-violet-400 hover:text-violet-600'
                      }`}
                    >
                      ${p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom */}
              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  Custom amount
                </label>
                <div className="mt-1.5 relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">$</span>
                  <input
                    type="number"
                    min={1}
                    step="1"
                    placeholder="0.00"
                    value={amountStr}
                    onChange={e => setAmountStr(e.target.value)}
                    className="w-full pl-7 pr-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-400/30 focus:border-violet-500 text-slate-900 font-mono"
                  />
                </div>
              </div>

              {/* Summary */}
              {amount > 0 && (
                <div className="bg-violet-50 border border-violet-100 rounded-xl px-4 py-3 space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">You pay</span>
                    <span className="font-mono font-semibold">${amount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Processing fee (2.9% + $0.30)</span>
                    <span className="font-mono">−${(amount - cardNet(amount)).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-semibold border-t border-violet-200 pt-1.5">
                    <span className="text-slate-700">You receive</span>
                    <span className="font-mono text-violet-700">{cardNet(amount).toFixed(2)} USDC</span>
                  </div>
                  <p className="text-xs text-slate-400 pt-0.5">Powered by Stripe · 1 USDC = $1.00</p>
                </div>
              )}

              {amount > 0 && amount < 1 && (
                <p className="text-sm text-red-600 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4" /> Minimum deposit is $1.00
                </p>
              )}

              <button
                onClick={() => { void handleCardDeposit(); }}
                disabled={amount < 1}
                className="w-full py-3 bg-violet-600 text-white font-semibold rounded-xl hover:bg-violet-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <CreditCard className="w-4 h-4" />
                Pay ${amount > 0 ? amount.toFixed(2) : '0.00'} with Card
              </button>
            </div>
          )}

          {tab === 'card' && step === 'loading' && (
            <div className="py-10 flex flex-col items-center gap-4">
              <Loader2 className="w-10 h-10 text-violet-600 animate-spin" />
              <div className="text-center">
                <p className="font-semibold text-slate-800">Creating checkout session…</p>
                <p className="text-sm text-slate-500 mt-1">Connecting to Stripe</p>
              </div>
            </div>
          )}

          {tab === 'card' && step === 'success' && (
            <div className="py-6 flex flex-col items-center gap-4 text-center">
              <CheckCircle className="w-12 h-12 text-emerald-500" />
              <div>
                <p className="font-semibold text-slate-800 text-lg">Checkout session ready!</p>
                <p className="text-sm text-slate-500 mt-1">
                  In production you&apos;d be redirected to Stripe&apos;s hosted checkout.
                  After payment, USDC is transferred to your wallet automatically.
                </p>
                {sessionId && (
                  <p className="mt-3 text-xs font-mono text-slate-400 bg-slate-50 rounded-lg px-3 py-2 break-all">
                    {sessionId}
                  </p>
                )}
              </div>
              <button
                onClick={onClose}
                className="w-full py-2.5 bg-violet-600 text-white font-semibold rounded-xl hover:bg-violet-700 transition-colors"
              >
                Done
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
