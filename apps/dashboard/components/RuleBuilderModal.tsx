'use client';

import { useState } from 'react';
import { X, ChevronRight, ChevronLeft, Check, AlertCircle } from 'lucide-react';
import { usePricingStore, newRuleId } from '@/lib/pricingStore';
import type { PricingRule, PathMatchType, BotMatchType, LicenseType } from '@/lib/pricingStore';

// ── Constants ─────────────────────────────────────────────────────────────────

const ALL_BOTS = [
  { id:'gptbot', name:'GPTBot' }, { id:'claudeweb', name:'ClaudeBot' },
  { id:'perplexitybot', name:'PerplexityBot' }, { id:'googleextended', name:'Google-Extended' },
  { id:'amazonbot', name:'AmazonBot' }, { id:'googlebot', name:'Googlebot' },
  { id:'bingbot', name:'Bingbot' }, { id:'duckduckbot', name:'DuckDuckBot' },
  { id:'ccbot', name:'CCBot' }, { id:'semrushbot', name:'SemrushBot' },
  { id:'ahrefsbot', name:'AhrefsBot' },
];
const BOT_GROUPS = [
  { id:'verified-ai',    name:'Verified AI Companies' },
  { id:'search-engines', name:'Search Engines'        },
  { id:'data-crawlers',  name:'Data Crawlers'         },
  { id:'social-media',   name:'Social Media'          },
  { id:'suspicious',     name:'Suspicious / Unknown'  },
];

const STEPS = ['Basic Info', 'Path Pattern', 'Bot Selection', 'Pricing & Advanced'] as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

function pathExamples(type: PathMatchType, pattern: string): string[] {
  if (!pattern) return [];
  if (type === 'exact')  return [`Matches only: ${pattern}`];
  if (type === 'prefix') {
    const base = pattern.replace(/\*$/, '').replace(/\/$/, '');
    return [`${base}/any-slug`, `${base}/sub/page`, `${base}`];
  }
  if (type === 'regex') {
    try { new RegExp(pattern); return ['Valid regex ✓']; } catch { return ['⚠ Invalid regex']; }
  }
  return ['Matches all paths'];
}

function priceToUsd(µusdc: number): string {
  return `$${(µusdc / 1_000_000).toFixed(µusdc < 1_000_000 ? 4 : 2)}`;
}

// ── Empty rule ────────────────────────────────────────────────────────────────

function emptyRule(): Omit<PricingRule, 'id' | 'createdAt' | 'updatedAt' | 'req7d' | 'rev7d'> {
  return {
    name: '', description: '', enabled: true, priority: 50,
    pathMatch:  { type: 'all', pattern: '' },
    botMatch:   { type: 'all', botIds: [], groupIds: [], uaPattern: '' },
    pricePerPage: 1000, licenseType: 'summarization', customLicense: '',
    freeTierOverride: { enabled: true, limit: 100 },
    validFrom: '', validUntil: '', notes: '',
  };
}

// ── Step components ───────────────────────────────────────────────────────────

type Draft = ReturnType<typeof emptyRule>;

function StepBasicInfo({ draft, set }: { draft: Draft; set: (p: Partial<Draft>) => void }) {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-semibold text-ink-2 uppercase tracking-wide">Rule Name *</label>
        <input type="text" value={draft.name} onChange={e => set({ name: e.target.value })}
          placeholder="e.g., Blog Posts Premium Pricing"
          className="mt-1.5 w-full px-3 py-2.5 rounded-xl border border-edge text-sm focus:outline-none focus:ring-2 focus:ring-brand-dark/30 focus:border-brand-dark" />
      </div>
      <div>
        <label className="text-xs font-semibold text-ink-2 uppercase tracking-wide">Description</label>
        <textarea value={draft.description} onChange={e => set({ description: e.target.value })}
          placeholder="What does this rule do?"
          rows={2}
          className="mt-1.5 w-full px-3 py-2.5 rounded-xl border border-edge text-sm focus:outline-none focus:ring-2 focus:ring-brand-dark/30 focus:border-brand-dark resize-none" />
      </div>
      <label className="flex items-center justify-between p-3.5 bg-canvas rounded-xl cursor-pointer border border-edge">
        <div>
          <p className="text-sm font-semibold text-slate-800">Enabled</p>
          <p className="text-xs text-ink-2 mt-0.5">Disabled rules are skipped during matching</p>
        </div>
        <button type="button" onClick={() => set({ enabled: !draft.enabled })}
          className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${draft.enabled ? 'bg-brand-dark' : 'bg-slate-200'}`}>
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${draft.enabled ? 'translate-x-5' : ''}`} />
        </button>
      </label>
    </div>
  );
}

