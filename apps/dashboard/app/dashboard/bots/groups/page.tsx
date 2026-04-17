'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Users, Plus, Edit2, Check, X, Trash2 } from 'lucide-react';
import { useBotStore, ALL_BOTS } from '@/lib/botStore';
import type { BotGroup, BotStatus, AccessLevel } from '@/lib/botStore';
import { formatUsdcDollar, compactNumber } from '@/lib/formatters';

// ── Constants ─────────────────────────────────────────────────────────────────

const GROUP_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  violet:  { bg:'bg-violet-50',  text:'text-violet-700',  border:'border-violet-200' },
  sky:     { bg:'bg-sky-50',     text:'text-sky-700',     border:'border-sky-200'    },
  amber:   { bg:'bg-amber-50',   text:'text-amber-700',   border:'border-amber-200'  },
  emerald: { bg:'bg-emerald-50', text:'text-emerald-700', border:'border-emerald-200'},
  red:     { bg:'bg-red-50',     text:'text-red-600',     border:'border-red-200'    },
  slate:   { bg:'bg-canvas',   text:'text-ink-2',   border:'border-edge'  },
};

const STATUS_BADGE: Record<BotStatus, string> = {
  allowed: 'bg-emerald-100 text-emerald-700',
  blocked: 'bg-red-100 text-red-600',
  pending: 'bg-amber-100 text-amber-700',
};

// ── Group card ────────────────────────────────────────────────────────────────

function GroupCard({ group }: { group: BotGroup }) {
  const { updateGroup, getConfig, setBulkStatus } = useBotStore();
  const [editing, setEditing]   = useState(false);
  const [name,    setName]      = useState(group.name);
  const [status,  setStatus]    = useState<BotStatus>(group.policy.status);
  const [access,  setAccess]    = useState<AccessLevel>(group.policy.accessLevel);
  const colors = GROUP_COLORS[group.color] ?? GROUP_COLORS.slate!;

  const members = ALL_BOTS.filter(b => group.botIds.includes(b.id));
  const totalRev = members.reduce((s, b) => s + b.rev7d, 0);
  const totalReq = members.reduce((s, b) => s + b.req7d, 0);

  function save() {
    updateGroup(group.id, { name, policy: { status, accessLevel: access } });
    setBulkStatus(group.botIds, status);
    setEditing(false);
  }

  return (
    <div className={`bg-white rounded-xl border ${colors.border} overflow-hidden`}>
      {/* Header */}
      <div className={`px-5 py-3.5 flex items-center justify-between ${colors.bg}`}>
        <div className="flex items-center gap-2.5">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${colors.bg} ${colors.border} border`}>
            <Users className={`w-4 h-4 ${colors.text}`} />
          </div>
          {editing ? (
            <input value={name} onChange={e => setName(e.target.value)} autoFocus
              className="font-bold text-ink bg-white border border-edge rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-brand-dark/30" />
          ) : (
            <span className="font-bold text-ink">{group.name}</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {editing ? (
            <>
              <button onClick={save} className="p-1.5 rounded-lg bg-brand-dark text-white hover:bg-brand-mid transition-colors">
                <Check className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => { setEditing(false); setName(group.name); }} className="p-1.5 rounded-lg text-ink-2 hover:bg-slate-200 transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            </>
          ) : (
            <button onClick={() => setEditing(true)} className={`p-1.5 rounded-lg hover:${colors.bg} transition-colors ${colors.text}`}>
              <Edit2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="px-5 py-3 border-b border-edge-2 flex gap-6 text-sm">
        <div>
          <p className="text-xs text-ink-3">Members</p>
          <p className="font-semibold text-slate-800">{members.length} bots</p>
        </div>
        <div>
          <p className="text-xs text-ink-3">Requests (7d)</p>
          <p className="font-semibold text-slate-800">{compactNumber(totalReq)}</p>
        </div>
        <div>
          <p className="text-xs text-ink-3">Revenue (7d)</p>
          <p className="font-semibold text-brand-dark">{totalRev > 0 ? formatUsdcDollar(totalRev) : '—'}</p>
        </div>
      </div>

      {/* Policy controls */}
      <div className="px-5 py-3 border-b border-edge-2 flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-ink-2 font-medium">Status:</span>
          {(['allowed','blocked','pending'] as BotStatus[]).map(s => (
            <button key={s} onClick={() => { setStatus(s); if (!editing) { updateGroup(group.id, { policy: { ...group.policy, status: s } }); setBulkStatus(group.botIds, s); } }}
              className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize border transition-colors ${status === s ? STATUS_BADGE[s] + ' border-transparent' : 'border-edge text-ink-3 hover:border-slate-300'}`}>
              {s}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5 ml-auto">
          <span className="text-xs text-ink-2 font-medium">Tier:</span>
          {(['default','free','custom'] as AccessLevel[]).map(a => (
            <button key={a} onClick={() => { setAccess(a); if (!editing) updateGroup(group.id, { policy: { ...group.policy, accessLevel: a } }); }}
              className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize border transition-colors ${access === a ? 'bg-brand-dark text-white border-brand-dark' : 'border-edge text-ink-3 hover:border-slate-300'}`}>
              {a}
            </button>
          ))}
        </div>
      </div>

      {/* Members list */}
      <div className="px-5 py-3">
        <div className="flex flex-wrap gap-1.5">
          {members.map(b => {
            const cfg = getConfig(b.id);
            return (
              <span key={b.id}
                className={`text-xs px-2 py-1 rounded-full border font-medium ${STATUS_BADGE[cfg.status]} border-transparent`}>
                {b.name}
              </span>
            );
          })}
          {members.length === 0 && (
            <span className="text-xs text-ink-3 italic">No members</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function BotGroupsPage() {
  const { groups } = useBotStore();

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/bots/manage"
          className="text-ink-3 hover:text-ink transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-ink">Bot Groups</h1>
          <p className="text-sm text-ink-2 mt-0.5">Apply bulk settings to categories of bots</p>
        </div>
        <button className="ml-auto flex items-center gap-1.5 text-sm font-semibold text-white bg-brand-dark hover:bg-brand-mid px-3 py-2 rounded-xl transition-colors">
          <Plus className="w-4 h-4" /> New Group
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {groups.map(g => <GroupCard key={g.id} group={g} />)}
      </div>

      <div className="bg-canvas rounded-xl border border-edge p-5 text-sm text-ink-2">
        <p className="font-semibold text-ink mb-1 flex items-center gap-1.5"><Users className="w-4 h-4" /> About Groups</p>
        <p>Groups let you apply access policies to many bots at once. Changes to a group&apos;s status or tier propagate to all member bots immediately. Individual overrides still apply per-bot.</p>
      </div>
    </div>
  );
}
