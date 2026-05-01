'use client';

/**
 * /dashboard/wallet/withdraw
 *
 * Allow a user to withdraw USDC from their platform balance
 * to their personal Ethereum wallet.
 *
 * Flow:
 *  1. Load available balance from GET /api/wallet/balance
 *  2. User enters amount + destination address
 *  3. POST /api/wallet/withdraw → on success redirect to /dashboard/wallet?success=withdrawal
 */

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtUsdc(n: number) {
  if (n >= 1)      return `$${n.toFixed(2)}`;
  if (n >= 0.0001) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(6)}`;
}

function isValidEthAddress(addr: string) {
  return /^0x[0-9a-fA-F]{40}$/.test(addr);
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface BalanceData {
  balance:            number;
  availableBalance:   number;
  pendingWithdrawals: number;
  withdrawalAddress:  string | null;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function WithdrawPage() {
  const router = useRouter();

  // Balance state
  const [balData,  setBalData]  = useState<BalanceData | null>(null);
  const [balError, setBalError] = useState<string | null>(null);
  const [balLoad,  setBalLoad]  = useState(true);

  // Form state
  const [amount,  setAmount]  = useState('');
  const [address, setAddress] = useState('');

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [formError,  setFormError]  = useState<string | null>(null);

  // ── Load balance ────────────────────────────────────────────────────────────

  const loadBalance = useCallback(async () => {
    setBalLoad(true);
    setBalError(null);
    try {
      const res  = await fetch('/api/wallet/balance');
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const data = await res.json() as BalanceData;
      setBalData(data);
      // Pre-fill withdrawal address if configured
      if (data.withdrawalAddress) {
        setAddress(data.withdrawalAddress);
      }
    } catch (e) {
      setBalError(e instanceof Error ? e.message : 'Failed to load balance');
    } finally {
      setBalLoad(false);
    }
  }, []);

  useEffect(() => { void loadBalance(); }, [loadBalance]);

  // ── Derived validation ──────────────────────────────────────────────────────

  const available   = balData?.availableBalance ?? 0;
  const amountNum   = parseFloat(amount);
  const amountValid = !isNaN(amountNum) && amountNum > 0 && amountNum <= available;
  const addrValid   = isValidEthAddress(address);
  const canSubmit   = amountValid && addrValid && !submitting && available > 0;

  function getAmountError(): string | null {
    if (!amount) return null;
    if (isNaN(amountNum) || amountNum <= 0) return 'Enter a positive number';
    if (amountNum < 0.01) return 'Minimum withdrawal is $0.01 USDC';
    if (amountNum > available) return `Exceeds available balance (${fmtUsdc(available)})`;
    return null;
  }

  function getAddrError(): string | null {
    if (!address) return null;
    if (!isValidEthAddress(address)) return 'Enter a valid Ethereum address (0x…, 42 characters)';
    return null;
  }

  // ── Submit ──────────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setFormError(null);

    try {
      const res = await fetch('/api/wallet/withdraw', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ amount: amountNum, toAddress: address }),
      });

      const data = await res.json() as { error?: string };

      if (!res.ok) {
        setFormError(data.error ?? `Request failed (${res.status})`);
        return;
      }

      // Success — navigate back to wallet with success banner
      router.push('/dashboard/wallet?success=withdrawal');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-lg mx-auto space-y-6 animate-fade-in">

      {/* Back link + header */}
      <div>
        <Link
          href="/dashboard/wallet"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-3 hover:text-ink transition-colors mb-3"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Wallet
        </Link>
        <h2 className="text-base font-bold text-ink">Withdraw USDC</h2>
        <p className="text-xs text-ink-3 mt-0.5">Transfer funds from your platform balance to your wallet</p>
      </div>

      {/* Balance loader / error */}
      {balLoad && (
        <div className="card p-5 flex items-center gap-3">
          <Loader2 className="w-4 h-4 animate-spin text-ink-3" />
          <p className="text-sm text-ink-3">Loading balance…</p>
        </div>
      )}

      {balError && (
        <div className="withdraw-error-banner">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <p className="text-sm">{balError}</p>
        </div>
      )}

      {/* Balance info strip */}
      {balData && (
        <div className="withdraw-balance-info">
          <div className="withdraw-balance-row">
            <span className="withdraw-balance-label">Total Balance</span>
            <span className="withdraw-balance-value tabular">{fmtUsdc(balData.balance)}</span>
          </div>
          {balData.pendingWithdrawals > 0 && (
            <div className="withdraw-balance-row">
              <span className="withdraw-balance-label">Pending Withdrawals</span>
              <span className="withdraw-balance-value tabular text-amber-600">
                −{fmtUsdc(balData.pendingWithdrawals)}
              </span>
            </div>
          )}
          <div className="withdraw-balance-row withdraw-balance-row--total">
            <span className="withdraw-balance-label font-bold text-ink">Available to Withdraw</span>
            <span className="withdraw-balance-value tabular font-bold text-ink">
              {fmtUsdc(balData.availableBalance)}
            </span>
          </div>
        </div>
      )}

      {/* Zero balance warning */}
      {balData && balData.availableBalance <= 0 && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-900">No funds available</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Your available balance is $0.00. Earn revenue by protecting your sites, or wait for
              pending withdrawals to confirm.
            </p>
          </div>
        </div>
      )}

      {/* Withdrawal form */}
      {balData && (
        <form onSubmit={(e) => void handleSubmit(e)} className="withdraw-card space-y-5">

          {/* Amount field */}
          <div className="withdraw-form-group">
            <label className="withdraw-form-label" htmlFor="withdraw-amount">
              Amount (USDC)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3 text-sm font-semibold pointer-events-none">
                $
              </span>
              <input
                id="withdraw-amount"
                type="number"
                step="0.01"
                min="0.01"
                max={available}
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0.00"
                disabled={submitting || available <= 0}
                className={cn(
                  'withdraw-form-input pl-7',
                  amount && getAmountError() && 'withdraw-form-input--error',
                )}
              />
              <button
                type="button"
                onClick={() => setAmount(available.toFixed(6))}
                disabled={available <= 0 || submitting}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-2xs font-bold text-accent hover:underline disabled:opacity-40 disabled:cursor-not-allowed"
              >
                MAX
              </button>
            </div>
            {amount && getAmountError() && (
              <p className="withdraw-field-error">{getAmountError()}</p>
            )}
            <p className="withdraw-form-hint">
              Min $0.01 · Max {fmtUsdc(available)} available
            </p>
          </div>

          {/* Destination address field */}
          <div className="withdraw-form-group">
            <label className="withdraw-form-label" htmlFor="withdraw-address">
              Destination Ethereum Address
            </label>
            <input
              id="withdraw-address"
              type="text"
              value={address}
              onChange={e => setAddress(e.target.value.trim())}
              placeholder="0x…"
              disabled={submitting || available <= 0}
              className={cn(
                'withdraw-form-input font-mono',
                address && getAddrError() && 'withdraw-form-input--error',
              )}
            />
            {address && getAddrError() && (
              <p className="withdraw-field-error">{getAddrError()}</p>
            )}
            {address && addrValid && (
              <p className="withdraw-field-success flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Valid address
              </p>
            )}
            <p className="withdraw-form-hint">
              Must be an EVM-compatible address on Base Sepolia
            </p>
          </div>

          {/* Form-level error */}
          {formError && (
            <div className="withdraw-error-banner">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <p className="text-sm">{formError}</p>
            </div>
          )}

          {/* Testnet notice */}
          <div className="withdraw-notice">
            <span className="text-base">⚠️</span>
            <p className="text-xs text-amber-800 leading-relaxed">
              <strong>Testnet only.</strong> Funds are Base Sepolia testnet USDC and have no real value.
              Withdrawals are processed on-chain and may take 15–30 seconds.
            </p>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={!canSubmit}
            className="withdraw-btn-submit"
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Processing withdrawal…
              </span>
            ) : (
              <>Withdraw {amount && amountValid ? fmtUsdc(amountNum) : 'USDC'}</>
            )}
          </button>

          <p className="text-center text-2xs text-ink-3">
            Funds will arrive within ~30 seconds after on-chain confirmation.
          </p>
        </form>
      )}
    </div>
  );
}
