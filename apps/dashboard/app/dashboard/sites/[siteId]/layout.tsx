'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useParams } from 'next/navigation';
import { ChevronLeft, Globe, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SiteDetail } from '@/app/api/sites/[siteId]/route';

// ── Tab definitions ───────────────────────────────────────────────────────────

const TABS = [
  { label: 'Overview',   slug: 'overview'   },
  { label: 'Activity',   slug: 'activity'   },
  { label: 'Revenue',    slug: 'revenue'    },
  { label: 'Protection', slug: 'protection' },
  { label: 'Settings',   slug: 'settings'   },
] as const;

// ── Tab bar ───────────────────────────────────────────────────────────────────

function SiteTabBar({ siteId }: { siteId: string }) {
  const pathname = usePathname();

  return (
    <div className="flex items-center gap-0.5 border-b border-edge overflow-x-auto scrollbar-thin pb-px">
      {TABS.map(tab => {
        const href   = `/dashboard/sites/${siteId}/${tab.slug}`;
        const active = pathname.startsWith(href);
        return (
          <Link
            key={tab.slug}
            href={href}
            className={cn(
              'px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-all duration-150 rounded-t-lg border-b-2 -mb-px',
              active
                ? 'border-accent text-accent font-semibold bg-accent-muted/40'
                : 'border-transparent text-ink-3 hover:text-ink hover:border-edge',
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}

// ── Header skeleton ───────────────────────────────────────────────────────────

function HeaderSkeleton() {
  return (
    <div className="flex items-center gap-3 animate-pulse">
      <div className="w-9 h-9 rounded-xl bg-edge shrink-0" />
      <div className="space-y-1.5">
        <div className="h-4 bg-edge rounded w-36" />
        <div className="h-3 bg-edge rounded w-48" />
      </div>
    </div>
  );
}

// ── Layout ────────────────────────────────────────────────────────────────────

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  const { siteId } = useParams<{ siteId: string }>();
  const [detail,  setDetail]  = useState<SiteDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/sites/${siteId}`)
      .then(r => r.ok ? r.json() as Promise<SiteDetail> : null)
      .then(data => {
        setDetail(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [siteId]);

  const summary = detail?.summary;

  return (
    <div className="space-y-0 animate-fade-in">

      {/* Site header */}
      <div className="mb-4">
        <Link
          href="/dashboard/sites"
          className="inline-flex items-center gap-1.5 text-xs text-ink-3 hover:text-ink transition-colors mb-3"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          All Sites
        </Link>

        {loading ? (
          <HeaderSkeleton />
        ) : (
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-accent-muted flex items-center justify-center shrink-0">
              <Globe className="w-4 h-4 text-accent" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-ink">
                  {summary?.name ?? siteId}
                </h1>
                {summary?.verified ? (
                  <span className="inline-flex items-center gap-1 text-2xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <CheckCircle2 className="w-3 h-3" />
                    Active
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-2xs font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                    <AlertCircle className="w-3 h-3" />
                    Setup required
                  </span>
                )}
              </div>
              <p className="text-xs text-ink-3">{summary?.url ?? siteId}</p>
            </div>
          </div>
        )}
      </div>

      {/* Tab navigation */}
      <SiteTabBar siteId={siteId} />

      {/* Page content */}
      <div className="pt-6">
        {children}
      </div>
    </div>
  );
}
