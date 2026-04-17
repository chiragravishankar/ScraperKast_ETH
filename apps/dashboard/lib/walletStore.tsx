'use client';

import {
  createContext, useCallback, useContext, useEffect, useState,
} from 'react';
import type { ReactNode } from 'react';
import {
  useWallet as useAdapterWallet,
  useConnection,
} from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress, getAccount } from '@solana/spl-token';

// ── Constants ─────────────────────────────────────────────────────────────────

// Official devnet USDC mint (Circle)
const DEVNET_USDC_MINT = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');

// ── Types ─────────────────────────────────────────────────────────────────────

export type WalletAdapterName = 'phantom' | 'solflare' | 'coinbase' | 'other';

export interface AutoWithdrawSettings {
  enabled:     boolean;
  threshold:   number; // µUSDC trigger amount
  destination: string; // wallet address
}

interface WalletState {
  address:          string | null;
  walletType:       WalletAdapterName | null;
  balance:          number; // µUSDC — real on-chain USDC balance when connected, else platform mock
  pending:          number; // µUSDC — pending settlement (platform accounting)
  lifetime:         number; // µUSDC — all-time earnings (platform accounting)
  today:            number; // µUSDC — today's earnings (platform accounting)
  network:          'devnet' | 'mainnet';
  isConnected:      boolean;
  isLoading:        boolean;
  autoWithdraw:     AutoWithdrawSettings;
}

interface PlatformWalletContextValue extends WalletState {
  refreshBalance:  () => Promise<void>;
  setAutoWithdraw: (s: AutoWithdrawSettings) => void;
}

// ── Context ───────────────────────────────────────────────────────────────────

const WalletCtx = createContext<PlatformWalletContextValue | null>(null);

const LS_KEY = 'sk_wallet_v1';

const INITIAL: WalletState = {
  address:     null,
  walletType:  null,
  balance:     0,
  pending:     89_230_000,     // $89.23 — platform pending (demo)
  lifetime:    5_432_100_000,  // $5,432.10 — all-time earnings (demo)
  today:       12_500_000,     // $12.50 — today's earnings (demo)
  network:     'devnet',
  isConnected: false,
  isLoading:   false,
  autoWithdraw: {
    enabled:     true,
    threshold:   100_000_000, // $100 USDC
    destination: '',
  },
};

// ── Provider ──────────────────────────────────────────────────────────────────

export function PlatformWalletProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WalletState>(INITIAL);

  // Solana wallet adapter hooks (must be inside SolanaProviders)
  const { publicKey, connected, wallet } = useAdapterWallet();
  const { connection } = useConnection();

  // Hydrate auto-withdraw settings from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as Partial<WalletState>;
      if (saved.autoWithdraw) {
        setState(prev => ({ ...prev, autoWithdraw: saved.autoWithdraw! }));
      }
    } catch { /* ignore parse errors */ }
  }, []);

  // Sync adapter wallet state into our store
  useEffect(() => {
    if (connected && publicKey) {
      const adapterName = (wallet?.adapter.name ?? '').toLowerCase();
      const walletType: WalletAdapterName =
        adapterName.includes('phantom')  ? 'phantom'  :
        adapterName.includes('solflare') ? 'solflare' :
        adapterName.includes('coinbase') ? 'coinbase' : 'other';

      setState(prev => ({
        ...prev,
        address:     publicKey.toBase58(),
        walletType,
        isConnected: true,
        // Pre-fill auto-withdraw destination if not set
        autoWithdraw: {
          ...prev.autoWithdraw,
          destination: prev.autoWithdraw.destination || publicKey.toBase58(),
        },
      }));
    } else {
      setState(prev => ({
        ...prev,
        address:     null,
        walletType:  null,
        isConnected: false,
        balance:     0,
      }));
    }
  }, [connected, publicKey, wallet]);

  // Fetch real on-chain USDC balance + platform earnings
  const refreshBalance = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true }));
    try {
      // Platform earnings from API (mock for now)
      const res  = await fetch('/api/wallet/balance');
      const data = await res.json() as {
        balance: number; pending: number; lifetime: number;
        today: number; network: string;
      };

      let onChainBalance = 0;

      // If a real wallet is connected, fetch its actual devnet USDC balance
      if (publicKey && connected) {
        try {
          const ata     = await getAssociatedTokenAddress(DEVNET_USDC_MINT, publicKey);
          const account = await getAccount(connection, ata);
          // account.amount is a BigInt in µUSDC (6 decimals)
          onChainBalance = Number(account.amount);
        } catch {
          // Token account doesn't exist yet = 0 USDC
          onChainBalance = 0;
        }
      }

      setState(prev => ({
        ...prev,
        // Show real on-chain balance when connected, otherwise platform mock
        balance:   connected ? onChainBalance : data.balance,
        pending:   data.pending,
        lifetime:  data.lifetime,
        today:     data.today,
        network:   'devnet',
        isLoading: false,
      }));
    } catch {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [connection, publicKey, connected]);

  function setAutoWithdraw(autoWithdraw: AutoWithdrawSettings) {
    setState(prev => {
      const next = { ...prev, autoWithdraw };
      try {
        localStorage.setItem(LS_KEY, JSON.stringify({ autoWithdraw: next.autoWithdraw }));
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

// ── Hook ──────────────────────────────────────────────────────────────────────

export function usePlatformWallet(): PlatformWalletContextValue {
  const ctx = useContext(WalletCtx);
  if (!ctx) throw new Error('usePlatformWallet must be used within <PlatformWalletProvider>');
  return ctx;
}

// Backward-compat alias (use usePlatformWallet in new code)
export const WalletProvider = PlatformWalletProvider;
export const useWallet      = usePlatformWallet;
