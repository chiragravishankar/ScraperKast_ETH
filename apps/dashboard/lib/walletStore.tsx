'use client';

import {
  createContext, useCallback, useContext, useEffect, useState,
} from 'react';
import type { ReactNode } from 'react';
import {
  useWallet as useAdapterWallet,
  useConnection,
} from '@solana/wallet-adapter-react';
import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
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

  // Sync adapter wallet state into our store, then immediately fetch balance
  useEffect(() => {
    if (connected && publicKey) {
      console.log('[WalletStore] Wallet connected:', publicKey.toBase58());
      console.log('[WalletStore] Adapter:', wallet?.adapter.name);

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
        autoWithdraw: {
          ...prev.autoWithdraw,
          destination: prev.autoWithdraw.destination || publicKey.toBase58(),
        },
      }));
    } else {
      if (!connected) console.log('[WalletStore] Wallet disconnected');
      setState(prev => ({
        ...prev,
        address:     null,
        walletType:  null,
        isConnected: false,
        balance:     0,
      }));
    }
  }, [connected, publicKey, wallet]);

  // Auto-refresh balance whenever wallet connects (or publicKey changes)
  useEffect(() => {
    if (connected && publicKey) {
      void refreshBalance();
    }
  // refreshBalance is stable within a connection — including it would cause loops
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, publicKey]);

  // Fetch real on-chain USDC balance + platform earnings
  const refreshBalance = useCallback(async () => {
    console.log('=== [WalletStore] BALANCE FETCH START ===');
    console.log('  connected   :', connected);
    console.log('  publicKey   :', publicKey?.toBase58() ?? 'none');
    console.log('  rpcEndpoint :', connection.rpcEndpoint);
    console.log('  USDC mint   :', DEVNET_USDC_MINT.toBase58());

    setState(prev => ({ ...prev, isLoading: true }));
    try {
      // Platform earnings from API
      const res  = await fetch('/api/wallet/balance');
      const data = await res.json() as {
        balance: number; pending: number; lifetime: number;
        today: number; network: string;
      };

      let onChainBalance = 0;

      if (publicKey && connected) {
        // SOL balance (useful for fee diagnostics)
        const lamports = await connection.getBalance(publicKey);
        console.log('  SOL balance :', lamports / LAMPORTS_PER_SOL, 'SOL');

        // USDC ATA
        const ata = await getAssociatedTokenAddress(DEVNET_USDC_MINT, publicKey);
        console.log('  USDC ATA    :', ata.toBase58());

        try {
          const account = await getAccount(connection, ata);
          onChainBalance = Number(account.amount);
          console.log('  raw amount  :', account.amount.toString(), 'µUSDC');
          console.log('  USDC balance:', onChainBalance / 1_000_000, 'USDC ✅');
        } catch (ataErr) {
          const name = (ataErr as Error).name;
          if (name === 'TokenAccountNotFoundError' || name === 'TokenInvalidAccountOwnerError') {
            console.log('  ATA not found — wallet has no USDC token account yet (balance = 0)');
          } else {
            console.error('  ATA fetch error:', ataErr);
          }
          onChainBalance = 0;
        }
      } else {
        console.log('  Wallet not connected — skipping on-chain fetch, using platform mock');
      }

      setState(prev => ({
        ...prev,
        balance:   connected ? onChainBalance : data.balance,
        pending:   data.pending,
        lifetime:  data.lifetime,
        today:     data.today,
        network:   'devnet',
        isLoading: false,
      }));
      console.log('=== [WalletStore] BALANCE FETCH DONE — displayed:', connected ? onChainBalance / 1_000_000 + ' USDC' : 'mock');
    } catch (err) {
      console.error('[WalletStore] refreshBalance error:', err);
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
