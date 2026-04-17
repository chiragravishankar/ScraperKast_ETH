'use client';

import { useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import type { WalletName } from '@solana/wallet-adapter-base';
import { ExternalLink, Loader2, CheckCircle } from 'lucide-react';

// ── Wallet display config ─────────────────────────────────────────────────────

const WALLET_UI: Record<string, { bgColor: string; textColor: string }> = {
  Phantom:  { bgColor: 'bg-purple-100', textColor: 'text-purple-700' },
  Solflare: { bgColor: 'bg-orange-100', textColor: 'text-orange-600' },
};

const DEFAULT_UI = { bgColor: 'bg-slate-100', textColor: 'text-slate-600' };

// ── Component ─────────────────────────────────────────────────────────────────

interface ConnectWalletProps {
  onConnected?: () => void;
}

export default function ConnectWallet({ onConnected }: ConnectWalletProps) {
  const {
    wallets, select, connect, connecting, connected, wallet: activeWallet,
  } = useWallet();

  const handleSelect = useCallback(async (walletName: WalletName) => {
    select(walletName);
    // connect() is called automatically after select when autoConnect = false;
    // with autoConnect = true the adapter connects on its own, but we call it
    // explicitly here so the modal closes after the user approves.
    try {
      await connect();
      onConnected?.();
    } catch {
      // User rejected or extension not installed — adapter shows its own error
    }
  }, [select, connect, onConnected]);

  const detectedWallets    = wallets.filter(w => w.readyState === 'Installed');
  const notInstalledWallets = wallets.filter(w => w.readyState !== 'Installed');

  if (connected) {
    return (
      <div className="flex flex-col items-center gap-3 py-4">
        <CheckCircle className="w-10 h-10 text-emerald-500" />
        <div className="text-center">
          <p className="font-semibold text-slate-800">Wallet connected!</p>
          <p className="text-sm text-slate-500 mt-1">
            {activeWallet?.adapter.name} · Devnet
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500">
        Connect a Solana wallet to withdraw earnings directly on-chain.
      </p>

      <p className="text-xs bg-sky-50 border border-sky-200 text-sky-700 rounded-lg px-3 py-2">
        Connected to <strong>Devnet</strong> — transactions are free and use test tokens only.
      </p>

      {/* Detected (installed) wallets */}
      {detectedWallets.length > 0 && (
        <div className="space-y-2 pt-1">
          {detectedWallets.map(w => {
            const ui = WALLET_UI[w.adapter.name] ?? DEFAULT_UI;
            const isConnecting = connecting && activeWallet?.adapter.name === w.adapter.name;
            return (
              <button
                key={w.adapter.name}
                onClick={() => handleSelect(w.adapter.name as WalletName)}
                disabled={connecting}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-200 bg-white hover:border-brand-dark hover:bg-slate-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
              >
                {w.adapter.icon ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={w.adapter.icon} alt={w.adapter.name} className="w-9 h-9 rounded-xl shrink-0" />
                ) : (
                  <span className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${ui.bgColor} ${ui.textColor}`}>
                    {w.adapter.name[0]}
                  </span>
                )}
                <div className="flex-1 text-left">
                  <p className="text-sm font-semibold text-slate-800">{w.adapter.name}</p>
                  <p className="text-xs text-emerald-600 font-medium">Detected</p>
                </div>
                {isConnecting ? (
                  <Loader2 className="w-4 h-4 text-brand-dark animate-spin shrink-0" />
                ) : (
                  <span className="text-xs text-slate-400 group-hover:text-brand-dark transition-colors">
                    Connect →
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Not-installed wallets */}
      {notInstalledWallets.length > 0 && (
        <div className="space-y-2">
          {detectedWallets.length > 0 && (
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide pt-1">
              Not installed
            </p>
          )}
          {notInstalledWallets.map(w => {
            const ui = WALLET_UI[w.adapter.name] ?? DEFAULT_UI;
            return (
              <a
                key={w.adapter.name}
                href={w.adapter.url}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-dashed border-slate-200 bg-white hover:border-brand-dark/40 hover:bg-slate-50 transition-all group"
              >
                {w.adapter.icon ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={w.adapter.icon} alt={w.adapter.name} className="w-9 h-9 rounded-xl shrink-0 opacity-60" />
                ) : (
                  <span className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 opacity-60 ${ui.bgColor} ${ui.textColor}`}>
                    {w.adapter.name[0]}
                  </span>
                )}
                <div className="flex-1 text-left">
                  <p className="text-sm font-semibold text-slate-600">{w.adapter.name}</p>
                  <p className="text-xs text-slate-400">Not installed — click to install</p>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-slate-300 group-hover:text-brand-dark transition-colors shrink-0" />
              </a>
            );
          })}
        </div>
      )}

      {wallets.length === 0 && (
        <div className="text-center py-4">
          <p className="text-sm text-slate-500 mb-3">
            No Solana wallet extension found.
          </p>
          <a
            href="https://phantom.app"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-semibold text-brand-dark hover:underline inline-flex items-center gap-1"
          >
            Install Phantom <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      )}

      <p className="text-center text-xs text-slate-400 pt-1">
        Need a wallet?{' '}
        <a
          href="https://phantom.app"
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand-dark hover:underline inline-flex items-center gap-0.5"
        >
          Get Phantom <ExternalLink className="w-3 h-3" />
        </a>
      </p>
    </div>
  );
}
