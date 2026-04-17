'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

export type PathMatchType = 'all' | 'exact' | 'prefix' | 'regex';
export type BotMatchType  = 'all' | 'specific' | 'group';
export type LicenseType   = 'summarization' | 'training' | 'full_access' | 'custom';

export interface PricingRule {
  id:          string;
  name:        string;
  description: string;
  enabled:     boolean;
  priority:    number;
  pathMatch: {
    type:    PathMatchType;
    pattern: string;
  };
  botMatch: {
    type:     BotMatchType;
    botIds:   string[];
    groupIds: string[];
    uaPattern: string;
  };
  pricePerPage:   number; // µUSDC
  licenseType:    LicenseType;
  customLicense:  string;
  freeTierOverride: {
    enabled: boolean;
    limit:   number;
  };
  validFrom:  string; // ISO date or ''
  validUntil: string; // ISO date or ''
  notes:      string;
  createdAt:  number;
  updatedAt:  number;
  // Mock analytics
  req7d: number;
  rev7d: number; // µUSDC
}

export interface DefaultPricing {
  pricePerPage: number; // µUSDC
  licenseType:  LicenseType;
  freeTierLimit: number;
}

export interface RuleTemplate {
  id:          string;
  name:        string;
  description: string;
  color:       string; // tailwind color key
  partial:     Partial<Omit<PricingRule, 'id' | 'createdAt' | 'updatedAt' | 'req7d' | 'rev7d'>>;
}

// ── Templates ─────────────────────────────────────────────────────────────────

export const RULE_TEMPLATES: RuleTemplate[] = [
  {
    id: 'free-search',
    name: 'Free for Search Engines',
    description: 'Allow SEO crawlers like Googlebot and Bingbot at no charge.',
    color: 'emerald',
    partial: {
      name: 'Free for Search Engines',
      pathMatch: { type: 'all', pattern: '' },
      botMatch:  { type: 'group', botIds: [], groupIds: ['search-engines'], uaPattern: '' },
      pricePerPage: 0, licenseType: 'full_access', enabled: true, priority: 1,
      freeTierOverride: { enabled: false, limit: 0 },
    },
  },
  {
    id: 'premium-ai',
    name: 'Premium AI Training',
    description: 'Charge AI training bots (GPTBot, ClaudeBot, etc.) a premium rate.',
    color: 'violet',
    partial: {
      name: 'Premium AI Training',
      pathMatch: { type: 'all', pattern: '' },
      botMatch:  { type: 'group', botIds: [], groupIds: ['verified-ai'], uaPattern: '' },
      pricePerPage: 2000, licenseType: 'training', enabled: true, priority: 10,
      freeTierOverride: { enabled: true, limit: 100 },
    },
  },
  {
    id: 'blog-standard',
    name: 'Standard Blog Access',
    description: 'Charge a standard rate for /blog/* paths.',
    color: 'sky',
    partial: {
      name: 'Standard Blog Access',
      pathMatch: { type: 'prefix', pattern: '/blog/' },
      botMatch:  { type: 'all', botIds: [], groupIds: [], uaPattern: '' },
      pricePerPage: 1000, licenseType: 'summarization', enabled: true, priority: 20,
      freeTierOverride: { enabled: true, limit: 50 },
    },
  },
  {
    id: 'docs-free',
    name: 'API Docs Free',
    description: 'Serve /docs/* to all bots for free (encourages adoption).',
    color: 'amber',
    partial: {
      name: 'API Docs Free',
      pathMatch: { type: 'prefix', pattern: '/docs/' },
      botMatch:  { type: 'all', botIds: [], groupIds: [], uaPattern: '' },
      pricePerPage: 0, licenseType: 'full_access', enabled: true, priority: 15,
      freeTierOverride: { enabled: false, limit: 0 },
    },
  },
  {
    id: 'premium-content',
    name: 'Premium Content',
    description: 'High-value paths command a premium licensing fee.',
    color: 'red',
    partial: {
      name: 'Premium Content',
      pathMatch: { type: 'prefix', pattern: '/research/' },
      botMatch:  { type: 'all', botIds: [], groupIds: [], uaPattern: '' },
      pricePerPage: 5000, licenseType: 'training', enabled: true, priority: 5,
      freeTierOverride: { enabled: false, limit: 0 },
    },
  },
];

// ── Seed data ─────────────────────────────────────────────────────────────────

