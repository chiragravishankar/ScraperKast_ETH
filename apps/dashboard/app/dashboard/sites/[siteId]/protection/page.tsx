'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  Search, Shield, DollarSign, Zap, Bot, Lock, Unlock,
  Plus, Trash2, ChevronRight, Globe, Code2, Key,
  Copy, Check, Info, ToggleLeft, ToggleRight,
  CheckSquare, Square, ChevronDown, Save,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  BOT_DATABASE,
  DEFAULT_PRICE_USD,
  getBotCounts,
  searchBots,
  type BotEntry,
  type BotType,
} from '@/lib/botDatabase';

// ── Types ─────────────────────────────────────────────────────────────────────

type SubTab  = 'rules' | 'pricing' | 'advanced';
type Action  = 'allow' | 'charge' | 'block';
type Filter  = 'all' | BotType;

interface BotRule {
  action:  Action;
  enabled: boolean;
  price:   number;   // USD, e.g. 0.001
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TYPE_COLORS: Record<BotType, string> = {
  ai:         'bg-violet-50 text-violet-700 border-violet-200',
  scraper:    'bg-amber-50  text-amber-700  border-amber-200',
  search:     'bg-emerald-50 text-emerald-700 border-emerald-200',
  social:     'bg-pink-50   text-pink-700   border-pink-200',
  monitoring: 'bg-slate-100 text-slate-600  border-slate-200',
};

const TYPE_LABELS: Record<BotType, string> = {
  ai:         'AI',
  scraper:    'Scraper',
  search:     'Search',
  social:     'Social',
  monitoring: 'Monitoring',
};

const ACTION_CFG: Record<Action, { label: string; cls: string }> = {
  allow:  { label: 'Allow',  cls: 'bg-blue-50 text-blue-700 border-blue-200'     },
  charge: { label: 'Charge', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  block:  { label: 'Block',  cls: 'bg-red-50 text-red-700 border-red-200'        },
};

// ── Small helpers ─────────────────────────────────────────────────────────────

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { void navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="flex items-center gap-1.5 text-2xs font-semibold text-ink-3 hover:text-ink px-2.5 py-1.5 rounded-lg hover:bg-edge-2 transition-colors"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

function ToggleSwitch({ enabled, onChange }: { enabled: boolean; onChange: () => void }) {
  return (
    <button onClick={onChange} className="transition-colors shrink-0">
      {enabled
        ? <ToggleRight className="w-5 h-5 text-accent" />
        : <ToggleLeft  className="w-5 h-5 text-ink-3"  />}
    </button>
  );
}

// First letter avatar coloured by type
const AVATAR_GRADIENTS: Record<BotType, string> = {
  ai:         'from-violet-500 to-purple-600',
  scraper:    'from-amber-400  to-orange-500',
  search:     'from-emerald-400 to-teal-600',
  social:     'from-pink-400   to-rose-500',
  monitoring: 'from-slate-400  to-slate-600',
};

// ═══════════════════════════════════════════════════════════════════════════════
// BOT RULES TAB
// ═══════════════════════════════════════════════════════════════════════════════

function BotRulesTab({ siteId }: { siteId: string }) {
  // Per-bot overrides. Default = charge at DEFAULT_PRICE_USD, enabled
  const [rules,    setRules]    = useState<Record<string, BotRule>>({});
  const [search,   setSearch]   = useState('');
  const [filter,   setFilter]   = useState<Filter>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saved,    setSaved]    = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);

  const counts = useMemo(() => getBotCounts(), []);

  // Derive default rule for any bot
  const getRule = useCallback((botId: string): BotRule =>
    rules[botId] ?? { action: 'charge', enabled: true, price: DEFAULT_PRICE_USD },
    [rules],
  );

  const patchRule = useCallback((botId: string, patch: Partial<BotRule>) => {
    setRules(prev => ({
      ...prev,
      [botId]: { ...getRule(botId), ...patch },
    }));
  }, [getRule]);

  // Filtered bot list
  const filteredBots = useMemo<BotEntry[]>(() => {
    let bots = BOT_DATABASE;
    if (filter !== 'all') bots = bots.filter(b => b.type === filter);
    if (search.trim())    bots = searchBots(search).filter(b => filter === 'all' || b.type === filter);
    return bots;
  }, [filter, search]);

  // Summary stats across ALL bots (not just filtered)
  const stats = useMemo(() => {
    let charge = 0, allow = 0, block = 0;
    for (const bot of BOT_DATABASE) {
      const r = getRule(bot.id);
      if (!r.enabled) continue;
      if (r.action === 'charge') charge++;
      else if (r.action === 'allow') allow++;
      else block++;
    }
    return { charge, allow, block };
  }, [rules, getRule]); // eslint-disable-line react-hooks/exhaustive-deps

  // Selection helpers
  const allOnPageSelected = filteredBots.length > 0 && filteredBots.every(b => selected.has(b.id));
  function togglePageSelect() {
    if (allOnPageSelected) {
      setSelected(prev => { const s = new Set(prev); filteredBots.forEach(b => s.delete(b.id)); return s; });
    } else {
      setSelected(prev => { const s = new Set(prev); filteredBots.forEach(b => s.add(b.id)); return s; });
    }
  }
  function toggleOne(id: string) {
    setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  }

  // Bulk action on selected bots
  function applyBulk(action: Action) {
    setRules(prev => {
      const next = { ...prev };
      selected.forEach(id => { next[id] = { ...getRule(id), action }; });
      return next;
    });
    setSelected(new Set());
    setBulkOpen(false);
  }
  function disableBulk() {
    setRules(prev => {
      const next = { ...prev };
      selected.forEach(id => { next[id] = { ...getRule(id), enabled: false }; });
      return next;
    });
    setSelected(new Set());
    setBulkOpen(false);
  }

  async function handleSave() {
    // In production: POST to /api/sites/[siteId]/bot-rules
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  const FILTER_TABS: { key: Filter; label: string; count: number }[] = [
    { key: 'all',        label: 'All',        count: counts.total     },
    { key: 'ai',         label: 'AI',         count: counts.ai        },
    { key: 'scraper',    label: 'Scrapers',   count: counts.scraper   },
    { key: 'search',     label: 'Search',     count: counts.search    },
    { key: 'social',     label: 'Social',     count: counts.social    },
    { key: 'monitoring', label: 'Monitoring', count: counts.monitoring },
  ];

  return (
    <div className="space-y-5">

      {/* ── Stats strip ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total Bots',  value: counts.total,  color: 'text-ink'         },
          { label: 'Charging',    value: stats.charge,  color: 'text-emerald-700' },
          { label: 'Allowed',     value: stats.allow,   color: 'text-blue-700'    },
          { label: 'Blocked',     value: stats.block,   color: 'text-red-600'     },
        ].map(({ label, value, color }) => (
          <div key={label} className="card p-3 text-center">
            <p className={cn('text-2xl font-bold tabular', color)}>{value}</p>
            <p className="text-2xs text-ink-3 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* ── Controls ────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">

        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-3 pointer-events-none" />
          <input
            type="text"
            placeholder="Search bots, companies…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input pl-9 text-sm w-full"
          />
        </div>

        {/* Bulk actions */}
        {selected.size > 0 && (
          <div className="relative">
            <button
              onClick={() => setBulkOpen(o => !o)}
              className="flex items-center gap-1.5 text-xs font-semibold bg-accent text-white px-3 py-2.5 rounded-xl hover:bg-accent-hover transition-colors"
            >
              {selected.size} selected
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
            {bulkOpen && (
              <div className="absolute right-0 top-full mt-1 z-20 bg-surface border border-edge rounded-xl shadow-card w-44 py-1 text-sm">
                <button onClick={() => applyBulk('allow')}  className="w-full text-left px-4 py-2 hover:bg-canvas text-blue-700 font-semibold">Allow all</button>
                <button onClick={() => applyBulk('charge')} className="w-full text-left px-4 py-2 hover:bg-canvas text-emerald-700 font-semibold">Charge all</button>
                <button onClick={() => applyBulk('block')}  className="w-full text-left px-4 py-2 hover:bg-canvas text-red-600 font-semibold">Block all</button>
                <div className="border-t border-edge my-1" />
                <button onClick={disableBulk} className="w-full text-left px-4 py-2 hover:bg-canvas text-ink-3">Disable all</button>
              </div>
            )}
          </div>
        )}

        {/* Save */}
        <button
          onClick={handleSave}
          className="flex items-center gap-1.5 text-xs font-semibold bg-accent text-white px-4 py-2.5 rounded-xl hover:bg-accent-hover transition-colors"
        >
          {saved ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
          {saved ? 'Saved!' : 'Save Changes'}
        </button>
      </div>

      {/* Type filter tabs */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-thin">
        {FILTER_TABS.map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all duration-150',
              filter === key
                ? 'bg-accent text-white'
                : 'text-ink-3 hover:text-ink hover:bg-edge-2',
            )}
          >
            {label}
            <span className={cn(
              'text-2xs px-1.5 py-0.5 rounded-full font-bold',
              filter === key ? 'bg-white/20 text-white' : 'bg-edge text-ink-3',
            )}>{count}</span>
          </button>
        ))}
      </div>

      {/* ── Table ───────────────────────────────────────────────────────────── */}
      <div className="card overflow-hidden">

        {/* Result count + deselect hint */}
        <div className="flex items-center justify-between px-5 py-2.5 border-b border-edge bg-canvas">
          <span className="text-2xs text-ink-3">
            Showing <span className="font-semibold text-ink">{filteredBots.length}</span> of {counts.total} bots
            {search && ` matching "${search}"`}
          </span>
          {selected.size > 0 && (
            <button onClick={() => setSelected(new Set())} className="text-2xs text-accent hover:underline">
              Clear selection
            </button>
          )}
        </div>

        <div className="overflow-x-auto" style={{ maxHeight: '560px', overflowY: 'auto' }}>
          <table className="w-full text-sm" style={{ minWidth: '640px' }}>
            <thead className="sticky top-0 z-10">
              <tr className="bg-canvas border-b border-edge">
                <th className="px-4 py-2.5 text-left w-8">
                  <button onClick={togglePageSelect} className="text-ink-3 hover:text-ink transition-colors">
                    {allOnPageSelected
                      ? <CheckSquare className="w-4 h-4 text-accent" />
                      : <Square className="w-4 h-4" />}
                  </button>
                </th>
                {['Bot', 'Type', 'Action', 'Price (USD)', 'Enabled'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-2xs font-semibold text-ink-3 uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-edge">
              {filteredBots.map(bot => {
                const rule  = getRule(bot.id);
                const isSel = selected.has(bot.id);
                return (
                  <tr
                    key={bot.id}
                    className={cn(
                      'hover:bg-canvas/70 transition-colors',
                      isSel && 'bg-accent-muted/20',
                      !rule.enabled && 'opacity-40',
                    )}
                  >
                    {/* Checkbox */}
                    <td className="px-4 py-2.5">
                      <button onClick={() => toggleOne(bot.id)} className="text-ink-3 hover:text-accent transition-colors">
                        {isSel
                          ? <CheckSquare className="w-4 h-4 text-accent" />
                          : <Square className="w-4 h-4" />}
                      </button>
                    </td>

                    {/* Bot identity */}
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          'w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-white text-xs font-bold bg-gradient-to-br',
                          AVATAR_GRADIENTS[bot.type],
                        )}>
                          {bot.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-ink truncate">{bot.name}</p>
                          <p className="text-2xs text-ink-3 truncate">{bot.company}</p>
                        </div>
                      </div>
                    </td>

                    {/* Type badge */}
                    <td className="px-4 py-2.5">
                      <span className={cn('text-2xs font-semibold px-2 py-0.5 rounded-full border', TYPE_COLORS[bot.type])}>
                        {TYPE_LABELS[bot.type]}
                      </span>
                    </td>

                    {/* Action selector */}
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-0.5">
                        {(['allow', 'charge', 'block'] as Action[]).map(a => (
                          <button
                            key={a}
                            onClick={() => patchRule(bot.id, { action: a })}
                            className={cn(
                              'text-2xs font-semibold px-2 py-1 rounded-md border transition-colors capitalize',
                              rule.action === a
                                ? ACTION_CFG[a].cls
                                : 'text-ink-3 border-edge hover:bg-canvas',
                            )}
                          >
                            {a}
                          </button>
                        ))}
                      </div>
                    </td>

                    {/* Price input */}
                    <td className="px-4 py-2.5">
                      {rule.action === 'charge' ? (
                        <div className="relative w-24">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3 text-xs font-semibold">$</span>
                          <input
                            type="number"
                            min="0"
                            step="0.001"
                            value={rule.price}
                            onChange={e => patchRule(bot.id, { price: parseFloat(e.target.value) || 0 })}
                            className="input pl-5 text-xs py-1 w-full font-mono"
                          />
                        </div>
                      ) : (
                        <span className="text-ink-3 text-xs">—</span>
                      )}
                    </td>

                    {/* Enable toggle */}
                    <td className="px-4 py-2.5">
                      <ToggleSwitch enabled={rule.enabled} onChange={() => patchRule(bot.id, { enabled: !rule.enabled })} />
                    </td>
                  </tr>
                );
              })}

              {filteredBots.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-ink-3">
                    No bots match <span className="font-semibold text-ink">"{search}"</span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Catch-all rule ──────────────────────────────────────────────────── */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-2">
          <Globe className="w-4 h-4 text-ink-3" />
          <h3 className="text-sm font-bold text-ink">Catch-all Rule</h3>
        </div>
        <p className="text-xs text-ink-3 mb-4">
          Applied to any bot <span className="font-semibold">not</span> in the list above.
        </p>
        <div className="flex items-center gap-2">
          {(['allow', 'charge', 'block'] as Action[]).map(a => (
            <button
              key={a}
              className={cn(
                'text-xs font-semibold px-4 py-2 rounded-xl border transition-colors capitalize',
                a === 'charge' ? ACTION_CFG.charge.cls : 'text-ink-3 border-edge hover:bg-canvas',
              )}
            >
              {a === 'charge' ? `Charge $${DEFAULT_PRICE_USD}` : a.charAt(0).toUpperCase() + a.slice(1)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PRICING TAB (unchanged from previous implementation)
// ═══════════════════════════════════════════════════════════════════════════════

const PRICING_STRATEGIES = [
  { id: 'flat',     title: 'Flat Rate',           desc: 'Charge every bot the same amount per request.',                              icon: DollarSign, badge: 'Most popular',  badgeCls: 'bg-accent-muted text-accent' },
  { id: 'tiered',   title: 'Tiered by Bot Type',  desc: 'AI bots pay more than SEO crawlers — reflect your value.',                  icon: Zap,        badge: 'Recommended',   badgeCls: 'bg-violet-50 text-violet-700 border border-violet-200' },
  { id: 'per-page', title: 'Per-Page Pricing',    desc: 'Premium pages (long-form, paywalled) cost more to crawl.',                  icon: Code2,      badge: 'Advanced',      badgeCls: 'bg-edge-2 text-ink-2' },
] as const;

function PricingTab() {
  const [strategy, setStrategy] = useState<'flat' | 'tiered' | 'per-page'>('tiered');
  const [flatPrice, setFlatPrice] = useState('0.001');

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-bold text-ink mb-3">Pricing Strategy</h3>
        <div className="grid grid-cols-1 gap-3">
          {PRICING_STRATEGIES.map(s => (
            <div
              key={s.id}
              onClick={() => setStrategy(s.id)}
              className={cn(
                'relative rounded-2xl border-2 p-4 cursor-pointer transition-all duration-200 flex items-start gap-4',
                strategy === s.id ? 'border-accent bg-accent-muted/20' : 'border-edge bg-surface hover:border-ink-3',
              )}
            >
              {strategy === s.id && (
                <span className="absolute top-4 right-4 w-5 h-5 rounded-full bg-accent flex items-center justify-center">
                  <Check className="w-3 h-3 text-white" />
                </span>
              )}
              <div className="w-8 h-8 rounded-xl bg-canvas flex items-center justify-center shrink-0">
                <s.icon className="w-4 h-4 text-accent" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <h4 className="text-sm font-bold text-ink">{s.title}</h4>
                  <span className={cn('text-2xs font-semibold px-2 py-0.5 rounded-full', s.badgeCls)}>{s.badge}</span>
                </div>
                <p className="text-xs text-ink-3">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {strategy === 'flat' && (
        <div className="card p-5 space-y-4">
          <h3 className="text-sm font-bold text-ink">Flat Rate Config</h3>
          <div>
            <label className="block text-xs font-semibold text-ink-2 mb-1.5">Price per request (USD)</label>
            <div className="relative max-w-xs">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3 text-sm font-semibold">$</span>
              <input type="number" min="0" step="0.001" value={flatPrice} onChange={e => setFlatPrice(e.target.value)} className="input pl-7 max-w-xs" />
            </div>
            <p className="text-2xs text-ink-3 mt-1.5">All bots pay this price regardless of type.</p>
          </div>
        </div>
      )}

      {strategy === 'tiered' && (
        <div className="card p-5 space-y-4">
          <h3 className="text-sm font-bold text-ink">Tiered Pricing</h3>
          <div className="space-y-3">
            {[
              { tier: 'AI Bots',          placeholder: '0.005', desc: 'GPTBot, ClaudeBot, ChatGPT…', color: 'text-violet-700' },
              { tier: 'Commercial Bots',  placeholder: '0.002', desc: 'Firecrawl, Diffbot, SemRush…', color: 'text-amber-700' },
              { tier: 'Search Engines',   placeholder: '0.000', desc: 'Googlebot, Bingbot, DuckDuckGo…', color: 'text-emerald-700' },
              { tier: 'Social Media',     placeholder: '0.001', desc: 'Twitterbot, Slackbot, WhatsApp…', color: 'text-pink-700' },
              { tier: 'Monitoring',       placeholder: '0.000', desc: 'Pingdom, UptimeRobot…', color: 'text-slate-600' },
              { tier: 'Unknown / Other',  placeholder: '0.001', desc: 'Anything not classified', color: 'text-ink-3' },
            ].map(t => (
              <div key={t.tier} className="flex items-center gap-4">
                <div className="flex-1">
                  <p className={cn('text-xs font-semibold', t.color)}>{t.tier}</p>
                  <p className="text-2xs text-ink-3">{t.desc}</p>
                </div>
                <div className="relative w-28">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3 text-sm font-semibold">$</span>
                  <input type="number" min="0" step="0.001" placeholder={t.placeholder} defaultValue={t.placeholder} className="input pl-6 text-sm" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {strategy === 'per-page' && (
        <div className="card p-5 space-y-4">
          <h3 className="text-sm font-bold text-ink">Per-Page Rules</h3>
          <div className="space-y-2">
            {[
              { pattern: '/blog/**',     price: '0.005', label: 'Blog posts' },
              { pattern: '/articles/**', price: '0.005', label: 'Articles'   },
              { pattern: '/sitemap.xml', price: '0.000', label: 'Sitemap (free)' },
              { pattern: '/**',          price: '0.001', label: 'Everything else' },
            ].map((row, i) => (
              <div key={i} className="flex items-center gap-3 p-3 bg-canvas rounded-xl border border-edge">
                <code className="flex-1 text-xs font-mono text-ink-2">{row.pattern}</code>
                <span className="text-2xs text-ink-3">{row.label}</span>
                <div className="relative w-24">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3 text-xs font-semibold">$</span>
                  <input type="number" min="0" step="0.001" defaultValue={row.price} className="input pl-5 text-xs py-1.5" />
                </div>
              </div>
            ))}
          </div>
          <button className="flex items-center gap-1.5 text-xs font-semibold text-accent hover:underline">
            <Plus className="w-3.5 h-3.5" /> Add path rule
          </button>
        </div>
      )}

      <div className="flex justify-end">
        <button className="flex items-center gap-2 bg-accent text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-accent-hover transition-colors">
          Save Pricing <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ADVANCED TAB (unchanged)
// ═══════════════════════════════════════════════════════════════════════════════

const MIDDLEWARE_SNIPPET = `import { scraperKast } from '@scraperkast/express';

app.use(scraperKast({
  apiKey: process.env.SCRAPERKAST_API_KEY,
  defaultPrice: 0.001,          // $0.001 per request
  rateLimit: { windowMs: 60_000, max: 60 },
  allowList: ['Googlebot', 'Bingbot'],
  blockList: ['Scrapy', 'wget', 'curl'],
}));`;

const RATE_LIMIT_SNIPPET = `# nginx.conf
limit_req_zone $binary_remote_addr zone=bots:10m rate=10r/s;
limit_req zone=bots burst=20 nodelay;`;

function AdvancedTab() {
  const [honeypot,  setHoneypot]  = useState(true);
  const [rateLimit, setRateLimit] = useState(true);
  const [challenge, setChallenge] = useState(false);

  return (
    <div className="space-y-6">
      <div className="card p-5 space-y-1">
        <h3 className="text-sm font-bold text-ink mb-4">Protection Features</h3>
        {[
          { label: 'Honeypot links',       desc: 'Hidden links that only bots follow — auto-fingerprints them.',                         value: honeypot,  set: setHoneypot  },
          { label: 'Rate limiting',        desc: 'Throttle bots to 60 requests/min before serving a 429.',                              value: rateLimit, set: setRateLimit },
          { label: 'JS challenge (aggr.)', desc: 'Require JS execution before serving content. May block legitimate crawlers.',          value: challenge, set: setChallenge },
        ].map(f => (
          <div key={f.label} className="flex items-start gap-4 py-3 border-b border-edge last:border-0">
            <div className="flex-1">
              <p className="text-sm font-semibold text-ink">{f.label}</p>
              <p className="text-xs text-ink-3 mt-0.5">{f.desc}</p>
            </div>
            <ToggleSwitch enabled={f.value} onChange={() => f.set(v => !v)} />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[
          { title: 'Always Allow', icon: Unlock, color: 'text-blue-500', bots: ['Googlebot', 'Bingbot', 'Applebot'] },
          { title: 'Always Block', icon: Lock,   color: 'text-red-500',  bots: ['Scrapy', 'wget', 'python-requests'] },
        ].map(panel => (
          <div key={panel.title} className="card p-5">
            <h3 className="text-sm font-bold text-ink mb-1 flex items-center gap-2">
              <panel.icon className={cn('w-3.5 h-3.5', panel.color)} />
              {panel.title}
            </h3>
            <p className="text-2xs text-ink-3 mb-3">These bots bypass all rules.</p>
            <div className="space-y-1.5">
              {panel.bots.map(b => (
                <div key={b} className="flex items-center justify-between px-3 py-2 bg-canvas rounded-lg border border-edge">
                  <span className="text-xs font-semibold text-ink">{b}</span>
                  <button className="text-ink-3 hover:text-red-500 transition-colors"><Trash2 className="w-3 h-3" /></button>
                </div>
              ))}
            </div>
            <button className="mt-2.5 flex items-center gap-1 text-xs font-semibold text-accent hover:underline">
              <Plus className="w-3.5 h-3.5" /> Add
            </button>
          </div>
        ))}
      </div>

      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Key className="w-4 h-4 text-ink-3" />
          <h3 className="text-sm font-bold text-ink">Integration Snippets</h3>
        </div>
        {[
          { lang: 'Node.js / Express', code: MIDDLEWARE_SNIPPET },
          { lang: 'nginx.conf',        code: RATE_LIMIT_SNIPPET },
        ].map(s => (
          <div key={s.lang}>
            <label className="block text-xs font-semibold text-ink-2 uppercase tracking-wide mb-2">{s.lang}</label>
            <div className="bg-canvas border border-edge rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 border-b border-edge">
                <span className="text-2xs font-mono text-ink-3">{s.lang}</span>
                <CopyBtn text={s.code} />
              </div>
              <pre className="p-4 text-xs font-mono text-ink-2 leading-relaxed overflow-x-auto scrollbar-thin">{s.code}</pre>
            </div>
          </div>
        ))}
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3">
          <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700">
            The middleware handles bot detection and USDC payment collection automatically.
          </p>
        </div>
      </div>

      <div className="flex justify-end">
        <button className="flex items-center gap-2 bg-accent text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-accent-hover transition-colors">
          Save Advanced Settings <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export default function ProtectionPage({ params }: { params: { siteId: string } }) {
  const [subTab, setSubTab] = useState<SubTab>('rules');

  const SUB_TABS: { key: SubTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { key: 'rules',    label: 'Bot Rules', icon: Bot        },
    { key: 'pricing',  label: 'Pricing',   icon: DollarSign },
    { key: 'advanced', label: 'Advanced',  icon: Shield     },
  ];

  return (
    <div className="space-y-6">

      <div>
        <h2 className="text-base font-bold text-ink">Protection</h2>
        <p className="text-xs text-ink-3 mt-0.5">Configure {BOT_DATABASE.length}+ bot rules, pricing, and advanced defences</p>
      </div>

      {/* Sub-tab pill bar */}
      <div className="flex items-center gap-1 bg-canvas rounded-xl p-1 border border-edge w-fit">
        {SUB_TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setSubTab(key)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-150',
              subTab === key
                ? 'bg-surface shadow-card text-ink border border-edge'
                : 'text-ink-3 hover:text-ink',
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {subTab === 'rules'    && <BotRulesTab  siteId={params.siteId} />}
      {subTab === 'pricing'  && <PricingTab   />}
      {subTab === 'advanced' && <AdvancedTab  />}
    </div>
  );
}
