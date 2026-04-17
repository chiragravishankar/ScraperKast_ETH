'use client';

import { useState } from 'react';
import { X, CreditCard, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

// ── Constants ─────────────────────────────────────────────────────────────────

const PRESETS = [10, 25, 50, 100, 250, 500];
const MIN_DEPOSIT = 1;

// ── Types ─────────────────────────────────────────────────────────────────────

type Step = 'form' | 'loading' | 'redirected';

interface AddFundsModalProps {
  onClose: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AddFundsModal({ onClose }: AddFundsModalProps) {
  const [amountStr, setAmountStr] = useState('');
  const [step,      setStep]      = useState<Step>('form');
  const [sessionId, setSessionId] = useState('');

  const amount  = parseFloat(amountStr) || 0;
  const isValid = amount >= MIN_DEPOSIT;

  async function handleAddFunds() {
    setStep('loading');
    // Simulate Dodo checkout session creation (~800 ms network call)
    await new Promise(r => setTimeout(r, 800));
    // In production: POST /api/wallet/checkout → get { checkoutUrl, sessionId }
    //                then window.location.href = checkoutUrl
    setSessionId(`dodo_${Math.random().toString(36).slice(2, 18)}`);
    setStep('redirected');
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-violet-600" />
            <h2 className="font-semibold text-slate-900">Add Funds via Card</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5">

          {/* ── Form ── */}
          {step === 'form' && (
            <div className="space-y-5">
              <p className="text-sm text-slate-500">
                Purchase USDC with your credit or debit card via Dodo Payments. Funds settle instantly to your platform balance.
              </p>

              {/* Preset amounts */}
              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  Select Amount (USD)
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

              {/* Custom amount */}
              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  Or enter custom amount
                </label>
                <div className="mt-1.5 relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">$</span>
                  <input
                    type="number"
                    min={MIN_DEPOSIT}
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
                    <span className="font-mono font-semibold">${amount.toFixed(2)} USD</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">You receive</span>
                    <span className="font-mono font-semibold text-violet-700">{amount.toFixed(2)} USDC</span>
                  </div>
                  <p className="text-xs text-slate-400 pt-0.5">
                    Powered by Dodo Payments · 1 USDC = $1.00 · No hidden fees
                  </p>
                </div>
              )}

              {/* Min deposit error */}
              {!isValid && amount > 0 && (
                <p className="text-sm text-red-600 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4" /> Minimum deposit is $1.00
                </p>
              )}

              <button
                onClick={handleAddFunds}
                disabled={!isValid}
                className="w-full py-3 bg-violet-600 text-white font-semibold rounded-xl hover:bg-violet-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <CreditCard className="w-4 h-4" />
                Pay ${amount > 0 ? amount.toFixed(2) : '0.00'} with Card
              </button>

              <p className="text-center text-xs text-slate-400">
                You&apos;ll be redirected to Dodo&apos;s secure checkout page.
                Your balance updates automatically after payment.
              </p>
            </div>
          )}

          {/* ── Loading ── */}
          {step === 'loading' && (
            <div className="py-10 flex flex-col items-center gap-4">
              <Loader2 className="w-10 h-10 text-violet-600 animate-spin" />
              <div className="text-center">
                <p className="font-semibold text-slate-800">Creating checkout session…</p>
                <p className="text-sm text-slate-500 mt-1">Connecting to Dodo Payments</p>
              </div>
            </div>
          )}

          {/* ── Redirected (demo) ── */}
          {step === 'redirected' && (
            <div className="py-6 flex flex-col items-center gap-4 text-center">
              <CheckCircle className="w-12 h-12 text-emerald-500" />
              <div>
                <p className="font-semibold text-slate-800 text-lg">Checkout session ready!</p>
                <p className="text-sm text-slate-500 mt-1">
                  In production you&apos;d be redirected to Dodo&apos;s hosted checkout.
                  After payment, your balance updates automatically via webhook.
                </p>
                <p className="mt-3 text-xs font-mono text-slate-400 bg-slate-50 rounded-lg px-3 py-2 break-all">
                  {sessionId}
                </p>
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
