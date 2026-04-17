'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

// ── Extended bot catalog ──────────────────────────────────────────────────────

export type BotType = 'ai_training' | 'ai_inference' | 'search' | 'crawler';
export type Confidence = 'high' | 'medium' | 'low';
export type BotStatus = 'allowed' | 'blocked' | 'pending';
export type AccessLevel = 'default' | 'free' | 'custom';

export interface BotDef {
  id:            string;
  name:          string;
  company:       string;
  type:          BotType;
  confidence:    Confidence;
  userAgent:     string;
  docUrl:        string;
  /** Baseline stats (seeded; real data would come from DB) */
  req7d:         number;
  rev7d:         number; // µUSDC
  totalReqs:     number;
  daysAgoSeen:   number;
  daysAgoFirst:  number;
  successRate:   number; // 0-1
}

export const ALL_BOTS: BotDef[] = [
  // ── Verified AI companies ──────────────────────────────────────────────
  { id:'gptbot',        name:'GPTBot',             company:'OpenAI',      type:'ai_training',  confidence:'high',   req7d:1247,  rev7d:1_234_567, totalReqs:34_521,  daysAgoSeen:0,  daysAgoFirst:90,  successRate:0.97, userAgent:'Mozilla/5.0 AppleWebKit/537.36 GPTBot/1.0',                                    docUrl:'https://platform.openai.com/docs/gptbot' },
  { id:'claudeweb',     name:'ClaudeBot',           company:'Anthropic',   type:'ai_inference', confidence:'high',   req7d:892,   rev7d:890_234,   totalReqs:21_456,  daysAgoSeen:0,  daysAgoFirst:75,  successRate:0.98, userAgent:'Mozilla/5.0 anthropic-ai/claude-web (+https://anthropic.com)',                  docUrl:'https://anthropic.com' },
  { id:'perplexitybot', name:'PerplexityBot',       company:'Perplexity',  type:'ai_inference', confidence:'high',   req7d:543,   rev7d:456_789,   totalReqs:12_345,  daysAgoSeen:1,  daysAgoFirst:60,  successRate:0.95, userAgent:'Mozilla/5.0 (compatible; PerplexityBot/1.0)',                                    docUrl:'https://perplexity.ai' },
  { id:'googleextended',name:'Google-Extended',     company:'Google',      type:'ai_training',  confidence:'high',   req7d:2103,  rev7d:2_345_678, totalReqs:67_890,  daysAgoSeen:0,  daysAgoFirst:120, successRate:0.99, userAgent:'Mozilla/5.0 (compatible; Googlebot/2.1; Google-Extended)',                      docUrl:'https://developers.google.com/search/docs/crawling-indexing/overview-google-crawlers' },
  { id:'amazonbot',     name:'AmazonBot',            company:'Amazon',      type:'ai_training',  confidence:'high',   req7d:445,   rev7d:234_567,   totalReqs:8_901,   daysAgoSeen:2,  daysAgoFirst:45,  successRate:0.94, userAgent:'Mozilla/5.0 (compatible; AmazonBot/0.1)',                                        docUrl:'https://developer.amazon.com/bots' },
  // ── Search engines (SEO whitelist) ─────────────────────────────────────
  { id:'googlebot',     name:'Googlebot',            company:'Google',      type:'search',       confidence:'high',   req7d:3456,  rev7d:0,         totalReqs:123_456, daysAgoSeen:0,  daysAgoFirst:180, successRate:1.00, userAgent:'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',      docUrl:'https://developers.google.com/search/docs/crawling-indexing/googlebot' },
  { id:'bingbot',       name:'Bingbot',              company:'Microsoft',   type:'search',       confidence:'high',   req7d:1234,  rev7d:0,         totalReqs:45_678,  daysAgoSeen:0,  daysAgoFirst:150, successRate:1.00, userAgent:'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',      docUrl:'https://www.bing.com/webmasters/help/which-crawlers-does-bing-use-8c184ec0' },
  { id:'duckduckbot',   name:'DuckDuckBot',          company:'DuckDuckGo',  type:'search',       confidence:'high',   req7d:234,   rev7d:0,         totalReqs:6_789,   daysAgoSeen:1,  daysAgoFirst:90,  successRate:1.00, userAgent:'DuckDuckBot/1.0; (+http://duckduckgo.com/duckduckbot.html)',                     docUrl:'https://help.duckduckgo.com/duckduckgo-help-pages/results/duckduckbot/' },
  { id:'applebot',      name:'Applebot',             company:'Apple',       type:'search',       confidence:'high',   req7d:156,   rev7d:0,         totalReqs:3_456,   daysAgoSeen:2,  daysAgoFirst:60,  successRate:1.00, userAgent:'Mozilla/5.0 (compatible; Applebot/0.3; +http://www.apple.com/go/applebot)',    docUrl:'https://support.apple.com/en-us/111900' },
  // ── Data crawlers ──────────────────────────────────────────────────────
  { id:'ccbot',         name:'CCBot',                company:'Common Crawl',type:'crawler',      confidence:'medium', req7d:789,   rev7d:567_890,   totalReqs:23_456,  daysAgoSeen:1,  daysAgoFirst:100, successRate:0.92, userAgent:'CCBot/2.0 (https://commoncrawl.org/faq/)',                                       docUrl:'https://commoncrawl.org' },
  { id:'semrushbot',    name:'SemrushBot',           company:'Semrush',     type:'crawler',      confidence:'high',   req7d:456,   rev7d:345_678,   totalReqs:12_345,  daysAgoSeen:1,  daysAgoFirst:70,  successRate:0.96, userAgent:'Mozilla/5.0 (compatible; SemrushBot/7~bl; +http://www.semrush.com/bot.html)', docUrl:'https://www.semrush.com/bot.html' },
  { id:'ahrefsbot',     name:'AhrefsBot',            company:'Ahrefs',      type:'crawler',      confidence:'high',   req7d:567,   rev7d:456_789,   totalReqs:18_901,  daysAgoSeen:0,  daysAgoFirst:85,  successRate:0.97, userAgent:'Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)',          docUrl:'https://ahrefs.com/robot' },
  // ── Social crawlers (link previews — always free) ──────────────────────
  { id:'facebookbot',   name:'facebookexternalhit',  company:'Meta',        type:'crawler',      confidence:'high',   req7d:89,    rev7d:0,         totalReqs:2_345,   daysAgoSeen:3,  daysAgoFirst:120, successRate:1.00, userAgent:'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',   docUrl:'https://developers.facebook.com' },
  { id:'twitterbot',    name:'Twitterbot',           company:'X Corp',      type:'crawler',      confidence:'high',   req7d:45,    rev7d:0,         totalReqs:1_234,   daysAgoSeen:5,  daysAgoFirst:90,  successRate:1.00, userAgent:'Twitterbot/1.0',                                                                 docUrl:'https://developer.x.com' },
  // ── Suspicious / blocked ───────────────────────────────────────────────
  { id:'scraperapi',    name:'ScraperAPI',           company:'Unknown',     type:'crawler',      confidence:'low',    req7d:2341,  rev7d:0,         totalReqs:45_678,  daysAgoSeen:0,  daysAgoFirst:30,  successRate:0.61, userAgent:'ScraperAPI/1.0 (proxy scraping service)',                                        docUrl:'' },
  { id:'bytespider',    name:'Bytespider',           company:'ByteDance',   type:'ai_training',  confidence:'medium', req7d:1567,  rev7d:0,         totalReqs:34_567,  daysAgoSeen:0,  daysAgoFirst:45,  successRate:0.72, userAgent:'Mozilla/5.0 (Linux; Android 5.0) AppleWebKit/537.36 Mobile (compatible; Bytespider)', docUrl:'https://bytedance.com' },
  // ── Pending / unknown ──────────────────────────────────────────────────
  { id:'petalbot',      name:'PetalBot',             company:'Huawei',      type:'search',       confidence:'medium', req7d:123,   rev7d:45_678,    totalReqs:2_345,   daysAgoSeen:2,  daysAgoFirst:15,  successRate:0.91, userAgent:'Mozilla/5.0 (compatible; PetalBot; +https://aspiegel.com/petalbot)',            docUrl:'https://aspiegel.com/petalbot' },
  { id:'unknownbot',    name:'UnknownBot/3.0',       company:'Unknown',     type:'crawler',      confidence:'low',    req7d:456,   rev7d:0,         totalReqs:4_567,   daysAgoSeen:1,  daysAgoFirst:8,   successRate:0.55, userAgent:'UnknownBot/3.0 (automated crawler)',                                              docUrl:'' },
];

