'use client';

import { useState } from 'react';
import { Loader2, ExternalLink } from 'lucide-react';
import { useWallet, type WalletAdapterName } from '@/lib/walletStore';

// ── Wallet definitions ────────────────────────────────────────────────────────

interface WalletOption {
  id:         WalletAdapterName;
  name:       string;
  bgColor:    string;
  textColor:  string;
  installUrl: string;
}

const WALLETS: WalletOption[] = [
  {
    id:         'phantom',
    name:       'Phantom',
    bgColor:    'bg-purple-100',
    textColor:  'text-purple-700',
    installUrl: 'https://phantom.app',
  },
  {
    id:         'solflare',
    name:       'Solflare',
    bgColor:    'bg-orange-100',
    textColor:  'text-orange-600',
    installUrl: 'https://solflare.com',
  },
  {
    id:         'backpack',
    name:       'Backpack',
    bgColor:    'bg-red-100',
    textColor:  'text-red-600',
    installUrl: 'https://backpack.app',
  },
];

// Demo-mode mock addresses per wallet type
const MOCK_ADDRESSES: Record<WalletAdapterName, string> = {
  phantom:  '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
  solflare: 'HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH',
  backpack: 'DRtXHDgC312wpNdNCSb8vCoXDcofCJcPHdAw4VkJ8L9i',
};

// ── Component ─────────────────────────────────────────────────────────────────

interface ConnectWalletProps {
  onConnected?: () => void;
}

export default function ConnectWallet({ onConnected }: ConnectWalletProps) {
  const { connect } = useWallet();
  const [connecting, setConnecting] = useState<WalletAdapterName | null>(null);

  async function handleConnect(wallet: WalletOption) {
    setConnecting(wallet.id);
    // Simulate wallet extension approval prompt (~1.2 s)
    await new Promise(r => setTimeout(r, 1_200));
    connect(MOCK_ADDRESSES[wallet.id], wallet.id);
    setConnecting(null);
    onConnected?.();
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500">
        Connect a Solana wallet to withdraw earnings directly on-chain.
      </p>
      <p className="text-xs bg-amber-50 border border-amber-200 text-amber-700 rounded-lg px-3 py-2">
        Demo mode: wallet connections are simulated — no browser extension required.
      </p>

      <div className="space-y-2 pt-1">
        {WALLETS.map(w => (
          <button
            key={w.id}
            onClick={() => handleConnect(w)}
            disabled={connecting !== null}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-200 bg-white hover:border-brand-dark hover:bg-slate-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
          >
            {/* Coloured initial as wallet icon */}
            <span className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${w.bgColor} ${w.textColor}`}>
              {w.name[0]}
            </span>
            <div className="flex-1 text-left">
              <p className="text-sm font-semibold text-slate-800">{w.name}</p>
              <p className="text-xs text-slate-400">Solana wallet</p>
            </div>
            {connecting === w.id ? (
              <Loader2 className="w-4 h-4 text-brand-dark animate-spin shrink-0" />
            ) : (
              <span className="text-xs text-slate-400 group-hover:text-brand-dark transition-colors">
                Connect →
              </span>
            )}
          </button>
        ))}
      </div>

      <p className="text-center text-xs text-slate-400 pt-2">
        Don&apos;t have a wallet?{' '}
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
