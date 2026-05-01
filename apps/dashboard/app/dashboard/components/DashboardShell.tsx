'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Settings, Menu, X, Zap, ChevronDown,
  Globe, ShieldCheck, Wallet,
} from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { cn } from '@/lib/utils';
import NetworkBadge from '@/components/NetworkBadge';
import { BotStoreProvider } from '@/lib/botStore';
import { PricingStoreProvider } from '@/lib/pricingStore';
import LogoutButton from './LogoutButton';

// ── Navigation structure ──────────────────────────────────────────────────────

interface ChildItem {
  href:   string;
  label:  string;
  badge?: string;
}

interface SingleItem {
  type:  'single';
  href:  string;
  label: string;
  icon:  React.ComponentType<{ className?: string }>;
}

interface GroupItem {
  type:     'group';
  label:    string;
  icon:     React.ComponentType<{ className?: string }>;
  children: ChildItem[];
}

type NavEntry = SingleItem | GroupItem;

const NAV: NavEntry[] = [
  {
    type:  'single',
    href:  '/dashboard',
    label: 'Dashboard',
    icon:  LayoutDashboard,
  },
  {
    type:  'group',
    label: 'Sites',
    icon:  Globe,
    children: [
      { href: '/dashboard/sites',     label: 'All Sites' },
      { href: '/dashboard/sites/add', label: 'Add New'   },
    ],
  },
  {
    type:  'single',
    href:  '/dashboard/wallet',
    label: 'Wallet',
    icon:  Wallet,
  },
  {
    type:  'single',
    href:  '/dashboard/audit',
    label: 'Audit Tool',
    icon:  ShieldCheck,
  },
  {
    type:  'single',
    href:  '/dashboard/settings',
    label: 'Settings',
    icon:  Settings,
  },
];

// ── Single nav item ───────────────────────────────────────────────────────────

function NavLink({ href, label, icon: Icon }: SingleItem) {
  const pathname = usePathname();
  const active   = href === '/dashboard' ? pathname === href : pathname.startsWith(href);

  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-150',
        active
          ? 'bg-accent-muted text-accent font-semibold'
          : 'text-ink-2 hover:bg-edge-2 hover:text-ink',
      )}
    >
      <Icon className={cn('w-4 h-4 shrink-0', active ? 'text-accent' : 'text-ink-3')} />
      {label}
    </Link>
  );
}

// ── Expandable group ──────────────────────────────────────────────────────────

