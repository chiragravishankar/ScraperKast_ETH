'use client';

import { type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title:      string;
  value:      string | number;
  sub?:       string;
  change?:    { text: string; positive: boolean };
  icon?:      LucideIcon;
  /** Visually emphasise this card (slightly darker border, accent value color) */
  accent?:    boolean;
  className?: string;
}

export default function StatCard({ title, value, sub, change, icon: Icon, accent, className }: StatCardProps) {
  return (
    <div
      className={cn(
        'card-hover p-5 flex flex-col gap-3',
        accent && 'border-accent/20',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-2xs font-semibold uppercase tracking-wider text-ink-2">
          {title}
        </p>
        {Icon && (
          <span className="p-1.5 rounded-lg bg-edge-2 shrink-0">
            <Icon className="w-3.5 h-3.5 text-ink-2" />
          </span>
        )}
      </div>

      <p className={cn(
        'text-2xl font-bold tabular leading-none',
        accent ? 'text-accent' : 'text-ink',
      )}>
        {value}
      </p>

      {(sub || change) && (
        <div className="flex items-center gap-2 text-xs">
          {sub && <span className="text-ink-3">{sub}</span>}
          {change && (
            <span className={cn(
              'font-semibold',
              change.positive ? 'text-emerald-600' : 'text-red-500',
            )}>
              {change.text}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