const SEED_RULES: PricingRule[] = [
  {
    id: 'rule-1', name: 'Free for Search Engines', description: 'SEO crawlers always free',
    enabled: true, priority: 1,
    pathMatch: { type: 'all', pattern: '' },
    botMatch:  { type: 'group', botIds: [], groupIds: ['search-engines'], uaPattern: '' },
    pricePerPage: 0, licenseType: 'full_access', customLicense: '',
    freeTierOverride: { enabled: false, limit: 0 },
    validFrom: '', validUntil: '', notes: 'SEO indexing bots should always be free.',
    createdAt: Date.now() - 30*86400000, updatedAt: Date.now() - 2*86400000,
    req7d: 4234, rev7d: 0,
  },
  {
    id: 'rule-2', name: 'Blog Posts – Standard Pricing', description: 'All bots pay for /blog/* content',
    enabled: true, priority: 20,
    pathMatch: { type: 'prefix', pattern: '/blog/' },
    botMatch:  { type: 'all', botIds: [], groupIds: [], uaPattern: '' },
    pricePerPage: 1000, licenseType: 'summarization', customLicense: '',
    freeTierOverride: { enabled: true, limit: 50 },
    validFrom: '', validUntil: '', notes: '',
    createdAt: Date.now() - 20*86400000, updatedAt: Date.now() - 86400000,
    req7d: 1892, rev7d: 1_234_000,
  },
  {
    id: 'rule-3', name: 'AI Training – Premium Rate', description: 'Higher rate for AI model trainers',
    enabled: true, priority: 10,
    pathMatch: { type: 'all', pattern: '' },
    botMatch:  { type: 'group', botIds: [], groupIds: ['verified-ai'], uaPattern: '' },
    pricePerPage: 2000, licenseType: 'training', customLicense: '',
    freeTierOverride: { enabled: true, limit: 100 },
    validFrom: '', validUntil: '', notes: 'AI companies have dedicated budgets for training data.',
    createdAt: Date.now() - 15*86400000, updatedAt: Date.now() - 3*86400000,
    req7d: 2341, rev7d: 2_456_000,
  },
  {
    id: 'rule-4', name: 'API Docs Free', description: 'Documentation always free',
    enabled: true, priority: 15,
    pathMatch: { type: 'prefix', pattern: '/docs/' },
    botMatch:  { type: 'all', botIds: [], groupIds: [], uaPattern: '' },
    pricePerPage: 0, licenseType: 'full_access', customLicense: '',
    freeTierOverride: { enabled: false, limit: 0 },
    validFrom: '', validUntil: '', notes: '',
    createdAt: Date.now() - 10*86400000, updatedAt: Date.now() - 5*86400000,
    req7d: 567, rev7d: 0,
  },
  {
    id: 'rule-5', name: 'Research Section – Premium', description: 'High-value research content',
    enabled: false, priority: 5,
    pathMatch: { type: 'prefix', pattern: '/research/' },
    botMatch:  { type: 'all', botIds: [], groupIds: [], uaPattern: '' },
    pricePerPage: 5000, licenseType: 'training', customLicense: '',
    freeTierOverride: { enabled: false, limit: 0 },
    validFrom: '', validUntil: '', notes: 'Disabled pending legal review of research content licensing.',
    createdAt: Date.now() - 5*86400000, updatedAt: Date.now() - 86400000,
    req7d: 0, rev7d: 0,
  },
];

const SEED_DEFAULT: DefaultPricing = {
  pricePerPage:  500,
  licenseType:   'summarization',
  freeTierLimit: 100,
};

// ── Path/bot matching (used by simulator) ────────────────────────────────────

export function matchesPath(rule: PricingRule, path: string): boolean {
  const { type, pattern } = rule.pathMatch;
  if (type === 'all')    return true;
  if (type === 'exact')  return path === pattern;
  if (type === 'prefix') {
    const prefix = pattern.replace(/\*$/, '').replace(/\/$/, '');
    return path.startsWith(prefix + '/') || path === prefix;
  }
  if (type === 'regex') {
    try { return new RegExp(pattern).test(path); } catch { return false; }
  }
  return false;
}

export function matchesBot(rule: PricingRule, botId: string, groupMap: Record<string, string[]>): boolean {
  const { type, botIds, groupIds } = rule.botMatch;
  if (type === 'all')      return true;
  if (type === 'specific') return botIds.includes(botId);
  if (type === 'group') {
    return groupIds.some(gid => (groupMap[gid] ?? []).includes(botId));
  }
  return false;
}

// ── Context ───────────────────────────────────────────────────────────────────