function NavGroup({ label, icon: Icon, children }: GroupItem) {
  const pathname       = usePathname();
  const anyChildActive = children.some(c => pathname.startsWith(c.href));
  const [open, setOpen] = useState(anyChildActive);

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          'w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium',
          'transition-all duration-150',
          anyChildActive
            ? 'text-ink'
            : 'text-ink-2 hover:bg-edge-2 hover:text-ink',
        )}
      >
        <Icon className="w-4 h-4 shrink-0 text-ink-3" />
        <span className="flex-1 text-left">{label}</span>
        <ChevronDown
          className={cn(
            'w-3.5 h-3.5 text-ink-3 transition-transform duration-200 ease-out',
            open && 'rotate-180',
          )}
        />
      </button>

      <div
        className={cn(
          'overflow-hidden transition-all duration-200 ease-out',
          open ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0',
        )}
      >
        <div className="mt-0.5 ml-3 pl-3 border-l-2 border-edge space-y-0.5 pb-1">
          {children.map(child => {
            const active = pathname.startsWith(child.href);
            return (
              <Link
                key={child.href}
                href={child.href}
                className={cn(
                  'flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg text-sm transition-all duration-150',
                  active
                    ? 'text-accent font-semibold bg-accent-muted'
                    : 'text-ink-2 font-medium hover:bg-edge-2 hover:text-ink',
                )}
              >
                <span className="flex items-center gap-2">
                  {active && (
                    <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                  )}
                  {child.label}
                </span>
                {child.badge && (
                  <span className="text-2xs bg-accent text-white px-1.5 py-0.5 rounded-full font-bold leading-none shrink-0">
                    {child.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── User avatar ───────────────────────────────────────────────────────────────

function UserAvatar({ name, size = 'sm' }: { name: string; size?: 'sm' | 'md' }) {
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <div
      className={cn(
        'rounded-xl flex items-center justify-center font-bold shrink-0 select-none',
        'bg-gradient-to-br from-orange-400 to-orange-600 text-white',
        size === 'sm' ? 'w-7 h-7 text-xs' : 'w-9 h-9 text-sm',
      )}
    >
      {initials || '?'}
    </div>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

function Sidebar({
  displayName,
  email,
  onClose,
}: {
  displayName: string;
  email:       string;
  onClose?:    () => void;
}) {
  return (
    <div className="flex flex-col h-full">

      {/* Logo */}
      <div className="flex items-center justify-between px-5 h-14 border-b border-edge shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center shrink-0 shadow-sm">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <div>
            <span className="font-bold text-ink tracking-tight text-sm leading-none block">
              ScraperKast
            </span>
            <span className="text-2xs text-ink-3 leading-none">Content protection</span>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-ink-3 hover:text-ink lg:hidden p-1 rounded-lg hover:bg-edge-2 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto scrollbar-thin">
        {NAV.map(item =>
          item.type === 'single'
            ? <NavLink key={item.href} {...item} />
            : <NavGroup key={item.label} {...item} />,
        )}
      </nav>

      {/* User profile footer */}
      <div className="px-3 pb-4 pt-3 border-t border-edge">
        <div className="px-2 mb-3">
          <NetworkBadge />
        </div>
        <div className="flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-canvas transition-colors group">
          <UserAvatar name={displayName} size="md" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-ink truncate leading-snug">{displayName}</p>
            <p className="text-2xs text-ink-3 truncate leading-snug">{email}</p>
          </div>
          <LogoutButton />
        </div>
        <p className="text-2xs text-ink-3 text-center mt-2.5">ScraperKast v0.1.0</p>
      </div>
    </div>
  );
}

// ── Main layout ───────────────────────────────────────────────────────────────

function DashboardInner({
  children,
  user,
}: {
  children: React.ReactNode;
  user:     User;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const displayName =
    (user.user_metadata?.full_name as string | undefined)?.trim() ||
    user.email?.split('@')[0] ||
    'User';
  const email = user.email ?? '';

  return (
    <div className="flex h-screen bg-canvas overflow-hidden">

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-[260px] flex-col bg-surface border-r border-edge shrink-0">
        <Sidebar displayName={displayName} email={email} />
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-ink/20 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="absolute left-0 top-0 bottom-0 w-[260px] bg-surface z-50 flex flex-col shadow-popover">
            <Sidebar
              displayName={displayName}
              email={email}
              onClose={() => setSidebarOpen(false)}
            />
          </aside>
        </div>
      )}

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Topbar */}
        <header className="h-14 bg-surface border-b border-edge flex items-center px-5 gap-3 shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-ink-3 hover:text-ink p-1 rounded-lg hover:bg-edge-2 transition-colors"
            aria-label="Open menu"
          >
            <Menu className="w-4 h-4" />
          </button>

          <div className="flex-1" />

          {/* Network badge */}
          <div className="hidden lg:block">
            <NetworkBadge />
          </div>

          {/* User avatar */}
          <div className="flex items-center gap-2 border-l border-edge pl-3 ml-1">
            <UserAvatar name={displayName} size="sm" />
            <div className="hidden md:block text-right leading-tight">
              <p className="text-xs font-semibold text-ink truncate max-w-[110px]">{displayName}</p>
              <p className="text-2xs text-ink-3 truncate max-w-[110px]">{email}</p>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6 lg:p-8 scrollbar-thin">
          {children}
        </main>
      </div>
    </div>
  );
}

// ── Exported shell ────────────────────────────────────────────────────────────

export default function DashboardShell({
  children,
  user,
}: {
  children: React.ReactNode;
  user:     User;
}) {
  return (
    <BotStoreProvider>
      <PricingStoreProvider>
        <DashboardInner user={user}>{children}</DashboardInner>
      </PricingStoreProvider>
    </BotStoreProvider>
  );
}
