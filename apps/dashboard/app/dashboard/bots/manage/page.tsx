'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Search, Filter, ChevronUp, ChevronDown, Edit2, Shield, Users,
  CheckSquare, Square, MoreHorizontal, Download, RefreshCw, Lightbulb,
  X,
} from 'lucide-react';
import { useBotStore, ALL_BOTS } from '@/lib/botStore';
import type { BotDef, BotStatus } from '@/lib/botStore';
import { formatUsdcDollar, compactNumber, timeAgo } from '@/lib/formatters';
import BotDetailModal from '@/components/BotDetailModal';
import BotQuickEdit from '@/components/BotQuickEdit';

// ── Constants ─────────────────────────────────────────────────────────────────

const TYPE_COLORS: Record<string, string> = {
  ai_training:  'bg-violet-100 text-violet-700',
  ai_inference: 'bg-sky-100 text-sky-700',
  search:       'bg-amber-100 text-amber-700',
  crawler:      'bg-slate-100 text-ink-2',
};
const TYPE_LABELS: Record<string, string> = {
  ai_training: 'AI Training', ai_inference: 'AI Inference', search: 'Search', crawler: 'Crawler',
};
const STATUS_BADGE: Record<BotStatus, string> = {
  allowed: 'bg-emerald-100 text-emerald-700',
  blocked: 'bg-red-100 text-red-600',
  pending: 'bg-amber-100 text-amber-700',
};
const ACCESS_BADGE: Record<string, string> = {
  default: 'text-ink-2',
  free:    'text-emerald-600',
  custom:  'text-brand-dark font-semibold',
};
const ACCESS_LABEL: Record<string, string> = {
  default: 'Default', free: 'Free', custom: 'Custom',
};
const CONFIDENCE_DOT: Record<string, string> = {
  high: 'bg-emerald-500', medium: 'bg-amber-400', low: 'bg-red-400',
};

type SortKey = 'name' | 'status' | 'req7d' | 'rev7d' | 'lastSeen';
type StatusFilter = 'all' | BotStatus;
type TierFilter   = 'all' | 'free' | 'paid' | 'custom';

function lastSeenDate(daysAgo: number) { return new Date(Date.now() - daysAgo * 86_400_000); }

// ── Recommendations ───────────────────────────────────────────────────────────

