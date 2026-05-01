'use client';

import { X, CheckCircle2, XCircle } from 'lucide-react';
import type { ScraperResult } from '@/app/api/audit/run/route';
import { cn } from '@/lib/utils';

interface Props {
  result:  ScraperResult;
  onClose: () => void;
}

export default function AttackPathModal({ result, onClose }: Props) {
  const { name, attackPath, success, timeMs, contentLength, fullArticle, blocked, error } = result;

  const tierColor: Record<string, string> = {
    ai:         'text-blue-600 bg-blue-50 border-blue-200',
    premium:    'text-red-600 bg-red-50 border-red-200',
    midtier:    'text-amber-600 bg-amber-50 border-amber-200',
    opensource: 'text-sky-600 bg-sky-50 border-sky-200',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-md bg-surface rounded-2xl shadow-popover border border-edge overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-edge">
          <div>
            <p className="font-bold text-ink text-sm">{name} — Attack Path</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={cn('text-2xs font-semibold px-2 py-0.5 rounded-full border capitalize', tierColor[result.tier])}>
                {result.tier === 'midtier' ? 'Mid-Tier' : result.tier === 'ai' ? 'AI Bot' : result.tier}
              </span>
              <span className="text-2xs text-ink-3">Difficulty {result.difficulty}/10</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-ink-3 hover:text-ink p-1 rounded-lg hover:bg-edge-2 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5">
          {attackPath.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-ink-3">
                {error ?? 'No attack path data available for this scraper.'}
              </p>
            </div>
          ) : (
            <div>
              {/* Steps */}
              <div className="space-y-0">
                {attackPath.map((step, i) => (
                  <div key={step.step} className="flex gap-3">
                    {/* Connector column */}
                    <div className="flex flex-col items-center shrink-0">
                      <div className="w-6 h-6 rounded-full bg-canvas border-2 border-edge flex items-center justify-center text-xs font-bold text-ink-2">
                        {step.step}
                      </div>
                      {i < attackPath.length - 1 && (
                        <div className="w-px flex-1 bg-edge my-1" style={{ minHeight: 16 }} />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 pb-4">
                      <p className="text-xs font-semibold text-ink leading-snug">{step.action}</p>
                      <p className="text-xs text-ink-3 mt-0.5 leading-relaxed">{step.result}</p>
                      {step.timeMs > 0 && (
                        <p className="text-2xs text-ink-3 mt-0.5 tabular-nums">{step.timeMs}ms</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Final outcome badge */}
              <div className={cn(
                'flex items-start gap-3 p-3.5 rounded-xl border mt-1',
                success
                  ? 'bg-red-50 border-red-200'
                  : 'bg-emerald-50 border-emerald-200',
              )}>
                {success ? (
                  <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                )}
                <div>
                  <p className={cn('text-xs font-bold', success ? 'text-red-700' : 'text-emerald-700')}>
                    {success
                      ? `Content extracted — ${timeMs}ms total`
                      : blocked
                        ? 'Blocked by site defenses'
                        : 'Test could not complete (tool unavailable)'}
                  </p>
                  {success && (
                    <p className="text-2xs text-red-600 mt-0.5">
                      {contentLength.toLocaleString()} bytes •{' '}
                      {fullArticle ? 'Full article retrieved' : 'Partial content retrieved'}
                    </p>
                  )}
                  {!success && error && (
                    <p className="text-2xs text-emerald-600 mt-0.5">{error}</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