// ── Config types ──────────────────────────────────────────────────────────────

export interface BotConfig {
  status:       BotStatus;
  accessLevel:  AccessLevel;
  customPricing: {
    pricePerPage:   number; // µUSDC
    freeTierLimit:  number; // requests per day (0 = none)
    feePercent:     number; // 0-100
  };
  rateLimit: {
    enabled:  boolean;
    perHour:  number;
    perDay:   number;
    action:   'block' | 'throttle' | 'log';
  };
  whitelisted: boolean;
  blacklisted: boolean;
  notes:       string;
  groupId:     string | null;
  updatedAt:   number; // unix ms
}

export interface BotGroup {
  id:      string;
  name:    string;
  botIds:  string[];
  color:   string; // tailwind color key: 'violet' | 'sky' | 'amber' | 'emerald' | 'red'
  policy: {
    status:      BotStatus;
    accessLevel: AccessLevel;
  };
}

export interface GlobalPolicy {
  defaultAction: 'allow' | 'block' | 'pending';
}

// ── Defaults ──────────────────────────────────────────────────────────────────

function defaultConfig(bot: BotDef): BotConfig {
  const whitelisted = ['googlebot','bingbot','duckduckbot','applebot','facebookbot','twitterbot'].includes(bot.id);
  const blacklisted = ['scraperapi','bytespider'].includes(bot.id);
  const status: BotStatus = blacklisted ? 'blocked' : (bot.id === 'petalbot' || bot.id === 'unknownbot') ? 'pending' : 'allowed';
  const accessLevel: AccessLevel = whitelisted ? 'free' : 'default';
  return {
    status,
    accessLevel,
    customPricing: { pricePerPage: 1000, freeTierLimit: 10, feePercent: 5 },
    rateLimit:     { enabled: blacklisted, perHour: 100, perDay: 1000, action: 'block' },
    whitelisted,
    blacklisted,
    notes:     '',
    groupId:   null,
    updatedAt: Date.now(),
  };
}

