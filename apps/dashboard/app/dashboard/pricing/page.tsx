'use client';

import { useState, useMemo, useRef } from 'react';
import {
  Plus, Download, Upload, Sliders, AlertCircle, CheckCircle,
  X, ChevronDown, Sparkles,
} from 'lucide-react';
import { usePricingStore, RULE_TEMPLATES } from '@/lib/pricingStore';
import type { PricingRule, DefaultPricing, LicenseType } from '@/lib/pricingStore';
import { formatUsdcDollar } from '@/lib/formatters';
import RuleCard from '@/components/RuleCard';
import RuleBuilderModal from '@/components/RuleBuilderModal';
import PricingSimulator from '@/components/PricingSimulator';

// ── Constants ─────────────────────────────────────────────────────────────────

const LICENSE_OPTIONS: { val: LicenseType; label: string }[] = [
  { val: 'summarization', label: 'Summarization' },
  { val: 'training',      label: 'Training'      },
  { val: 'full_access',   label: 'Full Access'   },
  { val: 'custom',        label: 'Custom'        },
];

const TEMPLATE_COLORS: Record<string, string> = {
  emerald: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  violet:  'bg-violet-50 border-violet-200 text-violet-800',
  sky:     'bg-sky-50 border-sky-200 text-sky-700',
  amber:   'bg-amber-50 border-amber-200 text-amber-800',
  red:     'bg-red-50 border-red-200 text-red-700',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Find rules that have overlapping path+bot scope (conflict detection) */
function detectConflicts(rules: PricingRule[]): Set<string> {
  const conflicts = new Set<string>();
  for (let i = 0; i < rules.length; i++) {
    for (let j = i + 1; j < rules.length; j++) {
      const a = rules[i]!;
      const b = rules[j]!;
      // Both match all paths → conflict
      const pathOverlap = a.pathMatch.type === 'all' || b.pathMatch.type === 'all' ||
        (a.pathMatch.type === 'prefix' && b.pathMatch.type === 'prefix' &&
          (a.pathMatch.pattern.startsWith(b.pathMatch.pattern) || b.pathMatch.pattern.startsWith(a.pathMatch.pattern)));
      const botOverlap  = a.botMatch.type === 'all' || b.botMatch.type === 'all';
      if (pathOverlap && botOverlap && a.enabled && b.enabled) {
        conflicts.add(a.id);
        conflicts.add(b.id);
      }
    }
  }
  return conflicts;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PricingPage() {
  const { rules, defaultPricing, setDefaultPricing, exportRules, importRules, addRule } = usePricingStore();

  // UI state
  const [builderOpen,    setBuilderOpen]    = useState(false);
  const [editingRule,    setEditingRule]    = useState<PricingRule | null>(null);
  const [testRule,       setTestRule]       = useState<PricingRule | null>(null);
  const [showTemplates,  setShowTemplates]  = useState(false);
  const [toast,          setToast]          = useState<string | null>(null);
  const [importError,    setImportError]    = useState<string | null>(null);
  const [defaultDraft,   setDefaultDraft]   = useState<DefaultPricing>(defaultPricing);
  const [defaultSaved,   setDefaultSaved]   = useState(false);
  const [selected,       setSelected]       = useState<Set<string>>(new Set());
  const [bulkMenu,       setBulkMenu]       = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Derived
  const sortedRules = useMemo(() => [...rules].sort((a, b) => a.priority - b.priority), [rules]);
  const conflicts   = useMemo(() => detectConflicts(sortedRules), [sortedRules]);
  const hasConflicts = conflicts.size > 0;

  const totalRev = rules.reduce((s, r) => s + r.rev7d, 0);
  const totalReq = rules.reduce((s, r) => s + r.req7d, 0);
  const activeRules = rules.filter(r => r.enabled).length;

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3_000);
  }

  function saveDefault() {
    setDefaultPricing(defaultDraft);
    setDefaultSaved(true);
    setTimeout(() => setDefaultSaved(false), 2_000);
    showToast('Default pricing saved.');
  }

  function handleExport() {
    const blob = new Blob([exportRules()], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'pricing-rules.json'; a.click();
    URL.revokeObjectURL(url);
    showToast('Rules exported as JSON.');
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const result = importRules(ev.target?.result as string);
      if (result.ok) showToast('Rules imported successfully!');
      else setImportError(result.error ?? 'Import failed');
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function applyTemplate(templateId: string) {
    const tpl = RULE_TEMPLATES.find(t => t.id === templateId);
    if (!tpl) return;
    const now = Date.now();
    addRule({
      id: `rule-${now}`,
      name: tpl.partial.name ?? tpl.name,
      description: tpl.description,
      enabled: true,
      priority: tpl.partial.priority ?? 50,
      pathMatch:  { type: 'all', pattern: '', ...tpl.partial.pathMatch },
      botMatch:   { type: 'all', botIds: [], groupIds: [], uaPattern: '', ...tpl.partial.botMatch },
      pricePerPage: tpl.partial.pricePerPage ?? 1000,
      licenseType:  (tpl.partial.licenseType ?? 'summarization') as LicenseType,
      customLicense: '',
      freeTierOverride: { enabled: false, limit: 0, ...tpl.partial.freeTierOverride },
      validFrom: '', validUntil: '', notes: '',
      createdAt: now, updatedAt: now,
      req7d: 0, rev7d: 0,
    });
    setShowTemplates(false);
    showToast(`Template "${tpl.name}" applied!`);
  }

  // Bulk selection
  const allSelected = sortedRules.length > 0 && sortedRules.every(r => selected.has(r.id));
  function toggleSelectAll() {
    setSelected(allSelected ? new Set() : new Set(sortedRules.map(r => r.id)));
  }

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Pricing Rules</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Visually build path- and bot-based pricing without editing JSON
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setShowTemplates(v => !v)}
            className="flex items-center gap-1.5 text-sm font-medium border border-slate-200 rounded-xl px-3 py-2 text-slate-600 hover:bg-slate-50 transition-colors">
            <Sparkles className="w-4 h-4" /> Templates
          </button>
          <button onClick={handleExport}
            className="flex items-center gap-1.5 text-sm font-medium border border-slate-200 rounded-xl px-3 py-2 text-slate-600 hover:bg-slate-50 transition-colors">
            <Download className="w-4 h-4" /> Export
          </button>
          <button onClick={() => fileRef.current?.click()}
            className="flex items-center gap-1.5 text-sm font-medium border border-slate-200 rounded-xl px-3 py-2 text-slate-600 hover:bg-slate-50 transition-colors">
            <Upload className="w-4 h-4" /> Import
          </button>
          <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
          <button onClick={() => { setEditingRule(null); setBuilderOpen(true); }}
            className="flex items-center gap-1.5 text-sm font-semibold bg-brand-dark text-white px-4 py-2 rounded-xl hover:bg-brand-mid transition-colors">
            <Plus className="w-4 h-4" /> Add Rule
          </button>
        </div>
      </div>

      {/* ── Stats strip ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label:'Total Rules',   value: String(rules.length),         color:'text-slate-900' },
          { label:'Active Rules',  value: String(activeRules),          color:'text-brand-dark' },
          { label:'Rev 7d',        value: formatUsdcDollar(totalRev),   color:'text-emerald-600' },
          { label:'Requests 7d',   value: totalReq.toLocaleString(),    color:'text-slate-700'  },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-slate-200 px-4 py-3 hover:shadow-sm transition-shadow">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{s.label}</p>
            <p className={`text-2xl font-bold tabular-nums mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* ── Conflict warning ─────────────────────────────────────────────── */}
      {hasConflicts && (
        <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-800">Rule conflicts detected</p>
            <p className="text-amber-700 mt-0.5">
              {conflicts.size} rules have overlapping path and bot scopes. The higher-priority rule wins,
              but consider narrowing your patterns or adjusting priorities.
            </p>
          </div>
        </div>
      )}

      {/* ── Import error ─────────────────────────────────────────────────── */}
      {importError && (
        <div className="flex items-center gap-2.5 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
          <span className="flex-1 text-red-700">{importError}</span>
          <button onClick={() => setImportError(null)} className="text-red-400 hover:text-red-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Templates panel ───────────────────────────────────────────────── */}
      {showTemplates && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-400" /> Quick-start Templates
            </h2>
            <button onClick={() => setShowTemplates(false)} className="text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {RULE_TEMPLATES.map(tpl => (
              <div key={tpl.id}
                className={`rounded-xl border p-4 space-y-2 ${TEMPLATE_COLORS[tpl.color] ?? TEMPLATE_COLORS.sky}`}>
                <p className="font-semibold text-sm">{tpl.name}</p>
                <p className="text-xs opacity-80">{tpl.description}</p>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs font-mono font-semibold">
                    {(tpl.partial.pricePerPage ?? 0) === 0 ? 'FREE' : formatUsdcDollar(tpl.partial.pricePerPage!)}
                  </span>
                  <button onClick={() => applyTemplate(tpl.id)}
                    className="text-xs font-semibold px-3 py-1.5 bg-white/70 hover:bg-white rounded-lg border border-current/20 transition-colors">
                    Use Template
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Main 2-col layout ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Left: Default pricing + Rules list ───────────────────────── */}
        <div className="lg:col-span-2 space-y-5">

          {/* Default pricing card */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Sliders className="w-4 h-4 text-slate-400" />
              <h2 className="text-sm font-semibold text-slate-700">Default Pricing (catch-all)</h2>
              <span className="text-xs text-slate-400 ml-auto">Applied when no rule matches</span>
            </div>
            <div className="flex flex-wrap gap-4 items-end">
              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Price / Page (µUSDC)</label>
                <input type="number" min="0" value={defaultDraft.pricePerPage}
                  onChange={e => setDefaultDraft(d => ({ ...d, pricePerPage: Math.max(0, parseInt(e.target.value)||0) }))}
                  className="mt-1.5 w-36 px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-dark/30 focus:border-brand-dark" />
                <p className="text-xs text-slate-400 mt-1">{formatUsdcDollar(defaultDraft.pricePerPage)} per request</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">License Type</label>
                <div className="mt-1.5 relative">
                  <select value={defaultDraft.licenseType}
                    onChange={e => setDefaultDraft(d => ({ ...d, licenseType: e.target.value as LicenseType }))}
                    className="appearance-none w-44 pl-3 pr-8 py-2.5 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-dark/30 focus:border-brand-dark text-slate-800">
                    {LICENSE_OPTIONS.map(o => <option key={o.val} value={o.val}>{o.label}</option>)}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Free Tier Limit / day</label>
                <input type="number" min="0" value={defaultDraft.freeTierLimit}
                  onChange={e => setDefaultDraft(d => ({ ...d, freeTierLimit: Math.max(0, parseInt(e.target.value)||0) }))}
                  className="mt-1.5 w-28 px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-dark/30 focus:border-brand-dark" />
              </div>
              <button onClick={saveDefault}
                className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${defaultSaved ? 'bg-emerald-600 text-white' : 'bg-brand-dark text-white hover:bg-brand-mid'}`}>
                {defaultSaved ? <><CheckCircle className="w-4 h-4" /> Saved</> : 'Save Default'}
              </button>
            </div>
          </div>

          {/* Bulk action bar */}
          {selected.size > 0 && (
            <div className="bg-brand-dark text-white rounded-xl px-4 py-3 flex items-center gap-3">
              <span className="font-semibold text-sm">{selected.size} selected</span>
              <div className="flex gap-2 ml-auto relative">
                <button className="px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-sm font-semibold transition-colors flex items-center gap-1"
                  onClick={() => setBulkMenu(v => !v)}>
                  Actions <ChevronDown className="w-3.5 h-3.5" />
                </button>
                {bulkMenu && (
                  <div className="absolute right-0 top-9 bg-white rounded-xl shadow-xl border border-slate-100 py-1 w-48 z-10 text-slate-700">
                    <button className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 flex items-center gap-2">Enable Selected</button>
                    <button className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 flex items-center gap-2">Disable Selected</button>
                    <button className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 text-red-500">Delete Selected</button>
                  </div>
                )}
                <button onClick={() => setSelected(new Set())}
                  className="px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-sm font-semibold transition-colors">
                  Clear
                </button>
              </div>
            </div>
          )}

          {/* Rules list */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-700">
                Rules <span className="text-slate-400 font-normal">({sortedRules.length})</span>
              </h2>
              <p className="text-xs text-slate-400">Evaluated top-to-bottom — first match wins</p>
            </div>

            {sortedRules.length === 0 ? (
              <div className="bg-white rounded-xl border border-dashed border-slate-300 py-16 text-center">
                <Sliders className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 font-medium">No rules yet</p>
                <p className="text-sm text-slate-400 mt-1">Add a rule or apply a template to get started</p>
                <button onClick={() => { setEditingRule(null); setBuilderOpen(true); }}
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 bg-brand-dark text-white rounded-xl text-sm font-semibold hover:bg-brand-mid transition-colors">
                  <Plus className="w-4 h-4" /> Add First Rule
                </button>
              </div>
            ) : (
              sortedRules.map((rule, idx) => (
                <RuleCard
                  key={rule.id}
                  rule={rule}
                  index={idx}
                  total={sortedRules.length}
                  isConflict={conflicts.has(rule.id)}
                  onEdit={r => { setEditingRule(r); setBuilderOpen(true); }}
                  onTest={r => setTestRule(r)}
                />
              ))
            )}

            {sortedRules.length > 0 && (
              <div className="bg-slate-50 rounded-xl border border-dashed border-slate-200 px-4 py-3 text-center">
                <p className="text-xs text-slate-400">
                  ↓ Default pricing ({formatUsdcDollar(defaultPricing.pricePerPage)}) applied if no rule matches
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ── Right: Simulator ─────────────────────────────────────────── */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5 lg:sticky lg:top-6">
            <h2 className="text-sm font-semibold text-slate-700 mb-4">Request Simulator</h2>
            <PricingSimulator prefillRule={testRule} />
            {testRule && (
              <button onClick={() => setTestRule(null)}
                className="mt-3 text-xs text-slate-400 hover:text-slate-600 transition-colors w-full text-center">
                Clear prefill
              </button>
            )}
          </div>

          {/* Rule legend */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2.5">
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Price Color Guide</p>
            {[
              { label:'Free (0 µUSDC)', color:'bg-emerald-50 border-emerald-200 text-emerald-600' },
              { label:'Low (&lt; 1000 µUSDC)', color:'bg-sky-50 border-sky-200 text-sky-600' },
              { label:'Standard (1000–3000)', color:'bg-brand-dark/5 border-brand-dark/20 text-brand-dark' },
              { label:'Premium (&gt; 3000)', color:'bg-violet-50 border-violet-200 text-violet-700' },
            ].map(l => (
              <div key={l.label} className={`text-xs font-medium px-3 py-1.5 rounded-lg border ${l.color}`}
                dangerouslySetInnerHTML={{ __html: l.label }} />
            ))}
          </div>
        </div>

      </div>

      {/* ── Modals ───────────────────────────────────────────────────────── */}
      {builderOpen && (
        <RuleBuilderModal
          initial={editingRule}
          onClose={() => { setBuilderOpen(false); setEditingRule(null); }}
        />
      )}

      {/* ── Toast ────────────────────────────────────────────────────────── */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-slate-900 text-white rounded-xl px-5 py-3 shadow-2xl text-sm animate-slide-up">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          {toast}
        </div>
      )}
    </div>
  );
}
