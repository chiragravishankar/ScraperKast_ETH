'use client';

import { useState } from 'react';
import { Play, CheckCircle, XCircle, ChevronDown } from 'lucide-react';
import { usePricingStore, matchesPath, matchesBot } from '@/lib/pricingStore';
import type { PricingRule } from '@/lib/pricingStore';
import { formatUsdcDollar } from '@/lib/formatters';

// ── Constants ─────────────────────────────────────────────────────────────────

const GROUP_MAP: Record<string, string[]> = {
  'verified-ai':    ['gptbot','claudeweb','perplexitybot','googleextended','amazonbot'],
  'search-engines': ['googlebot','bingbot','duckduckbot','applebot'],
  'data-crawlers':  ['ccbot','semrushbot','ahrefsbot'],
  'social-media':   ['facebookbot','twitterbot'],
  'suspicious':     ['scraperapi','bytespider','unknownbot'],
};

const KNOWN_BOTS = [
  { id:'gptbot',         label:'GPTBot (OpenAI)'          },
  { id:'claudeweb',      label:'ClaudeBot (Anthropic)'    },
  { id:'perplexitybot',  label:'PerplexityBot'            },
  { id:'googleextended', label:'Google-Extended'          },
  { id:'amazonbot',      label:'AmazonBot'                },
  { id:'googlebot',      label:'Googlebot'                },
  { id:'bingbot',        label:'Bingbot (Microsoft)'      },
  { id:'duckduckbot',    label:'DuckDuckBot'              },
  { id:'ccbot',          label:'CCBot (Common Crawl)'     },
  { id:'semrushbot',     label:'SemrushBot'               },
  { id:'ahrefsbot',      label:'AhrefsBot'                },
  { id:'scraperapi',     label:'ScraperAPI (suspicious)'  },
];

const EXAMPLE_PATHS = [
  '/blog/ai-monetization',
  '/blog/seo-guide',
  '/docs/api-reference',
  '/docs/getting-started',
  '/research/language-models',
  '/pricing',
  '/about',
];

