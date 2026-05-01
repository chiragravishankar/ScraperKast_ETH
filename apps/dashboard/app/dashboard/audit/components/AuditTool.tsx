'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, Loader2, AlertCircle, Shield } from 'lucide-react';
import type { AuditPayload } from '@/app/api/audit/run/route';
import AuditResults from './AuditResults';

// ── Progress steps shown while the audit runs (~30s) ──────────────────────────

const PROGRESS_STEPS = [
  { label: 'Resolving target URL…',                       pct: 3  },
  { label: 'Testing GPTBot, ClaudeBot, PerplexityBot…',   pct: 9  },
  { label: 'Testing Google-Extended, Bingbot-AI, CCBot…', pct: 15 },
  { label: 'Testing Applebot, FacebookBot, ChatGPT…',     pct: 21 },
  { label: 'Testing Scrapy, Cheerio, Axios+JSDOM…',       pct: 29 },
  { label: 'Testing ParseHub, Scrapingdog, Apify…',       pct: 38 },
  { label: 'Testing Diffbot & ScrapingBee…',              pct: 46 },
  { label: 'Testing BrightData residential proxies…',     pct: 55 },
  { label: 'Testing Oxylabs & Zyte enterprise proxies…',  pct: 63 },
  { label: 'Testing ScraperAPI proxy rotation…',          pct: 70 },
  { label: 'Launching headless Chrome for Firecrawl…',   pct: 78 },
  { label: 'Running Puppeteer headless extraction…',      pct: 87 },
  { label: 'Running Playwright multi-browser test…',      pct: 93 },
  { label: 'Calculating weighted vulnerability score…',   pct: 97 },
];

// ── Animated progress bar ─────────────────────────────────────────────────────

function ProgressBar({ pct }: { pct: number }) {
  return (
    <div className="w-full bg-edge rounded-full h-1.5 overflow-hidden">
      <div
        className="h-full bg-accent rounded-full transition-all duration-700 ease-out"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function AuditTool({ recentAudits }: { recentAudits: AuditPayload[] }) {
  const [url,       setUrl]       = useState('');
  const [running,   setRunning]   = useState(false);
  const [stepIdx,   setStepIdx]   = useState(0);
  const [error,     setError]     = useState('');
  const [result,    setResult]    = useState<AuditPayload | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Advance the progress step label every ~4 seconds while running
  useEffect(() => {
    if (running) {
      setStepIdx(0);
      intervalRef.current = setInterval(() => {
        setStepIdx(prev => Math.min(prev + 1, PROGRESS_STEPS.length - 1));
      }, 2500);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;

    setRunning(true);
    setError('');
    setResult(null);

    try {
      const res = await fetch('/api/audit/run', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ url: url.trim() }),
      });

      const data: AuditPayload & { error?: string } = await res.json() as AuditPayload & { error?: string };

      if (!res.ok) {
        setError(data.error ?? `Unexpected error (${res.status})`);
      } else {
        setResult(data);
      }
    } catch {
      setError('Network error — please check your connection and try again.');
    } finally {
      setRunning(false);
    }
  }

  function handleReset() {
    setResult(null);
    setUrl('');
    setError('');
  }

  const currentStep = PROGRESS_STEPS[stepIdx] ?? PROGRESS_STEPS[PROGRESS_STEPS.length - 1]!;

  // ── Show results ────────────────────────────────────────────────────────────
  if (result) {
    return <AuditResults result={result} onReset={handleReset} />;
  }

  // ── Form + recent audits ────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Input card */}
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center shrink-0">
            <Shield className="w-4.5 h-4.5 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-ink">Scraper Audit</h2>
            <p className="text-xs text-ink-3">
              Test 10 AI bots + 15 commercial scrapers against your site — takes ~35 seconds
            </p>
          </div>
        </div>

        <form onSubmit={e => { void handleSubmit(e); }} className="space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-3 pointer-events-none" />
              <input
                type="text"
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="https://yoursite.com"
                disabled={running}
                className="input pl-9 w-full disabled:opacity-50"
                autoFocus
              />
            </div>
            <button
              type="submit"
              disabled={running || !url.trim()}
              className="px-5 py-2.5 bg-accent text-white rounded-xl font-semibold text-sm hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            >
              {running ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Audit'}
            </button>
          </div>

          {/* Error banner */}
          {error && (
            <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl p-3">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
        </form>

        {/* Progress */}
        {running && (
          <div className="mt-5 space-y-2.5">
            <ProgressBar pct={currentStep.pct} />
            <p className="text-xs text-ink-3 animate-pulse">{currentStep.label}</p>
          </div>
        )}
      </div>

      {/* Recent audits */}
      {recentAudits.length > 0 && !running && (
        <div>
          <h3 className="text-xs font-semibold text-ink-3 uppercase tracking-wide mb-3">
            Recent Audits
          </h3>
          <div className="space-y-2">
            {recentAudits.map(audit => {
              const score = audit.vulnerabilityScore;
              const color =
                score >= 70 ? 'text-emerald-600' :
                score >= 40 ? 'text-amber-600'   :
                              'text-red-600';

              return (
                <button
                  key={audit.id}
                  onClick={() => setResult(audit)}
                  className="w-full flex items-center gap-4 p-3.5 rounded-xl border border-edge bg-surface hover:border-ink-3 hover:bg-canvas transition-all text-left group"
                >
                  <span className={`text-xl font-bold tabular-nums ${color}`}>{score}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-ink truncate">{audit.targetUrl}</p>
                    <p className="text-xs text-ink-3 mt-0.5">
                      {audit.results.tests.length} tests · {audit.results.remediations.length} recommendations
                    </p>
                  </div>
                  <span className="text-xs text-ink-3 shrink-0 group-hover:text-ink transition-colors">
                    View →
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}
