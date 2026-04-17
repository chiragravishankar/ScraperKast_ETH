'use client';

import { useState } from 'react';
import {
  X, ExternalLink, Shield, Zap, Clock, Activity,
  BarChart2, Lock, Unlock, Settings2, History, AlertCircle, Check,
} from 'lucide-react';
import { useBotStore } from '@/lib/botStore';
import type { BotDef, BotStatus, AccessLevel } from '@/lib/botStore';
import { formatUsdcDollar, compactNumber, timeAgo } from '@/lib/formatters';

// ── Helpers ───────────────────────────────────────────────────────────────────

const TYPE_COLORS: Record<string, string> = {
  ai_training:  'bg-violet-100 text-violet-700',
  ai_inference: 'bg-sky-100 text-sky-700',
  search:       'bg-amber-100 text-amber-700',
  crawler:      'bg-slate-100 text-ink-2',
};
const TYPE_LABELS: Record<string, string> = {
  ai_training:  'AI Training',
  ai_inference: 'AI Inference',
  search:       'Search Engine',
  crawler:      'Crawler',
};
const CONFIDENCE_COLORS: Record<string, string> = {
  high:   'bg-emerald-100 text-emerald-700',
  medium: 'bg-amber-100 text-amber-700',
  low:    'bg-red-100 text-red-600',
};

function lastSeenDate(daysAgo: number): Date {
  return new Date(Date.now() - daysAgo * 86_400_000);
}
function firstSeenDate(daysAgo: number): Date {
  return new Date(Date.now() - daysAgo * 86_400_000);
}

// ── Sub-tab components ────────────────────────────────────────────────────────