const LICENSE_LABELS: Record<string, string> = {
  summarization: 'Summarization',
  training:      'Training',
  full_access:   'Full Access',
  custom:        'Custom',
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface SimResult {
  matched:    PricingRule | null;
  considered: { rule: PricingRule; matchedPath: boolean; matchedBot: boolean }[];
}

// ── Component ─────────────────────────────────────────────────────────────────

interface PricingSimulatorProps {
  prefillRule?: PricingRule | null;
}

export default function PricingSimulator({ prefillRule }: PricingSimulatorProps) {
  const { rules, defaultPricing } = usePricingStore();
  const [path,    setPath]    = useState(prefillRule ? (prefillRule.pathMatch.pattern || '/blog/example-post') : '');
  const [botId,   setBotId]   = useState('gptbot');
  const [result,  setResult]  = useState<SimResult | null>(null);
  const [loading, setLoading] = useState(false);

  function simulate() {
    setLoading(true);
    // Small delay for perceived progress
    setTimeout(() => {
      const sorted = [...rules]
        .filter(r => r.enabled)
        .sort((a, b) => a.priority - b.priority);

      const considered: SimResult['considered'] = [];
      let matched: PricingRule | null = null;

      for (const rule of sorted) {
        const mp = matchesPath(rule, path);
        const mb = matchesBot(rule, botId, GROUP_MAP);
        considered.push({ rule, matchedPath: mp, matchedBot: mb });
        if (mp && mb && !matched) matched = rule;
      }
      setResult({ matched, considered });
      setLoading(false);
    }, 300);
  }

  const effectivePrice = result?.matched?.pricePerPage ?? defaultPricing.pricePerPage;
  const effectiveLicense = result?.matched?.licenseType ?? defaultPricing.licenseType;

  return (
    <div className="space-y-4">

      {/* Inputs */}
      <div className="space-y-3">
        {/* Path */}
        <div>
          <label className="text-xs font-semibold text-ink-2 uppercase tracking-wide">Request Path</label>
          <div className="mt-1.5 relative">
            <input
              type="text"
              placeholder="/blog/my-post"
              value={path}
              onChange={e => setPath(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-edge text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-dark/30 focus:border-brand-dark"
            />
          </div>
          {/* Example pills */}
          <div className="flex gap-1 flex-wrap mt-1.5">
            {EXAMPLE_PATHS.slice(0, 4).map(p => (
              <button key={p} onClick={() => setPath(p)}
                className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-ink-2 hover:bg-brand-dark/10 hover:text-brand-dark transition-colors">
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Bot */}
        <div>
          <label className="text-xs font-semibold text-ink-2 uppercase tracking-wide">Bot</label>
          <div className="mt-1.5 relative">
            <select value={botId} onChange={e => setBotId(e.target.value)}
              className="w-full appearance-none px-3 py-2.5 pr-8 rounded-xl border border-edge text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-dark/30 focus:border-brand-dark text-slate-800">
              {KNOWN_BOTS.map(b => (
                <option key={b.id} value={b.id}>{b.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-3 pointer-events-none" />
          </div>
        </div>

        <button
          onClick={simulate}
          disabled={!path || loading}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-brand-dark text-white rounded-xl font-semibold text-sm hover:bg-brand-mid transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
          <Play className="w-4 h-4" />
          {loading ? 'Simulating…' : 'Simulate Request'}
        </button>
      </div>

      {/* Result */}
      {result && (
        <div className="space-y-3 animate-fade-in">

          {/* Verdict */}
          <div className={`rounded-xl border p-4 ${result.matched ? 'bg-brand-dark/5 border-brand-dark/20' : 'bg-canvas border-edge'}`}>
            <p className="text-xs font-semibold text-ink-2 uppercase tracking-wide mb-2">Result</p>
            <div className="space-y-1.5 text-sm">
              <div className="flex gap-2">
                <span className="text-ink-3 w-20 shrink-0">Path</span>
                <span className="font-mono text-ink">{path}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-ink-3 w-20 shrink-0">Bot</span>
                <span className="text-ink">{KNOWN_BOTS.find(b => b.id === botId)?.label ?? botId}</span>
              </div>
              <div className="flex gap-2 items-center pt-1 border-t border-edge mt-2">
                <span className="text-ink-3 w-20 shrink-0">Matched</span>
                {result.matched ? (
                  <span className="font-semibold text-brand-dark flex items-center gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> {result.matched.name}
                  </span>
                ) : (
                  <span className="text-ink-2 flex items-center gap-1.5">
                    <XCircle className="w-3.5 h-3.5 text-ink-3" /> Default rule
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <span className="text-ink-3 w-20 shrink-0">Price</span>
                <span className={`font-bold tabular-nums text-base ${effectivePrice === 0 ? 'text-emerald-600' : 'text-brand-dark'}`}>
                  {effectivePrice === 0 ? 'FREE' : formatUsdcDollar(effectivePrice)}
                  <span className="text-xs font-normal text-ink-3 ml-1">
                    {effectivePrice > 0 && `(${effectivePrice} µUSDC)`}
                  </span>
                </span>
              </div>
              <div className="flex gap-2">
                <span className="text-ink-3 w-20 shrink-0">License</span>
                <span className="text-ink">{LICENSE_LABELS[effectiveLicense] ?? effectiveLicense}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-ink-3 w-20 shrink-0">Tier</span>
                <span className={effectivePrice === 0 ? 'text-emerald-600 font-semibold' : 'text-brand-dark font-semibold'}>
                  {effectivePrice === 0 ? 'Free' : 'Paid'}
                </span>
              </div>
            </div>
          </div>

          {/* Rules considered */}
          <div>
            <p className="text-xs font-semibold text-ink-2 uppercase tracking-wide mb-2">Rules evaluated ({result.considered.length})</p>
            <div className="space-y-1">
              {result.considered.map(({ rule, matchedPath, matchedBot }, i) => {
                const isMatch = matchedPath && matchedBot && result.matched?.id === rule.id;
                return (
                  <div key={rule.id}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${isMatch ? 'bg-brand-dark/5 border border-brand-dark/20' : 'bg-canvas'}`}>
                    <span className="w-5 h-5 rounded-full bg-slate-200 text-ink-2 text-[10px] font-bold flex items-center justify-center shrink-0">
                      {i + 1}
                    </span>
                    <span className={`flex-1 ${isMatch ? 'font-semibold text-brand-dark' : 'text-ink-2'}`}>{rule.name}</span>
                    <span className={`shrink-0 ${matchedPath ? 'text-emerald-500' : 'text-red-400'}`}>path {matchedPath ? '✓' : '✗'}</span>
                    <span className={`shrink-0 ${matchedBot ? 'text-emerald-500' : 'text-red-400'}`}>bot {matchedBot ? '✓' : '✗'}</span>
                    {isMatch && <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                  </div>
                );
              })}
              {result.considered.length === 0 && (
                <p className="text-xs text-ink-3 text-center py-2">No enabled rules</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
