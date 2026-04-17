'use client';

import {
  createContext, useCallback, useContext, useEffect, useState,
} from 'react';
import type { ReactNode } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AutoWithdrawSettings {
  enabled:     boolean;
  threshold:   number; // µUSDC trigger amount
  destination: string; // wallet address for crypto withdrawals
}

interface WalletState {
  /** Platform-managed smart wallet address (deposit address for this account) */
  smartWalletAddress: string;
  /** On-chain USDC balance of the smart wallet in µUSDC */
  balance:            number;
  network:            'devnet' | 'mainnet';
  isLoading:          boolean;
  autoWithdraw:       AutoWithdrawSettings;
}

interface WalletContextValue extends WalletState {
  refreshBalance:  () => Promise<void>;
  setAutoWithdraw: (s: AutoWithdrawSettings) => void;
}

// ── Context ───────────────────────────────────────────────────────────────────

const WalletCtx = createContext<WalletContextValue | null>(null);

const LS_KEY = 'sk_wallet_v2';

/** Demo smart wallet address — in production this comes from the user's DB record */
const DEMO_SMART_WALLET = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU';

const INITIAL: WalletState = {
  smartWalletAddress: DEMO_SMART_WALLET,
  balance:            0,
  network:            'devnet',
  isLoading:          false,
  autoWithdraw: {
    enabled:     false,
    threshold:   100_000_000, // $100 USDC
    destination: '',
  },
};

// ── Provider ──────────────────────────────────────────────────────────────────

export function WalletProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WalletState>(INITIAL);

  // Hydrate persisted settings from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as Partial<WalletState>;
      setState(prev => ({
        ...prev,
        ...(saved.autoWithdraw        ? { autoWithdraw:        saved.autoWithdraw }        : {}),
        ...(saved.smartWalletAddress  ? { smartWalletAddress:  saved.smartWalletAddress }  : {}),
      }));
    } catch { /* ignore */ }
  }, []);

  const refreshBalance = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true }));
    try {
      const res  = await fetch('/api/wallet/balance');
      const data = await res.json() as {
        balance:            number;
        smartWalletAddress: string;
        network:            string;
      };
      setState(prev => ({
        ...prev,
        balance:            data.balance ?? 0,
        smartWalletAddress: data.smartWalletAddress ?? prev.smartWalletAddress,
        network:            (data.network as 'devnet' | 'mainnet') ?? prev.network,
        isLoading:          false,
      }));
    } catch {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, []);

  // Fetch on mount
  useEffect(() => { void refreshBalance(); }, [refreshBalance]);

  function setAutoWithdraw(autoWithdraw: AutoWithdrawSettings) {
    setState(prev => {
      const next = { ...prev, autoWithdraw };
      try {
        localStorage.setItem(LS_KEY, JSON.stringify({
          autoWithdraw:       next.autoWithdraw,
          smartWalletAddress: next.smartWalletAddress,
        }));
      } catch { /* ignore */ }
      return next;
    });
  }

  return (
    <WalletCtx.Provider value={{ ...state, refreshBalance, setAutoWithdraw }}>
      {children}
    </WalletCtx.Provider>
  );
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletCtx);
  if (!ctx) throw new Error('useWallet must be used within <WalletProvider>');
  return ctx;
}

// Aliases for files that used the old names
export const PlatformWalletProvider = WalletProvider;
export const usePlatformWallet      = useWallet;
