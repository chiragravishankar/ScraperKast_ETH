'use client';

import { useState } from 'react';
import {
  X, Loader2, CheckCircle, AlertCircle, ExternalLink,
  Wallet, Building2, ChevronDown,
} from 'lucide-react';
import { useWallet as useAdapterWallet } from '@solana/wallet-adapter-react';
import { useWallet } from '@/lib/walletStore';
import { explorerUrl, formatUsdcDollar } from '@/lib/formatters';

// ── Constants ─────────────────────────────────────────────────────────────────

const BASE58        = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const MIN_CRYPTO_µ  = 1_000_000;   // 1 USDC
const MIN_BANK_µ    = 10_000_000;  // 10 USDC
const NETWORK_FEE   = 0.000025;    // ~SOL fee in USD
const BANK_FEE_BPS  = 100;         // 1%

// ── Demo bank accounts ────────────────────────────────────────────────────────

const DEMO_BANKS = [
  { id: 'ba_1', label: 'Chase ····1234',          isDefault: true  },
  { id: 'ba_2', label: 'Bank of America ····5678', isDefault: false },
];

// ── Types ─────────────────────────────────────────────────────────────────────

type Tab  = 'crypto' | 'bank';
type Step = 'form' | 'loading' | 'success' | 'error';

// ── Component ─────────────────────────────────────────────────────────────────

