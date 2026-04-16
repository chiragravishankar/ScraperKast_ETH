'use client';

import { useEffect, useState } from 'react';
import { timeAgo, formatUsdcDollar } from '@/lib/formatters';
import type { RequestEvent } from '@/lib/mockData';
import { cn } from '@/lib/utils';

const STATUS_STYLES: Record<RequestEvent['status'], string> = {
  paid:    'bg-emerald-100 text-emerald-700',
  allowed: 'bg-slate-100  text-slate-600',
  blocked: 'bg-red-100    text-red-600',
};

export default function ActivityFeed() {
  const [events, setEvents] = useState<RequestEvent[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  async function fetchEvents() {
    try {
      const res  = await fetch('/api/dashboard/realtime', { cache: 'no-store' });
      const data = await res.json() as { recent: RequestEvent[]; updatedAt: string };
      setEvents(data.recent);
      setLastUpdated(new Date());
    } catch { /* network error — keep last data */ }
  }

  useEffect(() => {
    fetchEvents();
    const interval = setInterval(fetchEvents, 5_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      {lastUpdated && (
        <p className="text-xs text-slate-400 mb-3">
          Updated {timeAgo(lastUpdated)}
        </p>
      )}

      {events.length === 0 ? (
        <p className="text-sm text-slate-400 py-8 text-center">Waiting for activity…</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {events.map((ev) => (
            <li key={ev.id} className="flex items-center justify-between py-2.5 gap-3 text-sm">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-slate-800 truncate">{ev.botName}</span>
                  <span className={cn('text-xs font-medium px-1.5 py-0.5 rounded-full', STATUS_STYLES[ev.status])}>
                    {ev.status}
                  </span>
                </div>
                <p className="text-slate-400 text-xs truncate mt-0.5">{ev.path}</p>
              </div>
              <div className="text-right shrink-0">
                {ev.amount > 0
                  ? <span className="text-brand-dark font-semibold">{formatUsdcDollar(ev.amount)}</span>
                  : <span className="text-slate-400 text-xs">free</span>
                }
                <p className="text-xs text-slate-400">{timeAgo(new Date(ev.timestamp))}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