function OverviewTab({ bot }: { bot: BotDef }) {
  const stats = [
    { label: 'Total Requests',  value: compactNumber(bot.totalReqs)       },
    { label: 'Revenue (7d)',    value: formatUsdcDollar(bot.rev7d)        },
    { label: 'Requests (7d)',   value: compactNumber(bot.req7d)           },
    { label: 'Success Rate',    value: `${(bot.successRate * 100).toFixed(1)}%` },
  ];
  return (
    <div className="space-y-5">
      {/* Mini stat grid */}
      <div className="grid grid-cols-2 gap-3">
        {stats.map(s => (
          <div key={s.label} className="bg-canvas rounded-xl px-4 py-3">
            <p className="text-xs text-ink-2 font-medium">{s.label}</p>
            <p className="text-lg font-bold text-ink tabular-nums mt-0.5">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Details */}
      <div className="space-y-2.5 text-sm">
        <div className="flex items-start gap-3 py-2.5 border-b border-edge-2">
          <span className="text-ink-3 w-28 shrink-0">Company</span>
          <span className="font-medium text-slate-800">{bot.company}</span>
        </div>
        <div className="flex items-start gap-3 py-2.5 border-b border-edge-2">
          <span className="text-ink-3 w-28 shrink-0">Type</span>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${TYPE_COLORS[bot.type]}`}>
            {TYPE_LABELS[bot.type]}
          </span>
        </div>
        <div className="flex items-start gap-3 py-2.5 border-b border-edge-2">
          <span className="text-ink-3 w-28 shrink-0">Confidence</span>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${CONFIDENCE_COLORS[bot.confidence]}`}>
            {bot.confidence}
          </span>
        </div>
        <div className="flex items-start gap-3 py-2.5 border-b border-edge-2">
          <span className="text-ink-3 w-28 shrink-0 mt-0.5">User-Agent</span>
          <span className="font-mono text-xs text-ink-2 break-all">{bot.userAgent}</span>
        </div>
        <div className="flex items-start gap-3 py-2.5 border-b border-edge-2">
          <span className="text-ink-3 w-28 shrink-0">First Seen</span>
          <span className="text-ink">{firstSeenDate(bot.daysAgoFirst).toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' })}</span>
        </div>
        <div className="flex items-start gap-3 py-2.5 border-b border-edge-2">
          <span className="text-ink-3 w-28 shrink-0">Last Seen</span>
          <span className="text-ink">{timeAgo(lastSeenDate(bot.daysAgoSeen))}</span>
        </div>
        {bot.docUrl && (
          <div className="flex items-start gap-3 py-2.5">
            <span className="text-ink-3 w-28 shrink-0">Docs</span>
            <a href={bot.docUrl} target="_blank" rel="noopener noreferrer"
               className="text-brand-dark hover:underline inline-flex items-center gap-1 text-sm">
              Official documentation <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}
      </div>

      {/* Bar chart placeholder — activity last 7 days */}
      <div className="bg-canvas rounded-xl p-4">
        <p className="text-xs font-semibold text-ink-2 mb-3 flex items-center gap-1.5">
          <BarChart2 className="w-3.5 h-3.5" /> Requests last 7 days
        </p>
        <div className="flex items-end gap-1.5 h-14">
          {Array.from({ length: 7 }, (_, i) => {
            const h = Math.max(10, Math.round(((bot.req7d / 7) * (0.5 + Math.sin(i * 1.3 + bot.id.length) * 0.4)) / bot.req7d * 100));
            return (
              <div key={i} className="flex-1 bg-brand-dark/20 hover:bg-brand-dark/40 rounded transition-colors" style={{ height: `${h}%` }} />
            );
          })}
        </div>
        <div className="flex justify-between mt-1.5 text-[10px] text-ink-3">
          {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => <span key={d}>{d}</span>)}
        </div>
      </div>
    </div>
  );
}

function AccessTab({ bot }: { bot: BotDef }) {
  const { getConfig, updateConfig } = useBotStore();
  const cfg = getConfig(bot.id);

  const [status,      setStatusLocal]      = useState<BotStatus>(cfg.status);
  const [accessLevel, setAccessLevelLocal] = useState<AccessLevel>(cfg.accessLevel);
  const [ppp,         setPpp]              = useState(cfg.customPricing.pricePerPage / 1_000_000);
  const [freeLimit,   setFreeLimit]        = useState(cfg.customPricing.freeTierLimit);
  const [feePct,      setFeePct]           = useState(cfg.customPricing.feePercent);
  const [saved, setSaved] = useState(false);

  function save() {
    updateConfig(bot.id, {
      status, accessLevel,
      customPricing: {
        pricePerPage:  Math.round(ppp * 1_000_000),
        freeTierLimit: freeLimit,
        feePercent:    feePct,
      },
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2_000);
  }

  return (
    <div className="space-y-5">
      {/* Status toggle */}
      <div className="bg-canvas rounded-xl p-4 space-y-3">
        <p className="text-xs font-semibold text-ink-2 uppercase tracking-wide">Access Status</p>
        <div className="flex gap-2">
          {(['allowed','blocked','pending'] as BotStatus[]).map(s => {
            const colors = s === 'allowed'
              ? 'bg-emerald-600 text-white border-emerald-600'
              : s === 'blocked'
              ? 'bg-red-500 text-white border-red-500'
              : 'bg-amber-500 text-white border-amber-500';
            return (
              <button key={s} onClick={() => setStatusLocal(s)}
                className={`flex-1 py-2 rounded-lg border text-sm font-semibold capitalize transition-all ${status === s ? colors : 'border-edge text-ink-2 hover:bg-slate-100'}`}>
                {s}
              </button>
            );
          })}
        </div>
        {status === 'blocked' && (
          <p className="text-xs text-red-600 flex items-center gap-1.5 bg-red-50 rounded-lg px-3 py-2">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            This bot will receive 403 responses on all requests.
          </p>
        )}
      </div>

      {/* Access level */}
      <div className="space-y-3">
        <p className="text-xs font-semibold text-ink-2 uppercase tracking-wide">Access Level</p>
        {[
          { val:'default', label:'Default Pricing',  desc:'Uses site-wide rules and pricing.'            },
          { val:'free',    label:'Always Free',       desc:'Whitelist — never charged, always served.'    },
          { val:'custom',  label:'Custom Pricing',    desc:'Override price per page and fee percentage.'  },
        ].map(opt => (
          <label key={opt.val}
            className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${accessLevel === opt.val ? 'border-brand-dark bg-brand-dark/5' : 'border-edge hover:border-slate-300'}`}>
            <input type="radio" className="mt-0.5 accent-brand-dark shrink-0"
              checked={accessLevel === opt.val} onChange={() => setAccessLevelLocal(opt.val as AccessLevel)} />
            <div>
              <p className="text-sm font-semibold text-slate-800">{opt.label}</p>
              <p className="text-xs text-ink-2 mt-0.5">{opt.desc}</p>
            </div>
          </label>
        ))}
      </div>

      {/* Custom pricing fields */}
      {accessLevel === 'custom' && (
        <div className="space-y-3 bg-canvas rounded-xl p-4">
          <p className="text-xs font-semibold text-ink-2 uppercase tracking-wide">Custom Pricing</p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-ink-2">Price/Page (USDC)</label>
              <div className="relative mt-1">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3 text-xs">$</span>
                <input type="number" min="0" step="0.0001" value={ppp}
                  onChange={e => setPpp(parseFloat(e.target.value)||0)}
                  className="w-full pl-5 pr-2 py-2 rounded-lg border border-edge text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-dark/30 focus:border-brand-dark" />
              </div>
            </div>
            <div>
              <label className="text-xs text-ink-2">Free Tier Limit/day</label>
              <input type="number" min="0" value={freeLimit}
                onChange={e => setFreeLimit(parseInt(e.target.value)||0)}
                className="mt-1 w-full px-2 py-2 rounded-lg border border-edge text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-dark/30 focus:border-brand-dark" />
            </div>
            <div>
              <label className="text-xs text-ink-2">Fee % (Platform)</label>
              <div className="relative mt-1">
                <input type="number" min="0" max="100" value={feePct}
                  onChange={e => setFeePct(parseInt(e.target.value)||0)}
                  className="w-full pr-5 px-2 py-2 rounded-lg border border-edge text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-dark/30 focus:border-brand-dark" />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-3 text-xs">%</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <button onClick={save}
        className={`w-full py-2.5 rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2 ${saved ? 'bg-emerald-600 text-white' : 'bg-brand-dark text-white hover:bg-brand-mid'}`}>
        {saved ? <><Check className="w-4 h-4" /> Saved!</> : 'Save Access Settings'}
      </button>
    </div>
  );
}

function RateLimitTab({ bot }: { bot: BotDef }) {
  const { getConfig, updateConfig } = useBotStore();
  const cfg = getConfig(bot.id);
  const rl = cfg.rateLimit;

  const [enabled, setEnabled]   = useState(rl.enabled);
  const [perHour, setPerHour]   = useState(rl.perHour);
  const [perDay,  setPerDay]    = useState(rl.perDay);
  const [action,  setAction]    = useState<'block'|'throttle'|'log'>(rl.action);
  const [saved, setSaved] = useState(false);

  function save() {
    updateConfig(bot.id, { rateLimit: { enabled, perHour, perDay, action } });
    setSaved(true);
    setTimeout(() => setSaved(false), 2_000);
  }

  return (
    <div className="space-y-5">
      {/* Enable toggle */}
      <label className="flex items-center justify-between p-4 bg-canvas rounded-xl cursor-pointer">
        <div>
          <p className="text-sm font-semibold text-slate-800">Enable Rate Limiting</p>
          <p className="text-xs text-ink-2 mt-0.5">Enforce request limits for this bot</p>
        </div>
        <button onClick={() => setEnabled(v => !v)}
          className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${enabled ? 'bg-brand-dark' : 'bg-slate-200'}`}>
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-5' : ''}`} />
        </button>
      </label>

      {/* Limits */}
      <div className={`space-y-3 transition-opacity ${enabled ? '' : 'opacity-40 pointer-events-none'}`}>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-ink-2 uppercase tracking-wide">Requests / Hour</label>
            <input type="number" min="1" value={perHour} onChange={e => setPerHour(parseInt(e.target.value)||1)}
              className="mt-1.5 w-full px-3 py-2.5 rounded-lg border border-edge text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-dark/30 focus:border-brand-dark" />
          </div>
          <div>
            <label className="text-xs font-semibold text-ink-2 uppercase tracking-wide">Requests / Day</label>
            <input type="number" min="1" value={perDay} onChange={e => setPerDay(parseInt(e.target.value)||1)}
              className="mt-1.5 w-full px-3 py-2.5 rounded-lg border border-edge text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-dark/30 focus:border-brand-dark" />
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-ink-2 uppercase tracking-wide mb-2">When Limit Exceeded</p>
          <div className="space-y-2">
            {[
              { val:'block',    label:'Block temporarily', desc:'Return 403 until next window resets' },
              { val:'throttle', label:'Return 429',        desc:'Send Too Many Requests response' },
              { val:'log',      label:'Allow but log',     desc:'Serve content, record the violation' },
            ].map(opt => (
              <label key={opt.val}
                className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${action === opt.val ? 'border-brand-dark bg-brand-dark/5' : 'border-edge hover:border-slate-300'}`}>
                <input type="radio" className="mt-0.5 accent-brand-dark shrink-0"
                  checked={action === opt.val} onChange={() => setAction(opt.val as typeof action)} />
                <div>
                  <p className="text-sm font-semibold text-slate-800">{opt.label}</p>
                  <p className="text-xs text-ink-2">{opt.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>
      </div>

      <button onClick={save}
        className={`w-full py-2.5 rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2 ${saved ? 'bg-emerald-600 text-white' : 'bg-brand-dark text-white hover:bg-brand-mid'}`}>
        {saved ? <><Check className="w-4 h-4" /> Saved!</> : 'Save Rate Limit Settings'}
      </button>
    </div>
  );
}

function HistoryTab({ bot }: { bot: BotDef }) {
  // Mock recent request events
  const events = Array.from({ length: 12 }, (_, i) => {
    const paid    = i % 3 !== 0;
    const msAgo   = i * 4_500_000 + Math.sin(i) * 600_000;
    const paths   = ['/blog/ai-guide','/docs/api','/pricing','/research','/blog/seo-tips'];
    return {
      id:        `evt-${i}`,
      path:      paths[i % paths.length]!,
      status:    paid ? 'paid' : 'allowed',
      amount:    paid ? bot.rev7d / bot.req7d : 0,
      timestamp: new Date(Date.now() - Math.abs(msAgo)),
    };
  });

  return (
    <div className="space-y-4">
      <p className="text-xs text-ink-3 flex items-center gap-1.5">
        <History className="w-3.5 h-3.5" /> Recent requests (demo data)
      </p>
      <div className="space-y-0 divide-y divide-slate-50 rounded-xl border border-edge-2 overflow-hidden">
        {events.map(e => (
          <div key={e.id} className="flex items-center gap-3 px-4 py-3 hover:bg-canvas transition-colors text-sm">
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${e.status === 'paid' ? 'bg-emerald-500' : 'bg-slate-300'}`} />
            <span className="font-mono text-xs text-ink-2 flex-1 truncate">{e.path}</span>
            <span className={`text-xs font-semibold ${e.status === 'paid' ? 'text-emerald-600' : 'text-ink-3'}`}>
              {e.status === 'paid' ? `+${formatUsdcDollar(e.amount)}` : 'free'}
            </span>
            <span className="text-xs text-ink-3 shrink-0">{timeAgo(e.timestamp)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'access' | 'rate-limit' | 'history';

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id:'overview',   label:'Overview',     icon: Activity  },
  { id:'access',     label:'Access',       icon: Shield    },
  { id:'rate-limit', label:'Rate Limit',   icon: Zap       },
  { id:'history',    label:'History',      icon: Clock     },
];

interface BotDetailModalProps {
  bot:     BotDef;
  onClose: () => void;
}

export default function BotDetailModal({ bot, onClose }: BotDetailModalProps) {
  const [tab, setTab] = useState<Tab>('overview');
  const { getConfig, resetConfig } = useBotStore();
  const cfg = getConfig(bot.id);

  const statusColor = cfg.status === 'allowed' ? 'bg-emerald-100 text-emerald-700' : cfg.status === 'blocked' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-surface rounded-2xl shadow-popover w-full max-w-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-edge-2 shrink-0">
          <div className="flex items-start gap-3">
            {/* Bot initial avatar */}
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${TYPE_COLORS[bot.type] ?? 'bg-slate-100 text-ink-2'}`}>
              {bot.name[0]}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-bold text-ink text-base">{bot.name}</h2>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${statusColor}`}>
                  {cfg.status}
                </span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${CONFIDENCE_COLORS[bot.confidence]}`}>
                  {bot.confidence} confidence
                </span>
              </div>
              <p className="text-xs text-ink-2 mt-0.5">{bot.company} · {TYPE_LABELS[bot.type]}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => resetConfig(bot.id)}
              className="text-xs text-ink-3 hover:text-ink-2 transition-colors px-2 py-1 rounded hover:bg-slate-100">
              Reset
            </button>
            <button onClick={onClose} className="text-ink-3 hover:text-ink-2 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex border-b border-edge-2 px-6 shrink-0 bg-canvas">
          {TABS.map(t => {
            const Icon = t.icon;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-all -mb-px ${
                  tab === t.id
                    ? 'border-brand-dark text-brand-dark'
                    : 'border-transparent text-ink-2 hover:text-slate-800'
                }`}>
                <Icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Tab body */}
        <div className="flex-1 overflow-y-auto p-6">
          {tab === 'overview'   && <OverviewTab   bot={bot} />}
          {tab === 'access'     && <AccessTab     bot={bot} />}
          {tab === 'rate-limit' && <RateLimitTab  bot={bot} />}
          {tab === 'history'    && <HistoryTab     bot={bot} />}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-edge-2 shrink-0 flex items-center justify-between text-xs text-ink-3">
          <span className="flex items-center gap-1.5">
            {cfg.accessLevel === 'free'   && <><Unlock className="w-3 h-3 text-emerald-500" /> Always Free</>}
            {cfg.accessLevel === 'custom' && <><Settings2 className="w-3 h-3 text-brand-dark" /> Custom Pricing</>}
            {cfg.accessLevel === 'default' && <>Default pricing</>}
          </span>
          {cfg.status === 'blocked' && (
            <span className="flex items-center gap-1 text-red-500">
              <Lock className="w-3 h-3" /> Blocked
            </span>
          )}
          <span>Last updated {timeAgo(new Date(cfg.updatedAt))}</span>
        </div>
      </div>
    </div>
  );
}