export const DEFAULT_GROUPS: BotGroup[] = [
  { id:'verified-ai',    name:'Verified AI Companies', color:'violet',  botIds:['gptbot','claudeweb','perplexitybot','googleextended','amazonbot'], policy:{ status:'allowed', accessLevel:'default' } },
  { id:'search-engines', name:'Search Engines',         color:'sky',     botIds:['googlebot','bingbot','duckduckbot','applebot'],                   policy:{ status:'allowed', accessLevel:'free'    } },
  { id:'data-crawlers',  name:'Data Crawlers',           color:'amber',   botIds:['ccbot','semrushbot','ahrefsbot'],                                 policy:{ status:'allowed', accessLevel:'default' } },
  { id:'social-media',   name:'Social Media',            color:'emerald', botIds:['facebookbot','twitterbot'],                                       policy:{ status:'allowed', accessLevel:'free'    } },
  { id:'suspicious',     name:'Suspicious / Unknown',    color:'red',     botIds:['scraperapi','bytespider','unknownbot'],                            policy:{ status:'blocked', accessLevel:'default' } },
];

// ── Context ───────────────────────────────────────────────────────────────────

const LS_CONFIGS_KEY = 'sk_bot_configs_v1';
const LS_POLICY_KEY  = 'sk_bot_policy_v1';
const LS_GROUPS_KEY  = 'sk_bot_groups_v1';

