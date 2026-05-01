'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Copy, Check, Globe, ChevronLeft, ArrowRight, Terminal } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

type Framework = 'express' | 'nextjs' | 'fastify';

const FRAMEWORK_LABELS: Record<Framework, string> = {
  express: 'Express',
  nextjs:  'Next.js',
  fastify: 'Fastify',
};

const SNIPPETS: Record<Framework, string> = {
  express: `npm install @scraperkast/express

// server.js / app.js
import { scraperKast } from '@scraperkast/express';

app.use(scraperKast({
  apiKey:  process.env.SCRAPERKAST_API_KEY,
  siteId:  process.env.SCRAPERKAST_SITE_ID,
  pricing: { default: 0.001 },  // $0.001 per request
}));`,

  nextjs: `npm install @scraperkast/next

// middleware.ts  (project root)
import { withScraperKast } from '@scraperkast/next';

export default withScraperKast({
  apiKey:  process.env.SCRAPERKAST_API_KEY,
  siteId:  process.env.SCRAPERKAST_SITE_ID,
  pricing: { default: 0.001 },
});

export const config = { matcher: ['/((?!_next|favicon.ico).*)'] };`,

  fastify: `npm install @scraperkast/fastify

// server.js
import { scraperKastPlugin } from '@scraperkast/fastify';

await fastify.register(scraperKastPlugin, {
  apiKey:  process.env.SCRAPERKAST_API_KEY,
  siteId:  process.env.SCRAPERKAST_SITE_ID,
  pricing: { default: 0.001 },
});`,
};

// ── Copy button ───────────────────────────────────────────────────────────────

function CopyBtn({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        void navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="flex items-center gap-1.5 text-2xs font-semibold text-ink-3 hover:text-ink px-2.5 py-1.5 rounded-lg hover:bg-edge-2 transition-colors shrink-0"
    >
      {copied
        ? <><Check className="w-3.5 h-3.5 text-emerald-500" />Copied!</>
        : <><Copy className="w-3.5 h-3.5" />{label}</>}
    </button>
  );
}

// ── Step badge ────────────────────────────────────────────────────────────────

