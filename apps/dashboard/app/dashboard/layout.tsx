'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Bot, DollarSign, List, Settings, Zap, Menu, X, Wallet, Sliders,
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import NetworkBadge from '@/components/NetworkBadge';
import { PlatformWalletProvider, usePlatformWallet } from '@/lib/walletStore';
import { BotStoreProvider } from '@/lib/botStore';
import { PricingStoreProvider } from '@/lib/pricingStore';
import { formatUsdcDollar, shortenAddress } from '@/lib/formatters';

// ── Navigation items ──────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { href: '/dashboard/wallet',       label: 'Wallet',       icon: Wallet         },
  { href: '/dashboard',              label: 'Overview',     icon: LayoutDashboard },
  { href: '/dashboard/bots',         label: 'Bots',         icon: Bot             },
  { href: '/dashboard/pricing',      label: 'Pricing',      icon: Sliders         },
  { href: '/dashboard/revenue',      label: 'Revenue',      icon: DollarSign      },
  { href: '/dashboard/transactions', label: 'Transactions', icon: List            },
  { href: '/dashboard/settings',     label: 'Settings',     icon: Settings        },
];

// ── NavLink ───────────────────────────────────────────────────────────────────

function NavLink({ href, label, icon: Icon }: {
  href: string; label: string; icon: React.ElementType;
}) {
  const pathname = usePathname();
  const active = href === '/dashboard'
    ? pathname === href
    : pathname.startsWith(href);

  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
        active
          ? 'bg-brand-dark text-white shadow-sm'
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
      )}
    >
      <Icon className="w-4 h-4 shrink-0" />
      {label}
    </Link>
  );
}

// ── Topbar wallet indicator ───────────────────────────────────────────────────

function WalletIndicator() {
  const { address, balance, isConnected } = usePlatformWallet();
  if (!isConnected || !address) return null;

  return (
    <Link
      href="/dashboard/wallet"
      className="hidden sm:flex items-center gap-2 text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 hover:border-brand-dark transition-colors"
      title="Open Wallet"
    >
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
      <span className="font-mono text-slate-600">{shortenAddress(address)}</span>
      <span className="font-semibold text-brand-dark tabular-nums">{formatUsdcDollar(balance)}</span>
    </Link>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

function Sidebar({ onClose }: { onClose?: () => void }) {
  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center justify-between px-4 py-5 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-brand-dark flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-slate-900 text-sm">ScraperKast</span>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 lg:hidden">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-thin">
        {NAV_ITEMS.map(item => (
          <NavLink key={item.href} {...item} />
        ))}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-slate-100">
        <NetworkBadge />
        <p className="text-xs text-slate-400 mt-2">ScraperKast v0.1.0</p>
      </div>
    </div>
  );
}

// ── Inner layout (consumer of WalletProvider) ────────────────────────────────

function DashboardLayoutInner({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-56 flex-col bg-white border-r border-slate-200 shrink-0">
        <Sidebar />
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-56 bg-white z-50 flex flex-col">
            <Sidebar onClose={() => setSidebarOpen(false)} />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="h-14 bg-white border-b border-slate-200 flex items-center px-4 gap-3 shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-slate-500 hover:text-slate-900"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex-1" />
          <WalletIndicator />
          <NetworkBadge />
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6 scrollbar-thin">
          {children}
        </main>
      </div>
    </div>
  );
}

// ── Exported layout ───────────────────────────────────────────────────────────

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <PlatformWalletProvider>
      <BotStoreProvider>
        <PricingStoreProvider>
          <DashboardLayoutInner>{children}</DashboardLayoutInner>
        </PricingStoreProvider>
      </BotStoreProvider>
    </PlatformWalletProvider>
  );
}
