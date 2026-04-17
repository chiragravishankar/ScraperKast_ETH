'use client';

import { useState } from 'react';
import {
  GripVertical, Edit2, Copy, Trash2, ChevronDown, ChevronUp,
  BarChart2, AlertCircle, ArrowUp, ArrowDown,
} from 'lucide-react';
import { usePricingStore } from '@/lib/pricingStore';
import type { PricingRule } from '@/lib/pricingStore';
import { formatUsdcDollar, compactNumber, timeAgo } from '@/lib/formatters';

// ── Helpers ───────────────────────────────────────────────────────────────────

const LICENSE_BADGES: Record<string, string> = {
  summarization: 'bg-sky-100 text-sky-700',
  training:      'bg-violet-100 text-violet-700',
  full_access:   'bg-emerald-100 text-emerald-700',
  custom:        'bg-amber-100 text-amber-700',
};
const LICENSE_LABELS: Record<string, string> = {
  summarization: 'Summarization',
  training:      'Training',
  full_access:   'Full Access',
  custom:        'Custom',
};
const PATH_TYPE_LABELS: Record<string, string> = {
  all:    'All paths',
  exact:  'Exact:',
  prefix: 'Prefix:',
  regex:  'Regex:',
};
const BOT_TYPE_LABELS: Record<string, string> = {
  all:      'All bots',
  specific: 'Specific bots',
  group:    'Bot group',
};
const GROUP_NAMES: Record<string, string> = {
  'verified-ai':    'Verified AI Companies',
  'search-engines': 'Search Engines',
  'data-crawlers':  'Data Crawlers',
  'social-media':   'Social Media',
  'suspicious':     'Suspicious',
};

function priceColor(p: number): string {
  if (p === 0)     return 'text-emerald-600';
  if (p < 1000)    return 'text-sky-600';
  if (p < 3000)    return 'text-brand-dark';
  return 'text-violet-700';
}
function priceBg(p: number): string {
  if (p === 0)     return 'bg-emerald-50 border-emerald-200';
  if (p < 1000)    return 'bg-sky-50 border-sky-200';
  if (p < 3000)    return 'bg-brand-dark/5 border-brand-dark/20';
  return 'bg-violet-50 border-violet-200';
}

// ── Component ─────────────────────────────────────────────────────────────────

interface RuleCardProps {
  rule:      PricingRule;
  index:     number;
  total:     number;
  onEdit:    (rule: PricingRule) => void;
  onTest:    (rule: PricingRule) => void;
  isConflict?: boolean;
}

