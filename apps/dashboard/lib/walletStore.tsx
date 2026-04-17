'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

export type WalletAdapterName = 'phantom' | 'solflare' | 'backpack';

export interface AutoWithdrawSettings {
  enabled:     boolean;
  threshold:   number; // µUSDC trigger amount
  destination: string; // wallet address
}

interface WalletState {
  address:      string | null;
  walletType:   WalletAdapterName | null;
  balance:      number; // µUSDC — earnings held by platform
  pending:      number; // µUSDC — pending settlement
  lifetime:     number; // µUSDC — all-time earnings
  today:        number; // µUSDC — today's earnings
  network:      'devnet' | 'mainnet';
  isConnected:  boolean;
  isLoading:    boolean;
  autoWithdraw: AutoWithdrawSettings;
}

interface WalletContextValue extends WalletState {
  connect:         (address: string, type: WalletAdapterName) => void;
  disconnect:      () => void;
  refreshBalance:  () => Promise<void>;
  setAutoWithdraw: (s: AutoWithdrawSettings) => void;
}

// ── Context ───────────────────────────────────────────────────────────────────

const WalletCtx = createContext<WalletContextValue | null>(null);

const LS_KEY = 'sk_wallet_v1';

const INITIAL: WalletState = {
  address:      null,
  walletType:   null,
  balance:      1_245_670_000,  // $1,245.67 USDC
  pending:      89_230_000,     // $89.23
  lifetime:     5_432_100_000,  // $5,432.10
  today:        12_500_000,     // $12.50
  network:      'devnet',
  isConnected:  false,
  isLoading:    false,
  autoWithdraw: {
    enabled:     true,
    threshold:   100_000_000, // $100 USDC
    destination: '',
  },
};

// ── Provider ──────────────────────────────────────────────────────────────────

export function WalletProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WalletState>(INITIAL);

  // Hydrate persistent wallet connection from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as Partial<WalletState>;
      setState(prev => ({
        ...prev,
        ...(saved.address      != null ? { address:      saved.address }      : {}),
        ...(saved.walletType   != null ? { walletType:   saved.walletType }   : {}),
        ...(saved.isConnected  != null ? { isConnected:  saved.isConnected }  : {}),
        ...(saved.autoWithdraw != null ? { autoWithdraw: saved.autoWithdraw } : {}),
      }));
    } catch { /* ignore parse errors */ }
  }, []);

  /** Apply a partial state patch and persist connection fields to localStorage. */
  function persist(patch: Partial<WalletState>) {
    setState(prev => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(LS_KEY, JSON.stringify({
          address:      next.address,
          walletType:   next.walletType,
          isConnected:  next.isConnected,
          autoWithdraw: next.autoWithdraw,
        }));
      } catch { /* ignore write errors */ }
      return next;
    });
  }

  function connect(address: string, type: WalletAdapterName) {
    persist({
      address,
      walletType:  type,
      isConnected: true,
      // Pre-fill auto-withdraw destination if not set
      autoWithdraw: {
        ...state.autoWithdraw,
        destination: state.autoWithdraw.destination || address,
      },
    });
  }

  function disconnect() {
    persist({ address: null, walletType: null, isConnected: false });
  }

  const refreshBalance = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true }));
    try {
      const res  = await fetch('/api/wallet/balance');
      const data = await res.json() as {
        balance: number; pending: number; lifetime: number;
        today: number; network: string;
      };
      setState(prev => ({
        ...prev,
        balance:   data.balance,
        pending:   data.pending,
        lifetime:  data.lifetime,
        today:     data.today,
        network:   (data.network as 'devnet' | 'mainnet') ?? prev.network,
        isLoading: false,
      }));
    } catch {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, []);

  function setAutoWithdraw(autoWithdraw: AutoWithdrawSettings) {
    persist({ autoWithdraw });
  }

  return (
    <WalletCtx.Provider value={{ ...state, connect, disconnect, refreshBalance, setAutoWithdraw }}>
      {children}
    </WalletCtx.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletCtx);
  if (!ctx) throw new Error('useWallet must be used within <WalletProvider>');
  return ctx;
}
