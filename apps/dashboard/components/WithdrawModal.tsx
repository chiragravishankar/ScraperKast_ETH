'use client';

import { useState } from 'react';
import { X, Loader2, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react';
import { useWallet } from '@/lib/walletStore';
import { explorerUrl } from '@/lib/formatters';

// ── Constants ─────────────────────────────────────────────────────────────────

const SOLANA_FEE_USDC = 0.000025; // approximate SOL tx fee in USD
const MIN_WITHDRAWAL  = 1_000_000; // 1 USDC in µUSDC
const BASE58          = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

// ── Types ─────────────────────────────────────────────────────────────────────

type Step = 'form' | 'loading' | 'success' | 'error';

interface WithdrawModalProps {
  onClose: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function WithdrawModal({ onClose }: WithdrawModalProps) {
  const { balance, address, network, refreshBalance } = useWallet();

  const maxUsdc = balance / 1_000_000;

  const [amountStr,   setAmountStr]   = useState('');
  const [destination, setDestination] = useState(address ?? '');
  const [step,        setStep]        = useState<Step>('form');
  const [txHash,      setTxHash]      = useState('');
  const [errorMsg,    setErrorMsg]    = useState('');

  const amount      = parseFloat(amountStr) || 0;
  const amountMicro = Math.floor(amount * 1_000_000);
  const netAmount   = Math.max(0, amount - SOLANA_FEE_USDC);

  // Collect validation errors for live display
  const errors: string[] = [];
  if (amountStr && amount <= 0)                      errors.push('Amount must be greater than 0');
  if (amountStr && amountMicro < MIN_WITHDRAWAL)     errors.push('Minimum withdrawal is 1 USDC');
  if (amountStr && amountMicro > balance)            errors.push('Amount exceeds your available balance');
  if (destination && !BASE58.test(destination))      errors.push('Invalid Solana wallet address (base58, 32–44 chars)');

  const canSubmit =
    amount > 0 && amountMicro >= MIN_WITHDRAWAL &&
    amountMicro <= balance && BASE58.test(destination) &&
    errors.length === 0;

  async function handleSubmit() {
    setStep('loading');
    try {
      const res  = await fetch('/api/wallet/withdraw', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ amount: amountMicro, destination }),
      });
      const data = await res.json() as { success: boolean; txHash?: string; error?: string };
      if (!data.success) throw new Error(data.error ?? 'Withdrawal failed');
      setTxHash(data.txHash ?? '');
      await refreshBalance();
      setStep('success');
    } catch (err) {
      setErrorMsg((err as Error).message);
      setStep('error');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Withdraw USDC</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5">

          {/* ── Form ── */}
          {step === 'form' && (
            <div className="space-y-4">

              {/* Available balance pill */}
              <div className="bg-slate-50 rounded-xl px-4 py-2.5 flex items-center justify-between text-sm">
                <span className="text-slate-500">Available balance</span>
                <span className="font-semibold text-slate-800 tabular-nums">
                  {maxUsdc.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC
                </span>
              </div>

              {/* Amount input */}
              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  Amount (USDC)
                </label>
                <div className="mt-1.5 relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">$</span>
                  <input
                    type="number"
                    min="1"
                    max={maxUsdc}
                    step="0.01"
                    placeholder="0.00"
                    value={amountStr}
                    onChange={e => setAmountStr(e.target.value)}
                    className="w-full pl-7 pr-16 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-dark/30 focus:border-brand-dark text-slate-900 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setAmountStr(maxUsdc.toFixed(2))}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-semibold text-brand-dark hover:text-brand-mid px-2 py-1 rounded transition-colors"
                  >
                    MAX
                  </button>
                </div>
              </div>

              {/* Destination address */}
              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  Destination Wallet
                </label>
                <input
                  type="text"
                  placeholder="Solana address (base58)"
                  value={destination}
                  onChange={e => setDestination(e.target.value)}
                  className="mt-1.5 w-full px-3 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-dark/30 focus:border-brand-dark text-slate-900 font-mono text-sm"
                />
              </div>

              {/* Fee breakdown */}
              {amount > 0 && (
                <div className="bg-slate-50 rounded-xl px-4 py-3 space-y-1.5 text-sm border border-slate-100">
                  <div className="flex justify-between text-slate-600">
                    <span>Amount</span>
                    <span className="font-mono">${amount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Solana network fee</span>
                    <span className="font-mono">~${SOLANA_FEE_USDC.toFixed(6)}</span>
                  </div>
                  <div className="flex justify-between font-semibold border-t border-slate-200 pt-1.5">
                    <span className="text-slate-700">You receive</span>
                    <span className="font-mono text-brand-dark">${netAmount.toFixed(2)}</span>
                  </div>
                  <p className="text-xs text-slate-400">⚡ Instant settlement on Solana</p>
                </div>
              )}

              {/* Validation errors */}
              {errors.length > 0 && (
                <div className="flex gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    {errors.map(e => <p key={e}>{e}</p>)}
                  </div>
                </div>
              )}

              {/* Mainnet real-money warning */}
              {network === 'mainnet' && (
                <div className="flex gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <p><strong>Mainnet:</strong> This will transfer real USDC. Double-check the destination address.</p>
                </div>
              )}

              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="w-full py-3 bg-brand-dark text-white font-semibold rounded-xl hover:bg-brand-mid transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Confirm Withdrawal
              </button>
            </div>
          )}

          {/* ── Loading ── */}
          {step === 'loading' && (
            <div className="py-10 flex flex-col items-center gap-4">
              <Loader2 className="w-10 h-10 text-brand-dark animate-spin" />
              <div className="text-center">
                <p className="font-semibold text-slate-800">Processing withdrawal…</p>
                <p className="text-sm text-slate-500 mt-1">Broadcasting to Solana {network}</p>
              </div>
            </div>
          )}

          {/* ── Success ── */}
          {step === 'success' && (
            <div className="py-6 flex flex-col items-center gap-4 text-center">
              <CheckCircle className="w-12 h-12 text-emerald-500" />
              <div>
                <p className="font-semibold text-slate-800 text-lg">Withdrawal complete!</p>
                <p className="text-sm text-slate-500 mt-1">
                  ${amount.toFixed(2)} USDC sent to{' '}
                  <span className="font-mono text-xs">{destination.slice(0, 8)}…{destination.slice(-4)}</span>
                </p>
              </div>
              {txHash && (
                <a
                  href={explorerUrl(txHash, network)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-brand-dark hover:underline"
                >
                  View on Solana Explorer <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
              <button
                onClick={onClose}
                className="mt-2 w-full py-2.5 bg-brand-dark text-white font-semibold rounded-xl hover:bg-brand-mid transition-colors"
              >
                Done
              </button>
            </div>
          )}

          {/* ── Error ── */}
          {step === 'error' && (
            <div className="py-6 flex flex-col items-center gap-4 text-center">
              <AlertCircle className="w-12 h-12 text-red-500" />
              <div>
                <p className="font-semibold text-slate-800 text-lg">Withdrawal failed</p>
                <p className="text-sm text-slate-500 mt-1">{errorMsg}</p>
              </div>
              <button
                onClick={() => setStep('form')}
                className="w-full py-2.5 bg-brand-dark text-white font-semibold rounded-xl hover:bg-brand-mid transition-colors"
              >
                Try Again
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