interface BotStoreValue {
  configs:         Record<string, BotConfig>;
  globalPolicy:    GlobalPolicy;
  groups:          BotGroup[];
  getConfig:       (id: string) => BotConfig;
  updateConfig:    (id: string, patch: Partial<BotConfig>) => void;
  setStatus:       (id: string, status: BotStatus) => void;
  setBulkStatus:   (ids: string[], status: BotStatus) => void;
  setGlobalPolicy: (p: GlobalPolicy) => void;
  updateGroup:     (id: string, patch: Partial<BotGroup>) => void;
  resetConfig:     (id: string) => void;
  exportConfigs:   () => string;
}

const BotStoreCtx = createContext<BotStoreValue | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

export function BotStoreProvider({ children }: { children: ReactNode }) {
  const [configs, setConfigs] = useState<Record<string, BotConfig>>(() => {
    const defaults: Record<string, BotConfig> = {};
    for (const bot of ALL_BOTS) defaults[bot.id] = defaultConfig(bot);
    return defaults;
  });
  const [globalPolicy, setGlobalPolicyState] = useState<GlobalPolicy>({ defaultAction: 'allow' });
  const [groups, setGroups] = useState<BotGroup[]>(DEFAULT_GROUPS);

  // Hydrate from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_CONFIGS_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Record<string, BotConfig>;
        setConfigs(prev => ({ ...prev, ...saved }));
      }
    } catch { /* ignore */ }
    try {
      const rawP = localStorage.getItem(LS_POLICY_KEY);
      if (rawP) setGlobalPolicyState(JSON.parse(rawP) as GlobalPolicy);
    } catch { /* ignore */ }
    try {
      const rawG = localStorage.getItem(LS_GROUPS_KEY);
      if (rawG) setGroups(JSON.parse(rawG) as BotGroup[]);
    } catch { /* ignore */ }
  }, []);

  function persist(next: Record<string, BotConfig>) {
    try { localStorage.setItem(LS_CONFIGS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  }
  function persistGroups(next: BotGroup[]) {
    try { localStorage.setItem(LS_GROUPS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  }

  const getConfig = useCallback((id: string): BotConfig => {
    const bot = ALL_BOTS.find(b => b.id === id);
    return configs[id] ?? (bot ? defaultConfig(bot) : configs['unknownbot']!);
  }, [configs]);

  const updateConfig = useCallback((id: string, patch: Partial<BotConfig>) => {
    setConfigs(prev => {
      const next = { ...prev, [id]: { ...prev[id]!, ...patch, updatedAt: Date.now() } };
      persist(next);
      return next;
    });
  }, []);

  const setStatus = useCallback((id: string, status: BotStatus) => {
    updateConfig(id, { status });
  }, [updateConfig]);

  const setBulkStatus = useCallback((ids: string[], status: BotStatus) => {
    setConfigs(prev => {
      const next = { ...prev };
      for (const id of ids) next[id] = { ...next[id]!, status, updatedAt: Date.now() };
      persist(next);
      return next;
    });
  }, []);

  const setGlobalPolicy = useCallback((p: GlobalPolicy) => {
    setGlobalPolicyState(p);
    try { localStorage.setItem(LS_POLICY_KEY, JSON.stringify(p)); } catch { /* ignore */ }
  }, []);

  const updateGroup = useCallback((id: string, patch: Partial<BotGroup>) => {
    setGroups(prev => {
      const next = prev.map(g => g.id === id ? { ...g, ...patch } : g);
      persistGroups(next);
      return next;
    });
  }, []);

  const resetConfig = useCallback((id: string) => {
    const bot = ALL_BOTS.find(b => b.id === id);
    if (!bot) return;
    setConfigs(prev => {
      const next = { ...prev, [id]: defaultConfig(bot) };
      persist(next);
      return next;
    });
  }, []);

  const exportConfigs = useCallback(() => JSON.stringify({ configs, globalPolicy, groups }, null, 2), [configs, globalPolicy, groups]);

  return (
    <BotStoreCtx.Provider value={{ configs, globalPolicy, groups, getConfig, updateConfig, setStatus, setBulkStatus, setGlobalPolicy, updateGroup, resetConfig, exportConfigs }}>
      {children}
    </BotStoreCtx.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useBotStore(): BotStoreValue {
  const ctx = useContext(BotStoreCtx);
  if (!ctx) throw new Error('useBotStore must be used within <BotStoreProvider>');
  return ctx;
}