const LS_RULES_KEY   = 'sk_pricing_rules_v1';
const LS_DEFAULT_KEY = 'sk_pricing_default_v1';

let _nextId = 100;
export function newRuleId(): string { return `rule-${++_nextId}`; }

interface PricingStoreValue {
  rules:         PricingRule[];
  defaultPricing: DefaultPricing;
  addRule:       (r: PricingRule) => void;
  updateRule:    (id: string, patch: Partial<PricingRule>) => void;
  deleteRule:    (id: string) => void;
  duplicateRule: (id: string) => void;
  reorderRules:  (fromIdx: number, toIdx: number) => void;
  setDefaultPricing: (d: DefaultPricing) => void;
  exportRules:   () => string;
  importRules:   (json: string) => { ok: boolean; error?: string };
}

const PricingCtx = createContext<PricingStoreValue | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

export function PricingStoreProvider({ children }: { children: ReactNode }) {
  const [rules,          setRules]          = useState<PricingRule[]>(SEED_RULES);
  const [defaultPricing, setDefaultState]   = useState<DefaultPricing>(SEED_DEFAULT);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_RULES_KEY);
      if (raw) setRules(JSON.parse(raw) as PricingRule[]);
    } catch { /* ignore */ }
    try {
      const raw = localStorage.getItem(LS_DEFAULT_KEY);
      if (raw) setDefaultState(JSON.parse(raw) as DefaultPricing);
    } catch { /* ignore */ }
  }, []);

  function saveRules(next: PricingRule[]) {
    setRules(next);
    try { localStorage.setItem(LS_RULES_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  }

  const addRule = useCallback((r: PricingRule) => {
    setRules(prev => {
      const next = [...prev, r].sort((a, b) => a.priority - b.priority);
      try { localStorage.setItem(LS_RULES_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const updateRule = useCallback((id: string, patch: Partial<PricingRule>) => {
    setRules(prev => {
      const next = prev.map(r => r.id === id ? { ...r, ...patch, updatedAt: Date.now() } : r);
      try { localStorage.setItem(LS_RULES_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const deleteRule = useCallback((id: string) => {
    setRules(prev => {
      const next = prev.filter(r => r.id !== id);
      try { localStorage.setItem(LS_RULES_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const duplicateRule = useCallback((id: string) => {
    setRules(prev => {
      const orig = prev.find(r => r.id === id);
      if (!orig) return prev;
      const copy: PricingRule = {
        ...orig, id: newRuleId(),
        name: `${orig.name} (copy)`,
        priority: Math.max(...prev.map(r => r.priority)) + 10,
        createdAt: Date.now(), updatedAt: Date.now(),
        req7d: 0, rev7d: 0,
      };
      const next = [...prev, copy];
      try { localStorage.setItem(LS_RULES_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const reorderRules = useCallback((fromIdx: number, toIdx: number) => {
    setRules(prev => {
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved!);
      // Re-assign priorities based on new order
      const reindexed = next.map((r, i) => ({ ...r, priority: (i + 1) * 10 }));
      try { localStorage.setItem(LS_RULES_KEY, JSON.stringify(reindexed)); } catch { /* ignore */ }
      return reindexed;
    });
  }, []);

  const setDefaultPricing = useCallback((d: DefaultPricing) => {
    setDefaultState(d);
    try { localStorage.setItem(LS_DEFAULT_KEY, JSON.stringify(d)); } catch { /* ignore */ }
  }, []);

  const exportRules = useCallback(() =>
    JSON.stringify({ version: 1, defaultPricing, rules }, null, 2),
  [defaultPricing, rules]);

  const importRules = useCallback((json: string): { ok: boolean; error?: string } => {
    try {
      const parsed = JSON.parse(json) as { rules?: PricingRule[]; defaultPricing?: DefaultPricing };
      if (!Array.isArray(parsed.rules)) return { ok: false, error: 'JSON must have a "rules" array.' };
      saveRules(parsed.rules);
      if (parsed.defaultPricing) setDefaultState(parsed.defaultPricing);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <PricingCtx.Provider value={{
      rules, defaultPricing,
      addRule, updateRule, deleteRule, duplicateRule, reorderRules,
      setDefaultPricing, exportRules, importRules,
    }}>
      {children}
    </PricingCtx.Provider>
  );
}

export function usePricingStore(): PricingStoreValue {
  const ctx = useContext(PricingCtx);
  if (!ctx) throw new Error('usePricingStore must be inside <PricingStoreProvider>');
  return ctx;
}
