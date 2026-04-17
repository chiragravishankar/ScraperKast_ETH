'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Bot, DollarSign, List, Settings,
  Menu, X, Wallet, Sliders, Zap,
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import NetworkBadge from '@/components/NetworkBadge';
import { WalletProvider, useWallet } from '@/lib/walletStore';
import { BotStoreProvider } from '@/lib/botStore';
import { PricingStoreProvider } from '@/lib/pricingStore';
import { formatUsdcDollar } from '@/lib/formatters';

// ── Navigation ────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { href: '/dashboard',              label: 'Overview',      icon: LayoutDashboard },
  { href: '/dashboard/wallet',       label: 'Wallet',        icon: Wallet          },
  { href: '/dashboard/bots',         label: 'Bots',          icon: Bot             },
  { href: '/dashboard/pricing',      label: 'Pricing',       icon: Sliders         },
  { href: '/dashboard/revenue',      label: 'Revenue',       icon: DollarSign      },
  { href: '/dashboard/transactions', label: 'Transactions',  icon: List            },
  { href: '/dashboard/settings',     label: 'Settings',      icon: Settings        },
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
        'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all',
        active
          ? 'bg-accent-muted text-accent font-semibold'
          : 'text-ink-2 hover:bg-edge-2 hover:text-ink',
      )}
    >
      <Icon className="w-4 h-4 shrink-0" />
      {label}
    </Link>
  );
}

// ── Topbar wallet pill ────────────────────────────────────────────────────────

function WalletPill() {
  const { balance, isLoading } = useWallet();

  return (
    <Link
      href="/dashboard/wallet"
      className="hidden sm:flex items-center gap-2 text-xs bg-canvas border border-edge rounded-lg px-3 py-1.5 hover:border-ink-3 transition-colors"
    >
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
      <span className={cn('font-semibold tabular text-ink', isLoading && 'opacity-30')}>
        {formatUsdcDollar(balance)} USDC
      </span>
    </Link>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

function Sidebar({ onClose }: { onClose?: () => void }) {
  return (
    <div className="flex flex-col h-full">

      {/* Logo */}
      <div className="flex items-center justify-between px-5 h-14 border-b border-edge shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-md bg-accent flex items-center justify-center shrink-0">
            <Zap className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-bold text-ink tracking-tight text-sm">ScraperKast</span>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-ink-3 hover:text-ink lg:hidden p-1">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto scrollbar-thin">
        {NAV_ITEMS.map(item => (
          <NavLink key={item.href} {...item} />
        ))}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-edge space-y-3">
        <NetworkBadge />
        <p className="text-2xs text-ink-3">ScraperKast v0.1.0</p>
      </div>

    </div>
  );
}

// ── Inner layout ──────────────────────────────────────────────────────────────

function DashboardLayoutInner({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-canvas overflow-hidden">

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-[220px] flex-col bg-surface border-r border-edge shrink-0">
        <Sidebar />
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-ink/20 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="absolute left-0 top-0 bottom-0 w-[220px] bg-surface z-50 flex flex-col shadow-popover">
            <Sidebar onClose={() => setSidebarOpen(false)} />
          </aside>
        </div>
      )}

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Topbar */}
        <header className="h-14 bg-surface border-b border-edge flex items-center px-5 gap-3 shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-ink-3 hover:text-ink p-1"
          >
            <Menu className="w-4 h-4" />
          </button>
          <div className="flex-1" />
          <WalletPill />
          <NetworkBadge />
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6 lg:p-8 scrollbar-thin">
          {children}
        </main>

      </div>
    </div>
  );
}

// ── Exported layout ───────────────────────────────────────────────────────────

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <WalletProvider>
      <BotStoreProvider>
        <PricingStoreProvider>
          <DashboardLayoutInner>{children}</DashboardLayoutInner>
        </PricingStoreProvider>
      </BotStoreProvider>
    </WalletProvider>
  );
}