function StepBadge({ n }: { n: number }) {
  return (
    <span className="w-6 h-6 rounded-full bg-accent text-white text-xs font-bold flex items-center justify-center shrink-0">
      {n}
    </span>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AddSitePage() {
  const router = useRouter();

  const [url,       setUrl]       = useState('');
  const [framework, setFramework] = useState<Framework>('express');
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res  = await fetch('/api/sites', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ url: url.trim(), method: 'code' }),
      });
      const data = await res.json() as { siteId?: string; error?: string };
      if (!res.ok) { setError(data.error ?? 'Failed to add site'); return; }
      router.push(`/dashboard/sites/${data.siteId}/overview`);
    } catch {
      setError('Network error — please try again.');
    } finally {
      setLoading(false);
    }
  }

  const snippet = SNIPPETS[framework];

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">

      {/* Back */}
      <Link
        href="/dashboard/sites"
        className="inline-flex items-center gap-1.5 text-sm text-ink-3 hover:text-ink transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        Back to Sites
      </Link>

      {/* Header */}
      <div>
        <h1 className="page-title">Add a New Site</h1>
        <p className="text-sm text-ink-3 mt-1">
          Protect your site from unauthorised scrapers and monetise AI crawler traffic in 3 steps.
        </p>
      </div>

      <form onSubmit={e => { void handleSubmit(e); }} className="space-y-5">

        {/* ── Step 1: URL ── */}
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-4">
            <StepBadge n={1} />
            <div>
              <p className="text-sm font-bold text-ink">Enter your site URL</p>
              <p className="text-xs text-ink-3">The domain you want to protect</p>
            </div>
          </div>
          <div className="relative">
            <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-3 pointer-events-none" />
            <input
              type="url"
              placeholder="https://yoursite.com"
              value={url}
              onChange={e => setUrl(e.target.value)}
              required
              className="input pl-10"
              autoFocus
            />
          </div>
          {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
        </div>

        {/* ── Step 2: Install middleware ── */}
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-4">
            <StepBadge n={2} />
            <div>
              <p className="text-sm font-bold text-ink">Install the middleware</p>
              <p className="text-xs text-ink-3">2 lines of code · your API key is shown after you add the site</p>
            </div>
          </div>

          {/* Framework tabs */}
          <div className="flex items-center gap-1 bg-canvas rounded-xl p-1 border border-edge w-fit mb-4">
            {(Object.keys(FRAMEWORK_LABELS) as Framework[]).map(fw => (
              <button
                key={fw}
                type="button"
                onClick={() => setFramework(fw)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150',
                  framework === fw
                    ? 'bg-surface shadow-card text-ink border border-edge'
                    : 'text-ink-3 hover:text-ink',
                )}
              >
                {FRAMEWORK_LABELS[fw]}
              </button>
            ))}
          </div>

          {/* Code block */}
          <div className="bg-canvas border border-edge rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-edge">
              <div className="flex items-center gap-2">
                <Terminal className="w-3.5 h-3.5 text-ink-3" />
                <span className="text-2xs font-mono text-ink-3">{FRAMEWORK_LABELS[framework]}</span>
              </div>
              <CopyBtn text={snippet} label="Copy code" />
            </div>
            <pre className="p-4 text-xs font-mono text-ink-2 leading-relaxed overflow-x-auto scrollbar-thin whitespace-pre">
              {snippet}
            </pre>
          </div>

          {/* Env hint */}
          <div className="mt-3 flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-3">
            <span className="text-base shrink-0 mt-0.5">🔑</span>
            <p className="text-xs text-amber-800">
              Your <code className="font-mono bg-amber-100 px-1 rounded">SCRAPERKAST_API_KEY</code> and{' '}
              <code className="font-mono bg-amber-100 px-1 rounded">SCRAPERKAST_SITE_ID</code> are
              shown on the next page after you add the site.
            </p>
          </div>

          {/* DNS alternative (collapsed) */}
          <details className="mt-4 group">
            <summary className="cursor-pointer text-xs font-semibold text-ink-3 hover:text-ink list-none flex items-center gap-1.5 select-none">
              <span className="group-open:hidden">▶</span>
              <span className="hidden group-open:inline">▼</span>
              Using DNS verification instead (no code changes)
            </summary>
            <div className="mt-3 space-y-2 pl-4 border-l-2 border-edge">
              <p className="text-xs text-ink-3">
                Add a TXT record to your domain DNS. We auto-verify every 5 minutes.
                Protection starts once verified — no server changes needed.
              </p>
              <div className="flex items-center gap-2 bg-canvas border border-edge rounded-xl px-3 py-2.5">
                <code className="flex-1 text-xs font-mono text-ink-2 break-all">
                  scraperkast-verify=sk_verify_demo123abc
                </code>
                <CopyBtn text="scraperkast-verify=sk_verify_demo123abc" />
              </div>
              <p className="text-2xs text-ink-3">
                DNS propagation typically takes 1–5 minutes.
              </p>
            </div>
          </details>
        </div>

        {/* ── Step 3: Deploy ── */}
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-4">
            <StepBadge n={3} />
            <div>
              <p className="text-sm font-bold text-ink">Add site &amp; get your keys</p>
              <p className="text-xs text-ink-3">Deploy your app — bot protection activates immediately</p>
            </div>
          </div>

          <button
            type="submit"
            disabled={!url.trim() || loading}
            className="w-full flex items-center justify-center gap-2 bg-accent text-white py-3 rounded-xl text-sm font-semibold hover:bg-accent-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
            ) : (
              <>
                Add Site &amp; Continue
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>

      </form>
    </div>
  );
}