export default function WithdrawModal({ onClose }: { onClose: () => void }) {
  const { balance, network, refreshBalance } = useWallet();

  // Optional: connect personal wallet to auto-fill destination
  const { publicKey: adapterPublicKey } = useAdapterWallet();

  const [tab,         setTab]         = useState<Tab>('crypto');
  const [amountStr,   setAmountStr]   = useState('');
  const [destination, setDestination] = useState('');
  const [bankId,      setBankId]      = useState(DEMO_BANKS[0].id);
  const [step,        setStep]        = useState<Step>('form');
  const [txHash,      setTxHash]      = useState('');
  const [payoutId,    setPayoutId]    = useState('');
  const [errorMsg,    setErrorMsg]    = useState('');

  const amount      = parseFloat(amountStr) || 0;
  const amountMicro = Math.floor(amount * 1_000_000);
  const maxUsdc     = balance / 1_000_000;

  // ── Crypto tab validation ────────────────────────────────────────────────

  const cryptoErrors: string[] = [];
  if (amountStr && amount <= 0)                     cryptoErrors.push('Amount must be greater than 0');
  if (amountStr && amountMicro < MIN_CRYPTO_µ)      cryptoErrors.push('Minimum withdrawal is 1 USDC');
  if (amountStr && amountMicro > balance)           cryptoErrors.push('Amount exceeds your balance');
  if (destination && !BASE58.test(destination))     cryptoErrors.push('Invalid Solana address (base58, 32–44 chars)');

  const canCrypto = amount > 0 && amountMicro >= MIN_CRYPTO_µ &&
    amountMicro <= balance && BASE58.test(destination) && cryptoErrors.length === 0;

  // ── Bank tab validation ──────────────────────────────────────────────────

  const bankErrors: string[] = [];
  if (amountStr && amount <= 0)                   bankErrors.push('Amount must be greater than 0');
  if (amountStr && amountMicro < MIN_BANK_µ)      bankErrors.push('Minimum bank withdrawal is 10 USDC');
  if (amountStr && amountMicro > balance)         bankErrors.push('Amount exceeds your balance');

  const canBank = amount > 0 && amountMicro >= MIN_BANK_µ &&
    amountMicro <= balance && bankErrors.length === 0;

  const bankFee    = Math.ceil(amountMicro * BANK_FEE_BPS / 10_000);
  const bankNet    = Math.max(0, amountMicro - bankFee);

  // ── Handlers ────────────────────────────────────────────────────────────

  async function handleCryptoWithdraw() {
    setStep('loading');
    try {
      const res  = await fetch('/api/wallet/withdraw/crypto', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ amountMicroUsdc: amountMicro, destinationAddress: destination }),
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

  async function handleBankWithdraw() {
    setStep('loading');
    try {
      const res  = await fetch('/api/wallet/withdraw/bank', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ amountMicroUsdc: amountMicro, bankAccountId: bankId }),
      });
      const data = await res.json() as { success: boolean; payoutId?: string; error?: string };
      if (!data.success) throw new Error(data.error ?? 'Payout failed');
      setPayoutId(data.payoutId ?? '');
      await refreshBalance();
      setStep('success');
    } catch (err) {
      setErrorMsg((err as Error).message);
      setStep('error');
    }
  }

  function reset() {
    setStep('form');
    setAmountStr('');
    setTxHash('');
    setPayoutId('');
    setErrorMsg('');
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Withdraw Funds</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        {step === 'form' && (
          <div className="flex border-b border-slate-100">
            {([
              { id: 'crypto', label: 'To Wallet',      icon: Wallet    },
              { id: 'bank',   label: 'To Bank Account', icon: Building2 },
            ] as { id: Tab; label: string; icon: React.ElementType }[]).map(t => (
              <button
                key={t.id}
                onClick={() => { setTab(t.id); setAmountStr(''); }}
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
        )}

        <div className="px-6 py-5">

          {/* ══ FORM STATE ══════════════════════════════════════════════════ */}
          {step === 'form' && (
            <>
              {/* ── Crypto tab ─────────────────────────────────────────── */}
              {tab === 'crypto' && (
                <div className="space-y-4">
                  {/* Balance pill */}
                  <div className="bg-slate-50 rounded-xl px-4 py-2.5 flex justify-between text-sm">
                    <span className="text-slate-500">Available</span>
                    <span className="font-semibold tabular-nums">{formatUsdcDollar(balance)} USDC</span>
                  </div>

                  {/* Amount */}
                  <div>
                    <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Amount (USDC)</label>
                    <div className="mt-1.5 relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                      <input
                        type="number" min="1" max={maxUsdc} step="0.01" placeholder="0.00"
                        value={amountStr} onChange={e => setAmountStr(e.target.value)}
                        className="w-full pl-7 pr-16 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-dark/30 focus:border-brand-dark text-slate-900 font-mono"
                      />
                      <button
                        type="button" onClick={() => setAmountStr(maxUsdc.toFixed(2))}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-semibold text-brand-dark px-2 py-1 rounded hover:bg-slate-50"
                      >MAX</button>
                    </div>
                  </div>

                  {/* Destination */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                        Destination Address
                      </label>
                      {adapterPublicKey && (
                        <button
                          onClick={() => setDestination(adapterPublicKey.toBase58())}
                          className="text-xs text-brand-dark hover:underline font-medium"
                        >
                          Use connected wallet
                        </button>
                      )}
                    </div>
                    <input
                      type="text" placeholder="Solana address (base58)"
                      value={destination} onChange={e => setDestination(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-dark/30 focus:border-brand-dark text-slate-900 font-mono text-sm"
                    />
                  </div>

                  {/* Fee breakdown */}
                  {amount > 0 && (
                    <div className="bg-slate-50 rounded-xl px-4 py-3 space-y-1.5 text-sm border border-slate-100">
                      <div className="flex justify-between text-slate-600">
                        <span>Amount</span><span className="font-mono">${amount.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Network fee</span><span className="font-mono">~${NETWORK_FEE.toFixed(6)}</span>
                      </div>
                      <div className="flex justify-between font-semibold border-t border-slate-200 pt-1.5">
                        <span>You receive</span>
                        <span className="font-mono text-brand-dark">${Math.max(0, amount - NETWORK_FEE).toFixed(2)} USDC</span>
                      </div>
                    </div>
                  )}

                  {cryptoErrors.length > 0 && (
                    <div className="flex gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2.5">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <div className="space-y-0.5">{cryptoErrors.map(e => <p key={e}>{e}</p>)}</div>
                    </div>
                  )}

                  <button
                    onClick={() => { void handleCryptoWithdraw(); }}
                    disabled={!canCrypto}
                    className="w-full py-3 bg-brand-dark text-white font-semibold rounded-xl hover:bg-brand-mid transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Withdraw to Wallet
                  </button>
                </div>
              )}

              {/* ── Bank tab ───────────────────────────────────────────── */}
              {tab === 'bank' && (
                <div className="space-y-4">
                  <div className="bg-slate-50 rounded-xl px-4 py-2.5 flex justify-between text-sm">
                    <span className="text-slate-500">Available</span>
                    <span className="font-semibold tabular-nums">{formatUsdcDollar(balance)} USDC</span>
                  </div>

                  {/* Amount */}
                  <div>
                    <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Amount (USDC)</label>
                    <div className="mt-1.5 relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                      <input
                        type="number" min="10" max={maxUsdc} step="0.01" placeholder="0.00"
                        value={amountStr} onChange={e => setAmountStr(e.target.value)}
                        className="w-full pl-7 pr-16 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-dark/30 focus:border-brand-dark text-slate-900 font-mono"
                      />
                      <button
                        type="button" onClick={() => setAmountStr(maxUsdc.toFixed(2))}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-semibold text-brand-dark px-2 py-1 rounded hover:bg-slate-50"
                      >MAX</button>
                    </div>
                  </div>

                  {/* Bank account selector */}
                  <div>
                    <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Bank Account</label>
                    <div className="mt-2 space-y-2">
                      {DEMO_BANKS.map(b => (
                        <label key={b.id} className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-colors ${
                          bankId === b.id ? 'border-brand-dark bg-brand-dark/5' : 'border-slate-200 hover:border-slate-300'
                        }`}>
                          <input
                            type="radio" name="bank" value={b.id}
                            checked={bankId === b.id} onChange={() => setBankId(b.id)}
                            className="accent-brand-dark"
                          />
                          <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                          <span className="text-sm font-medium text-slate-700">{b.label}</span>
                          {b.isDefault && (
                            <span className="ml-auto text-xs font-medium px-1.5 py-0.5 rounded-full bg-brand-dark/10 text-brand-dark">Default</span>
                          )}
                        </label>
                      ))}
                      <button className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-slate-200 text-sm text-slate-400 hover:border-brand-dark hover:text-brand-dark transition-colors">
                        <span className="text-lg leading-none">+</span> Add bank account
                      </button>
                    </div>
                  </div>

                  {/* Fee breakdown */}
                  {amount > 0 && (
                    <div className="bg-slate-50 rounded-xl px-4 py-3 space-y-1.5 text-sm border border-slate-100">
                      <div className="flex justify-between text-slate-600">
                        <span>Amount</span><span className="font-mono">${amount.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Fee (1%)</span><span className="font-mono">−${(bankFee / 1_000_000).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between font-semibold border-t border-slate-200 pt-1.5">
                        <span>You receive</span>
                        <span className="font-mono text-brand-dark">${(bankNet / 1_000_000).toFixed(2)} USD</span>
                      </div>
                      <p className="text-xs text-slate-400">Arrives in 1–3 business days via Stripe payout</p>
                    </div>
                  )}

                  {bankErrors.length > 0 && (
                    <div className="flex gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2.5">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <div className="space-y-0.5">{bankErrors.map(e => <p key={e}>{e}</p>)}</div>
                    </div>
                  )}

                  <button
                    onClick={() => { void handleBankWithdraw(); }}
                    disabled={!canBank}
                    className="w-full py-3 bg-brand-dark text-white font-semibold rounded-xl hover:bg-brand-mid transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Withdraw to Bank
                  </button>

                  <p className="text-center text-xs text-slate-400">
                    Exchange rate: 1 USDC = $1.00 · Powered by Stripe
                  </p>
                </div>
              )}
            </>
          )}

          {/* ══ LOADING ═════════════════════════════════════════════════════ */}
          {step === 'loading' && (
            <div className="py-10 flex flex-col items-center gap-4">
              <Loader2 className="w-10 h-10 text-brand-dark animate-spin" />
              <div className="text-center">
                <p className="font-semibold text-slate-800">
                  {tab === 'crypto' ? 'Processing withdrawal…' : 'Initiating bank payout…'}
                </p>
                <p className="text-sm text-slate-500 mt-1">
                  {tab === 'crypto' ? 'Broadcasting to Solana devnet' : 'Connecting to Stripe'}
                </p>
              </div>
            </div>
          )}

          {/* ══ SUCCESS ═════════════════════════════════════════════════════ */}
          {step === 'success' && (
            <div className="py-6 flex flex-col items-center gap-4 text-center">
              <CheckCircle className="w-12 h-12 text-emerald-500" />
              {tab === 'crypto' ? (
                <div>
                  <p className="font-semibold text-slate-800 text-lg">Withdrawal sent!</p>
                  <p className="text-sm text-slate-500 mt-1">
                    ${amount.toFixed(2)} USDC sent to{' '}
                    <span className="font-mono text-xs">{destination.slice(0, 8)}…{destination.slice(-4)}</span>
                  </p>
                  {txHash && (
                    <a
                      href={explorerUrl(txHash, network)}
                      target="_blank" rel="noopener noreferrer"
                      className="mt-3 inline-flex items-center gap-1.5 text-sm text-brand-dark hover:underline"
                    >
                      View on Solana Explorer <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              ) : (
                <div>
                  <p className="font-semibold text-slate-800 text-lg">Payout initiated!</p>
                  <p className="text-sm text-slate-500 mt-1">
                    ${(bankNet / 1_000_000).toFixed(2)} USD will arrive in 1–3 business days.
                  </p>
                  {payoutId && (
                    <p className="mt-2 text-xs font-mono text-slate-400 bg-slate-50 rounded-lg px-3 py-2">{payoutId}</p>
                  )}
                </div>
              )}
              <button onClick={onClose} className="mt-2 w-full py-2.5 bg-brand-dark text-white font-semibold rounded-xl hover:bg-brand-mid transition-colors">
                Done
              </button>
            </div>
          )}

          {/* ══ ERROR ═══════════════════════════════════════════════════════ */}
          {step === 'error' && (
            <div className="py-6 flex flex-col items-center gap-4 text-center">
              <AlertCircle className="w-12 h-12 text-red-500" />
              <div>
                <p className="font-semibold text-slate-800 text-lg">Withdrawal failed</p>
                <p className="text-sm text-slate-500 mt-1">{errorMsg}</p>
              </div>
              <button onClick={reset} className="w-full py-2.5 bg-brand-dark text-white font-semibold rounded-xl hover:bg-brand-mid transition-colors">
                Try Again
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
