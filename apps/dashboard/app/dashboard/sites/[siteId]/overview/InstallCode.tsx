'use client';

import { useState } from 'react';
import { Copy, Check, Terminal, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  siteId: string;
  apiKey: string;
}

function CopyBtn({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        void navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="flex items-center gap-1.5 text-2xs font-semibold text-ink-3 hover:text-ink px-2.5 py-1.5 rounded-lg hover:bg-edge-2 transition-colors"
    >
      {copied
        ? <><Check className="w-3.5 h-3.5 text-emerald-500" />Copied!</>
        : <><Copy className="w-3.5 h-3.5" />{label}</>}
    </button>
  );
}

type Framework = 'express' | 'nextjs' | 'fastify';

const SNIPPETS: Record<Framework, (siteId: string, apiKey: string) => string> = {
  express: (siteId, apiKey) => `npm install @scraperkast/express

// server.js / app.js
import { scraperKast } from '@scraperkast/express';

app.use(scraperKast({
  apiKey:  '${apiKey}',
  siteId:  '${siteId}',
  pricing: { default: 0.001 },   // $0.001 per request
}));`,

  nextjs: (siteId, apiKey) => `npm install @scraperkast/next

// middleware.ts  (project root)
import { withScraperKast } from '@scraperkast/next';

export default withScraperKast({
  apiKey:  '${apiKey}',
  siteId:  '${siteId}',
  pricing: { default: 0.001 },
});

export const config = { matcher: ['/((?!_next|favicon.ico).*)'] };`,

  fastify: (siteId, apiKey) => `npm install @scraperkast/fastify

// server.js
import { scraperKastPlugin } from '@scraperkast/fastify';

await fastify.register(scraperKastPlugin, {
  apiKey:  '${apiKey}',
  siteId:  '${siteId}',
  pricing: { default: 0.001 },
});`,
};

const FRAMEWORK_LABELS: Record<Framework, string> = {
  express: 'Express / Node',
  nextjs:  'Next.js',
  fastify: 'Fastify',
};

export default function InstallCode({ siteId, apiKey }: Props) {
  const [framework, setFramework] = useState<Framework>('express');
  const [open,      setOpen]      = useState(true);

  const snippet = SNIPPETS[framework](siteId, apiKey);

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-5 py-3.5 border-b border-edge hover:bg-canvas/60 transition-colors text-left"
      >
        <div className="w-7 h-7 rounded-lg bg-accent-muted flex items-center justify-center shrink-0">
          <Terminal className="w-3.5 h-3.5 text-accent" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-ink">⚙️ Installation</p>
          <p className="text-2xs text-ink-3">Add ScraperKast to your site in 2 minutes</p>
        </div>
        {open
          ? <ChevronUp   className="w-4 h-4 text-ink-3 shrink-0" />
          : <ChevronDown className="w-4 h-4 text-ink-3 shrink-0" />}
      </button>

      {open && (
        <div className="p-5 space-y-4">

          {/* Framework picker */}
          <div className="flex items-center gap-1 bg-canvas rounded-xl p-1 border border-edge w-fit">
            {(Object.keys(FRAMEWORK_LABELS) as Framework[]).map(fw => (
              <button
                key={fw}
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
              <span className="text-2xs font-mono text-ink-3">{FRAMEWORK_LABELS[framework]}</span>
              <CopyBtn text={snippet} label="Copy code" />
            </div>
            <pre className="p-4 text-xs font-mono text-ink-2 leading-relaxed overflow-x-auto scrollbar-thin whitespace-pre">
              {snippet}
            </pre>
          </div>

          {/* Env var hint */}
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-3">
            <span className="text-base shrink-0 mt-0.5">🔑</span>
            <div>
              <p className="text-xs font-semibold text-amber-800 mb-1">Add your API key to the environment</p>
              <div className="flex items-center gap-2 bg-white border border-amber-200 rounded-lg px-3 py-2">
                <code className="text-xs font-mono text-amber-900 flex-1">
                  SCRAPERKAST_API_KEY={apiKey}
                </code>
                <CopyBtn text={`SCRAPERKAST_API_KEY=${apiKey}`} />
              </div>
            </div>
          </div>

          {/* Steps */}
          <ol className="space-y-2">
            {[
              'Install the package with npm / yarn / pnpm',
              'Copy the snippet above into your server entry point',
              'Add the API key to your .env file',
              'Deploy — bot protection activates immediately',
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-3 text-xs text-ink-2">
                <span className="w-5 h-5 rounded-full bg-accent-muted text-accent font-bold text-2xs flex items-center justify-center shrink-0 mt-0.5">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>

          <a
            href="/docs"
            className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
          >
            View full documentation →
          </a>
        </div>
      )}
    </div>
  );
}