function Recommendations({ bots }: { bots: BotDef[] }) {
  const { getConfig, updateConfig } = useBotStore();
  const [dismissed, setDismissed] = useState<string[]>([]);

  const recs = useMemo(() => {
    const list: { id: string; botId: string; msg: string; action: string; apply: () => void }[] = [];
    for (const b of bots) {
      const cfg = getConfig(b.id);
      if (b.rev7d > 500_000 && cfg.accessLevel === 'default') {
        list.push({ id:`custom-${b.id}`, botId: b.id, msg:`${b.name} earned ${formatUsdcDollar(b.rev7d)} last week — set custom pricing.`, action:'Set Custom', apply: () => updateConfig(b.id, { accessLevel: 'custom' }) });
      }
      if (b.req7d > 1000 && b.rev7d === 0 && cfg.status === 'allowed') {
        list.push({ id:`price-${b.id}`, botId: b.id, msg:`${b.name} made ${compactNumber(b.req7d)} requests last week but paid nothing.`, action:'Set Paid', apply: () => updateConfig(b.id, { accessLevel: 'default' }) });
      }
      if (b.successRate < 0.7 && !cfg.rateLimit.enabled) {
        list.push({ id:`ratelimit-${b.id}`, botId: b.id, msg:`${b.name} has a ${(b.successRate*100).toFixed(0)}% success rate — consider rate limiting.`, action:'Enable Limit', apply: () => updateConfig(b.id, { rateLimit: { ...getConfig(b.id).rateLimit, enabled: true } }) });
      }
    }
    return list.filter(r => !dismissed.includes(r.id)).slice(0, 3);
  }, [bots, getConfig, updateConfig, dismissed]);

  if (recs.length === 0) return null;

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
      <p className="text-xs font-semibold text-amber-800 flex items-center gap-1.5">
        <Lightbulb className="w-3.5 h-3.5" /> Smart Recommendations
      </p>
      {recs.map(r => (
        <div key={r.id} className="flex items-center gap-3 text-sm">
          <span className="flex-1 text-amber-800">{r.msg}</span>
          <button onClick={() => { r.apply(); setDismissed(d => [...d, r.id]); }}
            className="shrink-0 text-xs font-semibold text-amber-800 border border-amber-300 hover:bg-amber-100 px-2.5 py-1 rounded-lg transition-colors">
            {r.action}
          </button>
          <button onClick={() => setDismissed(d => [...d, r.id])} className="text-amber-400 hover:text-amber-600 shrink-0">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function BotManagePage() {
  const { configs, getConfig, setStatus, setBulkStatus, setGlobalPolicy, globalPolicy, exportConfigs } = useBotStore();

  // UI state
  const [query,        setQuery]        = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [tierFilter,   setTierFilter]   = useState<TierFilter>('all');
  const [sortKey,      setSortKey]      = useState<SortKey>('rev7d');
  const [sortAsc,      setSortAsc]      = useState(false);
  const [page,         setPage]         = useState(1);
  const [selected,     setSelected]     = useState<Set<string>>(new Set());
  const [expandedEdit, setExpandedEdit] = useState<string | null>(null);
  const [detailBot,    setDetailBot]    = useState<BotDef | null>(null);
  const [bulkMenu,     setBulkMenu]     = useState(false);
  const [confirmBlock, setConfirmBlock] = useState<string | null>(null);
  const [toast,        setToast]        = useState<{ msg: string; undo?: () => void } | null>(null);
  const [policyDraft,  setPolicyDraft]  = useState(globalPolicy.defaultAction);
  const [policySaved,  setPolicySaved]  = useState(false);

  const PER_PAGE = 20;

  // Derived / filtered list
  const displayed = useMemo(() => {
    let list = ALL_BOTS.filter(b => {
      const cfg = getConfig(b.id);
      const qMatch = !query || b.name.toLowerCase().includes(query.toLowerCase()) || b.company.toLowerCase().includes(query.toLowerCase());
      const sMatch = statusFilter === 'all' || cfg.status === statusFilter;
      const tMatch = tierFilter === 'all'
        || (tierFilter === 'free'   && cfg.accessLevel === 'free')
        || (tierFilter === 'paid'   && b.rev7d > 0 && cfg.accessLevel !== 'free')
        || (tierFilter === 'custom' && cfg.accessLevel === 'custom');
      return qMatch && sMatch && tMatch;
    });

    list.sort((a, b) => {
      let va: string | number, vb: string | number;
      switch (sortKey) {
        case 'name':    va = a.name;           vb = b.name;           break;
        case 'status':  va = getConfig(a.id).status; vb = getConfig(b.id).status; break;
        case 'req7d':   va = a.req7d;          vb = b.req7d;          break;
        case 'rev7d':   va = a.rev7d;          vb = b.rev7d;          break;
        case 'lastSeen':va = a.daysAgoSeen;    vb = b.daysAgoSeen;    break;
        default:        va = 0; vb = 0;
      }
      if (va < vb) return sortAsc ? -1 : 1;
      if (va > vb) return sortAsc ?  1 : -1;
      return 0;
    });

    return list;
  }, [query, statusFilter, tierFilter, sortKey, sortAsc, getConfig, configs]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalPages  = Math.ceil(displayed.length / PER_PAGE);
  const pageSlice   = displayed.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  // Stats
  const totalBots   = ALL_BOTS.length;
  const activeBots  = ALL_BOTS.filter(b => b.daysAgoSeen === 0).length;
  const allowedBots = ALL_BOTS.filter(b => getConfig(b.id).status === 'allowed').length;
  const blockedBots = ALL_BOTS.filter(b => getConfig(b.id).status === 'blocked').length;

  // Sort header helper
  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <ChevronDown className="w-3 h-3 text-edge" />;
    return sortAsc ? <ChevronUp className="w-3 h-3 text-brand-dark" /> : <ChevronDown className="w-3 h-3 text-brand-dark" />;
  }
  function handleSort(k: SortKey) {
    if (sortKey === k) setSortAsc(v => !v);
    else { setSortKey(k); setSortAsc(false); }
  }

  // Selection
  const allOnPageSelected = pageSlice.every(b => selected.has(b.id));
  function toggleSelectAll() {
    if (allOnPageSelected) {
      const next = new Set(selected);
      pageSlice.forEach(b => next.delete(b.id));
      setSelected(next);
    } else {
      const next = new Set(selected);
      pageSlice.forEach(b => next.add(b.id));
      setSelected(next);
    }
  }
  function toggleSelect(id: string) {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  }

  // Block with confirmation + undo toast
  function requestBlock(id: string) { setConfirmBlock(id); }
  function confirmBlockBot() {
    if (!confirmBlock) return;
    const prev = getConfig(confirmBlock).status;
    setStatus(confirmBlock, 'blocked');
    setConfirmBlock(null);
    const undoId = confirmBlock;
    showToast(`${ALL_BOTS.find(b => b.id === undoId)?.name} blocked.`, () => setStatus(undoId, prev));
  }

  function showToast(msg: string, undo?: () => void) {
    setToast({ msg, undo });
    setTimeout(() => setToast(null), 5_000);
  }

  function handleBulkAction(action: 'allow' | 'block') {
    const ids = Array.from(selected);
    const prevStatuses = Object.fromEntries(ids.map(id => [id, getConfig(id).status]));
    setBulkStatus(ids, action === 'allow' ? 'allowed' : 'blocked');
    setSelected(new Set());
    setBulkMenu(false);
    showToast(`${ids.length} bots ${action}ed.`, () => {
      ids.forEach(id => setStatus(id, prevStatuses[id]!));
    });
  }

  function handleExport() {
    const blob = new Blob([exportConfigs()], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'bot-configs.json'; a.click();
    URL.revokeObjectURL(url);
  }

  function savePolicy() {
    setGlobalPolicy({ defaultAction: policyDraft });
    setPolicySaved(true);
    setTimeout(() => setPolicySaved(false), 2_000);
  }

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-ink">Bot Management</h1>
          <p className="text-sm text-ink-2 mt-0.5">
            Configure access, pricing, and rate limits per bot
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/dashboard/bots/groups"
            className="flex items-center gap-1.5 text-sm font-medium border border-edge rounded-lg px-3 py-2 text-ink-2 hover:bg-canvas transition-colors">
            <Users className="w-4 h-4" /> Groups
          </Link>
          <Link href="/dashboard/bots/whitelist"
            className="flex items-center gap-1.5 text-sm font-medium border border-edge rounded-lg px-3 py-2 text-ink-2 hover:bg-canvas transition-colors">
            <Shield className="w-4 h-4" /> Lists
          </Link>
          <button onClick={handleExport}
            className="flex items-center gap-1.5 text-sm font-medium border border-edge rounded-lg px-3 py-2 text-ink-2 hover:bg-canvas transition-colors">
            <Download className="w-4 h-4" /> Export
          </button>
        </div>
      </div>

      {/* ── Stats ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label:'Total Bots',    value: totalBots,   color:'text-ink' },
          { label:'Active (24h)',  value: activeBots,  color:'text-brand-dark' },
          { label:'Allowed',       value: allowedBots, color:'text-emerald-600' },
          { label:'Blocked',       value: blockedBots, color:'text-red-500'  },
        ].map(s => (
          <div key={s.label} className="card p-4 hover:shadow-md transition-shadow">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-2">{s.label}</p>
            <p className={`text-3xl font-bold tabular-nums mt-2 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* ── Recommendations ──────────────────────────────────────────────── */}
      <Recommendations bots={ALL_BOTS} />

      {/* ── Global Policy ────────────────────────────────────────────────── */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-ink mb-4 flex items-center gap-2">
          <Filter className="w-4 h-4 text-ink-3" /> Global Bot Policy
        </h2>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="space-y-2">
            <p className="text-xs text-ink-2">Default action for newly detected bots:</p>
            <div className="flex gap-3">
              {[
                { val:'allow',   label:'Auto-allow',      colors: 'border-emerald-500 bg-emerald-50 text-emerald-700' },
                { val:'pending', label:'Require Approval', colors: 'border-amber-500 bg-amber-50 text-amber-700' },
                { val:'block',   label:'Auto-block',       colors: 'border-red-500 bg-red-50 text-red-600' },
              ].map(opt => (
                <label key={opt.val}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 cursor-pointer text-sm font-medium transition-all ${policyDraft === opt.val ? opt.colors : 'border-edge text-ink-2 hover:border-slate-300'}`}>
                  <input type="radio" className="sr-only" checked={policyDraft === opt.val} onChange={() => setPolicyDraft(opt.val as typeof policyDraft)} />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>
          <button onClick={savePolicy}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${policySaved ? 'bg-emerald-600 text-white' : 'bg-brand-dark text-white hover:bg-brand-mid'}`}>
            {policySaved ? '✓ Saved' : 'Save Policy'}
          </button>
        </div>
      </div>

      {/* ── Filters + Search ─────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-3" />
          <input
            type="text"
            placeholder="Search bots by name or company…"
            value={query}
            onChange={e => { setQuery(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-edge bg-white text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand-dark/30 focus:border-brand-dark"
          />
        </div>

        {/* Status filter */}
        <div className="flex rounded-xl border border-edge bg-white overflow-hidden text-sm">
          {(['all','allowed','blocked','pending'] as const).map(s => (
            <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
              className={`px-3 py-2.5 font-medium capitalize transition-colors ${statusFilter === s ? 'bg-brand-dark text-white' : 'text-ink-2 hover:bg-canvas'}`}>
              {s === 'all' ? 'All' : s}
            </button>
          ))}
        </div>

        {/* Tier filter */}
        <div className="flex rounded-xl border border-edge bg-white overflow-hidden text-sm">
          {(['all','free','paid','custom'] as const).map(t => (
            <button key={t} onClick={() => { setTierFilter(t); setPage(1); }}
              className={`px-3 py-2.5 font-medium capitalize transition-colors ${tierFilter === t ? 'bg-brand-dark text-white' : 'text-ink-2 hover:bg-canvas'}`}>
              {t === 'all' ? 'All Tiers' : t}
            </button>
          ))}
        </div>
      </div>

      {/* ── Bulk action bar ───────────────────────────────────────────────── */}
      {selected.size > 0 && (
        <div className="bg-brand-dark text-white rounded-xl px-4 py-3 flex items-center gap-3 flex-wrap">
          <span className="font-semibold text-sm">{selected.size} bot{selected.size > 1 ? 's' : ''} selected</span>
          <div className="flex gap-2 ml-auto">
            <button onClick={() => handleBulkAction('allow')}
              className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold transition-colors">
              Allow All
            </button>
            <button onClick={() => handleBulkAction('block')}
              className="px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-colors">
              Block All
            </button>
            <div className="relative">
              <button onClick={() => setBulkMenu(v => !v)}
                className="px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-sm font-semibold transition-colors flex items-center gap-1">
                More <MoreHorizontal className="w-3.5 h-3.5" />
              </button>
              {bulkMenu && (
                <div className="absolute right-0 top-9 bg-white rounded-xl shadow-xl border border-edge-2 py-1 w-44 z-10 text-ink">
                  <button className="w-full text-left px-4 py-2 text-sm hover:bg-canvas">Apply Free Tier</button>
                  <button className="w-full text-left px-4 py-2 text-sm hover:bg-canvas">Apply Custom Pricing</button>
                  <button className="w-full text-left px-4 py-2 text-sm hover:bg-canvas">Export Selected</button>
                </div>
              )}
            </div>
            <button onClick={() => setSelected(new Set())}
              className="px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-sm font-semibold transition-colors">
              Clear
            </button>
          </div>
        </div>
      )}

      {/* ── Table ────────────────────────────────────────────────────────── */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-edge-2 bg-canvas text-left">
                <th className="px-4 py-3 w-10">
                  <button onClick={toggleSelectAll} className="text-ink-3 hover:text-brand-dark">
                    {allOnPageSelected ? <CheckSquare className="w-4 h-4 text-brand-dark" /> : <Square className="w-4 h-4" />}
                  </button>
                </th>
                <th className="px-4 py-3">
                  <button onClick={() => handleSort('name')} className="flex items-center gap-1 font-medium text-ink-2 text-xs uppercase tracking-wide hover:text-slate-800">
                    Bot <SortIcon k="name" />
                  </button>
                </th>
                <th className="px-4 py-3">
                  <button onClick={() => handleSort('status')} className="flex items-center gap-1 font-medium text-ink-2 text-xs uppercase tracking-wide hover:text-slate-800">
                    Status <SortIcon k="status" />
                  </button>
                </th>
                <th className="px-4 py-3 font-medium text-ink-2 text-xs uppercase tracking-wide">Level</th>
                <th className="px-4 py-3">
                  <button onClick={() => handleSort('req7d')} className="flex items-center gap-1 font-medium text-ink-2 text-xs uppercase tracking-wide hover:text-slate-800">
                    Reqs 7d <SortIcon k="req7d" />
                  </button>
                </th>
                <th className="px-4 py-3">
                  <button onClick={() => handleSort('rev7d')} className="flex items-center gap-1 font-medium text-ink-2 text-xs uppercase tracking-wide hover:text-slate-800">
                    Rev 7d <SortIcon k="rev7d" />
                  </button>
                </th>
                <th className="px-4 py-3">
                  <button onClick={() => handleSort('lastSeen')} className="flex items-center gap-1 font-medium text-ink-2 text-xs uppercase tracking-wide hover:text-slate-800">
                    Last Seen <SortIcon k="lastSeen" />
                  </button>
                </th>
                <th className="px-4 py-3 font-medium text-ink-2 text-xs uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageSlice.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-ink-3">
                    <RefreshCw className="w-6 h-6 mx-auto mb-2 opacity-30" />
                    No bots match your filters
                  </td>
                </tr>
              ) : pageSlice.map(bot => {
                const cfg = getConfig(bot.id);
                const isExpanded = expandedEdit === bot.id;

                return [
                  <tr key={bot.id}
                    className={`border-b border-slate-50 transition-colors hover:bg-canvas/60 cursor-pointer ${isExpanded ? 'bg-canvas' : ''}`}
                    onClick={() => setDetailBot(bot)}>

                    {/* Checkbox */}
                    <td className="px-4 py-3.5" onClick={e => e.stopPropagation()}>
                      <button onClick={() => toggleSelect(bot.id)} className="text-edge hover:text-brand-dark">
                        {selected.has(bot.id) ? <CheckSquare className="w-4 h-4 text-brand-dark" /> : <Square className="w-4 h-4" />}
                      </button>
                    </td>

                    {/* Bot name */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${TYPE_COLORS[bot.type] ?? 'bg-slate-100 text-ink-2'}`}>
                          {bot.name[0]}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-ink">{bot.name}</span>
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${CONFIDENCE_DOT[bot.confidence]}`} title={`${bot.confidence} confidence`} />
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-xs text-ink-3">{bot.company}</span>
                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${TYPE_COLORS[bot.type]}`}>
                              {TYPE_LABELS[bot.type]}
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3.5" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${STATUS_BADGE[cfg.status]}`}>
                          {cfg.status}
                        </span>
                        {/* Quick toggle allowed ↔ blocked */}
                        <button
                          onClick={() => {
                            if (cfg.status === 'blocked') { setStatus(bot.id, 'allowed'); showToast(`${bot.name} allowed.`, () => setStatus(bot.id, 'blocked')); }
                            else requestBlock(bot.id);
                          }}
                          className="text-edge hover:text-ink-2 transition-colors"
                          title={cfg.status === 'blocked' ? 'Allow' : 'Block'}>
                          <Shield className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>

                    {/* Access level */}
                    <td className="px-4 py-3.5">
                      <span className={`text-sm ${ACCESS_BADGE[cfg.accessLevel]}`}>
                        {ACCESS_LABEL[cfg.accessLevel]}
                        {cfg.accessLevel === 'custom' && (
                          <span className="ml-1 font-mono text-xs text-ink-2">
                            ({formatUsdcDollar(cfg.customPricing.pricePerPage)})
                          </span>
                        )}
                      </span>
                    </td>

                    {/* Requests 7d */}
                    <td className="px-4 py-3.5 font-mono text-ink">{compactNumber(bot.req7d)}</td>

                    {/* Revenue 7d */}
                    <td className="px-4 py-3.5 font-mono font-semibold">
                      <span className={bot.rev7d > 0 ? 'text-brand-dark' : 'text-edge'}>
                        {bot.rev7d > 0 ? formatUsdcDollar(bot.rev7d) : '—'}
                      </span>
                    </td>

                    {/* Last seen */}
                    <td className="px-4 py-3.5 text-xs text-ink-3">
                      {timeAgo(lastSeenDate(bot.daysAgoSeen))}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3.5" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setExpandedEdit(isExpanded ? null : bot.id)}
                          className={`p-1.5 rounded-lg transition-colors ${isExpanded ? 'bg-brand-dark text-white' : 'text-ink-3 hover:text-brand-dark hover:bg-slate-100'}`}
                          title="Quick edit">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>,

                  // Inline quick edit row
                  isExpanded && (
                    <BotQuickEdit key={`qe-${bot.id}`} bot={bot} onClose={() => setExpandedEdit(null)} />
                  ),
                ];
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-edge-2 flex items-center justify-between text-sm">
            <span className="text-ink-3">{displayed.length} bots · page {page} of {totalPages}</span>
            <div className="flex gap-1">
              <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1}
                className="px-3 py-1.5 rounded-lg border border-edge text-ink-2 hover:bg-canvas disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                ← Prev
              </button>
              <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page === totalPages}
                className="px-3 py-1.5 rounded-lg border border-edge text-ink-2 hover:bg-canvas disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                Next →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Modals ───────────────────────────────────────────────────────── */}

      {/* Bot detail modal */}
      {detailBot && <BotDetailModal bot={detailBot} onClose={() => setDetailBot(null)} />}

      {/* Confirm block modal */}
      {confirmBlock && (() => {
        const bot = ALL_BOTS.find(b => b.id === confirmBlock);
        return bot ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
              <h3 className="font-bold text-ink text-base">Block {bot.name}?</h3>
              <p className="text-sm text-ink-2">
                All requests from <strong>{bot.name}</strong> ({bot.company}) will receive a 403 response.
                This affects ~<strong>{compactNumber(bot.req7d)}</strong> requests per week.
              </p>
              <div className="flex gap-2 pt-2">
                <button onClick={() => setConfirmBlock(null)}
                  className="flex-1 py-2 border border-edge rounded-xl text-ink-2 font-semibold hover:bg-canvas transition-colors text-sm">
                  Cancel
                </button>
                <button onClick={confirmBlockBot}
                  className="flex-1 py-2 bg-red-500 text-white rounded-xl font-semibold hover:bg-red-600 transition-colors text-sm">
                  Block Bot
                </button>
              </div>
            </div>
          </div>
        ) : null;
      })()}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-slate-900 text-white rounded-xl px-5 py-3 shadow-2xl text-sm">
          <span>{toast.msg}</span>
          {toast.undo && (
            <button onClick={() => { toast.undo?.(); setToast(null); }}
              className="font-semibold text-brand-light hover:underline">
              Undo
            </button>
          )}
          <button onClick={() => setToast(null)} className="text-white/50 hover:text-white ml-1">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
