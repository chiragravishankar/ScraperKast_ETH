'use client';

import { type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title:      string;
  value:      string | number;
  sub?:       string;
  change?:    { text: string; positive: boolean };
  icon?:      LucideIcon;
  accent?:    boolean; // dark brand-colour card
  className?: string;
}

export default function StatCard({ title, value, sub, change, icon: Icon, accent, className }: StatCardProps) {
  return (
    <div
      className={cn(
        'rounded-xl p-5 border transition-shadow hover:shadow-md',
        accent
          ? 'bg-brand-dark text-white border-brand-dark'
          : 'bg-white text-slate-900 border-slate-200',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className={cn('text-xs font-semibold uppercase tracking-wider', accent ? 'text-white/70' : 'text-slate-500')}>
          {title}
        </p>
        {Icon && (
          <span className={cn('p-1.5 rounded-lg', accent ? 'bg-white/15' : 'bg-slate-100')}>
            <Icon className={cn('w-4 h-4', accent ? 'text-white' : 'text-brand-dark')} />
          </span>
        )}
      </div>

      <p className={cn('mt-3 text-2xl font-bold tabular-nums leading-none', accent ? 'text-white' : 'text-slate-900')}>
        {value}
      </p>

      {(sub || change) && (
        <div className="mt-2 flex items-center gap-2 text-xs">
          {sub && <span className={accent ? 'text-white/60' : 'text-slate-400'}>{sub}</span>}
          {change && (
            <span
              className={cn(
                'font-semibold',
                change.positive
                  ? accent ? 'text-green-300' : 'text-emerald-600'
                  : accent ? 'text-red-300'   : 'text-red-500',
              )}
            >
              {change.text}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