export default function RuleCard({ rule, index, total, onEdit, onTest, isConflict }: RuleCardProps) {
  const { updateRule, deleteRule, duplicateRule, reorderRules } = usePricingStore();
  const [expanded,       setExpanded]       = useState(false);
  const [confirmDelete,  setConfirmDelete]  = useState(false);

  const pathLabel = rule.pathMatch.type === 'all'
    ? 'All paths'
    : `${PATH_TYPE_LABELS[rule.pathMatch.type] ?? ''} ${rule.pathMatch.pattern}`;

  const botLabel = rule.botMatch.type === 'all'
    ? 'All bots'
    : rule.botMatch.type === 'group'
    ? rule.botMatch.groupIds.map(g => GROUP_NAMES[g] ?? g).join(', ')
    : `${rule.botMatch.botIds.length} bot${rule.botMatch.botIds.length !== 1 ? 's' : ''}`;

  return (
    <div className={`bg-white rounded-xl border transition-all ${
      !rule.enabled ? 'border-slate-200 opacity-60' :
      isConflict   ? 'border-amber-300 shadow-amber-50 shadow-md' :
                     'border-slate-200 hover:border-slate-300 hover:shadow-sm'
    }`}>
      {/* ── Main row ── */}
      <div className="flex items-center gap-3 px-4 py-3.5">

        {/* Move up/down (replaces drag handle for simplicity) */}
        <div className="flex flex-col gap-0.5 shrink-0">
          <button onClick={() => reorderRules(index, Math.max(0, index - 1))}
            disabled={index === 0}
            className="p-0.5 text-slate-300 hover:text-slate-600 disabled:opacity-20 transition-colors">
            <ArrowUp className="w-3 h-3" />
          </button>
          <GripVertical className="w-4 h-4 text-slate-200 mx-auto" />
          <button onClick={() => reorderRules(index, Math.min(total - 1, index + 1))}
            disabled={index === total - 1}
            className="p-0.5 text-slate-300 hover:text-slate-600 disabled:opacity-20 transition-colors">
            <ArrowDown className="w-3 h-3" />
          </button>
        </div>

        {/* Priority badge */}
        <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 text-xs font-bold flex items-center justify-center shrink-0">
          {index + 1}
        </span>

        {/* Main info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-slate-900 text-sm">{rule.name}</span>
            {isConflict && (
              <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
                <AlertCircle className="w-3 h-3" /> Conflict
              </span>
            )}
            {!rule.enabled && (
              <span className="text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">Disabled</span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-xs text-slate-400 font-mono truncate max-w-[180px]">{pathLabel}</span>
            <span className="text-slate-300 text-xs">·</span>
            <span className="text-xs text-slate-400">{botLabel}</span>
          </div>
        </div>

        {/* Price badge */}
        <div className={`shrink-0 rounded-lg border px-3 py-1.5 text-center min-w-[90px] ${priceBg(rule.pricePerPage)}`}>
          <p className={`text-sm font-bold tabular-nums ${priceColor(rule.pricePerPage)}`}>
            {rule.pricePerPage === 0 ? 'FREE' : formatUsdcDollar(rule.pricePerPage)}
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">{rule.pricePerPage > 0 ? `${rule.pricePerPage} µUSDC` : 'per page'}</p>
        </div>

        {/* License */}
        <span className={`hidden sm:block shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${LICENSE_BADGES[rule.licenseType]}`}>
          {LICENSE_LABELS[rule.licenseType]}
        </span>

        {/* Active toggle */}
        <button
          onClick={() => updateRule(rule.id, { enabled: !rule.enabled })}
          className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${rule.enabled ? 'bg-brand-dark' : 'bg-slate-200'}`}>
          <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${rule.enabled ? 'translate-x-4' : ''}`} />
        </button>

        {/* Action buttons */}
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => onTest(rule)} title="Test this rule"
            className="p-1.5 rounded-lg text-slate-400 hover:text-brand-dark hover:bg-slate-100 transition-colors">
            <BarChart2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => onEdit(rule)} title="Edit rule"
            className="p-1.5 rounded-lg text-slate-400 hover:text-brand-dark hover:bg-slate-100 transition-colors">
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => duplicateRule(rule.id)} title="Duplicate rule"
            className="p-1.5 rounded-lg text-slate-400 hover:text-brand-dark hover:bg-slate-100 transition-colors">
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setConfirmDelete(true)} title="Delete rule"
            className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setExpanded(v => !v)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* ── Expanded details ── */}
      {expanded && (
        <div className="border-t border-slate-100 px-5 py-4 grid grid-cols-1 sm:grid-cols-3 gap-5 bg-slate-50/50">

          {/* Rule details */}
          <div className="space-y-2 text-sm">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Rule Details</p>
            <div className="space-y-1.5">
              <div className="flex gap-2"><span className="text-slate-400 w-24 shrink-0">Path match</span><span className="font-mono text-slate-700 text-xs break-all">{pathLabel}</span></div>
              <div className="flex gap-2"><span className="text-slate-400 w-24 shrink-0">Bot match</span><span className="text-slate-700 text-xs">{botLabel}</span></div>
              <div className="flex gap-2"><span className="text-slate-400 w-24 shrink-0">License</span><span className="text-slate-700 text-xs">{LICENSE_LABELS[rule.licenseType]}</span></div>
              {rule.freeTierOverride.enabled && (
                <div className="flex gap-2"><span className="text-slate-400 w-24 shrink-0">Free tier</span><span className="text-slate-700 text-xs">{rule.freeTierOverride.limit} req/day</span></div>
              )}
              {rule.validFrom && (
                <div className="flex gap-2"><span className="text-slate-400 w-24 shrink-0">Valid from</span><span className="text-slate-700 text-xs">{rule.validFrom}</span></div>
              )}
              {rule.validUntil && (
                <div className="flex gap-2"><span className="text-slate-400 w-24 shrink-0">Valid until</span><span className="text-slate-700 text-xs">{rule.validUntil}</span></div>
              )}
            </div>
          </div>

          {/* Analytics */}
          <div className="space-y-2 text-sm">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Last 7 Days</p>
            <div className="space-y-1.5">
              <div className="flex gap-2"><span className="text-slate-400 w-24 shrink-0">Requests</span><span className="font-semibold text-slate-700">{compactNumber(rule.req7d)}</span></div>
              <div className="flex gap-2"><span className="text-slate-400 w-24 shrink-0">Revenue</span><span className={`font-semibold ${rule.rev7d > 0 ? 'text-brand-dark' : 'text-slate-400'}`}>{rule.rev7d > 0 ? formatUsdcDollar(rule.rev7d) : '—'}</span></div>
            </div>
            {/* Mini bar */}
            {rule.req7d > 0 && (
              <div className="flex items-end gap-0.5 h-6 mt-1">
                {Array.from({ length: 7 }, (_, i) => {
                  const h = Math.max(15, Math.round(60 + Math.sin(i * 1.5 + rule.priority) * 35));
                  return <div key={i} className="flex-1 bg-brand-dark/20 rounded-sm" style={{ height: `${h}%` }} />;
                })}
              </div>
            )}
          </div>

          {/* Meta */}
          <div className="space-y-2 text-sm">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Meta</p>
            <div className="space-y-1.5">
              <div className="flex gap-2"><span className="text-slate-400 w-24 shrink-0">Priority</span><span className="text-slate-700">{rule.priority}</span></div>
              <div className="flex gap-2"><span className="text-slate-400 w-24 shrink-0">Updated</span><span className="text-slate-700 text-xs">{timeAgo(new Date(rule.updatedAt))}</span></div>
              {rule.notes && <p className="text-xs text-slate-500 italic mt-1">{rule.notes}</p>}
            </div>
            {rule.description && <p className="text-xs text-slate-500 bg-slate-100 rounded-lg px-3 py-2 mt-1">{rule.description}</p>}
          </div>
        </div>
      )}

      {/* ── Delete confirmation ── */}
      {confirmDelete && (
        <div className="border-t border-red-100 px-5 py-3 bg-red-50 flex items-center gap-3">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
          <span className="text-sm text-red-700 flex-1">Delete &ldquo;{rule.name}&rdquo;? This cannot be undone.</span>
          <button onClick={() => { deleteRule(rule.id); setConfirmDelete(false); }}
            className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-sm font-semibold hover:bg-red-600 transition-colors">
            Delete
          </button>
          <button onClick={() => setConfirmDelete(false)}
            className="px-3 py-1.5 border border-red-200 text-red-600 rounded-lg text-sm font-semibold hover:bg-red-100 transition-colors">
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