function StepPathPattern({ draft, set }: { draft: Draft; set: (p: Partial<Draft>) => void }) {
  const types: { val: PathMatchType; label: string; hint: string }[] = [
    { val:'all',    label:'All paths',     hint:'Matches every request path' },
    { val:'exact',  label:'Exact path',    hint:'Only matches this specific path' },
    { val:'prefix', label:'Path prefix',   hint:'Matches paths starting with this prefix' },
    { val:'regex',  label:'Regex pattern', hint:'Matches paths against a regular expression' },
  ];
  const examples = pathExamples(draft.pathMatch.type, draft.pathMatch.pattern);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold text-ink-2 uppercase tracking-wide mb-2">Match Type</p>
        <div className="grid grid-cols-2 gap-2">
          {types.map(t => (
            <label key={t.val}
              className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${draft.pathMatch.type === t.val ? 'border-brand-dark bg-brand-dark/5' : 'border-edge hover:border-slate-300'}`}>
              <input type="radio" className="mt-0.5 accent-brand-dark shrink-0"
                checked={draft.pathMatch.type === t.val}
                onChange={() => set({ pathMatch: { ...draft.pathMatch, type: t.val } })} />
              <div>
                <p className="text-sm font-semibold text-slate-800">{t.label}</p>
                <p className="text-xs text-ink-2">{t.hint}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {draft.pathMatch.type !== 'all' && (
        <div>
          <label className="text-xs font-semibold text-ink-2 uppercase tracking-wide">
            {draft.pathMatch.type === 'exact' ? 'Exact Path' : draft.pathMatch.type === 'prefix' ? 'Path Prefix' : 'Regex Pattern'}
          </label>
          <input type="text" value={draft.pathMatch.pattern}
            onChange={e => set({ pathMatch: { ...draft.pathMatch, pattern: e.target.value } })}
            placeholder={draft.pathMatch.type === 'exact' ? '/blog/specific-post' : draft.pathMatch.type === 'prefix' ? '/blog/' : '^/blog/[0-9]+'}
            className="mt-1.5 w-full px-3 py-2.5 rounded-xl border border-edge text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-dark/30 focus:border-brand-dark" />
        </div>
      )}

      {examples.length > 0 && (
        <div className="bg-canvas rounded-xl px-4 py-3">
          <p className="text-xs font-semibold text-ink-2 mb-1.5">Examples</p>
          {examples.map(e => (
            <p key={e} className="text-xs font-mono text-ink-2 py-0.5">{e}</p>
          ))}
        </div>
      )}
    </div>
  );
}

function StepBotSelection({ draft, set }: { draft: Draft; set: (p: Partial<Draft>) => void }) {
  const types: { val: BotMatchType; label: string; hint: string }[] = [
    { val:'all',      label:'All bots',         hint:'Rule applies to every bot' },
    { val:'group',    label:'Bot group',         hint:'Apply to a predefined group of bots' },
    { val:'specific', label:'Specific bots',     hint:'Select individual bots to target' },
  ];

  function toggleBot(id: string) {
    const ids = draft.botMatch.botIds;
    set({ botMatch: { ...draft.botMatch, botIds: ids.includes(id) ? ids.filter(b => b !== id) : [...ids, id] } });
  }
  function toggleGroup(id: string) {
    const ids = draft.botMatch.groupIds;
    set({ botMatch: { ...draft.botMatch, groupIds: ids.includes(id) ? ids.filter(g => g !== id) : [...ids, id] } });
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {types.map(t => (
          <label key={t.val}
            className={`flex flex-col gap-1 p-3 rounded-xl border cursor-pointer transition-all ${draft.botMatch.type === t.val ? 'border-brand-dark bg-brand-dark/5' : 'border-edge hover:border-slate-300'}`}>
            <div className="flex items-center gap-2">
              <input type="radio" className="accent-brand-dark shrink-0"
                checked={draft.botMatch.type === t.val}
                onChange={() => set({ botMatch: { ...draft.botMatch, type: t.val } })} />
              <p className="text-sm font-semibold text-slate-800">{t.label}</p>
            </div>
            <p className="text-xs text-ink-2 ml-5">{t.hint}</p>
          </label>
        ))}
      </div>

      {draft.botMatch.type === 'group' && (
        <div>
          <p className="text-xs font-semibold text-ink-2 uppercase tracking-wide mb-2">Select Groups</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {BOT_GROUPS.map(g => (
              <label key={g.id}
                className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition-all ${draft.botMatch.groupIds.includes(g.id) ? 'border-brand-dark bg-brand-dark/5' : 'border-edge hover:border-slate-300'}`}>
                <input type="checkbox" className="accent-brand-dark"
                  checked={draft.botMatch.groupIds.includes(g.id)}
                  onChange={() => toggleGroup(g.id)} />
                <span className="text-sm text-slate-800">{g.name}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {draft.botMatch.type === 'specific' && (
        <div>
          <p className="text-xs font-semibold text-ink-2 uppercase tracking-wide mb-2">
            Select Bots ({draft.botMatch.botIds.length} selected)
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            {ALL_BOTS.map(b => (
              <label key={b.id}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-sm transition-all ${draft.botMatch.botIds.includes(b.id) ? 'border-brand-dark bg-brand-dark/5 font-medium text-brand-dark' : 'border-edge text-ink-2 hover:border-slate-300'}`}>
                <input type="checkbox" className="accent-brand-dark shrink-0"
                  checked={draft.botMatch.botIds.includes(b.id)}
                  onChange={() => toggleBot(b.id)} />
                {b.name}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StepPricingAdvanced({ draft, set }: { draft: Draft; set: (p: Partial<Draft>) => void }) {
  const licenses: { val: LicenseType; label: string }[] = [
    { val:'summarization', label:'Summarization' },
    { val:'training',      label:'Training'      },
    { val:'full_access',   label:'Full Access'   },
    { val:'custom',        label:'Custom'        },
  ];

  return (
    <div className="space-y-4">
      {/* Price */}
      <div>
        <label className="text-xs font-semibold text-ink-2 uppercase tracking-wide">Price Per Page (µUSDC)</label>
        <div className="mt-1.5 flex gap-3 items-center">
          <input type="number" min="0" value={draft.pricePerPage}
            onChange={e => set({ pricePerPage: Math.max(0, parseInt(e.target.value) || 0) })}
            className="flex-1 px-3 py-2.5 rounded-xl border border-edge text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-dark/30 focus:border-brand-dark" />
          <span className="text-sm text-ink-2 shrink-0">
            {draft.pricePerPage === 0
              ? <span className="text-emerald-600 font-semibold">Free</span>
              : <span>{priceToUsd(draft.pricePerPage)} USD</span>}
          </span>
        </div>
        {/* Quick presets */}
        <div className="flex gap-1.5 mt-2 flex-wrap">
          {[0, 500, 1000, 2000, 5000].map(p => (
            <button key={p} onClick={() => set({ pricePerPage: p })}
              className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${draft.pricePerPage === p ? 'bg-brand-dark text-white border-brand-dark' : 'border-edge text-ink-2 hover:border-brand-dark hover:text-brand-dark'}`}>
              {p === 0 ? 'Free' : `${p} µ`}
            </button>
          ))}
        </div>
      </div>

      {/* License type */}
      <div>
        <label className="text-xs font-semibold text-ink-2 uppercase tracking-wide">License Type</label>
        <div className="mt-1.5 grid grid-cols-2 gap-2">
          {licenses.map(l => (
            <label key={l.val}
              className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition-all ${draft.licenseType === l.val ? 'border-brand-dark bg-brand-dark/5' : 'border-edge hover:border-slate-300'}`}>
              <input type="radio" className="accent-brand-dark shrink-0"
                checked={draft.licenseType === l.val}
                onChange={() => set({ licenseType: l.val })} />
              <span className="text-sm font-medium text-slate-800">{l.label}</span>
            </label>
          ))}
        </div>
        {draft.licenseType === 'custom' && (
          <input type="text" value={draft.customLicense}
            onChange={e => set({ customLicense: e.target.value })}
            placeholder="Custom license name"
            className="mt-2 w-full px-3 py-2.5 rounded-xl border border-edge text-sm focus:outline-none focus:ring-2 focus:ring-brand-dark/30 focus:border-brand-dark" />
        )}
      </div>

      {/* Free tier override */}
      <div className="bg-canvas rounded-xl border border-edge p-4 space-y-3">
        <label className="flex items-center justify-between cursor-pointer">
          <div>
            <p className="text-sm font-semibold text-slate-800">Free Tier Override</p>
            <p className="text-xs text-ink-2 mt-0.5">Allow N free requests per day before charging</p>
          </div>
          <button type="button" onClick={() => set({ freeTierOverride: { ...draft.freeTierOverride, enabled: !draft.freeTierOverride.enabled } })}
            className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${draft.freeTierOverride.enabled ? 'bg-brand-dark' : 'bg-slate-200'}`}>
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${draft.freeTierOverride.enabled ? 'translate-x-5' : ''}`} />
          </button>
        </label>
        {draft.freeTierOverride.enabled && (
          <div className="flex items-center gap-2">
            <input type="number" min="0" value={draft.freeTierOverride.limit}
              onChange={e => set({ freeTierOverride: { ...draft.freeTierOverride, limit: Math.max(0, parseInt(e.target.value)||0) } })}
              className="w-24 px-3 py-2 rounded-lg border border-edge text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-dark/30 focus:border-brand-dark" />
            <span className="text-sm text-ink-2">free requests per day</span>
          </div>
        )}
      </div>

      {/* Advanced */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-ink-2 uppercase tracking-wide">Priority</label>
          <input type="number" min="1" value={draft.priority}
            onChange={e => set({ priority: Math.max(1, parseInt(e.target.value)||1) })}
            className="mt-1.5 w-full px-3 py-2.5 rounded-xl border border-edge text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-dark/30 focus:border-brand-dark" />
          <p className="text-xs text-ink-3 mt-1">Lower = higher priority</p>
        </div>
        <div>
          <label className="text-xs font-semibold text-ink-2 uppercase tracking-wide">Valid Until</label>
          <input type="date" value={draft.validUntil}
            onChange={e => set({ validUntil: e.target.value })}
            className="mt-1.5 w-full px-3 py-2.5 rounded-xl border border-edge text-sm focus:outline-none focus:ring-2 focus:ring-brand-dark/30 focus:border-brand-dark" />
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold text-ink-2 uppercase tracking-wide">Notes</label>
        <textarea value={draft.notes} onChange={e => set({ notes: e.target.value })}
          rows={2} placeholder="Internal notes about this rule…"
          className="mt-1.5 w-full px-3 py-2.5 rounded-xl border border-edge text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-dark/30 focus:border-brand-dark" />
      </div>
    </div>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────

interface RuleBuilderModalProps {
  initial?: PricingRule | null; // null = create new
  onClose: () => void;
}

export default function RuleBuilderModal({ initial, onClose }: RuleBuilderModalProps) {
  const { addRule, updateRule } = usePricingStore();
  const isEdit = !!initial;

  const [step, setStep]   = useState(0);
  const [draft, setDraft] = useState<Draft>(() =>
    initial
      ? { name: initial.name, description: initial.description, enabled: initial.enabled, priority: initial.priority,
          pathMatch: initial.pathMatch, botMatch: initial.botMatch,
          pricePerPage: initial.pricePerPage, licenseType: initial.licenseType, customLicense: initial.customLicense,
          freeTierOverride: initial.freeTierOverride,
          validFrom: initial.validFrom, validUntil: initial.validUntil, notes: initial.notes }
      : emptyRule()
  );

  function patch(p: Partial<Draft>) { setDraft(prev => ({ ...prev, ...p })); }

  const errors: string[] = [];
  if (!draft.name.trim())             errors.push('Rule name is required');
  if (draft.pathMatch.type !== 'all' && !draft.pathMatch.pattern.trim()) errors.push('Path pattern is required');
  if (draft.botMatch.type === 'specific' && draft.botMatch.botIds.length === 0) errors.push('Select at least one bot');
  if (draft.botMatch.type === 'group'    && draft.botMatch.groupIds.length === 0) errors.push('Select at least one group');

  function handleSubmit() {
    if (errors.length) return;
    const now = Date.now();
    if (isEdit && initial) {
      updateRule(initial.id, { ...draft, updatedAt: now });
    } else {
      addRule({
        ...draft,
        id: newRuleId(),
        createdAt: now, updatedAt: now,
        req7d: 0, rev7d: 0,
      });
    }
    onClose();
  }

  const stepProps = { draft, set: patch };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-surface rounded-2xl shadow-popover w-full max-w-xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-edge-2 shrink-0">
          <h2 className="font-bold text-ink">{isEdit ? 'Edit Rule' : 'New Pricing Rule'}</h2>
          <button onClick={onClose} className="text-ink-3 hover:text-ink-2 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex px-6 py-3 border-b border-edge-2 gap-1 shrink-0">
          {STEPS.map((s, i) => (
            <button key={s} onClick={() => setStep(i)}
              className={`flex-1 text-center text-xs font-medium py-1.5 rounded-lg transition-colors ${i === step ? 'bg-brand-dark text-white' : i < step ? 'bg-emerald-100 text-emerald-700' : 'text-ink-3 hover:text-ink-2'}`}>
              {i < step ? <Check className="w-3.5 h-3.5 mx-auto" /> : <span>{i + 1}</span>}
              <span className="hidden sm:block text-[10px] mt-0.5">{s}</span>
            </button>
          ))}
        </div>

        {/* Step body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <p className="text-sm font-semibold text-ink mb-4">{STEPS[step]}</p>
          {step === 0 && <StepBasicInfo      {...stepProps} />}
          {step === 1 && <StepPathPattern    {...stepProps} />}
          {step === 2 && <StepBotSelection   {...stepProps} />}
          {step === 3 && <StepPricingAdvanced {...stepProps} />}
        </div>

        {/* Errors */}
        {step === 3 && errors.length > 0 && (
          <div className="px-6 pb-2">
            <div className="flex gap-2 text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <div className="space-y-0.5">{errors.map(e => <p key={e}>{e}</p>)}</div>
            </div>
          </div>
        )}

        {/* Footer nav */}
        <div className="px-6 py-4 border-t border-edge-2 flex items-center gap-2 shrink-0">
          {step > 0 && (
            <button onClick={() => setStep(s => s - 1)}
              className="flex items-center gap-1.5 px-4 py-2.5 border border-edge rounded-xl text-sm font-semibold text-ink-2 hover:bg-canvas transition-colors">
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
          )}
          <div className="flex-1" />
          <button onClick={onClose}
            className="px-4 py-2.5 border border-edge rounded-xl text-sm font-semibold text-ink-2 hover:bg-canvas transition-colors">
            Cancel
          </button>
          {step < STEPS.length - 1 ? (
            <button onClick={() => setStep(s => s + 1)}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-brand-dark text-white rounded-xl text-sm font-semibold hover:bg-brand-mid transition-colors">
              Next <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={errors.length > 0}
              className="flex items-center gap-1.5 px-5 py-2.5 bg-brand-dark text-white rounded-xl text-sm font-semibold hover:bg-brand-mid transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              <Check className="w-4 h-4" />
              {isEdit ? 'Save Changes' : 'Create Rule'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
